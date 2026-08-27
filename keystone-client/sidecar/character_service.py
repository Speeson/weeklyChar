from __future__ import annotations

import math
import threading
import time
from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

import requests

import config as config_module


CHARACTER_NOT_AUTHENTICATED = "CHARACTER_NOT_AUTHENTICATED"
CHARACTER_REFRESH_FAILED = "CHARACTER_REFRESH_FAILED"

_DUNGEON_ABBR = {
    "Ara-Kara, City of Echoes": ("Ara-Kara", "AK"),
    "City of Threads": ("City of Threads", "CoT"),
    "The Stonevault": ("Stonevault", "SV"),
    "The Dawnbreaker": ("Dawnbreaker", "DB"),
    "Mists of Tirna Scithe": ("Mists of Tirna Scithe", "MoTS"),
    "The Necrotic Wake": ("Necrotic Wake", "NW"),
    "Siege of Boralus": ("Siege of Boralus", "SoB"),
    "Grim Batol": ("Grim Batol", "GB"),
    "Darkflame Cleft": ("Darkflame Cleft", "DC"),
    "Cinderbrew Meadery": ("Cinderbrew Meadery", "CB"),
    "The Rookery": ("The Rookery", "RK"),
    "Priory of the Sacred Flame": ("Priory", "PSF"),
    "Operation: Floodgate": ("Floodgate", "OF"),
    "The MOTHERLODE!!": ("MOTHERLODE!!", "ML"),
    "Mechagon Workshop": ("Mechagon Workshop", "MW"),
    "Brackenhide Hollow": ("Brackenhide Hollow", "BH"),
    "Halls of Infusion": ("Halls of Infusion", "HoI"),
    "Neltharus": ("Neltharus", "Nel"),
    "Ruby Life Pools": ("Ruby Life Pools", "RLP"),
    "Altar of Fangs": ("Altar of Fangs", "AOF"),
    "Murder Row": ("Murder Row", "MR"),
    "Den of Nalorakk": ("Den of Nalorakk", "DON"),
    "The Blinding Vale": ("The Blinding Vale", "BV"),
    "Voidscar Arena": ("Voidscar Arena", "VSA"),
    "Uldaman: Legacy of Tyr": ("Uldaman", "ULD"),
    "The Azure Vault": ("Azure Vault", "AV"),
    "The Nokhud Offensive": ("Nokhud Offensive", "NO"),
    "Dawn of the Infinite: Galakrond's Fall": ("DotI: Galakrond's Fall", "DOTG"),
    "Dawn of the Infinite: Murozond's Rise": ("DotI: Murozond's Rise", "DOTM"),
    "De Other Side": ("De Other Side", "DOS"),
    "Halls of Atonement": ("Halls of Atonement", "HoA"),
    "Plaguefall": ("Plaguefall", "PF"),
    "Sanguine Depths": ("Sanguine Depths", "SD"),
    "Spires of Ascension": ("Spires of Ascension", "SoA"),
    "Theater of Pain": ("Theater of Pain", "ToP"),
    "Tazavesh: So'leah's Gambit": ("Tazavesh: Gambit", "TazG"),
    "Tazavesh: Streets of Wonder": ("Tazavesh: Streets", "TazS"),
    "Freehold": ("Freehold", "FH"),
    "King's Rest": ("King's Rest", "KR"),
    "Shrine of the Storm": ("Shrine of the Storm", "SotS"),
    "Temple of Sethraliss": ("Temple of Sethraliss", "ToS"),
    "Tol Dagor": ("Tol Dagor", "TD"),
    "The Underrot": ("The Underrot", "UR"),
    "Waycrest Manor": ("Waycrest Manor", "WM"),
    "Operation: Mechagon - Junkyard": ("Mech. Junkyard", "OMJ"),
    "Operation: Mechagon - Workshop": ("Mech. Workshop", "OMW"),
    "Black Rook Hold": ("Black Rook Hold", "BRH"),
    "Darkheart Thicket": ("Darkheart Thicket", "DHT"),
    "Court of Stars": ("Court of Stars", "CoS"),
    "The Arcway": ("The Arcway", "Arc"),
    "Eye of Azshara": ("Eye of Azshara", "EoA"),
    "Vault of the Wardens": ("Vault of the Wardens", "VotW"),
    "Neltharion's Lair": ("Neltharion's Lair", "NL"),
    "Return to Karazhan: Lower": ("Karazhan: Lower", "KarL"),
    "Return to Karazhan: Upper": ("Karazhan: Upper", "KarU"),
    "The Nexus": ("The Nexus", "NX"),
    "Throne of the Tides": ("Throne of the Tides", "TotT"),
    "The Vortex Pinnacle": ("Vortex Pinnacle", "VP"),
    "Halls of Stone": ("Halls of Stone", "HoS"),
    "Halls of Lightning": ("Halls of Lightning", "HoL"),
    "The Oculus": ("The Oculus", "Occ"),
    "Utgarde Pinnacle": ("Utgarde Pinnacle", "UP"),
}

_DUNGEON_ABBR_BY_ID = {
    588: ("Altar of Fangs", "AOF"),
    587: ("Murder Row", "MR"),
    586: ("Den of Nalorakk", "DON"),
    584: ("The Blinding Vale", "BV"),
    585: ("Voidscar Arena", "VSA"),
    249: ("Kings' Rest", "KR"),
    250: ("Temple of Sethraliss", "TOS"),
    399: ("Ruby Life Pools", "RLP"),
}


class CharacterServiceError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    value = value.strip()
    return value or None


def _number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def _integer(value: Any) -> int | None:
    number = _number(value)
    return int(round(number)) if number is not None else None


def _safe_avatar_url(value: Any) -> str | None:
    url = _text(value)
    if not url:
        return None
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    if parsed.username or parsed.password:
        return None
    return url


def keystone_display(keystone: Any) -> str:
    if not isinstance(keystone, dict):
        return "—"
    level = _integer(keystone.get("level"))
    if not level:
        return "—"
    challenge_map_id = _integer(keystone.get("challengeMapId"))
    if challenge_map_id in _DUNGEON_ABBR_BY_ID:
        display, abbreviation = _DUNGEON_ABBR_BY_ID[challenge_map_id]
        return f"+{level} {display} ({abbreviation})"
    dungeon = _text(keystone.get("dungeon")) or ""
    if dungeon in _DUNGEON_ABBR:
        display, abbreviation = _DUNGEON_ABBR[dungeon]
        return f"+{level} {display} ({abbreviation})"
    return f"+{level} {dungeon}" if dungeon else f"+{level}"


def _sanitize_keystone(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    level = _integer(value.get("level"))
    if not level:
        return None
    return {
        "level": level,
        "dungeon": _text(value.get("dungeon")),
        "challengeMapId": _integer(value.get("challengeMapId")),
        "mapId": _integer(value.get("mapId")),
    }


def sanitize_character(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    name = _text(value.get("name"))
    realm = _text(value.get("realm"))
    if not name or not realm:
        return None
    region = (_text(value.get("region")) or "eu").lower()
    current_keystone = _sanitize_keystone(value.get("currentKeystone"))
    raw_id = value.get("id")
    stable_id = str(raw_id) if isinstance(raw_id, (str, int)) and not isinstance(raw_id, bool) else ""
    if not stable_id:
        stable_id = f"{region}:{realm.casefold()}:{name.casefold()}"

    return {
        "id": stable_id,
        "name": name,
        "realm": realm,
        "region": region,
        "wowAccount": _text(value.get("wowAccount")),
        "wowClass": _text(value.get("wowClass")),
        "avatarUrl": _safe_avatar_url(value.get("avatarUrl")),
        "ilvl": _integer(value.get("ilvl")),
        "rioScore": _number(value.get("rioScore")),
        "currentKeystone": current_keystone,
        "keystoneDisplay": keystone_display(current_keystone),
    }


class CharacterService:
    def __init__(
        self,
        *,
        config_loader: Callable[[], dict[str, Any]] = config_module.load,
        config_saver: Callable[[dict[str, Any]], None] = config_module.save,
        session=requests,
        raiderio_fetcher: Callable[[str, str, str], tuple[Any, Any, Any, Any]] | None = None,
        emit: Callable[[str, dict[str, Any]], None] | None = None,
    ):
        self._config_loader = config_loader
        self._config_saver = config_saver
        self._session = session
        self._raiderio_fetcher = raiderio_fetcher
        self._emit = emit or (lambda _event, _data: None)
        self._lock = threading.RLock()
        self._characters: list[dict[str, Any]] | None = None
        self._source = "none"
        self._refreshing = False
        self._refresh_pending = False
        self._last_refresh_at: str | None = None
        self._last_error: str | None = None
        self._refresh_thread: threading.Thread | None = None
        self._refresh_timer: threading.Timer | None = None
        self._generation = 0

    def set_emit(self, emit: Callable[[str, dict[str, Any]], None] | None) -> None:
        with self._lock:
            self._emit = emit or (lambda _event, _data: None)

    def reset(self) -> dict[str, Any]:
        with self._lock:
            if self._refresh_timer is not None:
                self._refresh_timer.cancel()
                self._refresh_timer = None
            self._characters = []
            self._source = "none"
            self._refresh_pending = False
            self._last_refresh_at = None
            self._last_error = None
            self._generation += 1
            return self._state_locked()

    def get_state(self, cfg: dict[str, Any] | None = None) -> dict[str, Any]:
        cfg = cfg or self._config_loader()
        with self._lock:
            if self._characters is None:
                cached = self._sanitize_list(cfg.get("cached_characters"))
                self._characters = self._sort_default(cached)
                self._source = "cache" if self._characters else "none"
            return self._state_locked()

    def refresh(self, cfg: dict[str, Any] | None = None) -> dict[str, Any]:
        cfg = cfg or self._config_loader()
        with self._lock:
            if self._refreshing:
                self._refresh_pending = True
                return self._state_locked()
            self._refreshing = True
            self._last_error = None
            generation = self._generation
        return self._execute_refresh(cfg, generation)

    def _execute_refresh(self, cfg: dict[str, Any], generation: int) -> dict[str, Any]:
        try:
            characters = self._fetch_remote(cfg)
            with self._lock:
                if generation != self._generation:
                    return self._finish_refresh()
                self._characters = self._sort_default(characters)
                self._source = "remote"
                self._last_refresh_at = _utc_now()
                self._last_error = None
                cached_characters = list(self._characters)
            latest_cfg = self._config_loader()
            latest_cfg["cached_characters"] = cached_characters
            self._config_saver(latest_cfg)
            return self._finish_refresh()
        except CharacterServiceError:
            with self._lock:
                self._last_error = "No se pudieron actualizar los personajes."
            self._finish_refresh()
            raise
        except Exception as exc:
            with self._lock:
                self._last_error = "No se pudieron actualizar los personajes."
            self._finish_refresh()
            raise CharacterServiceError(
                CHARACTER_REFRESH_FAILED,
                "No se pudieron actualizar los personajes.",
            ) from exc

    def refresh_async(self, cfg: dict[str, Any] | None = None) -> dict[str, Any]:
        cfg = cfg or self._config_loader()
        with self._lock:
            if self._refreshing or (
                self._refresh_thread is not None and self._refresh_thread.is_alive()
            ):
                self._refresh_pending = True
                return self._state_locked()
            self._refreshing = True
            self._last_error = None
            generation = self._generation
            thread = threading.Thread(
                target=self._refresh_background,
                args=(cfg, generation),
                daemon=True,
            )
            self._refresh_thread = thread
            thread.start()
            return self._state_locked()

    def schedule_refresh(self, delay: float = 0.5) -> None:
        with self._lock:
            if self._refresh_timer is not None:
                self._refresh_timer.cancel()
            timer = threading.Timer(delay, self.refresh_async)
            timer.daemon = True
            self._refresh_timer = timer
            timer.start()

    def wait_for_idle(self, timeout: float = 5) -> bool:
        deadline = time.time() + timeout
        while time.time() < deadline:
            with self._lock:
                timer_alive = self._refresh_timer is not None and self._refresh_timer.is_alive()
                thread_alive = self._refresh_thread is not None and self._refresh_thread.is_alive()
                if not self._refreshing and not timer_alive and not thread_alive:
                    return True
            time.sleep(0.02)
        return False

    def _refresh_background(self, cfg: dict[str, Any], generation: int) -> None:
        try:
            self._execute_refresh(cfg, generation)
        except CharacterServiceError:
            pass

    def _fetch_remote(self, cfg: dict[str, Any]) -> list[dict[str, Any]]:
        token = cfg.get("access_token") or cfg.get("sync_token")
        if not isinstance(token, str) or not token:
            raise CharacterServiceError(
                CHARACTER_NOT_AUTHENTICATED,
                "Inicia sesion para cargar los personajes.",
            )
        api_url = config_module._normalize_api_url(cfg.get("api_url"))
        try:
            response = self._session.get(
                f"{api_url}/api/me/characters",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10,
            )
        except Exception as exc:
            raise CharacterServiceError(
                CHARACTER_REFRESH_FAILED,
                "No se pudieron actualizar los personajes.",
            ) from exc
        if not response.ok:
            raise CharacterServiceError(
                CHARACTER_REFRESH_FAILED,
                "No se pudieron actualizar los personajes.",
            )
        try:
            raw_characters = response.json()
        except (TypeError, ValueError) as exc:
            raise CharacterServiceError(
                CHARACTER_REFRESH_FAILED,
                "No se pudieron actualizar los personajes.",
            ) from exc
        if not isinstance(raw_characters, list):
            raise CharacterServiceError(
                CHARACTER_REFRESH_FAILED,
                "No se pudieron actualizar los personajes.",
            )

        sanitized = []
        for raw in raw_characters:
            if not isinstance(raw, dict):
                continue
            enriched = self._enrich_missing(dict(raw), cfg)
            dto = sanitize_character(enriched)
            if dto is not None:
                sanitized.append(dto)
        return sanitized

    def _enrich_missing(self, character: dict[str, Any], cfg: dict[str, Any]) -> dict[str, Any]:
        missing_avatar = not _safe_avatar_url(character.get("avatarUrl"))
        missing_score = _number(character.get("rioScore")) is None
        missing_class = not _text(character.get("wowClass"))
        missing_ilvl = _integer(character.get("ilvl")) is None
        if not (missing_avatar or missing_score or missing_class or missing_ilvl):
            return character

        name = _text(character.get("name"))
        realm = _text(character.get("realm"))
        region = (_text(character.get("region")) or "eu").lower()
        if not name or not realm:
            return character

        fetcher = self._raiderio_fetcher
        if fetcher is None:
            from sync_worker import SyncWorker

            fetcher = SyncWorker(cfg)._fetch_raiderio
        avatar, score, wow_class, ilvl = fetcher(name, realm, region)
        enrichment: dict[str, Any] = {}
        if missing_avatar and _safe_avatar_url(avatar):
            character["avatarUrl"] = avatar
            enrichment["avatarUrl"] = avatar
        if missing_score and _number(score) is not None:
            character["rioScore"] = score
            enrichment["rioScore"] = score
        if missing_class and _text(wow_class):
            character["wowClass"] = wow_class
            enrichment["wowClass"] = wow_class
        if missing_ilvl and _integer(ilvl) is not None:
            character["ilvl"] = ilvl
            enrichment["ilvl"] = _integer(ilvl)
        if enrichment:
            self._persist_enrichment(cfg, character, enrichment)
        return character

    def _persist_enrichment(
        self,
        cfg: dict[str, Any],
        character: dict[str, Any],
        enrichment: dict[str, Any],
    ) -> None:
        sync_token = cfg.get("sync_token")
        if not isinstance(sync_token, str) or not sync_token:
            return
        payload = {
            "name": character.get("name"),
            "realm": character.get("realm"),
            "region": (character.get("region") or "eu").lower(),
            **enrichment,
        }
        try:
            self._session.post(
                f"{config_module._normalize_api_url(cfg.get('api_url'))}/api/me/characters/enrich",
                json=payload,
                headers={"Authorization": f"Bearer {sync_token}"},
                timeout=8,
            )
        except Exception:
            pass

    def _finish_refresh(self) -> dict[str, Any]:
        with self._lock:
            self._refreshing = False
            pending = self._refresh_pending
            self._refresh_pending = False
            state = self._state_locked()
            emit = self._emit
        try:
            emit("characters.updated", state)
        except Exception:
            pass
        if pending:
            self.schedule_refresh(0.25)
        return state

    def _sanitize_list(self, values: Any) -> list[dict[str, Any]]:
        if not isinstance(values, list):
            return []
        return [dto for value in values if (dto := sanitize_character(value)) is not None]

    @staticmethod
    def _sort_default(characters: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return sorted(
            characters,
            key=lambda character: (
                character.get("rioScore") is not None,
                character.get("rioScore") if character.get("rioScore") is not None else 0,
                character.get("name", "").casefold(),
            ),
            reverse=True,
        )

    def _state_locked(self) -> dict[str, Any]:
        return {
            "characters": list(self._characters or []),
            "refreshing": self._refreshing,
            "source": self._source,
            "lastRefreshAt": self._last_refresh_at,
            "lastError": self._last_error,
        }
