import os
import time
import threading
from typing import Callable, Optional, Tuple

import requests
from slpp import slpp as lua

import config as cfg_module
import wow_path

_RIO_BASE = "https://raider.io/api/v1/characters/profile"


def _normalize_ilvl(value):
    if value is None:
        return None
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return None


def _lua_array_for_json(value):
    if isinstance(value, list):
        return list(value)
    if not isinstance(value, dict):
        return value
    if not value:
        return []

    keys = sorted(value) if all(isinstance(key, int) for key in value) else []
    if keys != list(range(1, len(value) + 1)):
        return value
    return [value[index] for index in keys]


def _keystone_loot_for_json(value):
    if not isinstance(value, dict):
        return value

    snapshot = dict(value)
    favorites = _lua_array_for_json(snapshot.get("favorites"))
    if isinstance(favorites, list):
        copied_favorites = []
        for favorite in favorites:
            if not isinstance(favorite, dict):
                copied_favorites.append(favorite)
                continue
            copied_favorite = dict(favorite)
            for field in ("bonusIds", "gems"):
                if field in copied_favorite:
                    copied_favorite[field] = _lua_array_for_json(copied_favorite[field])
            copied_favorites.append(copied_favorite)
        snapshot["favorites"] = copied_favorites

    voidcore = snapshot.get("voidcore")
    if isinstance(voidcore, dict):
        copied_voidcore = dict(voidcore)
        if "usedItems" in copied_voidcore:
            copied_voidcore["usedItems"] = _lua_array_for_json(copied_voidcore["usedItems"])
        snapshot["voidcore"] = copied_voidcore

    return snapshot


class SyncWorker(threading.Thread):
    def __init__(self, config: dict, on_sync: Callable = None, on_error: Callable = None):
        super().__init__(daemon=True)
        self.config = config
        self.on_sync = on_sync
        self.on_error = on_error
        self._last_mtime = 0
        self._last_mtimes = {}
        self._stop = threading.Event()

    def force_sync(self):
        self._last_mtime = 0
        self._last_mtimes = {}

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
        accounts = wow_path.selected_savedvars_paths(self.config)
        if not accounts:
            discovered = wow_path.discover_savedvars_accounts(self.config.get("wow_install_path"))
            existing = [a for a in discovered if a.get("exists")]
            if len(existing) > 1 and not self.config.get("wow_accounts_selected"):
                return
            path = self.config.get("wow_path")
            if not path or not os.path.exists(path):
                path = wow_path.find_savedvars(self.config.get("wow_install_path"))
            if not path or not os.path.exists(path):
                return
            accounts = [{"name": self._account_name_from_path(path), "savedvars_path": path}]
            self.config["wow_path"] = path
            cfg_module.save(self.config)

        changed = []
        for account in accounts:
            path = account["savedvars_path"]
            if not path or not os.path.exists(path):
                continue
            mtime = os.path.getmtime(path)
            if mtime <= self._last_mtimes.get(path, 0):
                continue
            self._last_mtimes[path] = mtime
            changed.append(account)

        if not changed:
            return

        time.sleep(0.5)
        for account in changed:
            self._sync(account["savedvars_path"], account.get("name"))

    def _account_name_from_path(self, path: str) -> str:
        try:
            return os.path.basename(os.path.dirname(os.path.dirname(path)))
        except Exception:
            return "WoW"

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

    def _sync(self, path: str, account_name: str | None = None):
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
            addon_ilvl = entry.get("ilvl")

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
                "wowAccount": account_name or self._account_name_from_path(path),
                "avatarUrl": avatar_url,
                "rioScore": rio_score,
                "wowClass": wow_class,
                "ilvl": addon_ilvl if addon_ilvl is not None else ilvl,
                "vault": entry.get("vault"),
                "preyHunts": entry.get("preyHunts"),
                "currencies": entry.get("currencies"),
                "money": entry.get("money"),
                "mythicPlusSeason": entry.get("mythicPlusSeason"),
            }
            if "keystoneLoot" in entry:
                payload["keystoneLoot"] = _keystone_loot_for_json(entry["keystoneLoot"])
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
            self.on_sync({"account": account_name or self._account_name_from_path(path), "characters": synced})
