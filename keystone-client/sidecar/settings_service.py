from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import config as config_module


SETTINGS_INVALID_PAYLOAD = "SETTINGS_INVALID_PAYLOAD"

_FIELD_MAP = {
    "startMinimized": "start_minimized",
    "minimizeOnClose": "minimize_on_close",
    "closeBehavior": "close_behavior",
    "lang": "lang",
}

_LANGUAGES = {"es", "en"}
_CLOSE_BEHAVIORS = {"ask", "minimize", "exit"}


@dataclass(frozen=True)
class SettingsError(Exception):
    code: str
    message: str


def get_settings(cfg: dict[str, Any]) -> dict[str, Any]:
    close_behavior = cfg.get("close_behavior")
    if close_behavior not in _CLOSE_BEHAVIORS:
        close_behavior = "minimize" if cfg.get("minimize_on_close") else "ask"
    return {
        "startMinimized": bool(cfg.get("start_minimized")),
        "minimizeOnClose": bool(cfg.get("minimize_on_close")),
        "closeBehavior": close_behavior,
        "lang": cfg.get("lang") if cfg.get("lang") in _LANGUAGES else "es",
    }


def update_settings(cfg: dict[str, Any], updates: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(updates, dict):
        raise SettingsError(SETTINGS_INVALID_PAYLOAD, "settings update must be an object.")

    for key, value in updates.items():
        if key not in _FIELD_MAP:
            raise SettingsError(SETTINGS_INVALID_PAYLOAD, f"Unknown setting: {key}.")
        if key in ("startMinimized", "minimizeOnClose") and not isinstance(value, bool):
            raise SettingsError(SETTINGS_INVALID_PAYLOAD, f"{key} must be a boolean.")
        if key == "closeBehavior" and (not isinstance(value, str) or value not in _CLOSE_BEHAVIORS):
            raise SettingsError(SETTINGS_INVALID_PAYLOAD, "closeBehavior must be ask, minimize or exit.")
        if key == "lang" and (not isinstance(value, str) or value not in _LANGUAGES):
            raise SettingsError(SETTINGS_INVALID_PAYLOAD, "lang must be es or en.")

    for key, value in updates.items():
        cfg[_FIELD_MAP[key]] = value
        if key == "closeBehavior":
            cfg["minimize_on_close"] = value == "minimize"

    config_module.save(cfg)
    return get_settings(cfg)
