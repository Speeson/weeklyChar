from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest import mock


REPO_ROOT = Path(__file__).resolve().parents[2]
CLIENT_ROOT = REPO_ROOT / "keystone-client"
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


if __name__ == "__main__":
    unittest.main()
