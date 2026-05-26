import json
import os
from pathlib import Path

_DIR = Path(os.environ.get("APPDATA", Path.home())) / "KeystoneClient"
_FILE = _DIR / "config.json"

_DEFAULTS = {
    "api_url": "https://weeklychar-production.up.railway.app",
    "sync_token": None,
    "username": None,
    "wow_path": None,
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
