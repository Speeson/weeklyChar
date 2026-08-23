from __future__ import annotations

from pathlib import Path
from typing import Any

import config as config_module
import wow_path


ERROR_WOW_INVALID_INSTALL = "WOW_INVALID_INSTALL"
ERROR_WOW_INVALID_ACCOUNT_SELECTION = "WOW_INVALID_ACCOUNT_SELECTION"


class WowError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


def _install_state(wow_dir: str | Path | None) -> dict[str, Any]:
    normalized = wow_path.normalize_wow_dir(wow_dir)
    valid = bool(normalized and wow_path.is_wow_dir(normalized))
    retail = normalized / "_retail_" if normalized else None
    addons = wow_path.addons_folder_for(normalized) if normalized else None

    return {
        "detected": valid,
        "installPath": str(normalized) if valid and normalized else None,
        "retailPath": str(retail) if valid and retail else None,
        "addonsPath": addons if valid else None,
    }


def _selected_names(cfg: dict[str, Any], accounts: list[dict[str, Any]]) -> set[str]:
    configured = cfg.get("wow_accounts_selected") or []
    configured_names = {str(name).lower() for name in configured if isinstance(name, str)}
    if configured_names:
        return configured_names

    existing = [account for account in accounts if account.get("exists")]
    if len(existing) == 1:
        return {str(existing[0]["name"]).lower()}

    legacy = cfg.get("wow_path")
    if legacy:
        legacy_norm = str(legacy).lower()
        return {
            str(account["name"]).lower()
            for account in existing
            if str(account.get("savedvars_path", "")).lower() == legacy_norm
        }

    return set()


def _account_dto(account: dict[str, Any], selected_names: set[str]) -> dict[str, Any]:
    return {
        "name": account["name"],
        "savedVariablesPath": account["savedvars_path"],
        "savedVariablesExists": bool(account.get("exists")),
        "selected": str(account["name"]).lower() in selected_names,
        "modifiedAt": account.get("mtime"),
    }


def get_wow_state(cfg: dict[str, Any]) -> dict[str, Any]:
    configured = cfg.get("wow_install_path")
    found = str(wow_path.normalize_wow_dir(configured)) if wow_path.is_wow_dir(configured) else None
    accounts = wow_path.discover_savedvars_accounts(found) if found else []
    selected = _selected_names(cfg, accounts)

    selected_accounts = [
        account["name"] for account in accounts if str(account["name"]).lower() in selected
    ]
    configured_selection = bool(cfg.get("wow_accounts_prompted")) or bool(cfg.get("wow_path"))
    return {
        "install": _install_state(found),
        "accounts": [_account_dto(account, selected) for account in accounts],
        "selectedAccounts": selected_accounts,
        "configurationComplete": bool(found and configured_selection and selected_accounts),
    }


def detect_wow(cfg: dict[str, Any]) -> dict[str, Any]:
    found = wow_path.find_wow_dir(cfg.get("wow_install_path"))
    if found and cfg.get("wow_install_path") != found:
        cfg["wow_install_path"] = found
        config_module.save(cfg)
    return get_wow_state(cfg)


def list_accounts(cfg: dict[str, Any]) -> dict[str, Any]:
    return get_wow_state(cfg)


def select_install(cfg: dict[str, Any], path: str) -> dict[str, Any]:
    normalized = wow_path.normalize_wow_dir(path)
    if not normalized or not wow_path.is_wow_dir(normalized):
        raise WowError(
            ERROR_WOW_INVALID_INSTALL,
            "The selected folder is not a valid World of Warcraft installation.",
        )

    discovered = wow_path.discover_savedvars_accounts(str(normalized))
    available = {str(account["name"]).lower(): account for account in discovered}
    previous = cfg.get("wow_accounts_selected") or []
    preserved = [
        available[str(name).lower()]["name"]
        for name in previous
        if isinstance(name, str) and str(name).lower() in available
    ]
    selected_keys = {name.lower() for name in preserved}
    active = [
        account
        for account in discovered
        if account.get("exists") and str(account["name"]).lower() in selected_keys
    ]

    cfg["wow_install_path"] = str(normalized)
    cfg["wow_accounts_selected"] = preserved
    cfg["wow_accounts_prompted"] = bool(preserved) and bool(cfg.get("wow_accounts_prompted"))
    cfg["wow_path"] = active[0]["savedvars_path"] if active else None
    config_module.save(cfg)
    return get_wow_state(cfg)


def _dedupe_account_names(accounts: list[Any]) -> list[str]:
    if not isinstance(accounts, list) or not accounts:
        raise WowError(
            ERROR_WOW_INVALID_ACCOUNT_SELECTION,
            "Select at least one World of Warcraft account.",
        )

    selected: list[str] = []
    seen: set[str] = set()
    for account in accounts:
        if not isinstance(account, str) or not account.strip():
            raise WowError(
                ERROR_WOW_INVALID_ACCOUNT_SELECTION,
                "Account names must be non-empty strings.",
            )
        name = account.strip()
        key = name.lower()
        if key not in seen:
            seen.add(key)
            selected.append(name)
    return selected


def select_accounts(cfg: dict[str, Any], accounts: list[Any]) -> dict[str, Any]:
    selected = _dedupe_account_names(accounts)
    configured = cfg.get("wow_install_path")
    found = str(wow_path.normalize_wow_dir(configured)) if wow_path.is_wow_dir(configured) else None
    discovered = wow_path.discover_savedvars_accounts(found) if found else []
    by_name = {str(account["name"]).lower(): account for account in discovered}
    unknown = [name for name in selected if name.lower() not in by_name]
    if unknown:
        raise WowError(
            ERROR_WOW_INVALID_ACCOUNT_SELECTION,
            "Selected World of Warcraft accounts were not found.",
        )

    canonical = [by_name[name.lower()]["name"] for name in selected]
    selected_keys = {name.lower() for name in canonical}
    active = [
        account
        for account in discovered
        if account.get("exists") and str(account["name"]).lower() in selected_keys
    ]

    cfg["wow_accounts_selected"] = canonical
    cfg["wow_accounts_prompted"] = True
    cfg["wow_path"] = active[0]["savedvars_path"] if active else None
    config_module.save(cfg)
    return get_wow_state(cfg)
