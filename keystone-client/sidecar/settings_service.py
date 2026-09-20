from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

import config as config_module


SETTINGS_INVALID_PAYLOAD = "SETTINGS_INVALID_PAYLOAD"

_FIELD_MAP = {
    "startMinimized": "start_minimized",
    "minimizeOnClose": "minimize_on_close",
    "closeBehavior": "close_behavior",
    "lockWindowAspectRatio": "lock_window_aspect_ratio",
    "overlayEnabled": "overlay_enabled",
    "overlayShortcut": "overlay_shortcut",
    "lang": "lang",
}

_LANGUAGES = {"es", "en"}
_CLOSE_BEHAVIORS = {"ask", "minimize", "exit"}
_DEFAULT_OVERLAY_SHORTCUT = "Ctrl+Shift+K"
_MODIFIER_ALIASES = {
    "alt": "Alt",
    "option": "Alt",
    "control": "Ctrl",
    "ctrl": "Ctrl",
    "shift": "Shift",
    "cmd": "Super",
    "command": "Super",
    "super": "Super",
}
_SHORTCUT_KEY = re.compile(r"^[A-Za-z0-9]+$")


@dataclass(frozen=True)
class SettingsError(Exception):
    code: str
    message: str


def normalize_overlay_shortcut(value: Any) -> str:
    if not isinstance(value, str) or len(value) > 64:
        raise SettingsError(
            SETTINGS_INVALID_PAYLOAD,
            "overlayShortcut must be a keyboard shortcut string.",
        )

    parts = [part.strip() for part in value.split("+")]
    if len(parts) < 2 or any(not part for part in parts):
        raise SettingsError(
            SETTINGS_INVALID_PAYLOAD,
            "overlayShortcut must include a modifier and one key.",
        )

    modifiers = []
    for part in parts[:-1]:
        modifier = _MODIFIER_ALIASES.get(part.lower())
        if modifier is None or modifier in modifiers:
            raise SettingsError(
                SETTINGS_INVALID_PAYLOAD,
                "overlayShortcut contains invalid or repeated modifiers.",
            )
        modifiers.append(modifier)

    key = parts[-1]
    if key.lower() in _MODIFIER_ALIASES or not _SHORTCUT_KEY.fullmatch(key):
        raise SettingsError(
            SETTINGS_INVALID_PAYLOAD,
            "overlayShortcut must end with one supported key.",
        )

    return "+".join([*modifiers, key])


def get_settings(cfg: dict[str, Any]) -> dict[str, Any]:
    close_behavior = cfg.get("close_behavior")
    if close_behavior not in _CLOSE_BEHAVIORS:
        close_behavior = "minimize" if cfg.get("minimize_on_close") else "ask"
    try:
        overlay_shortcut = normalize_overlay_shortcut(cfg.get("overlay_shortcut"))
    except SettingsError:
        overlay_shortcut = _DEFAULT_OVERLAY_SHORTCUT
    return {
        "startMinimized": bool(cfg.get("start_minimized")),
        "minimizeOnClose": bool(cfg.get("minimize_on_close")),
        "closeBehavior": close_behavior,
        "lockWindowAspectRatio": bool(cfg.get("lock_window_aspect_ratio")),
        "overlayEnabled": bool(cfg.get("overlay_enabled")),
        "overlayShortcut": overlay_shortcut,
        "lang": cfg.get("lang") if cfg.get("lang") in _LANGUAGES else "es",
    }


def update_settings(cfg: dict[str, Any], updates: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(updates, dict):
        raise SettingsError(SETTINGS_INVALID_PAYLOAD, "settings update must be an object.")

    for key, value in updates.items():
        if key not in _FIELD_MAP:
            raise SettingsError(SETTINGS_INVALID_PAYLOAD, f"Unknown setting: {key}.")
        if key in (
            "startMinimized",
            "minimizeOnClose",
            "lockWindowAspectRatio",
            "overlayEnabled",
        ) and not isinstance(value, bool):
            raise SettingsError(SETTINGS_INVALID_PAYLOAD, f"{key} must be a boolean.")
        if key == "closeBehavior" and (not isinstance(value, str) or value not in _CLOSE_BEHAVIORS):
            raise SettingsError(SETTINGS_INVALID_PAYLOAD, "closeBehavior must be ask, minimize or exit.")
        if key == "lang" and (not isinstance(value, str) or value not in _LANGUAGES):
            raise SettingsError(SETTINGS_INVALID_PAYLOAD, "lang must be es or en.")
        if key == "overlayShortcut":
            normalize_overlay_shortcut(value)

    for key, value in updates.items():
        cfg[_FIELD_MAP[key]] = (
            normalize_overlay_shortcut(value) if key == "overlayShortcut" else value
        )
        if key == "closeBehavior":
            cfg["minimize_on_close"] = value == "minimize"

    config_module.save(cfg)
    return get_settings(cfg)
