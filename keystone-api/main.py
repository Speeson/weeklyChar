import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
import bcrypt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from models import Character, Keystone, Team, TeamMember, User

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "change-this-secret-key")
ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 30

Base.metadata.create_all(bind=engine)

app = FastAPI(title="KeystoneSync API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_bearer = HTTPBearer()
_bearer_optional = HTTPBearer(auto_error=False)


# --- Auth helpers ---

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())

def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": str(user_id), "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

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
    username: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

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

class CreateTeamRequest(BaseModel):
    name: str

class JoinTeamRequest(BaseModel):
    invite_code: str


# --- Auth endpoints ---

@app.post("/api/auth/register", status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if len(payload.username) < 3:
        raise HTTPException(400, "El nombre de usuario debe tener al menos 3 caracteres")
    if len(payload.password) < 6:
        raise HTTPException(400, "La contraseña debe tener al menos 6 caracteres")
    if db.query(User).filter_by(username=payload.username).first():
        raise HTTPException(400, "Nombre de usuario ya en uso")
    user = User(username=payload.username, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "username": user.username, "syncToken": user.sync_token}

@app.post("/api/auth/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(username=payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "Credenciales incorrectas")
    return {"accessToken": create_access_token(user.id), "tokenType": "bearer"}


# --- Me endpoints ---

@app.get("/api/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "syncToken": current_user.sync_token,
    }

@app.get("/api/me/characters")
def get_my_characters(
    current_user: User = Depends(get_current_user),
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

def _character_response(c: Character):
    latest = c.keystones[-1] if c.keystones else None
    return {
        "id": c.id,
        "name": c.name,
        "realm": c.realm,
        "region": c.region,
        "currentKeystone": _keystone_dict(latest) if latest else None,
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
