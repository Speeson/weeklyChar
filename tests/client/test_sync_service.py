from __future__ import annotations

import sys
import tempfile
import time
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
CLIENT_ROOT = REPO_ROOT / "keystone-client"
sys.path.insert(0, str(CLIENT_ROOT))

from sync_service import (  # noqa: E402
    SYNC_NO_ACCOUNT_SELECTED,
    SYNC_NOT_AUTHENTICATED,
    SYNC_SAVEDVARS_NOT_FOUND,
    SyncService,
    SyncServiceError,
)


def make_wow_tree(root: Path, *, account_b_savedvars: bool = False) -> Path:
    wow = root / "World of Warcraft"
    retail = wow / "_retail_"
    (retail / "Interface" / "AddOns").mkdir(parents=True)
    (retail / "Wow.exe").write_text("", encoding="utf-8")
    account_a = retail / "WTF" / "Account" / "ACCOUNT_A" / "SavedVariables"
    account_b = retail / "WTF" / "Account" / "ACCOUNT_B" / "SavedVariables"
    account_a.mkdir(parents=True)
    account_b.mkdir(parents=True)
    (account_a / "KeystoneSync.lua").write_text("KeystoneSyncDB = {}", encoding="utf-8")
    if account_b_savedvars:
        (account_b / "KeystoneSync.lua").write_text("KeystoneSyncDB = {}", encoding="utf-8")
    return wow


class FakeWorker:
    created = 0
    sync_started = None
    unblock_sync = None

    def __init__(self, config, on_sync, on_error):
        type(self).created += 1
        self.config = config
        self.on_sync = on_sync
        self.on_error = on_error
        self.started = False
        self.stopped = False
        self.sync_calls = []

    def start(self):
        self.started = True

    def is_alive(self):
        return self.started and not self.stopped

    def stop(self):
        self.stopped = True

    def join(self, timeout=None):
        return None

    def _sync(self, path, account_name=None):
        self.sync_calls.append((path, account_name))
        if type(self).sync_started is not None:
            type(self).sync_started.set()
        if type(self).unblock_sync is not None:
            type(self).unblock_sync.wait(timeout=2)
        self.on_sync({"account": account_name, "characters": ["Auralis"]})


class ErrorWorker(FakeWorker):
    def _sync(self, path, account_name=None):
        self.sync_calls.append((path, account_name))
        self.on_error("sync_token=secret raw payload traceback")


class SyncServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        FakeWorker.created = 0
        FakeWorker.sync_started = None
        FakeWorker.unblock_sync = None
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.wow = make_wow_tree(self.root)
        self.config = {
            "api_url": "https://api.test",
            "sync_token": "sync-token",
            "login_at": time.time(),
            "wow_install_path": str(self.wow),
            "wow_accounts_selected": ["ACCOUNT_A"],
        }
        self.events = []

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def make_service(self, worker_class=FakeWorker) -> SyncService:
        return SyncService(
            config_loader=lambda: dict(self.config),
            worker_factory=lambda cfg, on_sync, on_error: worker_class(cfg, on_sync, on_error),
            emit=lambda event, data: self.events.append({"event": event, "data": data}),
        )

    def test_initial_idle_status_counts_selected_account(self):
        service = self.make_service()

        self.assertEqual(
            service.get_status(),
            {
                "running": False,
                "state": "idle",
                "lastSyncAt": None,
                "lastSuccessAt": None,
                "lastError": None,
                "selectedAccounts": 1,
            },
        )

    def test_start_is_idempotent_and_second_start_does_not_create_worker(self):
        service = self.make_service()

        first = service.start()
        second = service.start()

        self.assertTrue(first["running"])
        self.assertEqual(second["state"], "watching")
        self.assertEqual(FakeWorker.created, 1)
        self.assertEqual([event["event"] for event in self.events], ["sync.started", "sync.status"])

    def test_reconcile_starts_when_prerequisites_are_ready_without_duplicates(self):
        service = self.make_service()

        first = service.reconcile()
        second = service.reconcile()

        self.assertTrue(first["running"])
        self.assertTrue(second["running"])
        self.assertEqual(FakeWorker.created, 1)

    def test_reconcile_stops_when_authentication_is_removed(self):
        service = self.make_service()
        service.reconcile()
        self.config["sync_token"] = None

        status = service.reconcile()

        self.assertFalse(status["running"])
        self.assertEqual(status["state"], "idle")

    def test_reconcile_restart_replaces_active_monitor(self):
        service = self.make_service()
        service.reconcile()

        status = service.reconcile(restart=True)

        self.assertTrue(status["running"])
        self.assertEqual(FakeWorker.created, 2)

    def test_stop_and_second_stop_are_idempotent(self):
        service = self.make_service()
        service.start()

        stopped = service.stop()
        stopped_again = service.stop()

        self.assertFalse(stopped["running"])
        self.assertFalse(stopped_again["running"])
        self.assertEqual(stopped_again["state"], "idle")

    def test_force_uses_worker_sync_path_without_starting_duplicate_worker(self):
        service = self.make_service()
        service.start()

        status = service.force()
        self.assertEqual(status["state"], "syncing")
        self.assertTrue(service.wait_for_idle())

        self.assertEqual(FakeWorker.created, 1)
        self.assertIn("sync.completed", [event["event"] for event in self.events])

    def test_force_while_idle_uses_temporary_worker_and_keeps_monitor_stopped(self):
        service = self.make_service()

        status = service.force()
        self.assertFalse(status["running"])
        self.assertTrue(service.wait_for_idle())

        self.assertEqual(FakeWorker.created, 1)
        self.assertFalse(service.get_status()["running"])
        self.assertEqual(service.get_status()["state"], "success")

    def test_successful_sync_invokes_completion_callback(self):
        completed = []
        service = SyncService(
            config_loader=lambda: dict(self.config),
            worker_factory=lambda cfg, on_sync, on_error: FakeWorker(cfg, on_sync, on_error),
            emit=lambda event, data: self.events.append({"event": event, "data": data}),
            on_completed=lambda: completed.append(True),
        )

        service.force()
        self.assertTrue(service.wait_for_idle())

        self.assertEqual(completed, [True])

    def test_force_while_already_syncing_does_not_duplicate_post_path(self):
        FakeWorker.sync_started = __import__("threading").Event()
        FakeWorker.unblock_sync = __import__("threading").Event()
        service = self.make_service()

        service.force()
        self.assertTrue(FakeWorker.sync_started.wait(timeout=2))
        second = service.force()
        FakeWorker.unblock_sync.set()
        self.assertTrue(service.wait_for_idle())

        self.assertEqual(second["state"], "syncing")
        self.assertEqual(FakeWorker.created, 1)

    def test_shutdown_stops_worker(self):
        service = self.make_service()
        service.start()

        status = service.shutdown()

        self.assertFalse(status["running"])
        self.assertEqual(status["state"], "idle")

    def test_safe_error_events_do_not_expose_tokens_raw_payload_or_tracebacks(self):
        service = self.make_service(ErrorWorker)

        service.force()
        self.assertTrue(service.wait_for_idle())
        serialized = str(self.events)

        self.assertIn("sync.error", serialized)
        self.assertNotIn("sync-token", serialized)
        self.assertNotIn("raw payload", serialized)
        self.assertNotIn("traceback", serialized.lower())

    def test_start_requires_authenticated_session(self):
        self.config["sync_token"] = None
        service = self.make_service()

        with self.assertRaises(SyncServiceError) as caught:
            service.start()

        self.assertEqual(caught.exception.code, SYNC_NOT_AUTHENTICATED)

    def test_single_account_backward_compatibility_without_explicit_selection(self):
        self.config["wow_accounts_selected"] = []
        service = self.make_service()

        self.assertEqual(service.get_status()["selectedAccounts"], 1)
        self.assertEqual(service.start()["selectedAccounts"], 1)

    def test_explicit_multi_selection_counts_existing_selected_savedvariables(self):
        self.temp_dir.cleanup()
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.wow = make_wow_tree(self.root, account_b_savedvars=True)
        self.config["wow_install_path"] = str(self.wow)
        self.config["wow_accounts_selected"] = ["ACCOUNT_A", "ACCOUNT_B"]
        service = self.make_service()

        self.assertEqual(service.get_status()["selectedAccounts"], 2)

    def test_missing_selected_savedvariables_is_controlled_error(self):
        self.config["wow_accounts_selected"] = ["ACCOUNT_B"]
        service = self.make_service()

        with self.assertRaises(SyncServiceError) as caught:
            service.start()

        self.assertEqual(caught.exception.code, SYNC_SAVEDVARS_NOT_FOUND)

    def test_multiple_existing_accounts_without_selection_requires_selection(self):
        self.temp_dir.cleanup()
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.wow = make_wow_tree(self.root, account_b_savedvars=True)
        self.config["wow_install_path"] = str(self.wow)
        self.config["wow_accounts_selected"] = []
        service = self.make_service()

        with self.assertRaises(SyncServiceError) as caught:
            service.start()

        self.assertEqual(caught.exception.code, SYNC_NO_ACCOUNT_SELECTED)


if __name__ == "__main__":
    unittest.main()
