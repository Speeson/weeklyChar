from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import auth_service
import config as config_module


PROFILE_NOT_AUTHENTICATED = "PROFILE_NOT_AUTHENTICATED"
PROFILE_INVALID_AVATAR = "PROFILE_INVALID_AVATAR"
PROFILE_UPDATE_FAILED = "PROFILE_UPDATE_FAILED"


@dataclass(frozen=True)
class ProfileError(Exception):
    code: str
    message: str


class ProfileService:
    def __init__(self, *, session: Any = None, config_saver=None):
        self._session = session
        self._config_saver = config_saver or config_module.save

    def set_avatar(
        self,
        cfg: dict[str, Any],
        avatar_url: str,
        characters: list[dict[str, Any]],
    ) -> dict[str, Any]:
        if not config_module.is_session_valid(cfg):
            raise ProfileError(PROFILE_NOT_AUTHENTICATED, "Inicia sesion para cambiar el avatar.")

        avatar_url = avatar_url.strip()
        allowed_urls = {
            character.get("avatarUrl")
            for character in characters
            if isinstance(character, dict) and isinstance(character.get("avatarUrl"), str)
        }
        if not avatar_url or avatar_url not in allowed_urls:
            raise ProfileError(PROFILE_INVALID_AVATAR, "El avatar seleccionado no es valido.")

        session = self._session or _http_client()
        try:
            response = session.patch(
                f"{config_module._normalize_api_url(cfg.get('api_url'))}/api/me/avatar",
                json={"avatarUrl": avatar_url},
                headers={"Authorization": f"Bearer {cfg['access_token']}"},
                timeout=10,
            )
        except session.exceptions.RequestException as exc:
            raise ProfileError(PROFILE_UPDATE_FAILED, "No se pudo actualizar el avatar.") from exc

        if not response.ok:
            raise ProfileError(PROFILE_UPDATE_FAILED, "No se pudo actualizar el avatar.")

        cfg["avatar_url"] = avatar_url
        self._config_saver(cfg)
        return auth_service.get_public_auth_state(cfg)


def _http_client():
    import requests

    return requests
