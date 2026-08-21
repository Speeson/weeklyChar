from __future__ import annotations

import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import release_changes  # noqa: E402
import release_state  # noqa: E402


class ReleaseChangesTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        (self.tmp / ".changes" / "pending").mkdir(parents=True)
        (self.tmp / ".changes" / "releases").mkdir(parents=True)
        self.version_file = self.tmp / "VERSION"
        self.version_file.write_text("0.2.1\n", encoding="utf-8")

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def write_changeset(self, name: str, **overrides):
        payload = {
            "components": ["client"],
            "type": "patch",
            "category": "fixed",
            "summary": "Corrige un problema visible.",
            "details": ["Mantiene el texto en español."],
        }
        payload.update(overrides)
        path = self.tmp / ".changes" / "pending" / name
        path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        return path

    def test_bump_version_patch_minor_major(self):
        self.assertEqual(release_changes.bump_version("0.2.1", "patch"), "0.2.2")
        self.assertEqual(release_changes.bump_version("0.2.1", "minor"), "0.3.0")
        self.assertEqual(release_changes.bump_version("0.2.1", "major"), "1.0.0")

    def test_invalid_semver_and_bump_fail(self):
        with self.assertRaises(release_changes.ChangesetError):
            release_changes.bump_version("0.2", "patch")
        with self.assertRaises(release_changes.ChangesetError):
            release_changes.bump_version("0.2.1", "build")

    def test_auto_selects_highest_bump(self):
        self.write_changeset("patch.json", type="patch")
        self.write_changeset("minor.json", type="minor")
        plan = release_changes.plan_release(self.tmp, "client", "0.2.1", "auto")
        self.assertEqual(plan.bump, "minor")
        self.assertEqual(plan.next_version, "0.3.0")

    def test_forced_bump_overrides_auto(self):
        self.write_changeset("minor.json", type="minor")
        plan = release_changes.plan_release(self.tmp, "client", "0.2.1", "patch")
        self.assertEqual(plan.bump, "patch")
        self.assertEqual(plan.next_version, "0.2.2")

    def test_no_changesets_fails(self):
        with self.assertRaises(release_changes.ChangesetError):
            release_changes.plan_release(self.tmp, "client", "0.2.1", "auto")

    def test_schema_validation_rejects_invalid_component_type_category_and_summary(self):
        invalid_cases = [
            {"components": [], "type": "patch", "category": "fixed", "summary": "x", "details": ["x"]},
            {"components": ["client"], "type": "build", "category": "fixed", "summary": "x", "details": ["x"]},
            {"components": ["client"], "type": "patch", "category": "misc", "summary": "x", "details": ["x"]},
            {"components": ["client"], "type": "patch", "category": "fixed", "summary": "", "details": ["x"]},
            {"components": ["client"], "type": "patch", "category": "fixed", "summary": "x", "details": [1]},
        ]
        for index, payload in enumerate(invalid_cases):
            with self.subTest(index=index):
                path = self.tmp / ".changes" / "pending" / f"bad-{index}.json"
                path.write_text(json.dumps(payload), encoding="utf-8")
                with self.assertRaises(release_changes.ChangesetError):
                    release_changes.load_changesets(self.tmp, "client")
                path.unlink()

    def test_component_filtering_and_spanish_notes(self):
        self.write_changeset("client.json", summary="Añade instalación remota.", details=["Se conserva el texto en español."])
        self.write_changeset("worker.json", components=["worker"], summary="No aplica al cliente.")
        plan = release_changes.plan_release(self.tmp, "client", "0.2.1", "auto")
        self.assertEqual([item.name for item in plan.changesets], ["client.json"])
        notes = release_changes.render_notes(plan)
        self.assertIn("## Correcciones", notes)
        self.assertIn("Añade instalación remota.", notes)
        self.assertIn("Se conserva el texto en español.", notes)

    def test_prepare_consumes_changesets_and_writes_metadata(self):
        self.write_changeset("client.json", type="minor", category="added")
        plan = release_changes.plan_release(self.tmp, "client", "0.2.1", "auto")
        release_dir = release_changes.write_release_files(self.tmp, plan, self.version_file)

        self.assertEqual(self.version_file.read_text(encoding="utf-8"), "0.3.0\n")
        self.assertFalse((self.tmp / ".changes" / "pending" / "client.json").exists())
        self.assertTrue((release_dir / "client.json").is_file())
        metadata = json.loads((release_dir / "metadata.json").read_text(encoding="utf-8"))
        self.assertEqual(metadata["tag"], "client-v0.3.0")
        self.assertEqual(metadata["asset"], "KeystoneClientSetup.exe")


class ReleaseStateTests(unittest.TestCase):
    def test_fresh_resume_complete_and_inconsistent_states(self):
        self.assertEqual(
            release_state.determine_release_state(
                pending_changesets=True,
                tag_exists=False,
                release_exists=False,
                asset_exists=False,
            ).name,
            "fresh",
        )
        self.assertEqual(
            release_state.determine_release_state(
                pending_changesets=True,
                tag_exists=True,
                release_exists=False,
                asset_exists=False,
            ).name,
            "resume",
        )
        self.assertEqual(
            release_state.determine_release_state(
                pending_changesets=False,
                tag_exists=True,
                release_exists=False,
                asset_exists=False,
            ).name,
            "resume",
        )
        self.assertEqual(
            release_state.determine_release_state(
                pending_changesets=False,
                tag_exists=True,
                release_exists=True,
                asset_exists=True,
            ).name,
            "complete",
        )
        self.assertEqual(
            release_state.determine_release_state(
                pending_changesets=False,
                tag_exists=False,
                release_exists=True,
                asset_exists=True,
            ).name,
            "inconsistent",
        )


if __name__ == "__main__":
    unittest.main()
