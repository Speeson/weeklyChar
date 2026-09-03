import json
import os
import time
from pathlib import Path

_DIR = Path(os.environ.get("APPDATA", Path.home())) / "KeystoneClient"
_FILE = _DIR / "config.json"
TOKEN_EXPIRE_DAYS = 30
OLD_API_URLS = {
    "https://weeklychar-production.up.railway.app",
}
DEFAULT_API_URL = "https://api-keystonesync.esgarpe.dev"

_DEFAULTS = {
    "api_url": DEFAULT_API_URL,
    "sync_token": None,
    "access_token": None,
    "username": None,
    "avatar_url": None,
    "wow_path": None,
    "wow_install_path": None,
    "wow_accounts_selected": [],
    "wow_accounts_prompted": False,
    "saved_variables_instances": {},
    "start_minimized": False,
    "minimize_on_close": False,
    "close_behavior": "ask",
    "login_at": None,
    "lang": "es",
    "cached_characters": [],
    "pending_update_changelog": None,
    "pending_update_version": None,
    "last_changelog_version": None,
    "last_update_check": None,
}

def _normalize_api_url(value: str | None) -> str:
    api_url = (value or "").strip().rstrip("/")
    if not api_url or api_url in OLD_API_URLS:
        return DEFAULT_API_URL
    return api_url

def load() -> dict:
    loaded = None
    if _FILE.exists():
        try:
            with open(_FILE, encoding="utf-8") as f:
                loaded = json.load(f)
        except Exception:
            pass
    cfg = {**_DEFAULTS, **(loaded or {})}
    original_api_url = cfg.get("api_url")
    cfg["api_url"] = _normalize_api_url(original_api_url)
    migrated_close_behavior = loaded is not None and "close_behavior" not in loaded
    if migrated_close_behavior:
        cfg["close_behavior"] = "minimize" if loaded.get("minimize_on_close") else "ask"
    if loaded is not None and (cfg["api_url"] != original_api_url or migrated_close_behavior):
        save(cfg)
    return cfg

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
