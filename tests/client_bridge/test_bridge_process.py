from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import time
import unittest
import zipfile
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
BRIDGE_MAIN = REPO_ROOT / "keystone-client" / "bridge_main.py"


def make_wow_tree(root: Path) -> Path:
    wow = root / "World of Warcraft"
    retail = wow / "_retail_"
    (retail / "Interface" / "AddOns").mkdir(parents=True)
    (retail / "Wow.exe").write_text("", encoding="utf-8")
    account_a = retail / "WTF" / "Account" / "ACCOUNT_A" / "SavedVariables"
    account_b = retail / "WTF" / "Account" / "ACCOUNT_B" / "SavedVariables"
    account_a.mkdir(parents=True)
    account_b.mkdir(parents=True)
    (account_a / "KeystoneSync.lua").write_text("KeystoneSyncDB = {}", encoding="utf-8")
    return wow


def make_addon_zip(path: Path, version: str) -> None:
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            "KeystoneSync/KeystoneSync.toc",
            "\n".join(
                [
                    "## Interface: 120005",
                    "## Title: KeystoneSync",
                    f"## Version: {version}",
                    "## SavedVariables: KeystoneSyncDB",
                    "",
                    "KeystoneSync.lua",
                ]
            ),
        )
        archive.writestr("KeystoneSync/KeystoneSync.lua", "-- addon\n")


class BridgeProcess:
    def __init__(self, appdata: str | None = None):
        env = None
        if appdata is not None:
            env = os.environ.copy()
            env["APPDATA"] = appdata
            inherited_pythonpath = os.pathsep.join(path for path in sys.path if path)
            env["PYTHONPATH"] = (
                inherited_pythonpath
                if not env.get("PYTHONPATH")
                else env["PYTHONPATH"] + os.pathsep + inherited_pythonpath
            )
        self.process = subprocess.Popen(
            [sys.executable, str(BRIDGE_MAIN)],
            cwd=REPO_ROOT,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            env=env,
        )

    def read_message(self) -> dict:
        assert self.process.stdout is not None
        line = self.process.stdout.readline()
        if not line:
            stderr = self.process.stderr.read() if self.process.stderr else ""
            raise AssertionError(f"Bridge produced no stdout line. stderr={stderr!r}")
        return json.loads(line)

    def send_raw(self, line: str) -> dict:
        assert self.process.stdin is not None
        self.process.stdin.write(line)
        self.process.stdin.flush()
        return self.read_message()

    def send(self, request: dict) -> dict:
        response, _events = self.send_collect(request)
        return response

    def send_collect(self, request: dict) -> tuple[dict, list[dict]]:
        assert self.process.stdin is not None
        self.process.stdin.write(json.dumps(request, separators=(",", ":")) + "\n")
        self.process.stdin.flush()
        events = []
        while True:
            message = self.read_message()
            if message.get("type") == "response" and message.get("id") == request.get("id"):
                return message, events
            events.append(message)

    def close(self) -> tuple[int, str]:
        if self.process.stdin:
            self.process.stdin.close()
        code = self.process.wait(timeout=5)
        stderr = self.process.stderr.read() if self.process.stderr else ""
        if self.process.stdout:
            self.process.stdout.close()
        if self.process.stderr:
            self.process.stderr.close()
        return code, stderr

    def kill(self):
        if self.process.poll() is None:
            self.process.kill()
            self.process.wait(timeout=5)
        if self.process.stdin and not self.process.stdin.closed:
            self.process.stdin.close()
        if self.process.stdout and not self.process.stdout.closed:
            self.process.stdout.close()
        if self.process.stderr and not self.process.stderr.closed:
            self.process.stderr.close()


class BridgeProcessTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.bridge = BridgeProcess(self.temp_dir.name)
        self.ready = self.bridge.read_message()

    def tearDown(self):
        self.bridge.kill()
        self.temp_dir.cleanup()

    def test_ready_is_first_stdout_json_line(self):
        self.assertEqual(self.ready["protocolVersion"], 1)
        self.assertEqual(self.ready["type"], "event")
        self.assertEqual(self.ready["event"], "system.ready")
        self.assertEqual(
            self.ready["data"]["capabilities"],
            [
                "system.ping",
                "system.get_state",
                "auth.login",
                "auth.register",
                "auth.logout",
                "profile.set_avatar",
                "settings.get",
                "settings.update",
                "wow.detect",
                "wow.list_accounts",
                "wow.select_accounts",
                "wow.select_install",
                "sync.get_status",
                "sync.start",
                "sync.stop",
                "sync.force",
                "characters.get",
                "characters.refresh",
                "addon.get_status",
                "addon.check",
                "addon.install",
                "addon.update",
                "addon.reinstall",
            ],
        )

    def test_system_ping_returns_correlated_response(self):
        response = self.bridge.send(
            {"protocolVersion": 1, "id": "ping-1", "command": "system.ping", "payload": {}}
        )

        self.assertEqual(response["id"], "ping-1")
        self.assertTrue(response["ok"])
        self.assertEqual(response["data"], {"pong": True})

    def test_system_get_state_returns_safe_minimal_state(self):
        response = self.bridge.send(
            {"protocolVersion": 1, "id": "state-1", "command": "system.get_state", "payload": {}}
        )

        self.assertTrue(response["ok"])
        self.assertEqual(
            response["data"],
            {
                "protocolVersion": 1,
                "bridge": "ready",
                "auth": {"authenticated": False, "username": None, "avatarUrl": None},
                "settings": {
                    "startMinimized": False,
                    "minimizeOnClose": False,
                    "lang": "es",
                },
                "wow": {
                    "install": {
                        "detected": False,
                        "installPath": None,
                        "retailPath": None,
                        "addonsPath": None,
                    },
                    "accounts": [],
                    "selectedAccounts": [],
                    "configurationComplete": False,
                },
                "sync": {
                    "running": False,
                    "state": "idle",
                    "lastSyncAt": None,
                    "lastSuccessAt": None,
                    "lastError": None,
                    "selectedAccounts": 0,
                },
                "characters": {
                    "characters": [],
                    "refreshing": False,
                    "source": "none",
                    "lastRefreshAt": None,
                    "lastError": None,
                },
                "addon": {
                    "installed": False,
                    "installedVersion": None,
                    "latestVersion": None,
                    "state": "not-installed",
                    "cacheAvailable": False,
                    "lastCheckAt": None,
                    "source": None,
                    "message": "",
                    "operation": None,
                },
            },
        )
        self.assertNotIn("sync_token", json.dumps(response))
        self.assertNotIn("access_token", json.dumps(response))

    def test_unknown_command_returns_error_and_bridge_stays_alive(self):
        response = self.bridge.send(
            {"protocolVersion": 1, "id": "bad-1", "command": "addon.install_from_zip", "payload": {}}
        )
        self.assertFalse(response["ok"])
        self.assertEqual(response["error"]["code"], "UNKNOWN_COMMAND")

        second = self.bridge.send(
            {"protocolVersion": 1, "id": "ping-2", "command": "system.ping", "payload": {}}
        )
        self.assertTrue(second["ok"])

    def test_malformed_json_returns_error_and_bridge_stays_alive(self):
        response = self.bridge.send_raw("{not-json}\n")
        self.assertFalse(response["ok"])
        self.assertIsNone(response["id"])
        self.assertEqual(response["error"]["code"], "INVALID_JSON")

        second = self.bridge.send(
            {"protocolVersion": 1, "id": "ping-3", "command": "system.ping", "payload": {}}
        )
        self.assertTrue(second["ok"])

    def test_unsupported_protocol_version(self):
        response = self.bridge.send(
            {"protocolVersion": 99, "id": "bad-version", "command": "system.ping", "payload": {}}
        )

        self.assertFalse(response["ok"])
        self.assertEqual(response["id"], "bad-version")
        self.assertEqual(response["error"]["code"], "UNSUPPORTED_PROTOCOL_VERSION")

    def test_invalid_request_schema(self):
        response = self.bridge.send({"protocolVersion": 1, "id": "invalid", "command": "system.ping"})

        self.assertFalse(response["ok"])
        self.assertEqual(response["id"], "invalid")
        self.assertEqual(response["error"]["code"], "INVALID_REQUEST")

    def test_non_empty_payload_is_rejected(self):
        response = self.bridge.send(
            {"protocolVersion": 1, "id": "payload", "command": "system.ping", "payload": {"x": 1}}
        )

        self.assertFalse(response["ok"])
        self.assertEqual(response["error"]["code"], "INVALID_REQUEST")

    def test_auth_login_invalid_payload_is_rejected(self):
        response = self.bridge.send(
            {"protocolVersion": 1, "id": "login-bad", "command": "auth.login", "payload": {}}
        )

        self.assertFalse(response["ok"])
        self.assertEqual(response["error"]["code"], "INVALID_REQUEST")
        self.assertNotIn("password", json.dumps(response))

    def test_auth_register_requires_the_complete_payload(self):
        response = self.bridge.send(
            {
                "protocolVersion": 1,
                "id": "register-bad",
                "command": "auth.register",
                "payload": {"username": "newplayer"},
            }
        )

        self.assertFalse(response["ok"])
        self.assertEqual(response["error"]["code"], "INVALID_REQUEST")
        self.assertNotIn("newplayer", json.dumps(response["error"]))

    def test_settings_get_and_update_use_safe_whitelist(self):
        initial = self.bridge.send(
            {"protocolVersion": 1, "id": "settings-1", "command": "settings.get", "payload": {}}
        )
        self.assertTrue(initial["ok"])
        self.assertEqual(
            initial["data"],
            {"startMinimized": False, "minimizeOnClose": False, "lang": "es"},
        )

        updated = self.bridge.send(
            {
                "protocolVersion": 1,
                "id": "settings-2",
                "command": "settings.update",
                "payload": {"startMinimized": True, "lang": "en"},
            }
        )
        self.assertTrue(updated["ok"])
        self.assertEqual(
            updated["data"],
            {"startMinimized": True, "minimizeOnClose": False, "lang": "en"},
        )

        rejected = self.bridge.send(
            {
                "protocolVersion": 1,
                "id": "settings-3",
                "command": "settings.update",
                "payload": {"sync_token": "x"},
            }
        )
        self.assertFalse(rejected["ok"])
        self.assertEqual(rejected["error"]["code"], "SETTINGS_INVALID_PAYLOAD")

    def test_wow_commands_validate_install_accounts_and_return_safe_dtos(self):
        wow = make_wow_tree(Path(self.temp_dir.name))

        selected_install = self.bridge.send(
            {
                "protocolVersion": 1,
                "id": "wow-install",
                "command": "wow.select_install",
                "payload": {"path": str(wow / "_retail_")},
            }
        )
        self.assertTrue(selected_install["ok"])
        data = selected_install["data"]
        self.assertEqual(data["install"]["installPath"], str(wow))
        self.assertEqual(data["install"]["addonsPath"], str(wow / "_retail_" / "Interface" / "AddOns"))
        self.assertEqual([account["name"] for account in data["accounts"]], ["ACCOUNT_A", "ACCOUNT_B"])
        self.assertEqual(
            set(data["accounts"][0]),
            {"name", "savedVariablesPath", "savedVariablesExists", "selected", "modifiedAt"},
        )
        self.assertTrue(data["accounts"][0]["savedVariablesExists"])
        self.assertFalse(data["accounts"][1]["savedVariablesExists"])

        selected_accounts = self.bridge.send(
            {
                "protocolVersion": 1,
                "id": "wow-accounts",
                "command": "wow.select_accounts",
                "payload": {"accounts": ["ACCOUNT_A", "ACCOUNT_A"]},
            }
        )
        self.assertTrue(selected_accounts["ok"])
        self.assertEqual(selected_accounts["data"]["selectedAccounts"], ["ACCOUNT_A"])

        listed = self.bridge.send(
            {
                "protocolVersion": 1,
                "id": "wow-list",
                "command": "wow.list_accounts",
                "payload": {},
            }
        )
        self.assertTrue(listed["ok"])
        self.assertEqual(listed["data"]["selectedAccounts"], ["ACCOUNT_A"])
        self.assertNotIn("sync_token", json.dumps(listed))
        self.assertNotIn("access_token", json.dumps(listed))

    def test_wow_invalid_payloads_are_controlled_errors(self):
        invalid_install = self.bridge.send(
            {
                "protocolVersion": 1,
                "id": "wow-bad-install",
                "command": "wow.select_install",
                "payload": {"path": str(Path(self.temp_dir.name) / "missing")},
            }
        )
        self.assertFalse(invalid_install["ok"])
        self.assertEqual(invalid_install["error"]["code"], "WOW_INVALID_INSTALL")

        invalid_accounts = self.bridge.send(
            {
                "protocolVersion": 1,
                "id": "wow-bad-accounts",
                "command": "wow.select_accounts",
                "payload": {"accounts": ["MISSING"]},
            }
        )
        self.assertFalse(invalid_accounts["ok"])
        self.assertEqual(invalid_accounts["error"]["code"], "WOW_INVALID_ACCOUNT_SELECTION")

    def test_sync_commands_validate_lifecycle_and_emit_safe_events(self):
        wow = make_wow_tree(Path(self.temp_dir.name))
        config_dir = Path(self.temp_dir.name) / "KeystoneClient"
        config_dir.mkdir(parents=True, exist_ok=True)
        (config_dir / "config.json").write_text(
            json.dumps(
                {
                    "api_url": "http://127.0.0.1:9",
                    "sync_token": "secret-sync-token",
                    "login_at": time.time(),
                    "wow_install_path": str(wow),
                    "wow_accounts_selected": ["ACCOUNT_A"],
                }
            ),
            encoding="utf-8",
        )

        status = self.bridge.send(
            {"protocolVersion": 1, "id": "sync-status", "command": "sync.get_status", "payload": {}}
        )
        self.assertTrue(status["ok"])
        self.assertEqual(status["data"]["state"], "idle")
        self.assertEqual(status["data"]["selectedAccounts"], 1)

        invalid = self.bridge.send(
            {
                "protocolVersion": 1,
                "id": "sync-invalid",
                "command": "sync.start",
                "payload": {"unexpected": True},
            }
        )
        self.assertFalse(invalid["ok"])
        self.assertEqual(invalid["error"]["code"], "INVALID_REQUEST")

        started, start_events = self.bridge.send_collect(
            {"protocolVersion": 1, "id": "sync-start", "command": "sync.start", "payload": {}}
        )
        self.assertTrue(started["ok"])
        self.assertTrue(started["data"]["running"])
        self.assertIn("sync.started", [event.get("event") for event in start_events])

        stopped, stop_events = self.bridge.send_collect(
            {"protocolVersion": 1, "id": "sync-stop", "command": "sync.stop", "payload": {}}
        )
        self.assertTrue(stopped["ok"])
        self.assertFalse(stopped["data"]["running"])
        self.assertTrue(all("secret-sync-token" not in json.dumps(event) for event in start_events + stop_events))
        self.assertTrue(all("KeystoneSyncDB" not in json.dumps(event) for event in start_events + stop_events))

    def test_sync_start_requires_authentication(self):
        response = self.bridge.send(
            {"protocolVersion": 1, "id": "sync-auth", "command": "sync.start", "payload": {}}
        )

        self.assertFalse(response["ok"])
        self.assertEqual(response["error"]["code"], "SYNC_NOT_AUTHENTICATED")

    def test_startup_automatically_monitors_and_serves_cached_characters(self):
        self.bridge.kill()
        wow = make_wow_tree(Path(self.temp_dir.name))
        config_dir = Path(self.temp_dir.name) / "KeystoneClient"
        config_dir.mkdir(parents=True, exist_ok=True)
        (config_dir / "config.json").write_text(
            json.dumps(
                {
                    "api_url": "http://127.0.0.1:9",
                    "sync_token": "secret-sync-token",
                    "login_at": time.time(),
                    "wow_install_path": str(wow),
                    "wow_accounts_selected": ["ACCOUNT_A"],
                    "cached_characters": [
                        {
                            "id": "cached-1",
                            "name": "Auralis",
                            "realm": "Zul'jin",
                            "region": "eu",
                            "wowClass": "Mage",
                            "avatarUrl": None,
                            "ilvl": 300,
                            "rioScore": 0,
                            "currentKeystone": None,
                        }
                    ],
                }
            ),
            encoding="utf-8",
        )
        self.bridge = BridgeProcess(self.temp_dir.name)
        self.ready = self.bridge.read_message()

        state = self.bridge.send(
            {"protocolVersion": 1, "id": "auto-state", "command": "system.get_state", "payload": {}}
        )

        self.assertTrue(state["ok"])
        self.assertTrue(state["data"]["sync"]["running"])
        self.assertIn(state["data"]["sync"]["state"], {"watching", "syncing"})
        self.assertEqual(state["data"]["characters"]["characters"][0]["name"], "Auralis")
        self.assertNotIn("secret-sync-token", json.dumps(state))

    def test_character_commands_return_safe_state_and_require_auth_for_refresh(self):
        state = self.bridge.send(
            {"protocolVersion": 1, "id": "characters-get", "command": "characters.get", "payload": {}}
        )
        self.assertTrue(state["ok"])
        self.assertEqual(state["data"]["characters"], [])
        self.assertNotIn("sync_token", json.dumps(state))

        refresh = self.bridge.send(
            {
                "protocolVersion": 1,
                "id": "characters-refresh",
                "command": "characters.refresh",
                "payload": {},
            }
        )
        self.assertFalse(refresh["ok"])
        self.assertEqual(refresh["error"]["code"], "CHARACTER_NOT_AUTHENTICATED")

    def test_addon_commands_return_safe_status_and_use_cache_fixture(self):
        wow = make_wow_tree(Path(self.temp_dir.name))
        cache = Path(self.temp_dir.name) / "KeystoneClient" / "addon-cache"
        cache.mkdir(parents=True, exist_ok=True)
        make_addon_zip(cache / "KeystoneSync-v0.1.17.zip", "0.1.17")
        config_dir = Path(self.temp_dir.name) / "KeystoneClient"
        config_dir.mkdir(parents=True, exist_ok=True)
        (config_dir / "config.json").write_text(
            json.dumps({"wow_install_path": str(wow)}),
            encoding="utf-8",
        )

        status = self.bridge.send(
            {
                "protocolVersion": 1,
                "id": "addon-status",
                "command": "addon.get_status",
                "payload": {},
            }
        )
        self.assertTrue(status["ok"])
        self.assertEqual(status["data"]["state"], "not-installed")
        self.assertTrue(status["data"]["cacheAvailable"])

        invalid = self.bridge.send(
            {
                "protocolVersion": 1,
                "id": "addon-invalid",
                "command": "addon.install",
                "payload": {"zipPath": "C:/not-allowed.zip"},
            }
        )
        self.assertFalse(invalid["ok"])
        self.assertEqual(invalid["error"]["code"], "INVALID_REQUEST")

        installed, events = self.bridge.send_collect(
            {
                "protocolVersion": 1,
                "id": "addon-install",
                "command": "addon.install",
                "payload": {},
            }
        )
        self.assertTrue(installed["ok"])
        event_names = [event.get("event") for event in events]
        for _ in range(100):
            followup = self.bridge.read_message()
            event_names.append(followup.get("event"))
            if followup.get("event") == "addon.install.completed":
                break
        else:
            self.fail("addon install did not complete")

        for expected in ("addon.install.started", "addon.install.progress", "addon.install.completed"):
            self.assertIn(expected, event_names)
        self.assertTrue((wow / "_retail_" / "Interface" / "AddOns" / "KeystoneSync").is_dir())
        self.assertTrue(all("zipPath" not in json.dumps(event) for event in events))

    def test_eof_stops_running_sync_worker_cleanly(self):
        wow = make_wow_tree(Path(self.temp_dir.name))
        config_dir = Path(self.temp_dir.name) / "KeystoneClient"
        config_dir.mkdir(parents=True, exist_ok=True)
        (config_dir / "config.json").write_text(
            json.dumps(
                {
                    "api_url": "http://127.0.0.1:9",
                    "sync_token": "secret-sync-token",
                    "login_at": time.time(),
                    "wow_install_path": str(wow),
                    "wow_accounts_selected": ["ACCOUNT_A"],
                }
            ),
            encoding="utf-8",
        )
        self.bridge.send_collect(
            {"protocolVersion": 1, "id": "sync-start-eof", "command": "sync.start", "payload": {}}
        )

        code, stderr = self.bridge.close()

        self.assertEqual(code, 0)
        self.assertNotIn("Traceback", stderr)

    def test_oversized_request_is_rejected_and_bridge_stays_alive(self):
        response = self.bridge.send_raw(("x" * (1024 * 1024 + 1)) + "\n")
        self.assertFalse(response["ok"])
        self.assertIsNone(response["id"])
        self.assertEqual(response["error"]["code"], "REQUEST_TOO_LARGE")

        second = self.bridge.send(
            {"protocolVersion": 1, "id": "ping-4", "command": "system.ping", "payload": {}}
        )
        self.assertTrue(second["ok"])

    def test_multiple_sequential_requests_work(self):
        responses = [
            self.bridge.send(
                {"protocolVersion": 1, "id": f"ping-{index}", "command": "system.ping", "payload": {}}
            )
            for index in range(3)
        ]

        self.assertEqual([item["id"] for item in responses], ["ping-0", "ping-1", "ping-2"])
        self.assertTrue(all(item["ok"] for item in responses))

    def test_stdout_contains_only_valid_json_objects_and_stderr_is_diagnostics(self):
        self.bridge.send_raw("{not-json}\n")
        response = self.bridge.send(
            {"protocolVersion": 1, "id": "ping-json", "command": "system.ping", "payload": {}}
        )
        self.assertTrue(response["ok"])

    def test_eof_exits_cleanly(self):
        code, stderr = self.bridge.close()
        self.assertEqual(code, 0)
        self.assertNotIn("Traceback", stderr)


if __name__ == "__main__":
    unittest.main()
