from __future__ import annotations

import math
from typing import Any, Callable
from urllib.parse import urlparse

import requests

import config as config_module

INVALID_TEAM_REQUEST = "INVALID_TEAM_REQUEST"
SESSION_EXPIRED = "SESSION_EXPIRED"
TEAM_ACCESS_DENIED = "TEAM_ACCESS_DENIED"
TEAM_NOT_FOUND = "TEAM_NOT_FOUND"
API_THROTTLED = "API_THROTTLED"
API_TIMEOUT = "API_TIMEOUT"
API_UNAVAILABLE = "API_UNAVAILABLE"
INVALID_TEAM_RESPONSE = "INVALID_TEAM_RESPONSE"
INVALID_SELECTOR_RESPONSE = "INVALID_SELECTOR_RESPONSE"

_VOIDCORE_STATES = {"pending", "completed_with_voidcore", "voidcore_not_checked"}
_TIER_KEYS = ("bestInSlot", "mustHave", "niceToHave", "catalyst", "transmog", "other")
_QUALITY_TYPES = {"POOR", "COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "ARTIFACT", "HEIRLOOM"}


class TeamServiceError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def _positive(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and 0 < value <= 2**53 - 1


def _non_negative(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and 0 <= value <= 2**53 - 1


def _text(value: Any, maximum: int) -> bool:
    return isinstance(value, str) and 0 < len(value) <= maximum


def _nullable_text(value: Any, maximum: int) -> bool:
    return value is None or _text(value, maximum)


def _nullable_number(value: Any) -> bool:
    return value is None or (
        isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)
    )


def _nullable_https(value: Any) -> bool:
    if value is None:
        return True
    if not _text(value, 2048):
        return False
    parsed = urlparse(value)
    return parsed.scheme == "https" and bool(parsed.netloc) and not parsed.username and not parsed.password


def _stat_names(value: Any) -> bool:
    return isinstance(value, list) and len(value) <= 32 \
        and all(_text(stat, 128) for stat in value) and len(set(value)) == len(value)


def _tiers(value: Any) -> dict[str, int] | None:
    if not isinstance(value, dict) or not all(_non_negative(value.get(key)) for key in _TIER_KEYS):
        return None
    return {key: value[key] for key in _TIER_KEYS}


def sanitize_team_list(value: Any) -> list[dict[str, Any]] | None:
    if not isinstance(value, list) or len(value) > 1000:
        return None
    result = []
    for team in value:
        if not isinstance(team, dict) or not _positive(team.get("id")) \
                or not _text(team.get("name"), 128) or not _non_negative(team.get("memberCount")):
            return None
        result.append({"id": team["id"], "name": team["name"], "memberCount": team["memberCount"]})
    return result


def _keystone(value: Any) -> dict[str, Any] | None | Ellipsis:
    if value is None:
        return None
    challenge_map_id = value.get("challengeMapId") if isinstance(value, dict) else None
    if not isinstance(value, dict) or not _positive(value.get("level")) \
            or "challengeMapId" not in value \
            or not (challenge_map_id is None or _positive(challenge_map_id)) \
            or not _nullable_text(value.get("dungeon"), 256):
        return Ellipsis
    return {"level": value["level"], "challengeMapId": value["challengeMapId"], "dungeon": value["dungeon"]}


def sanitize_team_detail(value: Any, expected_team_id: int) -> dict[str, Any] | None:
    if not isinstance(value, dict) or value.get("id") != expected_team_id \
            or not _text(value.get("name"), 128) or not isinstance(value.get("members"), list) \
            or len(value["members"]) > 1000:
        return None
    members = []
    for member in value["members"]:
        if not isinstance(member, dict) or not _positive(member.get("userId")) \
                or not _text(member.get("username"), 128) or not isinstance(member.get("characters"), list) \
                or len(member["characters"]) > 2000:
            return None
        characters = []
        for character in member["characters"]:
            if not isinstance(character, dict) or not _positive(character.get("id")) \
                    or not _text(character.get("name"), 128) or not _text(character.get("realm"), 128) \
                    or not _text(character.get("region"), 16) or not _nullable_text(character.get("wowClass"), 64) \
                    or not _nullable_https(character.get("avatarUrl")) or not _nullable_number(character.get("ilvl")) \
                    or not _nullable_number(character.get("rioScore")):
                return None
            current = _keystone(character.get("currentKeystone"))
            if current is Ellipsis:
                return None
            characters.append({
                "characterId": character["id"], "name": character["name"], "realm": character["realm"],
                "region": character["region"], "wowClass": character["wowClass"],
                "avatarUrl": character["avatarUrl"], "ilvl": character["ilvl"],
                "rioScore": character["rioScore"], "currentKeystone": current,
            })
        members.append({"userId": member["userId"], "username": member["username"], "characters": characters})
    return {"id": value["id"], "name": value["name"], "members": members}


def _objective(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict) or not _positive(value.get("itemId")) \
            or not _nullable_text(value.get("itemName"), 512) or not _nullable_https(value.get("iconUrl")) \
            or not _positive(value.get("tier")) or not isinstance(value.get("specIds"), list) \
            or not 0 < len(value["specIds"]) <= 64 or not all(_positive(item) for item in value["specIds"]) \
            or len(set(value["specIds"])) != len(value["specIds"]) or not _text(value.get("sourceType"), 64):
        return None
    source_id = value.get("sourceId")
    slot_id = value.get("slotId")
    stats = value.get("statNames")
    primary_stats = value.get("primaryStatNames")
    secondary_stats = value.get("secondaryStatNames")
    other_stats = value.get("otherStatNames")
    quality_type = value.get("qualityType")
    classified_stats = [*primary_stats, *secondary_stats, *other_stats] \
        if all(isinstance(group, list) for group in (primary_stats, secondary_stats, other_stats)) else []
    if not (_positive(source_id) or _text(source_id, 128)) \
            or not (slot_id is None or (isinstance(slot_id, int) and not isinstance(slot_id, bool) and abs(slot_id) <= 2**53 - 1)) \
            or not _nullable_text(value.get("slotName"), 128) \
            or not _nullable_text(value.get("itemClassName"), 128) \
            or not _nullable_text(value.get("itemSubClassName"), 128) \
            or not _stat_names(stats) or not _stat_names(primary_stats) or not _stat_names(secondary_stats) \
            or not _stat_names(other_stats) or len(classified_stats) != len(stats) \
            or set(classified_stats) != set(stats) \
            or not (quality_type is None or (isinstance(quality_type, str) and quality_type in _QUALITY_TYPES)) \
            or value.get("voidcoreState") not in _VOIDCORE_STATES:
        return None
    return {key: value[key] for key in (
        "itemId", "itemName", "iconUrl", "tier", "specIds", "sourceType", "sourceId", "slotId",
        "slotName", "itemClassName", "itemSubClassName", "statNames", "primaryStatNames",
        "secondaryStatNames", "otherStatNames", "qualityType", "voidcoreState",
    )}


def _stone(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict) or not _positive(value.get("characterId")) \
            or not _text(value.get("characterName"), 128) or not _positive(value.get("ownerUserId")) \
            or not _text(value.get("ownerUsername"), 128) or not _positive(value.get("level")):
        return None
    return {key: value[key] for key in ("characterId", "characterName", "ownerUserId", "ownerUsername", "level")}


def _spec(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict) or not _positive(value.get("specId")) or not _non_negative(value.get("objectiveCount")):
        return None
    tier_counts = _tiers(value.get("tierCounts"))
    return None if tier_counts is None else {"specId": value["specId"], "objectiveCount": value["objectiveCount"], "tierCounts": tier_counts}


def _selector_character(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict) or not _positive(value.get("userId")) or not _text(value.get("username"), 128) \
            or not _positive(value.get("characterId")) or not _text(value.get("characterName"), 128) \
            or not _text(value.get("realm"), 128) or not _text(value.get("region"), 16) \
            or not _nullable_text(value.get("wowClass"), 64) or not _nullable_https(value.get("avatarUrl")) \
            or not _nullable_number(value.get("ilvl")) or not _nullable_number(value.get("rioScore")) \
            or not _non_negative(value.get("totalObjectives")) or not isinstance(value.get("specs"), list) \
            or len(value["specs"]) > 64 or not isinstance(value.get("objectives"), list) \
            or len(value["objectives"]) > 2000:
        return None
    tier_counts = _tiers(value.get("tierCounts"))
    specs = [_spec(item) for item in value["specs"]]
    objectives = [_objective(item) for item in value["objectives"]]
    if tier_counts is None or any(item is None for item in specs) or any(item is None for item in objectives):
        return None
    return {
        **{key: value[key] for key in ("userId", "username", "characterId", "characterName", "realm", "region", "wowClass", "avatarUrl", "ilvl", "rioScore", "totalObjectives")},
        "tierCounts": tier_counts, "specs": specs, "objectives": objectives,
    }


def sanitize_selector(value: Any, team_id: int, challenge_map_id: int) -> dict[str, Any] | None:
    if not isinstance(value, dict) or value.get("teamId") != team_id or value.get("challengeMapId") != challenge_map_id \
            or not isinstance(value.get("availability"), dict) or not _non_negative(value["availability"].get("stoneCount")) \
            or not isinstance(value["availability"].get("stones"), list) or len(value["availability"]["stones"]) > 2000 \
            or not isinstance(value.get("summary"), dict) or not _non_negative(value["summary"].get("charactersWithObjectives")) \
            or not _non_negative(value["summary"].get("totalObjectives")) or not isinstance(value.get("characters"), list) \
            or len(value["characters"]) > 2000:
        return None
    stones = [_stone(item) for item in value["availability"]["stones"]]
    tiers = _tiers(value["summary"].get("tiers"))
    characters = [_selector_character(item) for item in value["characters"]]
    if tiers is None or any(item is None for item in stones) or any(item is None for item in characters) \
            or value["availability"]["stoneCount"] != len(stones) \
            or value["summary"]["charactersWithObjectives"] != len(characters):
        return None
    return {"teamId": team_id, "challengeMapId": challenge_map_id,
            "availability": {"stoneCount": len(stones), "stones": stones},
            "summary": {"charactersWithObjectives": len(characters), "totalObjectives": value["summary"]["totalObjectives"], "tiers": tiers},
            "characters": characters}


class TeamService:
    def __init__(self, *, session=requests):
        self._session = session

    def _get(self, cfg: dict[str, Any], path: str, parser: Callable[[Any], Any], invalid_code: str) -> Any:
        token = cfg.get("access_token")
        if not isinstance(token, str) or not token or not config_module.is_session_valid(cfg):
            raise TeamServiceError(SESSION_EXPIRED, "La sesión ha caducado. Inicia sesión de nuevo.")
        url = f"{config_module._normalize_api_url(cfg.get('api_url'))}{path}"
        try:
            response = self._session.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=10)
        except requests.Timeout as exc:
            raise TeamServiceError(API_TIMEOUT, "La API tardó demasiado en responder.") from exc
        except requests.ConnectionError as exc:
            raise TeamServiceError(API_UNAVAILABLE, "No se pudo conectar con la API.") from exc
        except Exception as exc:
            raise TeamServiceError(API_UNAVAILABLE, "No se pudo conectar con la API.") from exc
        if not response.ok:
            mapping = {
                400: (INVALID_TEAM_REQUEST, "La solicitud de equipo no es válida."),
                401: (SESSION_EXPIRED, "La sesión ha caducado. Inicia sesión de nuevo."),
                403: (TEAM_ACCESS_DENIED, "Ya no tienes acceso a este equipo."),
                404: (TEAM_NOT_FOUND, "No se encontró el equipo."),
                429: (API_THROTTLED, "La API ha limitado temporalmente las solicitudes."),
            }
            code, message = mapping.get(response.status_code, (API_UNAVAILABLE, "La API no está disponible."))
            raise TeamServiceError(code, message)
        try:
            raw = response.json()
        except (TypeError, ValueError) as exc:
            raise TeamServiceError(invalid_code, "La API devolvió una respuesta no válida.") from exc
        parsed = parser(raw)
        if parsed is None:
            raise TeamServiceError(invalid_code, "La API devolvió una respuesta no válida.")
        return parsed

    def list_teams(self, cfg: dict[str, Any]) -> list[dict[str, Any]]:
        return self._get(cfg, "/api/teams", sanitize_team_list, INVALID_TEAM_RESPONSE)

    def get_team(self, cfg: dict[str, Any], team_id: int) -> dict[str, Any]:
        if not _positive(team_id):
            raise TeamServiceError(INVALID_TEAM_REQUEST, "El identificador de equipo no es válido.")
        return self._get(cfg, f"/api/teams/{team_id}", lambda raw: sanitize_team_detail(raw, team_id), INVALID_TEAM_RESPONSE)

    def get_keystone_selector(self, cfg: dict[str, Any], team_id: int, challenge_map_id: int) -> dict[str, Any]:
        if not _positive(team_id) or not _positive(challenge_map_id):
            raise TeamServiceError(INVALID_TEAM_REQUEST, "Los identificadores del selector no son válidos.")
        path = f"/api/teams/{team_id}/keystone-loot/dungeons/{challenge_map_id}/summary"
        return self._get(cfg, path, lambda raw: sanitize_selector(raw, team_id, challenge_map_id), INVALID_SELECTOR_RESPONSE)
