from __future__ import annotations

import sys
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

import requests

import addon_installer
import addon_updater
import config as config_module
import wow_path


ADDON_INVALID_STATE = "ADDON_INVALID_STATE"
ADDON_OPERATION_RUNNING = "ADDON_OPERATION_RUNNING"

Emit = Callable[[str, dict[str, Any]], None]


class AddonServiceError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _client_version_path() -> Path:
    bundle_root = getattr(sys, "_MEIPASS", None)
    if bundle_root:
        return Path(bundle_root) / "VERSION"
    return Path(__file__).resolve().parents[1] / "VERSION"


def _client_version() -> str | None:
    try:
        return _client_version_path().read_text(encoding="utf-8").strip()
    except Exception:
        return None


def _addons_path(cfg: dict[str, Any]) -> str | None:
    return wow_path.addons_folder_for(cfg.get("wow_install_path"))


def _path_key(path: str | Path | None) -> str | None:
    return str(Path(path).resolve()).casefold() if path else None


def _cache_available(cache_root: str | Path | None = None) -> bool:
    return addon_updater.get_cached_release(cache_root) is not None


def _state_from_check(check: addon_updater.UpdateCheck) -> str:
    if check.status in {"not_installed", "installed_unknown"}:
        return "not-installed" if check.status == "not_installed" else "error"
    if check.status in {"not_installed_cached", "installed_unknown_cached"}:
        return "offline-cache"
    if check.status in {"update_available", "update_available_cached"}:
        return "update-available"
    if check.status in {"up_to_date", "up_to_date_cached"}:
        return "current"
    if check.status == "installed_newer":
        return "local-newer"
    if check.status == "offline_no_candidate":
        return "unavailable"
    return "error"


def _status_from_installed(
    addons_path: str | Path | None,
    *,
    cache_root: str | Path | None = None,
    last_check_at: str | None = None,
    latest_version: str | None = None,
    source: str | None = None,
    message: str | None = None,
    operation: dict[str, Any] | None = None,
) -> dict[str, Any]:
    installed = addon_updater.installed_status(addons_path)
    state = "not-installed"
    if installed.get("installed"):
        state = "error" if installed.get("corrupt") or installed.get("invalid_version") else "current"

    return {
        "installed": bool(installed.get("installed")),
        "installedVersion": installed.get("version"),
        "latestVersion": latest_version,
        "state": state,
        "cacheAvailable": _cache_available(cache_root),
        "lastCheckAt": last_check_at,
        "source": source,
        "message": message or installed.get("error") or "",
        "operation": operation,
    }


def _status_from_check(
    check: addon_updater.UpdateCheck,
    *,
    cache_root: str | Path | None = None,
    last_check_at: str | None = None,
    operation: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "installed": check.installed_version is not None,
        "installedVersion": check.installed_version,
        "latestVersion": check.latest_version,
        "state": _state_from_check(check),
        "cacheAvailable": check.cached is not None or _cache_available(cache_root),
        "lastCheckAt": last_check_at,
        "source": check.source,
        "message": check.message,
        "operation": operation,
    }


class AddonService:
    def __init__(
        self,
        *,
        session=requests,
        cache_root: str | Path | None = None,
        client_version: str | None = None,
    ):
        self._session = session
        self._cache_root = cache_root
        self._client_version = client_version or _client_version()
        self._emit: Emit = lambda _event, _data: None
        self._lock = threading.Lock()
        self._operation: dict[str, Any] | None = None
        self._last_check: addon_updater.UpdateCheck | None = None
        self._last_check_at: str | None = None
        self._last_check_error: str | None = None
        self._last_check_path: str | None = None
        self._auto_checked_paths: set[str] = set()
        self._check_thread: threading.Thread | None = None

    def set_emit(self, emit: Emit) -> None:
        self._emit = emit

    def get_status(self, cfg: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            operation = dict(self._operation) if self._operation else None
            last_check = self._last_check
            last_check_at = self._last_check_at
            last_check_error = self._last_check_error
            last_check_path = self._last_check_path
        addons_path = _addons_path(cfg)
        current_path = _path_key(addons_path)

        if last_check_error and last_check_path == current_path:
            status = _status_from_installed(
                addons_path,
                cache_root=self._cache_root,
                last_check_at=last_check_at,
                message=last_check_error,
                operation=operation,
            )
            status["state"] = "error"
            return status

        if last_check and last_check_path == current_path:
            return _status_from_check(
                last_check,
                cache_root=self._cache_root,
                last_check_at=last_check_at,
                operation=operation,
            )

        return _status_from_installed(
            addons_path,
            cache_root=self._cache_root,
            last_check_at=last_check_at,
            operation=operation,
        )

    def check(self, cfg: dict[str, Any]) -> dict[str, Any]:
        addons_path = self._require_addons_path(cfg)
        self._emit("addon.check.started", {})
        try:
            check = addon_updater.check_for_update(
                addons_path,
                session=self._session,
                cache_root=self._cache_root,
                client_version=self._client_version,
            )
        except addon_updater.AddonUpdateError as exc:
            self._record_check_error(cfg, str(exc))
            raise AddonServiceError("ADDON_CHECK_FAILED", str(exc)) from exc

        checked_at = _now_iso()
        with self._lock:
            self._last_check = check
            self._last_check_at = checked_at
            self._last_check_error = None
            self._last_check_path = _path_key(addons_path)
            operation = dict(self._operation) if self._operation else None

        status = _status_from_check(
            check,
            cache_root=self._cache_root,
            last_check_at=checked_at,
            operation=operation,
        )
        self._emit("addon.check.completed", status)
        self._emit("addon.status.changed", status)
        return status

    def check_async(self, cfg: dict[str, Any]) -> bool:
        addons_path = _addons_path(cfg)
        if not addons_path:
            return False
        path_key = _path_key(addons_path)
        with self._lock:
            if path_key in self._auto_checked_paths:
                return False
            self._auto_checked_paths.add(path_key)
            thread = threading.Timer(
                0.05,
                self._check_background,
                args=(dict(cfg),),
            )
            thread.daemon = True
            self._check_thread = thread
            thread.start()
        return True

    def wait_for_idle(self, timeout: float = 5) -> bool:
        thread = self._check_thread
        if thread is not None:
            thread.join(timeout=timeout)
        return thread is None or not thread.is_alive()

    def _check_background(self, cfg: dict[str, Any]) -> None:
        try:
            self.check(cfg)
        except AddonServiceError as exc:
            self._emit("addon.check.failed", {"code": exc.code, "message": exc.message})

    def _record_check_error(self, cfg: dict[str, Any], message: str) -> None:
        with self._lock:
            self._last_check_at = _now_iso()
            self._last_check_error = message
            self._last_check_path = _path_key(_addons_path(cfg))
        self._emit("addon.status.changed", self.get_status(cfg))

    def install(self, cfg: dict[str, Any]) -> dict[str, Any]:
        return self._start_operation("install", cfg, require_update=False, require_installed=False)

    def update(self, cfg: dict[str, Any]) -> dict[str, Any]:
        return self._start_operation("update", cfg, require_update=True, require_installed=True)

    def reinstall(self, cfg: dict[str, Any]) -> dict[str, Any]:
        return self._start_operation("reinstall", cfg, require_update=False, require_installed=True)

    def _require_addons_path(self, cfg: dict[str, Any]) -> str:
        addons_path = _addons_path(cfg)
        if not addons_path:
            raise AddonServiceError(
                ADDON_INVALID_STATE,
                "Select a valid World of Warcraft installation before managing the addon.",
            )
        return addons_path

    def _start_operation(
        self,
        action: str,
        cfg: dict[str, Any],
        *,
        require_update: bool,
        require_installed: bool,
    ) -> dict[str, Any]:
        addons_path = self._require_addons_path(cfg)
        with self._lock:
            if self._operation:
                raise AddonServiceError(
                    ADDON_OPERATION_RUNNING,
                    "An addon install operation is already running.",
                )
            self._operation = {
                "action": action,
                "state": "starting",
                "startedAt": _now_iso(),
                "finishedAt": None,
                "message": "Starting addon operation.",
            }
            operation = dict(self._operation)

        thread = threading.Thread(
            target=self._run_operation,
            args=(action, addons_path, require_update, require_installed),
            daemon=True,
        )
        thread.start()
        status = self.get_status(cfg)
        status["operation"] = operation
        return status

    def _set_operation_stage(self, action: str, stage: str, message: str) -> dict[str, Any]:
        with self._lock:
            if not self._operation:
                return {"action": action, "state": stage, "message": message}
            self._operation.update({"state": stage, "message": message})
            return dict(self._operation)

    def _finish_operation(self, action: str, state: str, message: str) -> dict[str, Any]:
        with self._lock:
            operation = self._operation or {"action": action, "startedAt": None}
            operation.update({"state": state, "message": message, "finishedAt": _now_iso()})
            self._operation = None
            return dict(operation)

    def _run_operation(
        self,
        action: str,
        addons_path: str,
        require_update: bool,
        require_installed: bool,
    ) -> None:
        self._emit("addon.install.started", self._set_operation_stage(action, "checking", "Checking addon release."))
        try:
            check = addon_updater.check_for_update(
                addons_path,
                session=self._session,
                cache_root=self._cache_root,
                client_version=self._client_version,
            )
            checked_at = _now_iso()
            with self._lock:
                self._last_check = check
                self._last_check_at = checked_at

            if require_installed and not check.installed_version:
                raise AddonServiceError(ADDON_INVALID_STATE, "The addon is not installed.")
            if require_update and not check.update_available:
                raise AddonServiceError(ADDON_INVALID_STATE, check.message)
            if not check.install_available:
                raise AddonServiceError(ADDON_INVALID_STATE, check.message)

            self._emit(
                "addon.install.progress",
                self._set_operation_stage(action, "downloading", "Resolving addon package."),
            )
            self._emit(
                "addon.install.progress",
                self._set_operation_stage(action, "installing", "Installing validated addon package."),
            )
            result = addon_updater.install_from_check(
                addons_path,
                check,
                session=self._session,
                cache_root=self._cache_root,
                client_version=self._client_version,
            )
            self._emit(
                "addon.install.progress",
                self._set_operation_stage(action, "verifying", "Verifying installed addon."),
            )
            status = _status_from_installed(
                addons_path,
                cache_root=self._cache_root,
                last_check_at=checked_at,
                latest_version=result.version,
                source=result.source,
                message=f"Addon {action} completed.",
            )
            operation = self._finish_operation(action, "completed", f"Addon {action} completed.")
            self._emit("addon.install.completed", {"operation": operation, "status": status})
            self._emit("addon.status.changed", status)
        except AddonServiceError as exc:
            operation = self._finish_operation(action, "failed", exc.message)
            self._emit("addon.install.failed", {"operation": operation, "error": {"code": exc.code, "message": exc.message}})
        except addon_updater.AddonUpdateError as exc:
            operation = self._finish_operation(action, "failed", str(exc))
            self._emit("addon.install.failed", {"operation": operation, "error": {"code": "ADDON_INSTALL_FAILED", "message": str(exc)}})
        except Exception:
            message = "Addon install operation failed."
            operation = self._finish_operation(action, "failed", message)
            self._emit("addon.install.failed", {"operation": operation, "error": {"code": "ADDON_INSTALL_FAILED", "message": message}})
