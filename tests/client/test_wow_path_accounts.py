from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
CLIENT_ROOT = REPO_ROOT / "keystone-client" / "sidecar"
sys.path.insert(0, str(CLIENT_ROOT))

import wow_path  # noqa: E402


def make_account(root: Path, name: str, *, savedvars: bool) -> Path:
    folder = root / "World of Warcraft" / "_retail_" / "WTF" / "Account" / name / "SavedVariables"
    folder.mkdir(parents=True, exist_ok=True)
    if savedvars:
        (folder / "KeystoneSync.lua").write_text("KeystoneSyncDB = {}", encoding="utf-8")
    return folder / "KeystoneSync.lua"


class WowPathAccountTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.wow = self.root / "World of Warcraft"
        retail = self.wow / "_retail_"
        (retail / "Interface" / "AddOns").mkdir(parents=True)
        (retail / "Wow.exe").write_text("", encoding="utf-8")

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_selected_accounts_return_existing_savedvariables_only(self) -> None:
        account_a = make_account(self.root, "ACCOUNT_A", savedvars=True)
        make_account(self.root, "ACCOUNT_B", savedvars=False)

        paths = wow_path.selected_savedvars_paths(
            {"wow_install_path": str(self.wow), "wow_accounts_selected": ["ACCOUNT_A", "ACCOUNT_B"]}
        )

        self.assertEqual([item["savedvars_path"] for item in paths], [str(account_a)])

    def test_single_account_backward_compatibility_without_selection(self) -> None:
        account_a = make_account(self.root, "ACCOUNT_A", savedvars=True)

        paths = wow_path.selected_savedvars_paths({"wow_install_path": str(self.wow)})

        self.assertEqual([item["savedvars_path"] for item in paths], [str(account_a)])

    def test_legacy_wow_path_fallback_selects_matching_account(self) -> None:
        account_a = make_account(self.root, "ACCOUNT_A", savedvars=True)
        make_account(self.root, "ACCOUNT_B", savedvars=True)

        paths = wow_path.selected_savedvars_paths(
            {"wow_install_path": str(self.wow), "wow_path": str(account_a)}
        )

        self.assertEqual([item["name"] for item in paths], ["ACCOUNT_A"])

    def test_multiple_accounts_without_selection_are_not_synced(self) -> None:
        make_account(self.root, "ACCOUNT_A", savedvars=True)
        make_account(self.root, "ACCOUNT_B", savedvars=True)

        self.assertEqual(wow_path.selected_savedvars_paths({"wow_install_path": str(self.wow)}), [])


if __name__ == "__main__":
    unittest.main()
