from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

import config as config_module


AUTH_INVALID_CREDENTIALS = "AUTH_INVALID_CREDENTIALS"
AUTH_CONNECTION_ERROR = "AUTH_CONNECTION_ERROR"
AUTH_SERVER_ERROR = "AUTH_SERVER_ERROR"
AUTH_INVALID_RESPONSE = "AUTH_INVALID_RESPONSE"


@dataclass(frozen=True)
class AuthError(Exception):
    code: str
    message: str


def get_public_auth_state(cfg: dict[str, Any]) -> dict[str, Any]:
    if not config_module.is_session_valid(cfg):
        return {
            "authenticated": False,
            "username": None,
            "avatarUrl": None,
        }

    return {
        "authenticated": True,
        "username": cfg.get("username") if isinstance(cfg.get("username"), str) else None,
        "avatarUrl": cfg.get("avatar_url") if isinstance(cfg.get("avatar_url"), str) else None,
    }


def login(cfg: dict[str, Any], username: str, password: str) -> dict[str, Any]:
    username = username.strip()
    if not username or not password:
        raise AuthError(AUTH_INVALID_CREDENTIALS, "Introduce usuario y contraseña.")

    api_url = config_module._normalize_api_url(cfg.get("api_url"))
    requests_module = _http_client()

    try:
        response = requests_module.post(
            f"{api_url}/api/auth/login",
            json={"username": username, "password": password},
            timeout=10,
        )
    except requests_module.exceptions.ConnectionError as exc:
        raise AuthError(AUTH_CONNECTION_ERROR, "No se puede conectar con la API.") from exc
    except requests_module.exceptions.RequestException as exc:
        raise AuthError(AUTH_CONNECTION_ERROR, "No se puede conectar con la API.") from exc

    if not response.ok:
        raise _auth_http_error(response)

    try:
        login_payload = response.json()
    except ValueError as exc:
        raise AuthError(AUTH_INVALID_RESPONSE, "Respuesta de login no válida.") from exc

    token = login_payload.get("accessToken")
    if not isinstance(token, str) or not token:
        raise AuthError(AUTH_INVALID_RESPONSE, "Respuesta de login no válida.")

    try:
        me_response = requests_module.get(
            f"{api_url}/api/me",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
    except requests_module.exceptions.ConnectionError as exc:
        raise AuthError(AUTH_CONNECTION_ERROR, "No se puede conectar con la API.") from exc
    except requests_module.exceptions.RequestException as exc:
        raise AuthError(AUTH_CONNECTION_ERROR, "No se puede conectar con la API.") from exc

    if not me_response.ok:
        raise _me_http_error(me_response)

    try:
        me = me_response.json()
    except ValueError as exc:
        raise AuthError(AUTH_INVALID_RESPONSE, "Respuesta de perfil no válida.") from exc

    sync_token = me.get("syncToken")
    profile_username = me.get("username")
    if not isinstance(sync_token, str) or not sync_token:
        raise AuthError(AUTH_INVALID_RESPONSE, "Respuesta de perfil no válida.")
    if not isinstance(profile_username, str) or not profile_username:
        raise AuthError(AUTH_INVALID_RESPONSE, "Respuesta de perfil no válida.")

    avatar_url = me.get("avatarUrl")
    cfg["api_url"] = api_url
    cfg["sync_token"] = sync_token
    cfg["access_token"] = token
    cfg["username"] = profile_username
    cfg["avatar_url"] = avatar_url if isinstance(avatar_url, str) and avatar_url else None
    cfg["login_at"] = time.time()
    config_module.save(cfg)

    return get_public_auth_state(cfg)


def logout(cfg: dict[str, Any]) -> dict[str, Any]:
    cfg.update(
        {
            "sync_token": None,
            "access_token": None,
            "login_at": None,
            "username": None,
            "avatar_url": None,
            "cached_characters": [],
        }
    )
    config_module.save(cfg)
    return get_public_auth_state(cfg)


def _auth_http_error(response: Any) -> AuthError:
    message = _safe_detail(response) or "Credenciales no válidas."
    if response.status_code in (400, 401, 403):
        return AuthError(AUTH_INVALID_CREDENTIALS, message)
    if response.status_code >= 500:
        return AuthError(AUTH_SERVER_ERROR, "El servidor no pudo completar el login.")
    return AuthError(AUTH_INVALID_CREDENTIALS, message)


def _me_http_error(response: Any) -> AuthError:
    if response.status_code >= 500:
        return AuthError(AUTH_SERVER_ERROR, "El servidor no pudo cargar el perfil.")
    return AuthError(AUTH_INVALID_RESPONSE, "No se pudo validar la sesión.")


def _safe_detail(response: Any) -> str | None:
    try:
        detail = response.json().get("detail")
    except ValueError:
        return None
    return detail if isinstance(detail, str) and detail else None


def _http_client():
    import requests

    return requests
