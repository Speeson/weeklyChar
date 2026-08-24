from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


REPO_ROOT = Path(__file__).resolve().parents[2]
CLIENT_ROOT = REPO_ROOT / "keystone-client" / "sidecar"
sys.path.insert(0, str(CLIENT_ROOT))

import addon_service  # noqa: E402
import addon_updater  # noqa: E402


def make_wow_tree(root: Path) -> Path:
    wow = root / "World of Warcraft"
    retail = wow / "_retail_"
    (retail / "Interface" / "AddOns").mkdir(parents=True)
    (retail / "Wow.exe").write_text("", encoding="utf-8")
    return wow


class AddonServiceTests(unittest.TestCase):
    def test_client_version_reads_canonical_root_in_source_mode(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            client_root = Path(tmp) / "keystone-client"
            module_path = client_root / "sidecar" / "addon_service.py"
            module_path.parent.mkdir(parents=True)
            (client_root / "VERSION").write_text("0.4.7\n", encoding="utf-8")

            with mock.patch.object(addon_service, "__file__", str(module_path)), mock.patch.object(
                addon_service.sys, "_MEIPASS", None, create=True
            ):
                self.assertEqual(addon_service._client_version(), "0.4.7")

    def test_client_version_reads_bundled_resource_when_frozen(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            bundle_root = Path(tmp) / "bundle"
            bundle_root.mkdir()
            (bundle_root / "VERSION").write_text("0.4.8\n", encoding="utf-8")

            with mock.patch.object(addon_service.sys, "_MEIPASS", bundle_root, create=True):
                self.assertEqual(addon_service._client_version(), "0.4.8")

    def test_check_async_runs_only_once_per_addons_path(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            wow = make_wow_tree(Path(tmp))
            cfg = {"wow_install_path": str(wow)}
            check = addon_updater.UpdateCheck(
                status="not_installed",
                installed_version=None,
                latest_version="1.0.0",
                release=None,
                cached=None,
                update_available=False,
                install_available=True,
                source="remote",
                message="Install available.",
            )
            service = addon_service.AddonService()

            with mock.patch("addon_updater.check_for_update", return_value=check) as updater, mock.patch(
                "addon_updater.install_best_available"
            ) as installer:
                self.assertTrue(service.check_async(cfg))
                self.assertFalse(service.check_async(cfg))
                self.assertTrue(service.wait_for_idle())

            self.assertEqual(updater.call_count, 1)
            installer.assert_not_called()

    def test_check_async_allows_new_install_path(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            first = make_wow_tree(Path(tmp) / "one")
            second = make_wow_tree(Path(tmp) / "two")
            check = mock.Mock(
                status="not_installed",
                installed_version=None,
                latest_version="1.0.0",
                update_available=False,
                install_available=True,
                source="remote",
                message="Install available.",
                candidate=None,
                cached=None,
            )
            service = addon_service.AddonService()

            with mock.patch("addon_updater.check_for_update", return_value=check) as updater:
                self.assertTrue(service.check_async({"wow_install_path": str(first)}))
                self.assertTrue(service.wait_for_idle())
                self.assertIsNone(service.get_status({"wow_install_path": str(second)})["latestVersion"])
                self.assertTrue(service.check_async({"wow_install_path": str(second)}))
                self.assertTrue(service.wait_for_idle())

            self.assertEqual(updater.call_count, 2)

    def test_failed_auto_check_is_exposed_as_error_status(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            wow = make_wow_tree(Path(tmp))
            cfg = {"wow_install_path": str(wow)}
            events = []
            service = addon_service.AddonService()
            service.set_emit(lambda event, data: events.append((event, data)))

            with mock.patch(
                "addon_updater.check_for_update",
                side_effect=addon_updater.AddonUpdateError("Network unavailable."),
            ):
                self.assertTrue(service.check_async(cfg))
                self.assertTrue(service.wait_for_idle())

            status = service.get_status(cfg)
            self.assertEqual(status["state"], "error")
            self.assertEqual(status["message"], "Network unavailable.")
            self.assertIn("addon.status.changed", [event for event, _data in events])


if __name__ == "__main__":
    unittest.main()
