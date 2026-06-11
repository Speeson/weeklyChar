import json
import os
import time
from pathlib import Path

_DIR = Path(os.environ.get("APPDATA", Path.home())) / "KeystoneClient"
_FILE = _DIR / "config.json"
TOKEN_EXPIRE_DAYS = 30

_DEFAULTS = {
    "api_url": "https://weeklychar-production.up.railway.app",
    "sync_token": None,
    "access_token": None,
    "username": None,
    "avatar_url": None,
    "wow_path": None,
    "wow_install_path": None,
    "start_minimized": False,
    "minimize_on_close": False,
    "login_at": None,
    "lang": "es",
    "cached_characters": [],
    "pending_update_changelog": None,
    "pending_update_version": None,
    "last_changelog_version": None,
}

def load() -> dict:
    if _FILE.exists():
        try:
            with open(_FILE, encoding="utf-8") as f:
                return {**_DEFAULTS, **json.load(f)}
        except Exception:
            pass
    return _DEFAULTS.copy()

def save(cfg: dict) -> None:
    _DIR.mkdir(parents=True, exist_ok=True)
    with open(_FILE, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2)

def is_session_valid(cfg: dict) -> bool:
    if not cfg.get("sync_token"):
        return False
    login_at = cfg.get("login_at")
    if not login_at:
        return False
    return (time.time() - login_at) < TOKEN_EXPIRE_DAYS * 86400
