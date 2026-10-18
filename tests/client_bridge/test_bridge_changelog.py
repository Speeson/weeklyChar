from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "keystone-client" / "sidecar"))

import bridge_main  # noqa: E402
from bridge_protocol import ProtocolError  # noqa: E402


class BridgeChangelogTests(unittest.TestCase):
    def test_migrates_browser_version_and_remembers_dismissal_across_starts(self) -> None:
        with tempfile.TemporaryDirectory() as directory, (
            mock.patch.object(bridge_main.changelog_state, "_FILE", Path(directory) / "changelog.json")
        ), mock.patch.object(bridge_main.config_module, "load", return_value={}):
            self.assertEqual(bridge_main.handle_changelog_check({
                "version": "0.4.0", "browserSeenVersion": "0.3.0",
            }), {"show": True, "firstRun": False})
            self.assertIn('"seenVersion": "0.4.0"', (Path(directory) / "changelog.json").read_text())
            self.assertEqual(bridge_main.handle_changelog_check({
                "version": "0.4.0", "browserSeenVersion": "0.3.0",
            }), {"show": False, "firstRun": False})

    def test_first_install_is_recorded_without_showing_notes(self) -> None:
        with tempfile.TemporaryDirectory() as directory, (
            mock.patch.object(bridge_main.changelog_state, "_FILE", Path(directory) / "changelog.json")
        ), mock.patch.object(bridge_main.config_module, "load", return_value={}):
            self.assertEqual(bridge_main.handle_changelog_check({
                "version": "0.4.0", "browserSeenVersion": None,
            }), {"show": False, "firstRun": True})
            self.assertTrue((Path(directory) / "changelog.json").exists())

    def test_current_browser_version_does_not_reopen_older_sidecar_state(self) -> None:
        with tempfile.TemporaryDirectory() as directory, (
            mock.patch.object(bridge_main.changelog_state, "_FILE", Path(directory) / "changelog.json")
        ), mock.patch.object(bridge_main.config_module, "load", return_value={"last_changelog_version": "0.3.0"}):
            self.assertEqual(bridge_main.handle_changelog_check({
                "version": "0.4.0", "browserSeenVersion": "0.4.0",
            }), {"show": False, "firstRun": False})
            self.assertTrue((Path(directory) / "changelog.json").exists())

    def test_rejects_invalid_version(self) -> None:
        with self.assertRaises(ProtocolError):
            bridge_main.handle_changelog_check({"version": "", "browserSeenVersion": None})


if __name__ == "__main__":
    unittest.main()
