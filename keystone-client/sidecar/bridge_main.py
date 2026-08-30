from __future__ import annotations

import json
import sys
import threading
from collections.abc import Callable
from typing import Any, TextIO

from bridge_protocol import (
    ERROR_INTERNAL_ERROR,
    ERROR_INVALID_JSON,
    ERROR_INVALID_REQUEST,
    ERROR_REQUEST_TOO_LARGE,
    ERROR_UNKNOWN_COMMAND,
    MAX_LINE_BYTES,
    PROTOCOL_VERSION,
    ProtocolError,
    error_response,
    event_message,
    success_response,
    validate_request,
)
import auth_service
import addon_service
import character_service
import config as config_module
import profile_service
import settings_service
import sync_service
import team_service
import wow_service


Handler = Callable[[dict[str, Any]], dict[str, Any]]
CHARACTER_SERVICE = character_service.CharacterService()
SYNC_SERVICE = sync_service.SyncService(on_completed=CHARACTER_SERVICE.schedule_refresh)
ADDON_SERVICE = addon_service.AddonService()
PROFILE_SERVICE = profile_service.ProfileService()
TEAM_SERVICE = team_service.TeamService()
_STDOUT_LOCK = threading.Lock()


def _require_empty_payload(payload: dict[str, Any]) -> None:
    if payload:
        raise ProtocolError(ERROR_INVALID_REQUEST, "payload must be empty for this command.")


def handle_ping(payload: dict[str, Any]) -> dict[str, Any]:
    _require_empty_payload(payload)
    return {"pong": True}


def handle_get_state(payload: dict[str, Any]) -> dict[str, Any]:
    _require_empty_payload(payload)
    cfg = config_module.load()
    return {
        "protocolVersion": PROTOCOL_VERSION,
        "bridge": "ready",
        "auth": auth_service.get_public_auth_state(cfg),
        "settings": settings_service.get_settings(cfg),
        "wow": wow_service.get_wow_state(cfg),
        "sync": SYNC_SERVICE.get_status(),
        "characters": CHARACTER_SERVICE.get_state(cfg),
        "addon": ADDON_SERVICE.get_status(cfg),
    }


def handle_auth_login(payload: dict[str, Any]) -> dict[str, Any]:
    username = payload.get("username")
    password = payload.get("password")
    if not isinstance(username, str) or not username.strip():
        raise ProtocolError(ERROR_INVALID_REQUEST, "username must be a non-empty string.")
    if not isinstance(password, str) or not password:
        raise ProtocolError(ERROR_INVALID_REQUEST, "password must be a non-empty string.")

    cfg = config_module.load()
    try:
        result = auth_service.login(cfg, username, password)
        refreshed_cfg = config_module.load()
        SYNC_SERVICE.reconcile(emit_events=False)
        CHARACTER_SERVICE.refresh_async(refreshed_cfg)
        ADDON_SERVICE.check_async(refreshed_cfg)
        return result
    except auth_service.AuthError as exc:
        raise ProtocolError(exc.code, exc.message) from exc


def handle_auth_logout(payload: dict[str, Any]) -> dict[str, Any]:
    _require_empty_payload(payload)
    cfg = config_module.load()
    result = auth_service.logout(cfg)
    SYNC_SERVICE.stop()
    CHARACTER_SERVICE.reset()
    return result


def handle_profile_set_avatar(payload: dict[str, Any]) -> dict[str, Any]:
    avatar_url = payload.get("avatarUrl")
    if not isinstance(avatar_url, str) or not avatar_url.strip():
        raise ProtocolError(ERROR_INVALID_REQUEST, "avatarUrl must be a non-empty string.")
    cfg = config_module.load()
    characters = CHARACTER_SERVICE.get_state(cfg)["characters"]
    try:
        return PROFILE_SERVICE.set_avatar(cfg, avatar_url, characters)
    except profile_service.ProfileError as exc:
        raise ProtocolError(exc.code, exc.message) from exc


def handle_auth_register(payload: dict[str, Any]) -> dict[str, Any]:
    required = (
        "firstName",
        "lastName",
        "email",
        "username",
        "password",
        "confirmPassword",
        "dateOfBirth",
    )
    if any(not isinstance(payload.get(key), str) or not payload[key].strip() for key in required):
        raise ProtocolError(ERROR_INVALID_REQUEST, "All registration fields are required.")
    try:
        return auth_service.register(config_module.load(), {key: payload[key] for key in required})
    except auth_service.AuthError as exc:
        raise ProtocolError(exc.code, exc.message) from exc


def handle_settings_get(payload: dict[str, Any]) -> dict[str, Any]:
    _require_empty_payload(payload)
    return settings_service.get_settings(config_module.load())


def handle_settings_update(payload: dict[str, Any]) -> dict[str, Any]:
    try:
        return settings_service.update_settings(config_module.load(), payload)
    except settings_service.SettingsError as exc:
        raise ProtocolError(exc.code, exc.message) from exc


def handle_wow_detect(payload: dict[str, Any]) -> dict[str, Any]:
    _require_empty_payload(payload)
    cfg = config_module.load()
    result = wow_service.detect_wow(cfg)
    SYNC_SERVICE.reconcile(restart=True, emit_events=False)
    ADDON_SERVICE.check_async(cfg)
    return result


def handle_wow_list_accounts(payload: dict[str, Any]) -> dict[str, Any]:
    _require_empty_payload(payload)
    return wow_service.list_accounts(config_module.load())


def handle_wow_select_install(payload: dict[str, Any]) -> dict[str, Any]:
    path = payload.get("path")
    if not isinstance(path, str) or not path.strip():
        raise ProtocolError(ERROR_INVALID_REQUEST, "path must be a non-empty string.")
    try:
        cfg = config_module.load()
        result = wow_service.select_install(cfg, path)
        SYNC_SERVICE.reconcile(restart=True, emit_events=False)
        ADDON_SERVICE.check_async(cfg)
        return result
    except wow_service.WowError as exc:
        raise ProtocolError(exc.code, exc.message) from exc


def handle_wow_select_accounts(payload: dict[str, Any]) -> dict[str, Any]:
    accounts = payload.get("accounts")
    try:
        cfg = config_module.load()
        result = wow_service.select_accounts(cfg, accounts)
        SYNC_SERVICE.reconcile(restart=True, emit_events=False)
        CHARACTER_SERVICE.refresh_async(cfg)
        return result
    except wow_service.WowError as exc:
        raise ProtocolError(exc.code, exc.message) from exc


def handle_sync_get_status(payload: dict[str, Any]) -> dict[str, Any]:
    _require_empty_payload(payload)
    return SYNC_SERVICE.get_status()


def handle_sync_start(payload: dict[str, Any]) -> dict[str, Any]:
    _require_empty_payload(payload)
    try:
        return SYNC_SERVICE.start()
    except sync_service.SyncServiceError as exc:
        raise ProtocolError(exc.code, exc.message) from exc


def handle_sync_stop(payload: dict[str, Any]) -> dict[str, Any]:
    _require_empty_payload(payload)
    return SYNC_SERVICE.stop()


def handle_sync_force(payload: dict[str, Any]) -> dict[str, Any]:
    _require_empty_payload(payload)
    try:
        return SYNC_SERVICE.force()
    except sync_service.SyncServiceError as exc:
        raise ProtocolError(exc.code, exc.message) from exc


def handle_characters_get(payload: dict[str, Any]) -> dict[str, Any]:
    _require_empty_payload(payload)
    return CHARACTER_SERVICE.get_state(config_module.load())


def handle_characters_refresh(payload: dict[str, Any]) -> dict[str, Any]:
    _require_empty_payload(payload)
    cfg = config_module.load()
    if not config_module.is_session_valid(cfg):
        raise ProtocolError(
            character_service.CHARACTER_NOT_AUTHENTICATED,
            "Inicia sesion para cargar los personajes.",
        )
    return CHARACTER_SERVICE.refresh_async(cfg)


def _require_positive_id(payload: dict[str, Any], key: str) -> int:
    value = payload.get(key)
    if not isinstance(value, int) or isinstance(value, bool) or value <= 0 or value > 2**53 - 1:
        raise ProtocolError(ERROR_INVALID_REQUEST, f"{key} must be a positive safe integer.")
    return value


def handle_teams_list(payload: dict[str, Any]) -> dict[str, Any]:
    _require_empty_payload(payload)
    try:
        return TEAM_SERVICE.list_teams(config_module.load())
    except team_service.TeamServiceError as exc:
        raise ProtocolError(exc.code, exc.message) from exc


def handle_teams_get(payload: dict[str, Any]) -> dict[str, Any]:
    team_id = _require_positive_id(payload, "teamId")
    if set(payload) != {"teamId"}:
        raise ProtocolError(ERROR_INVALID_REQUEST, "payload must contain only teamId.")
    try:
        return TEAM_SERVICE.get_team(config_module.load(), team_id)
    except team_service.TeamServiceError as exc:
        raise ProtocolError(exc.code, exc.message) from exc


def handle_teams_keystone_selector(payload: dict[str, Any]) -> dict[str, Any]:
    team_id = _require_positive_id(payload, "teamId")
    challenge_map_id = _require_positive_id(payload, "challengeMapId")
    locale = payload.get("locale", "es_ES")
    if set(payload) - {"teamId", "challengeMapId", "locale"} or locale not in {"es_ES", "en_US"}:
        raise ProtocolError(ERROR_INVALID_REQUEST, "payload must contain valid teamId, challengeMapId and locale values.")
    try:
        return TEAM_SERVICE.get_keystone_selector(config_module.load(), team_id, challenge_map_id, locale)
    except team_service.TeamServiceError as exc:
        raise ProtocolError(exc.code, exc.message) from exc


def handle_addon_get_status(payload: dict[str, Any]) -> dict[str, Any]:
    _require_empty_payload(payload)
    return ADDON_SERVICE.get_status(config_module.load())


def handle_addon_check(payload: dict[str, Any]) -> dict[str, Any]:
    _require_empty_payload(payload)
    try:
        return ADDON_SERVICE.check(config_module.load())
    except addon_service.AddonServiceError as exc:
        raise ProtocolError(exc.code, exc.message) from exc


def handle_addon_install(payload: dict[str, Any]) -> dict[str, Any]:
    _require_empty_payload(payload)
    try:
        return ADDON_SERVICE.install(config_module.load())
    except addon_service.AddonServiceError as exc:
        raise ProtocolError(exc.code, exc.message) from exc


def handle_addon_update(payload: dict[str, Any]) -> dict[str, Any]:
    _require_empty_payload(payload)
    try:
        return ADDON_SERVICE.update(config_module.load())
    except addon_service.AddonServiceError as exc:
        raise ProtocolError(exc.code, exc.message) from exc


def handle_addon_reinstall(payload: dict[str, Any]) -> dict[str, Any]:
    _require_empty_payload(payload)
    try:
        return ADDON_SERVICE.reinstall(config_module.load())
    except addon_service.AddonServiceError as exc:
        raise ProtocolError(exc.code, exc.message) from exc


COMMANDS: dict[str, Handler] = {
    "system.ping": handle_ping,
    "system.get_state": handle_get_state,
    "auth.login": handle_auth_login,
    "auth.register": handle_auth_register,
    "auth.logout": handle_auth_logout,
    "profile.set_avatar": handle_profile_set_avatar,
    "settings.get": handle_settings_get,
    "settings.update": handle_settings_update,
    "wow.detect": handle_wow_detect,
    "wow.list_accounts": handle_wow_list_accounts,
    "wow.select_accounts": handle_wow_select_accounts,
    "wow.select_install": handle_wow_select_install,
    "sync.get_status": handle_sync_get_status,
    "sync.start": handle_sync_start,
    "sync.stop": handle_sync_stop,
    "sync.force": handle_sync_force,
    "characters.get": handle_characters_get,
    "characters.refresh": handle_characters_refresh,
    "teams.list": handle_teams_list,
    "teams.get": handle_teams_get,
    "teams.keystone_selector": handle_teams_keystone_selector,
    "addon.get_status": handle_addon_get_status,
    "addon.check": handle_addon_check,
    "addon.install": handle_addon_install,
    "addon.update": handle_addon_update,
    "addon.reinstall": handle_addon_reinstall,
}


def write_message(message: dict[str, Any], stdout: TextIO = sys.stdout) -> None:
    with _STDOUT_LOCK:
        stdout.write(json.dumps(message, separators=(",", ":"), ensure_ascii=True) + "\n")
        stdout.flush()


def _log(message: str, stderr: TextIO = sys.stderr) -> None:
    stderr.write(message + "\n")
    stderr.flush()


def _discard_remainder_of_line(stdin) -> None:
    while True:
        chunk = stdin.readline(MAX_LINE_BYTES + 1)
        if not chunk or chunk.endswith(b"\n"):
            return


def _read_line(stdin) -> bytes | None:
    line = stdin.readline(MAX_LINE_BYTES + 1)
    if line == b"":
        return None
    if len(line) > MAX_LINE_BYTES:
        _discard_remainder_of_line(stdin)
        raise ProtocolError(ERROR_REQUEST_TOO_LARGE, "Request line exceeds maximum size.")
    return line


def _handle_line(line: bytes) -> dict[str, Any]:
    try:
        text = line.decode("utf-8")
        decoded = json.loads(text)
    except UnicodeDecodeError as exc:
        raise ProtocolError(ERROR_INVALID_JSON, "Request must be valid UTF-8 JSON.") from exc
    except json.JSONDecodeError as exc:
        raise ProtocolError(ERROR_INVALID_JSON, "Request must be valid JSON.") from exc

    request = validate_request(decoded)
    command = request["command"]
    handler = COMMANDS.get(command)
    if handler is None:
        raise ProtocolError(ERROR_UNKNOWN_COMMAND, f"Unknown command {command}.", request["id"])

    try:
        data = handler(request["payload"])
    except ProtocolError as exc:
        if exc.request_id is None:
            raise ProtocolError(exc.code, exc.message, request["id"]) from exc
        raise
    return success_response(request["id"], data)


def run(stdin=sys.stdin.buffer, stdout=sys.stdout, stderr=sys.stderr) -> int:
    cfg = config_module.load()
    SYNC_SERVICE.reconcile(emit_events=False)
    SYNC_SERVICE.set_emit(lambda event, data: write_message(event_message(event, data), stdout))
    CHARACTER_SERVICE.set_emit(lambda event, data: write_message(event_message(event, data), stdout))
    ADDON_SERVICE.set_emit(lambda event, data: write_message(event_message(event, data), stdout))
    write_message(event_message("system.ready", {"capabilities": list(COMMANDS)}), stdout)

    ADDON_SERVICE.check_async(cfg)
    if config_module.is_session_valid(cfg):
        CHARACTER_SERVICE.get_state(cfg)
        CHARACTER_SERVICE.refresh_async(cfg)

    try:
        while True:
            try:
                line = _read_line(stdin)
                if line is None:
                    return 0
                response = _handle_line(line)
            except ProtocolError as exc:
                _log(f"{exc.code}: {exc.message}", stderr)
                response = error_response(exc.request_id, exc.code, exc.message)
            except Exception:
                _log("INTERNAL_ERROR: unexpected bridge failure", stderr)
                response = error_response(None, ERROR_INTERNAL_ERROR, "Internal bridge error.")

            write_message(response, stdout)
    finally:
        SYNC_SERVICE.shutdown()


if __name__ == "__main__":
    raise SystemExit(run())
