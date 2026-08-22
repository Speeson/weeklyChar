from __future__ import annotations

import threading
import time
from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any, Protocol

import config as config_module
import wow_path


SYNC_NOT_AUTHENTICATED = "SYNC_NOT_AUTHENTICATED"
SYNC_NO_ACCOUNT_SELECTED = "SYNC_NO_ACCOUNT_SELECTED"
SYNC_SAVEDVARS_NOT_FOUND = "SYNC_SAVEDVARS_NOT_FOUND"
SYNC_PARSE_ERROR = "SYNC_PARSE_ERROR"
SYNC_NETWORK_ERROR = "SYNC_NETWORK_ERROR"
SYNC_SERVER_ERROR = "SYNC_SERVER_ERROR"
SYNC_ALREADY_STOPPED = "SYNC_ALREADY_STOPPED"
SYNC_INTERNAL_ERROR = "SYNC_INTERNAL_ERROR"

SyncEventEmitter = Callable[[str, dict[str, Any]], None]
ConfigLoader = Callable[[], dict[str, Any]]
WorkerFactory = Callable[
    [dict[str, Any], Callable[[dict[str, Any]], None], Callable[[str], None]],
    "SyncWorkerProtocol",
]


class SyncWorkerProtocol(Protocol):
    config: dict[str, Any]

    def start(self) -> None: ...
    def is_alive(self) -> bool: ...
    def stop(self) -> None: ...
    def join(self, timeout: float | None = None) -> None: ...
    def _sync(self, path: str, account_name: str | None = None): ...


class SyncServiceError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _safe_error(raw: str | None) -> tuple[str, str]:
    text = (raw or "").strip()
    lowered = text.lower()
    if not text:
        return SYNC_INTERNAL_ERROR, "Unable to sync selected account."
    if "sin conexion" in lowered or "sin conexión" in lowered or "connection" in lowered:
        return SYNC_NETWORK_ERROR, "Unable to reach KeystoneSync API."
    if text.startswith("Error sincronizando") or "http " in lowered:
        return SYNC_SERVER_ERROR, "KeystoneSync API rejected the sync request."
    if "decode" in lowered or "parse" in lowered or "savedvariables" in lowered:
        return SYNC_PARSE_ERROR, "Unable to read KeystoneSync SavedVariables."
    return SYNC_INTERNAL_ERROR, "Unable to sync selected account."


class SyncService:
    def __init__(
        self,
        *,
        config_loader: ConfigLoader = config_module.load,
        worker_factory: WorkerFactory | None = None,
        emit: SyncEventEmitter | None = None,
    ):
        self._config_loader = config_loader
        self._worker_factory = worker_factory
        self._emit = emit or (lambda _event, _data: None)
        self._lock = threading.RLock()
        self._sync_lock = threading.Lock()
        self._worker: SyncWorkerProtocol | None = None
        self._force_thread: threading.Thread | None = None
        self._running = False
        self._state = "idle"
        self._last_sync_at: str | None = None
        self._last_success_at: str | None = None
        self._last_error: str | None = None
        self._selected_accounts = 0
        self._operation_failed = False
        self._operation_error: tuple[str, str] | None = None
        self._operation_synced = 0

    def set_emit(self, emit: SyncEventEmitter | None) -> None:
        with self._lock:
            self._emit = emit or (lambda _event, _data: None)

    def get_status(self) -> dict[str, Any]:
        cfg = self._config_loader()
        with self._lock:
            self._refresh_running_locked()
            self._selected_accounts = self._selected_accounts_count(cfg)
            return self._status_locked()

    def start(self) -> dict[str, Any]:
        cfg, accounts = self._require_ready()
        emit_started = False
        with self._lock:
            self._refresh_running_locked()
            self._selected_accounts = len(accounts)
            if not self._running:
                worker = self._create_worker(cfg)
                self._worker = worker
                self._running = True
                self._state = "watching"
                self._last_error = None
                worker.start()
                emit_started = True
            status = self._status_locked()

        if emit_started:
            self._emit_event("sync.started", status)
            self._emit_event("sync.status", status)
        return status

    def stop(self, *, emit_status: bool = True) -> dict[str, Any]:
        with self._lock:
            worker = self._worker
            self._worker = None
            self._running = False
            if self._state == "watching":
                self._state = "idle"
            status = self._status_locked()

        if worker is not None:
            worker.stop()
            worker.join(timeout=5)
        if emit_status:
            status = self.get_status()
            self._emit_event("sync.status", status)
        return status

    def force(self) -> dict[str, Any]:
        cfg, accounts = self._require_ready()
        with self._lock:
            self._refresh_running_locked()
            self._selected_accounts = len(accounts)
            if self._is_force_alive_locked() or self._state == "syncing":
                return self._status_locked()
            worker = self._worker if self._running and self._worker is not None else self._create_worker(cfg)
            force_thread = threading.Thread(
                target=self._force_accounts,
                args=(worker, accounts),
                daemon=True,
            )
            self._force_thread = force_thread
            self._state = "syncing"
            self._last_sync_at = _utc_now()
            self._last_error = None
            status = self._status_locked()
            force_thread.start()

        self._emit_event("sync.status", status)
        return status

    def shutdown(self) -> dict[str, Any]:
        return self.stop(emit_status=False)

    def wait_for_idle(self, timeout: float = 5) -> bool:
        deadline = time.time() + timeout
        while time.time() < deadline:
            with self._lock:
                force_alive = self._is_force_alive_locked()
                syncing = self._state == "syncing"
            if not force_alive and not syncing:
                return True
            time.sleep(0.02)
        return False

    def _create_worker(self, cfg: dict[str, Any]) -> SyncWorkerProtocol:
        if self._worker_factory is not None:
            return self._worker_factory(cfg, self._on_sync, self._on_error)
        from sync_worker import SyncWorker

        service = self

        class ManagedSyncWorker(SyncWorker):
            def _sync(self, path, account_name=None):
                return service._run_sync_operation(
                    lambda: SyncWorker._sync(self, path, account_name),
                    source="watcher",
                )

            def _sync_service_base_sync(self, path, account_name=None):
                return SyncWorker._sync(self, path, account_name)

        return ManagedSyncWorker(cfg, on_sync=self._on_sync, on_error=self._on_error)

    def _force_accounts(self, worker: SyncWorkerProtocol, accounts: list[dict[str, Any]]) -> None:
        for account in accounts:
            path = account.get("savedvars_path")
            if not path:
                continue
            self._run_sync_operation(
                lambda path=path, name=account.get("name"): self._sync_one(worker, path, name),
                source="force",
            )
        with self._lock:
            self._force_thread = None

    def _sync_one(self, worker: SyncWorkerProtocol, path: str, account_name: str | None) -> None:
        base_sync = getattr(worker, "_sync_service_base_sync", None)
        if callable(base_sync):
            base_sync(path, account_name)
            return
        worker._sync(path, account_name)

    def _run_sync_operation(self, operation: Callable[[], Any], *, source: str) -> bool:
        if not self._sync_lock.acquire(blocking=False):
            return False

        with self._lock:
            self._state = "syncing"
            self._last_sync_at = _utc_now()
            self._last_error = None
            self._operation_failed = False
            self._operation_error = None
            self._operation_synced = 0
            status = self._status_locked()
        self._emit_event("sync.status", status)

        try:
            operation()
        except Exception as exc:
            self._on_error(str(exc))
        finally:
            with self._lock:
                failed = self._operation_failed
                error = self._operation_error
                synced = self._operation_synced
                if failed:
                    self._state = "error"
                    if error:
                        self._last_error = error[1]
                else:
                    self._state = "success"
                    self._last_success_at = _utc_now()
                    self._last_error = None
                status = self._status_locked()
                self._operation_failed = False
                self._operation_error = None
                self._operation_synced = 0
            self._sync_lock.release()

        if failed:
            self._emit_event(
                "sync.error",
                {"code": error[0] if error else SYNC_INTERNAL_ERROR, "message": status["lastError"]},
            )
        else:
            self._emit_event("sync.completed", {"status": status, "syncedCharacters": synced})
        self._emit_event("sync.status", status)
        return not failed

    def _on_sync(self, payload: dict[str, Any]) -> None:
        characters = payload.get("characters")
        synced = len(characters) if isinstance(characters, list) else 0
        with self._lock:
            self._operation_synced += synced

    def _on_error(self, raw_message: str) -> None:
        code, message = _safe_error(raw_message)
        emit_immediately = False
        status: dict[str, Any] | None = None
        with self._lock:
            self._operation_failed = True
            self._operation_error = (code, message)
            self._state = "error"
            self._last_error = message
            if not self._sync_lock.locked():
                emit_immediately = True
                status = self._status_locked()
        if emit_immediately:
            self._emit_event("sync.error", {"code": code, "message": message})
            if status is not None:
                self._emit_event("sync.status", status)

    def _require_ready(self) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        cfg = self._config_loader()
        if not config_module.is_session_valid(cfg):
            raise SyncServiceError(SYNC_NOT_AUTHENTICATED, "Sign in before syncing.")
        accounts = self._resolve_accounts(cfg)
        return cfg, accounts

    def _resolve_accounts(self, cfg: dict[str, Any]) -> list[dict[str, Any]]:
        if not wow_path.is_wow_dir(cfg.get("wow_install_path")):
            raise SyncServiceError(
                SYNC_SAVEDVARS_NOT_FOUND,
                "Select a valid World of Warcraft install before syncing.",
            )
        accounts = wow_path.selected_savedvars_paths(cfg)
        if accounts:
            return accounts
        if cfg.get("wow_accounts_selected"):
            raise SyncServiceError(
                SYNC_SAVEDVARS_NOT_FOUND,
                "Selected World of Warcraft accounts do not have KeystoneSync SavedVariables.",
            )
        raise SyncServiceError(SYNC_NO_ACCOUNT_SELECTED, "Select a World of Warcraft account before syncing.")

    def _selected_accounts_count(self, cfg: dict[str, Any]) -> int:
        if not wow_path.is_wow_dir(cfg.get("wow_install_path")):
            return 0
        return len(wow_path.selected_savedvars_paths(cfg))

    def _refresh_running_locked(self) -> None:
        self._running = self._worker is not None and self._worker.is_alive()
        if not self._running and self._worker is not None:
            self._worker = None
        if not self._running and self._state == "watching":
            self._state = "idle"

    def _is_force_alive_locked(self) -> bool:
        return self._force_thread is not None and self._force_thread.is_alive()

    def _status_locked(self) -> dict[str, Any]:
        return {
            "running": self._running,
            "state": self._state,
            "lastSyncAt": self._last_sync_at,
            "lastSuccessAt": self._last_success_at,
            "lastError": self._last_error,
            "selectedAccounts": self._selected_accounts,
        }

    def _emit_event(self, event: str, data: dict[str, Any]) -> None:
        with self._lock:
            emit = self._emit
        try:
            emit(event, data)
        except Exception:
            pass
