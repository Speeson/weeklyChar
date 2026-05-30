import os
import time
import threading
from typing import Callable, Optional, Tuple

import requests
from slpp import slpp as lua

_RIO_BASE = "https://raider.io/api/v1/characters/profile"


def _normalize_ilvl(value):
    if value is None:
        return None
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return None


class SyncWorker(threading.Thread):
    def __init__(self, config: dict, on_sync: Callable = None, on_error: Callable = None):
        super().__init__(daemon=True)
        self.config = config
        self.on_sync = on_sync
        self.on_error = on_error
        self._last_mtime = 0
        self._stop = threading.Event()

    def force_sync(self):
        self._last_mtime = 0

    def stop(self):
        self._stop.set()

    def run(self):
        while not self._stop.is_set():
            try:
                self._check()
            except Exception as e:
                if self.on_error:
                    self.on_error(str(e))
            time.sleep(2)

    def _check(self):
        path = self.config.get("wow_path")
        if not path or not os.path.exists(path):
            return
        mtime = os.path.getmtime(path)
        if mtime <= self._last_mtime:
            return
        self._last_mtime = mtime
        time.sleep(0.5)
        self._sync(path)

    def _fetch_raiderio(self, name: str, realm: str, region: str) -> Tuple[Optional[str], Optional[float], Optional[str], Optional[int]]:
        """Return (avatar_url, rio_score, wow_class, ilvl) from Raider.IO, or (None, None, None, None) on failure."""
        try:
            params = {
                "region": region,
                "realm": realm,
                "name": name,
                "fields": "thumbnail_url,class,mythic_plus_scores_by_season:current,gear",
            }
            r = requests.get(_RIO_BASE, params=params, timeout=8)
            if not r.ok:
                return None, None, None, None
            data = r.json()
            avatar = data.get("thumbnail_url")
            wow_class = data.get("class")
            seasons = data.get("mythic_plus_scores_by_season") or []
            score = seasons[0]["scores"]["all"] if seasons else None
            ilvl = _normalize_ilvl((data.get("gear") or {}).get("item_level_equipped"))
            return avatar, score, wow_class, ilvl
        except Exception:
            return None, None, None, None

    def _sync(self, path: str):
        with open(path, encoding="utf-8") as f:
            content = f.read().strip()

        table_str = content[content.index("=") + 1:].strip()
        data = lua.decode(table_str)
        if not data:
            return

        api_url = self.config["api_url"]
        token = self.config["sync_token"]
        headers = {"Authorization": f"Bearer {token}"}

        synced = []
        for _, entry in data.items():
            name   = entry.get("character")
            realm  = entry.get("realm")
            region = entry.get("region", "eu")

            avatar_url, rio_score, wow_class, ilvl = self._fetch_raiderio(name, realm, region)

            payload = {
                "character": name,
                "realm": realm,
                "region": region,
                "hasKeystone": entry.get("hasKeystone", False),
                "keystoneLevel": entry.get("keystoneLevel"),
                "keystoneChallengeMapId": entry.get("keystoneChallengeMapId"),
                "keystoneMapId": entry.get("keystoneMapId"),
                "keystoneDungeon": entry.get("keystoneDungeon"),
                "updatedAt": entry.get("updatedAt"),
                "updatedReason": entry.get("updatedReason"),
                "avatarUrl": avatar_url,
                "rioScore": rio_score,
                "wowClass": wow_class,
                "ilvl": ilvl,
                "vault": entry.get("vault"),
                "preyHunts": entry.get("preyHunts"),
                "currencies": entry.get("currencies"),
                "mythicPlusSeason": entry.get("mythicPlusSeason"),
            }
            try:
                r = requests.post(
                    f"{api_url}/api/keystones/update",
                    json=payload,
                    headers=headers,
                    timeout=10,
                )
                if r.ok:
                    synced.append(name or "?")
                else:
                    if self.on_error:
                        self.on_error(f"Error sincronizando {name or '?'}: HTTP {r.status_code} {r.text[:200]}")
                    return
            except requests.exceptions.ConnectionError:
                if self.on_error:
                    self.on_error("Sin conexión con la API.")
                return
            except Exception as e:
                if self.on_error:
                    self.on_error(str(e))
                return

        if synced and self.on_sync:
            self.on_sync(synced)
