from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


REPO_ROOT = Path(__file__).resolve().parents[2]
CLIENT_ROOT = REPO_ROOT / "keystone-client"
sys.path.insert(0, str(CLIENT_ROOT))

import config  # noqa: E402
import wow_path  # noqa: E402
import wow_service  # noqa: E402


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


class WowServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.config_file = self.root / "config.json"
        config._DIR = self.root
        config._FILE = self.config_file

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_select_install_accepts_base_and_retails_paths_and_lists_accounts(self) -> None:
        wow = make_wow_tree(self.root)
        cfg = {"unrelated": "preserved"}

        state = wow_service.select_install(cfg, str(wow / "_retail_"))

        self.assertTrue(state["install"]["detected"])
        self.assertEqual(state["install"]["installPath"], str(wow))
        self.assertEqual(state["install"]["retailPath"], str(wow / "_retail_"))
        self.assertEqual(state["install"]["addonsPath"], str(wow / "_retail_" / "Interface" / "AddOns"))
        self.assertEqual([account["name"] for account in state["accounts"]], ["ACCOUNT_A", "ACCOUNT_B"])
        self.assertTrue(state["accounts"][0]["savedVariablesExists"])
        self.assertFalse(state["accounts"][1]["savedVariablesExists"])
        self.assertEqual(cfg["wow_install_path"], str(wow))
        self.assertEqual(cfg["wow_accounts_selected"], [])
        self.assertIsNone(cfg["wow_path"])
        self.assertEqual(cfg["unrelated"], "preserved")

        persisted = json.loads(self.config_file.read_text(encoding="utf-8"))
        self.assertEqual(persisted["wow_install_path"], str(wow))
        self.assertEqual(persisted["unrelated"], "preserved")

    def test_select_install_rejects_invalid_path_without_persisting(self) -> None:
        cfg = {"wow_install_path": "keep", "unrelated": "preserved"}

        with self.assertRaises(wow_service.WowError) as raised:
            wow_service.select_install(cfg, str(self.root / "missing"))

        self.assertEqual(raised.exception.code, wow_service.ERROR_WOW_INVALID_INSTALL)
        self.assertEqual(cfg["wow_install_path"], "keep")
        self.assertFalse(self.config_file.exists())

    def test_select_install_preserves_valid_selection_for_same_install(self) -> None:
        wow = make_wow_tree(self.root)
        savedvars = wow / "_retail_" / "WTF" / "Account" / "ACCOUNT_A" / "SavedVariables" / "KeystoneSync.lua"
        cfg = {
            "wow_install_path": str(wow),
            "wow_accounts_selected": ["ACCOUNT_A"],
            "wow_accounts_prompted": True,
            "wow_path": str(savedvars),
        }

        state = wow_service.select_install(cfg, str(wow / "_retail_"))

        self.assertEqual(cfg["wow_accounts_selected"], ["ACCOUNT_A"])
        self.assertTrue(cfg["wow_accounts_prompted"])
        self.assertEqual(cfg["wow_path"], str(savedvars))
        self.assertEqual(state["selectedAccounts"], ["ACCOUNT_A"])

    def test_select_install_keeps_only_valid_selections_after_install_change(self) -> None:
        first = make_wow_tree(self.root / "first")
        second = make_wow_tree(self.root / "second")
        cfg = {
            "wow_install_path": str(first),
            "wow_accounts_selected": ["ACCOUNT_A", "MISSING"],
            "wow_accounts_prompted": True,
        }

        wow_service.select_install(cfg, str(second))

        self.assertEqual(cfg["wow_accounts_selected"], ["ACCOUNT_A"])
        self.assertTrue(cfg["wow_accounts_prompted"])
        self.assertIn("ACCOUNT_A", cfg["wow_path"])

    def test_select_accounts_dedupes_persists_mapping_and_preserves_config(self) -> None:
        wow = make_wow_tree(self.root)
        cfg = {"wow_install_path": str(wow), "unrelated": "preserved"}

        state = wow_service.select_accounts(cfg, ["ACCOUNT_A", "account_a", "ACCOUNT_B"])

        self.assertEqual(cfg["wow_accounts_selected"], ["ACCOUNT_A", "ACCOUNT_B"])
        self.assertTrue(cfg["wow_accounts_prompted"])
        self.assertEqual(
            cfg["wow_path"],
            str(wow / "_retail_" / "WTF" / "Account" / "ACCOUNT_A" / "SavedVariables" / "KeystoneSync.lua"),
        )
        self.assertEqual(state["selectedAccounts"], ["ACCOUNT_A", "ACCOUNT_B"])
        self.assertEqual([account["selected"] for account in state["accounts"]], [True, True])
        self.assertEqual(cfg["unrelated"], "preserved")

    def test_select_accounts_rejects_unknown_and_bad_payloads(self) -> None:
        wow = make_wow_tree(self.root)
        cfg = {"wow_install_path": str(wow)}

        for payload in ([], ["ACCOUNT_A", ""], ["MISSING"]):
            with self.subTest(payload=payload):
                with self.assertRaises(wow_service.WowError):
                    wow_service.select_accounts(cfg, payload)

    def test_select_accounts_without_valid_install_does_not_scan_real_disks(self) -> None:
        cfg = {}

        with mock.patch("wow_path.find_wow_dir", side_effect=AssertionError("unexpected scan")):
            with self.assertRaises(wow_service.WowError) as raised:
                wow_service.select_accounts(cfg, ["ACCOUNT_A"])

        self.assertEqual(raised.exception.code, wow_service.ERROR_WOW_INVALID_ACCOUNT_SELECTION)

    def test_detect_uses_wow_path_source_of_truth_and_persists_found_install(self) -> None:
        wow = make_wow_tree(self.root)
        cfg = {}

        with mock.patch("wow_path.find_wow_dir", return_value=str(wow)):
            state = wow_service.detect_wow(cfg)

        self.assertEqual(state["install"]["installPath"], str(wow))
        self.assertEqual(cfg["wow_install_path"], str(wow))

    def test_wow_path_primitives_remain_source_of_truth(self) -> None:
        wow = make_wow_tree(self.root)

        self.assertEqual(wow_path.normalize_wow_dir(wow / "_retail_"), wow)
        self.assertTrue(wow_path.is_wow_dir(wow))
        self.assertEqual(wow_path.addons_folder_for(wow), str(wow / "_retail_" / "Interface" / "AddOns"))


if __name__ == "__main__":
    unittest.main()
