from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

import config as config_module


_FILE = config_module._DIR / "changelog.json"


def _read_version() -> str | None:
    try:
        value = json.loads(_FILE.read_text(encoding="utf-8"))
        version = value.get("seenVersion") if isinstance(value, dict) else None
        return version if isinstance(version, str) and version else None
    except (OSError, ValueError):
        return None


def _write_version(version: str) -> None:
    _FILE.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix="changelog-", suffix=".tmp", dir=_FILE.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            json.dump({"seenVersion": version}, stream)
        os.replace(temporary, _FILE)
    finally:
        Path(temporary).unlink(missing_ok=True)


def check(version: str, browser_seen: str | None, legacy_seen: str | None) -> dict[str, bool]:
    persisted_seen = _read_version()
    seen = version if browser_seen == version else (persisted_seen or legacy_seen or browser_seen)
    if persisted_seen != version:
        _write_version(version)
    return {"show": seen is not None and seen != version, "firstRun": seen is None}
