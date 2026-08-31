import os
import time
import threading
from copy import deepcopy
from typing import Callable, Optional, Tuple

import requests
from slpp import slpp as lua

import config as cfg_module
import wow_path

_RIO_BASE = "https://raider.io/api/v1/characters/profile"
_INSTANCE_FIELD = "savedVariablesInstanceId"
_BASELINES_FIELD = "saved_variables_instances"
_VALID_REGIONS = {"eu", "us", "kr", "tw"}


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


def _decode_savedvariables(content: str):
    table_str = content[content.index("=") + 1 :].strip()
    data = lua.decode(table_str)
    if not isinstance(data, dict) or not data:
        raise ValueError("KeystoneSync SavedVariables has no valid database")

    instance_id = data.get(_INSTANCE_FIELD)
    if instance_id is not None:
        if (
            not isinstance(instance_id, str)
            or instance_id != instance_id.strip()
            or not 8 <= len(instance_id) <= 160
        ):
            raise ValueError("KeystoneSync SavedVariables has an invalid instance ID")

    characters = []
    for key, entry in data.items():
        if key == _INSTANCE_FIELD:
            continue
        if not isinstance(entry, dict):
            raise ValueError("KeystoneSync SavedVariables contains an invalid top-level entry")
        name = entry.get("character")
        realm = entry.get("realm")
        region = entry.get("region", "eu")
        if (
            not isinstance(name, str)
            or not name.strip()
            or not isinstance(realm, str)
            or not realm.strip()
            or region not in _VALID_REGIONS
        ):
            raise ValueError("KeystoneSync SavedVariables contains an invalid character entry")
        characters.append(entry)

    if not characters:
        raise ValueError("KeystoneSync SavedVariables contains no character entries")
    return instance_id, characters


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
            changed.append((account, mtime))

        if not changed:
            return

        time.sleep(0.5)
        for account, mtime in changed:
            if self._sync(account["savedvars_path"], account.get("name")):
                self._last_mtimes[account["savedvars_path"]] = mtime

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

    def _post(self, url, payload, headers, error_label):
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=10)
            if response.ok:
                return True
            if self.on_error:
                self.on_error(
                    f"{error_label}: HTTP {response.status_code} {response.text[:200]}"
                )
            return False
        except requests.exceptions.ConnectionError:
            if self.on_error:
                self.on_error("Sin conexión con la API.")
            return False
        except Exception as exc:
            if self.on_error:
                self.on_error(str(exc))
            return False

    def _instance_baselines(self):
        baselines = self.config.get(_BASELINES_FIELD)
        return deepcopy(baselines) if isinstance(baselines, dict) else {}

    def _sync(self, path: str, account_name: str | None = None):
        with open(path, encoding="utf-8") as f:
            content = f.read().strip()

        instance_id, characters = _decode_savedvariables(content)

        api_url = self.config["api_url"]
        token = self.config["sync_token"]
        headers = {"Authorization": f"Bearer {token}"}
        account = (account_name or self._account_name_from_path(path)).strip()
        if not account or len(account) > 128:
            raise ValueError("KeystoneSync SavedVariables has no valid WoW account scope")

        baselines = self._instance_baselines()
        account_key = account.casefold()
        stored_regions = baselines.get(account_key)
        if not isinstance(stored_regions, dict):
            stored_regions = {}
        current_regions = sorted({entry.get("region", "eu") for entry in characters})
        baseline_updates = {}

        if instance_id is not None:
            for region in current_regions:
                previous_instance = stored_regions.get(region)
                if previous_instance is not None and previous_instance != instance_id:
                    if not self._post(
                        f"{api_url}/api/me/keystone-loot/reset",
                        {"region": region, "wowAccount": account},
                        headers,
                        f"Error reconciliando KeystoneLoot para {account}/{region}",
                    ):
                        return False
                if previous_instance != instance_id:
                    baseline_updates[region] = instance_id

        synced = []
        for entry in characters:
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
                "wowAccount": account,
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
            if not self._post(
                f"{api_url}/api/keystones/update",
                payload,
                headers,
                f"Error sincronizando {name or '?'}",
            ):
                return False
            synced.append(name or "?")

        if baseline_updates:
            updated_regions = dict(stored_regions)
            updated_regions.update(baseline_updates)
            updated_baselines = deepcopy(baselines)
            updated_baselines[account_key] = updated_regions
            updated_config = dict(self.config)
            updated_config[_BASELINES_FIELD] = updated_baselines
            cfg_module.save(updated_config)
            self.config.clear()
            self.config.update(updated_config)

        if synced and self.on_sync:
            self.on_sync({"account": account, "characters": synced})
        return True
