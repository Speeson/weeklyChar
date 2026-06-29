import os
import json
import hashlib
import html as html_lib
import re
import secrets
import urllib.error
import urllib.request
from collections import defaultdict, deque
from datetime import date
from datetime import datetime, timedelta, timezone
from time import time
from typing import Any, Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
import bcrypt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from sqlalchemy import inspect, text
from database import Base, engine, get_db
from models import Character, Keystone, Team, TeamMember, User

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "change-this-secret-key")
ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 30
EMAIL_TOKEN_EXPIRE_HOURS = 24
PASSWORD_RESET_EXPIRE_MINUTES = 60
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
EMAIL_FROM = os.getenv("EMAIL_FROM", "KeystoneSync <noreply@keystonesync.esgarpe.dev>")
WEB_BASE_URL = os.getenv("WEB_BASE_URL", "http://localhost:3000").rstrip("/")
PASSWORD_RESET_IP_LIMIT = int(os.getenv("PASSWORD_RESET_IP_LIMIT", "5"))
PASSWORD_RESET_IP_WINDOW_SECONDS = int(os.getenv("PASSWORD_RESET_IP_WINDOW_SECONDS", "900"))
PASSWORD_RESET_IDENTITY_LIMIT = int(os.getenv("PASSWORD_RESET_IDENTITY_LIMIT", "3"))
PASSWORD_RESET_IDENTITY_WINDOW_SECONDS = int(os.getenv("PASSWORD_RESET_IDENTITY_WINDOW_SECONDS", "3600"))
PASSWORD_RESET_COOLDOWN_SECONDS = int(os.getenv("PASSWORD_RESET_COOLDOWN_SECONDS", "120"))

Base.metadata.create_all(bind=engine)

def _add_column_if_missing(conn, table_name: str, column_name: str, column_sql: str):
    existing = {column["name"] for column in inspect(conn).get_columns(table_name)}
    if column_name in existing:
        return
    conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_sql}"))

with engine.connect() as _conn:
    for _table, _column, _definition in [
        ("users", "avatar_url", "VARCHAR(512)"),
        ("users", "first_name", "VARCHAR(100)"),
        ("users", "last_name", "VARCHAR(150)"),
        ("users", "email", "VARCHAR(255)"),
        ("users", "date_of_birth", "DATE"),
        ("users", "email_verified", "BOOLEAN DEFAULT TRUE NOT NULL"),
        ("users", "email_verification_token_hash", "VARCHAR(64)"),
        ("users", "email_verification_expires_at", "TIMESTAMP"),
        ("users", "password_reset_token_hash", "VARCHAR(64)"),
        ("users", "password_reset_expires_at", "TIMESTAMP"),
        ("characters", "avatar_url", "VARCHAR(512)"),
        ("characters", "wow_account", "VARCHAR(100)"),
        ("characters", "rio_score", "FLOAT"),
        ("characters", "wow_class", "VARCHAR(50)"),
        ("characters", "ilvl", "INTEGER"),
        ("characters", "vault_json", "TEXT"),
        ("characters", "prey_hunts_json", "TEXT"),
        ("characters", "currencies_json", "TEXT"),
        ("characters", "money_json", "TEXT"),
        ("characters", "mythic_plus_season_json", "TEXT"),
    ]:
        _add_column_if_missing(_conn, _table, _column, _definition)
    _conn.commit()

app = FastAPI(title="KeystoneSync API")

_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
_allowed_origins = [o.strip() for o in _raw_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

_bearer = HTTPBearer()
_bearer_optional = HTTPBearer(auto_error=False)


# --- Auth helpers ---

_rate_limit_attempts: dict[str, deque[float]] = defaultdict(deque)


def _get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _rate_limit_key(scope: str, value: str) -> str:
    return f"{scope}:{hashlib.sha256(value.encode('utf-8')).hexdigest()}"


def _check_rate_limit(key: str, limit: int, window_seconds: int, now: Optional[float] = None):
    current = now if now is not None else time()
    attempts = _rate_limit_attempts[key]

    while attempts and current - attempts[0] >= window_seconds:
        attempts.popleft()

    if len(attempts) >= limit:
        raise HTTPException(
            status_code=429,
            detail="Demasiados intentos. Espera unos minutos antes de volver a probar.",
        )

    attempts.append(current)


def _check_email_rate_limits(request: Request, action: str, identity: str):
    normalized_identity = identity.strip().lower()
    client_ip = _get_client_ip(request)

    _check_rate_limit(
        _rate_limit_key(f"{action}:ip", client_ip),
        PASSWORD_RESET_IP_LIMIT,
        PASSWORD_RESET_IP_WINDOW_SECONDS,
    )
    _check_rate_limit(
        _rate_limit_key(f"{action}:identity", normalized_identity),
        PASSWORD_RESET_IDENTITY_LIMIT,
        PASSWORD_RESET_IDENTITY_WINDOW_SECONDS,
    )
    _check_rate_limit(
        _rate_limit_key(f"{action}:cooldown", normalized_identity),
        1,
        PASSWORD_RESET_COOLDOWN_SECONDS,
    )

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())

def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": str(user_id), "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

def _normalize_email(email: str) -> str:
    return email.strip().lower()

def _is_valid_email(email: str) -> bool:
    return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email))

def _new_plain_token() -> str:
    return secrets.token_urlsafe(32)

def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def _send_email(to_email: str, subject: str, html: str, text: str):
    if not RESEND_API_KEY:
        raise HTTPException(500, "Servicio de email no configurado")

    payload = json.dumps({
        "from": EMAIL_FROM,
        "to": [to_email],
        "subject": subject,
        "html": html,
        "text": text,
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json",
            "User-Agent": "KeystoneSync/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            if response.status >= 300:
                raise HTTPException(502, "No se pudo enviar el email")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise HTTPException(502, f"No se pudo enviar el email: {detail or exc.reason}")
    except urllib.error.URLError:
        raise HTTPException(502, "No se pudo conectar con el servicio de email")

def _send_verification_email(user: User, token: str):
    link = f"{WEB_BASE_URL}/verify-email?token={token}"
    safe_username = html_lib.escape(user.username)
    subject = "Verifica tu cuenta de KeystoneSync"
    text = (
        f"Hola {user.username},\n\n"
        "Confirma tu cuenta de KeystoneSync abriendo este enlace:\n"
        f"{link}\n\n"
        "Este enlace caduca en 24 horas."
    )
    email_html = f"""
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
      <h2>Verifica tu cuenta de KeystoneSync</h2>
      <p>Hola <strong>{safe_username}</strong>, confirma tu cuenta para poder iniciar sesion.</p>
      <p><a href="{link}" style="display:inline-block;background:#f59e0b;color:#111827;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:bold">Verificar cuenta</a></p>
      <p>Si el boton no funciona, copia este enlace:</p>
      <p>{link}</p>
      <p>Este enlace caduca en 24 horas.</p>
    </div>
    """
    _send_email(user.email, subject, email_html, text)

def _send_password_reset_email(user: User, token: str):
    link = f"{WEB_BASE_URL}/reset-password?token={token}"
    safe_username = html_lib.escape(user.username)
    subject = "Recupera tu password de KeystoneSync"
    text = (
        f"Hola {user.username},\n\n"
        "Puedes establecer una nueva password desde este enlace:\n"
        f"{link}\n\n"
        "Este enlace caduca en 60 minutos."
    )
    email_html = f"""
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
      <h2>Recupera tu password de KeystoneSync</h2>
      <p>Hola <strong>{safe_username}</strong>, usa este enlace para establecer una nueva password.</p>
      <p><a href="{link}" style="display:inline-block;background:#f59e0b;color:#111827;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:bold">Cambiar password</a></p>
      <p>Si el boton no funciona, copia este enlace:</p>
      <p>{link}</p>
      <p>Este enlace caduca en 60 minutos.</p>
    </div>
    """
    _send_email(user.email, subject, email_html, text)

def _is_expired(value: Optional[datetime]) -> bool:
    if not value:
        return True
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value < datetime.now(timezone.utc)

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Token inválido")
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return user

def get_current_user_flexible(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    """Accepts either a JWT access token or a sync token."""
    token = credentials.credentials
    # Try JWT first
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user = db.query(User).filter_by(id=int(payload["sub"])).first()
        if user:
            return user
    except (JWTError, KeyError, ValueError):
        pass
    # Fall back to sync token
    user = db.query(User).filter_by(sync_token=token).first()
    if user:
        return user
    raise HTTPException(status_code=401, detail="Token inválido")

def get_user_by_sync_token(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    user = db.query(User).filter_by(sync_token=credentials.credentials).first()
    if not user:
        raise HTTPException(status_code=401, detail="Sync token inválido")
    return user


# --- Schemas ---

class RegisterRequest(BaseModel):
    firstName: str
    lastName: str
    email: str
    username: str
    password: str
    confirmPassword: str
    dateOfBirth: date

class LoginRequest(BaseModel):
    username: str
    password: str

class VerifyEmailRequest(BaseModel):
    token: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    password: str
    confirmPassword: str

class ResendVerificationRequest(BaseModel):
    emailOrUsername: str

class ChangePasswordRequest(BaseModel):
    currentPassword: str
    password: str
    confirmPassword: str

class KeystoneUpdateRequest(BaseModel):
    character: str
    realm: str
    region: str = "eu"
    hasKeystone: bool = False
    keystoneLevel: Optional[int] = None
    keystoneChallengeMapId: Optional[int] = None
    keystoneMapId: Optional[int] = None
    keystoneDungeon: Optional[str] = None
    updatedAt: Optional[int] = None
    updatedReason: Optional[str] = None
    wowAccount: Optional[str] = None
    avatarUrl: Optional[str] = None
    rioScore: Optional[float] = None
    wowClass: Optional[str] = None
    ilvl: Optional[int] = None
    vault: Optional[dict[str, Any]] = None
    preyHunts: Optional[dict[str, Any]] = None
    currencies: Optional[dict[str, Any]] = None
    money: Optional[dict[str, Any]] = None
    mythicPlusSeason: Optional[dict[str, Any]] = None

class AvatarUpdateRequest(BaseModel):
    avatarUrl: str

class CharacterEnrichRequest(BaseModel):
    name: str
    realm: str
    region: str = "eu"
    avatarUrl: Optional[str] = None
    rioScore: Optional[float] = None
    wowClass: Optional[str] = None
    ilvl: Optional[int] = None
    vault: Optional[dict[str, Any]] = None
    preyHunts: Optional[dict[str, Any]] = None
    currencies: Optional[dict[str, Any]] = None
    money: Optional[dict[str, Any]] = None
    mythicPlusSeason: Optional[dict[str, Any]] = None

class CreateTeamRequest(BaseModel):
    name: str

class JoinTeamRequest(BaseModel):
    invite_code: str


# --- Auth endpoints ---

@app.post("/api/auth/register", status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    username = payload.username.strip()
    first_name = payload.firstName.strip()
    last_name = payload.lastName.strip()
    email = _normalize_email(payload.email)

    if len(username) < 3:
        raise HTTPException(400, "El nombre de usuario debe tener al menos 3 caracteres")
    if not first_name or not last_name:
        raise HTTPException(400, "Nombre y apellidos son obligatorios")
    if not _is_valid_email(email):
        raise HTTPException(400, "Email invalido")
    if len(payload.password) < 6:
        raise HTTPException(400, "La password debe tener al menos 6 caracteres")
    if payload.password != payload.confirmPassword:
        raise HTTPException(400, "Las passwords no coinciden")
    if payload.dateOfBirth >= date.today():
        raise HTTPException(400, "Fecha de nacimiento invalida")
    if db.query(User).filter_by(username=username).first():
        raise HTTPException(400, "Nombre de usuario ya en uso")
    if db.query(User).filter_by(email=email).first():
        raise HTTPException(400, "Email ya en uso")

    token = _new_plain_token()
    user = User(
        username=username,
        password_hash=hash_password(payload.password),
        first_name=first_name,
        last_name=last_name,
        email=email,
        date_of_birth=payload.dateOfBirth,
        email_verified=False,
        email_verification_token_hash=_hash_token(token),
        email_verification_expires_at=datetime.now(timezone.utc) + timedelta(hours=EMAIL_TOKEN_EXPIRE_HOURS),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    try:
        _send_verification_email(user, token)
    except HTTPException:
        db.delete(user)
        db.commit()
        raise
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "emailVerified": user.email_verified,
        "message": "Cuenta creada. Revisa tu email para verificarla.",
    }

@app.post("/api/auth/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(username=payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "Credenciales incorrectas")
    if user.email and not user.email_verified:
        raise HTTPException(403, "Email no verificado. Revisa tu correo antes de iniciar sesion.")
    return {"accessToken": create_access_token(user.id), "tokenType": "bearer"}

@app.post("/api/auth/verify-email")
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)):
    token_hash = _hash_token(payload.token.strip())
    user = db.query(User).filter_by(email_verification_token_hash=token_hash).first()
    if not user or _is_expired(user.email_verification_expires_at):
        raise HTTPException(400, "Link de verificacion invalido o caducado")

    user.email_verified = True
    user.email_verification_token_hash = None
    user.email_verification_expires_at = None
    db.commit()
    return {"message": "Email verificado correctamente"}

@app.post("/api/auth/resend-verification")
def resend_verification(
    payload: ResendVerificationRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    value = payload.emailOrUsername.strip()
    _check_email_rate_limits(request, "resend_verification", value)
    normalized = _normalize_email(value)
    user = db.query(User).filter_by(email=normalized).first()
    if not user:
        user = db.query(User).filter_by(username=value).first()

    if user and user.email and not user.email_verified:
        token = _new_plain_token()
        user.email_verification_token_hash = _hash_token(token)
        user.email_verification_expires_at = datetime.now(timezone.utc) + timedelta(hours=EMAIL_TOKEN_EXPIRE_HOURS)
        db.commit()
        _send_verification_email(user, token)

    return {"message": "Si la cuenta existe y esta pendiente, recibiras un nuevo email de verificacion."}

@app.post("/api/auth/forgot-password")
def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    email = _normalize_email(payload.email)
    _check_email_rate_limits(request, "forgot_password", email)
    user = db.query(User).filter_by(email=email).first()
    if user:
        token = _new_plain_token()
        user.password_reset_token_hash = _hash_token(token)
        user.password_reset_expires_at = datetime.now(timezone.utc) + timedelta(minutes=PASSWORD_RESET_EXPIRE_MINUTES)
        db.commit()
        _send_password_reset_email(user, token)
    return {"message": "Si el email existe, recibiras un enlace para recuperar la password."}

@app.post("/api/auth/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    if len(payload.password) < 6:
        raise HTTPException(400, "La password debe tener al menos 6 caracteres")
    if payload.password != payload.confirmPassword:
        raise HTTPException(400, "Las passwords no coinciden")

    token_hash = _hash_token(payload.token.strip())
    user = db.query(User).filter_by(password_reset_token_hash=token_hash).first()
    if not user or _is_expired(user.password_reset_expires_at):
        raise HTTPException(400, "Link de recuperacion invalido o caducado")

    user.password_hash = hash_password(payload.password)
    user.password_reset_token_hash = None
    user.password_reset_expires_at = None
    db.commit()
    return {"message": "Password actualizada correctamente"}

@app.post("/api/me/change-password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.currentPassword, current_user.password_hash):
        raise HTTPException(400, "La password actual no es correcta")
    if len(payload.password) < 6:
        raise HTTPException(400, "La nueva password debe tener al menos 6 caracteres")
    if payload.password != payload.confirmPassword:
        raise HTTPException(400, "Las passwords no coinciden")

    current_user.password_hash = hash_password(payload.password)
    current_user.password_reset_token_hash = None
    current_user.password_reset_expires_at = None
    db.commit()
    return {"message": "Password actualizada correctamente"}


# --- Me endpoints ---

@app.get("/api/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "syncToken": current_user.sync_token,
        "avatarUrl": current_user.avatar_url,
        "firstName": current_user.first_name,
        "lastName": current_user.last_name,
        "email": current_user.email,
        "dateOfBirth": current_user.date_of_birth.isoformat() if current_user.date_of_birth else None,
        "emailVerified": current_user.email_verified,
    }

@app.post("/api/me/characters/enrich")
def enrich_character(
    payload: CharacterEnrichRequest,
    current_user: User = Depends(get_current_user_flexible),
    db: Session = Depends(get_db),
):
    character = db.query(Character).filter_by(
        user_id=current_user.id,
        name=payload.name,
        realm=payload.realm,
        region=payload.region,
    ).first()
    if not character:
        raise HTTPException(404, "Personaje no encontrado")
    if payload.avatarUrl is not None:
        character.avatar_url = payload.avatarUrl
    if payload.rioScore is not None:
        character.rio_score = payload.rioScore
    if payload.wowClass is not None:
        character.wow_class = payload.wowClass
    if payload.ilvl is not None:
        character.ilvl = payload.ilvl
    if payload.vault is not None:
        character.vault_json = _json_dump(payload.vault)
    if payload.preyHunts is not None:
        character.prey_hunts_json = _json_dump(payload.preyHunts)
    if payload.currencies is not None:
        character.currencies_json = _json_dump(payload.currencies)
    if payload.money is not None:
        character.money_json = _json_dump(payload.money)
    if payload.mythicPlusSeason is not None:
        character.mythic_plus_season_json = _json_dump(payload.mythicPlusSeason)
    db.commit()
    return {"status": "ok"}

@app.patch("/api/me/avatar")
def update_avatar(
    payload: AvatarUpdateRequest,
    current_user: User = Depends(get_current_user_flexible),
    db: Session = Depends(get_db),
):
    current_user.avatar_url = payload.avatarUrl
    db.commit()
    return {"status": "ok", "avatarUrl": payload.avatarUrl}

@app.get("/api/me/characters")
def get_my_characters(
    current_user: User = Depends(get_current_user_flexible),
    db: Session = Depends(get_db),
):
    characters = db.query(Character).filter_by(user_id=current_user.id).order_by(Character.name).all()
    return [_character_response(c) for c in characters]


# --- Keystone sync endpoint ---

@app.post("/api/keystones/update")
def update_keystone(
    payload: KeystoneUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_user_by_sync_token),
):
    character = db.query(Character).filter_by(
        user_id=current_user.id,
        name=payload.character,
        realm=payload.realm,
        region=payload.region,
    ).first()

    if not character:
        character = Character(
            user_id=current_user.id,
            name=payload.character,
            realm=payload.realm,
            region=payload.region,
        )
        db.add(character)
        db.flush()

    character.updated_at = datetime.now(timezone.utc)
    if payload.wowAccount is not None:
        character.wow_account = payload.wowAccount
    if payload.avatarUrl is not None:
        character.avatar_url = payload.avatarUrl
    if payload.rioScore is not None:
        character.rio_score = payload.rioScore
    if payload.wowClass is not None:
        character.wow_class = payload.wowClass
    if payload.ilvl is not None:
        character.ilvl = payload.ilvl
    if payload.vault is not None:
        character.vault_json = _json_dump(payload.vault)
    if payload.preyHunts is not None:
        character.prey_hunts_json = _json_dump(payload.preyHunts)
    if payload.currencies is not None:
        character.currencies_json = _json_dump(payload.currencies)
    if payload.money is not None:
        character.money_json = _json_dump(payload.money)
    if payload.mythicPlusSeason is not None:
        character.mythic_plus_season_json = _json_dump(payload.mythicPlusSeason)

    latest = _latest_real_keystone(character)
    is_newer = (
        latest is None
        or latest.updated_at is None
        or payload.updatedAt is None
        or payload.updatedAt > latest.updated_at
    )
    has_real_keystone = payload.hasKeystone and payload.keystoneLevel is not None

    if is_newer and has_real_keystone:
        keystone = Keystone(
            character_id=character.id,
            has_keystone=payload.hasKeystone,
            keystone_level=payload.keystoneLevel,
            keystone_challenge_map_id=payload.keystoneChallengeMapId,
            keystone_map_id=payload.keystoneMapId,
            keystone_dungeon=payload.keystoneDungeon,
            updated_reason=payload.updatedReason,
            updated_at=payload.updatedAt,
        )
        db.add(keystone)

    db.commit()

    return {"status": "ok", "message": "Keystone updated", "character": payload.character, "realm": payload.realm}


# --- Teams endpoints ---

@app.get("/api/teams")
def list_teams(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    memberships = db.query(TeamMember).filter_by(user_id=current_user.id).all()
    return [_team_response(m.team, current_user) for m in memberships]

@app.post("/api/teams", status_code=201)
def create_team(
    payload: CreateTeamRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    team = Team(name=payload.name, created_by=current_user.id)
    db.add(team)
    db.flush()
    db.add(TeamMember(team_id=team.id, user_id=current_user.id))
    db.commit()
    db.refresh(team)
    return _team_response(team, current_user)

@app.post("/api/teams/join")
def join_team(
    payload: JoinTeamRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    team = db.query(Team).filter_by(invite_code=payload.invite_code).first()
    if not team:
        raise HTTPException(404, "Código de invitación no válido")
    already = db.query(TeamMember).filter_by(team_id=team.id, user_id=current_user.id).first()
    if already:
        raise HTTPException(400, "Ya eres miembro de este team")
    db.add(TeamMember(team_id=team.id, user_id=current_user.id))
    db.commit()
    return _team_response(team, current_user)

@app.get("/api/teams/{team_id}")
def get_team(
    team_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = db.query(TeamMember).filter_by(team_id=team_id, user_id=current_user.id).first()
    if not membership:
        raise HTTPException(403, "No perteneces a este team")
    return _team_detail_response(membership.team, current_user)


# --- Helpers ---

def _keystone_dict(k: Keystone):
    return {
        "level": k.keystone_level,
        "dungeon": k.keystone_dungeon,
        "challengeMapId": k.keystone_challenge_map_id,
        "mapId": k.keystone_map_id,
        "updatedAt": k.updated_at,
        "updatedReason": k.updated_reason,
    }

def _latest_real_keystone(c: Character):
    real_keystones = [
        k for k in c.keystones
        if k.has_keystone and k.keystone_level is not None
    ]
    if not real_keystones:
        return None
    return max(real_keystones, key=lambda k: (k.updated_at or 0, k.id or 0))

def _json_dump(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))

def _json_load(value):
    if not value:
        return None
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return None

def _character_response(c: Character):
    latest = _latest_real_keystone(c)
    return {
        "id": c.id,
        "name": c.name,
        "realm": c.realm,
        "region": c.region,
        "wowAccount": c.wow_account,
        "avatarUrl": c.avatar_url,
        "rioScore": c.rio_score,
        "wowClass": c.wow_class,
        "ilvl": c.ilvl,
        "currentKeystone": _keystone_dict(latest) if latest else None,
        "vault": _json_load(c.vault_json),
        "preyHunts": _json_load(c.prey_hunts_json),
        "currencies": _json_load(c.currencies_json),
        "money": _json_load(c.money_json),
        "mythicPlusSeason": _json_load(c.mythic_plus_season_json),
    }

def _team_response(team: Team, current_user: User):
    return {
        "id": team.id,
        "name": team.name,
        "inviteCode": team.invite_code,
        "isOwner": team.created_by == current_user.id,
        "memberCount": len(team.members),
    }

def _team_detail_response(team: Team, current_user: User):
    members = []
    for m in team.members:
        characters = db_characters_for_user(m.user_id, m.user)
        members.append({
            "userId": m.user.id,
            "username": m.user.username,
            "characters": characters,
        })
    return {
        "id": team.id,
        "name": team.name,
        "inviteCode": team.invite_code,
        "isOwner": team.created_by == current_user.id,
        "members": members,
    }

def db_characters_for_user(user_id: int, user: User):
    return [_character_response(c) for c in sorted(user.characters, key=lambda c: c.name)]
