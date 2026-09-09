from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest import mock


REPO_ROOT = Path(__file__).resolve().parents[2]
CLIENT_ROOT = REPO_ROOT / "keystone-client" / "sidecar"
sys.path.insert(0, str(CLIENT_ROOT))

import bridge_main  # noqa: E402


class BridgeAuthHandlerTests(unittest.TestCase):
    def test_logout_persists_anonymous_session_before_waiting_for_sync_stop(self) -> None:
        calls: list[str] = []
        anonymous = {"authenticated": False, "username": None, "avatarUrl": None}

        with (
            mock.patch.object(bridge_main.config_module, "load", return_value={}),
            mock.patch.object(
                bridge_main.auth_service,
                "logout",
                side_effect=lambda _cfg: calls.append("logout") or anonymous,
            ),
            mock.patch.object(
                bridge_main.SYNC_SERVICE,
                "stop",
                side_effect=lambda: calls.append("stop") or {},
            ),
            mock.patch.object(bridge_main.CHARACTER_SERVICE, "reset"),
        ):
            result = bridge_main.handle_auth_logout({})

        self.assertEqual(result, anonymous)
        self.assertEqual(calls, ["logout", "stop"])

    def test_battlenet_commands_are_allowlisted_and_poll_ready_refreshes_services(self) -> None:
        self.assertIn("auth.battlenet.start", bridge_main.COMMANDS)
        self.assertIn("auth.battlenet.poll", bridge_main.COMMANDS)
        self.assertIn("auth.battlenet.cancel", bridge_main.COMMANDS)
        calls: list[str] = []
        with (
            mock.patch.object(bridge_main.config_module, "load", return_value={}),
            mock.patch.object(bridge_main.auth_service, "poll_battlenet", return_value={
                "status": "ready", "auth": {"authenticated": True, "username": "player", "avatarUrl": None}
            }),
            mock.patch.object(bridge_main.SYNC_SERVICE, "reconcile", side_effect=lambda **_kwargs: calls.append("sync")),
            mock.patch.object(bridge_main.CHARACTER_SERVICE, "refresh_async", side_effect=lambda _cfg: calls.append("characters")),
            mock.patch.object(bridge_main.ADDON_SERVICE, "check_async", side_effect=lambda _cfg: calls.append("addon")),
        ):
            result = bridge_main.handle_auth_battlenet_poll({})
        self.assertEqual(result["status"], "ready")
        self.assertEqual(calls, ["sync", "characters", "addon"])


if __name__ == "__main__":
    unittest.main()
