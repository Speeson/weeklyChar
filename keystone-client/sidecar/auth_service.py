from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

import config as config_module


AUTH_INVALID_CREDENTIALS = "AUTH_INVALID_CREDENTIALS"
AUTH_CONNECTION_ERROR = "AUTH_CONNECTION_ERROR"
AUTH_SERVER_ERROR = "AUTH_SERVER_ERROR"
AUTH_INVALID_RESPONSE = "AUTH_INVALID_RESPONSE"
AUTH_REGISTRATION_FAILED = "AUTH_REGISTRATION_FAILED"
AUTH_BATTLENET_FAILED = "AUTH_BATTLENET_FAILED"

_pending_battlenet_flow: dict[str, str] | None = None


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

    return _persist_keystone_session(cfg, token, requests_module)


def _persist_keystone_session(cfg: dict[str, Any], token: str, requests_module: Any) -> dict[str, Any]:
    api_url = config_module._normalize_api_url(cfg.get("api_url"))
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


def start_battlenet(cfg: dict[str, Any]) -> dict[str, Any]:
    global _pending_battlenet_flow
    api_url = config_module._normalize_api_url(cfg.get("api_url"))
    requests_module = _http_client()
    try:
        response = requests_module.post(
            f"{api_url}/api/auth/battlenet/desktop/start", json={}, timeout=10
        )
    except requests_module.exceptions.RequestException as exc:
        raise AuthError(AUTH_CONNECTION_ERROR, "No se puede conectar con la API.") from exc
    if not response.ok:
        raise AuthError(AUTH_BATTLENET_FAILED, _safe_detail(response) or "No se pudo iniciar Battle.net.")
    try:
        payload = response.json()
    except ValueError as exc:
        raise AuthError(AUTH_INVALID_RESPONSE, "Respuesta de Battle.net no valida.") from exc

    flow_id = payload.get("flowId")
    poll_secret = payload.get("pollSecret")
    authorization_url = payload.get("authorizationUrl")
    expires_at = payload.get("expiresAt")
    parsed = urlparse(authorization_url) if isinstance(authorization_url, str) else None
    if (
        not isinstance(flow_id, str) or not flow_id
        or not isinstance(poll_secret, str) or not poll_secret
        or not isinstance(expires_at, str) or not expires_at
        or parsed is None or parsed.scheme != "https" or parsed.hostname != "oauth.battle.net"
        or parsed.username is not None or parsed.password is not None or parsed.path != "/authorize"
    ):
        raise AuthError(AUTH_INVALID_RESPONSE, "Respuesta de Battle.net no valida.")

    _pending_battlenet_flow = {
        "flowId": flow_id,
        "pollSecret": poll_secret,
        "expiresAt": expires_at,
    }
    return {"authorizationUrl": authorization_url, "expiresAt": expires_at}


def poll_battlenet(cfg: dict[str, Any]) -> dict[str, Any]:
    global _pending_battlenet_flow
    if _pending_battlenet_flow is None:
        raise AuthError(AUTH_BATTLENET_FAILED, "No hay una autorizacion Battle.net activa.")
    api_url = config_module._normalize_api_url(cfg.get("api_url"))
    requests_module = _http_client()
    try:
        response = requests_module.post(
            f"{api_url}/api/auth/battlenet/desktop/exchange",
            json={
                "flowId": _pending_battlenet_flow["flowId"],
                "pollSecret": _pending_battlenet_flow["pollSecret"],
            },
            timeout=10,
        )
    except requests_module.exceptions.RequestException as exc:
        raise AuthError(AUTH_CONNECTION_ERROR, "No se puede conectar con la API.") from exc
    if not response.ok:
        raise AuthError(AUTH_BATTLENET_FAILED, _safe_detail(response) or "No se pudo completar Battle.net.")
    try:
        payload = response.json()
    except ValueError as exc:
        raise AuthError(AUTH_INVALID_RESPONSE, "Respuesta de Battle.net no valida.") from exc
    status = payload.get("status")
    if status in ("pending", "needs_onboarding"):
        return {"status": status}
    if status in ("expired", "consumed"):
        _pending_battlenet_flow = None
        return {"status": status}
    if status != "ready":
        raise AuthError(AUTH_INVALID_RESPONSE, "Respuesta de Battle.net no valida.")
    token = payload.get("accessToken")
    if not isinstance(token, str) or not token:
        raise AuthError(AUTH_INVALID_RESPONSE, "Respuesta de Battle.net no valida.")
    try:
        auth = _persist_keystone_session(cfg, token, requests_module)
    finally:
        _pending_battlenet_flow = None
    return {"status": "ready", "auth": auth}


def cancel_battlenet() -> dict[str, str]:
    global _pending_battlenet_flow
    _pending_battlenet_flow = None
    return {"status": "cancelled"}


def register(cfg: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    api_url = config_module._normalize_api_url(cfg.get("api_url"))
    requests_module = _http_client()

    try:
        response = requests_module.post(
            f"{api_url}/api/auth/register",
            json=payload,
            timeout=10,
        )
    except requests_module.exceptions.ConnectionError as exc:
        raise AuthError(AUTH_CONNECTION_ERROR, "No se puede conectar con la API.") from exc
    except requests_module.exceptions.RequestException as exc:
        raise AuthError(AUTH_CONNECTION_ERROR, "No se puede conectar con la API.") from exc

    if not response.ok:
        message = _safe_detail(response) or "No se pudo crear la cuenta."
        raise AuthError(AUTH_REGISTRATION_FAILED, message)

    try:
        result = response.json()
    except ValueError as exc:
        raise AuthError(AUTH_INVALID_RESPONSE, "Respuesta de registro no válida.") from exc

    username = result.get("username")
    email = result.get("email")
    message = result.get("message")
    if not isinstance(username, str) or not isinstance(email, str) or not isinstance(message, str):
        raise AuthError(AUTH_INVALID_RESPONSE, "Respuesta de registro no válida.")

    return {
        "username": username,
        "email": email,
        "emailVerified": bool(result.get("emailVerified")),
        "message": message,
    }


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
