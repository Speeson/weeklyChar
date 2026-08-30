from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = REPO_ROOT / "scripts" / "release_orchestration.py"


def load_module():
    if not MODULE_PATH.is_file():
        raise AssertionError("scripts/release_orchestration.py must implement the release gate")
    spec = importlib.util.spec_from_file_location("release_orchestration", MODULE_PATH)
    if spec is None or spec.loader is None:
        raise AssertionError("release orchestration module could not be loaded")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class ReleaseOrchestrationTests(unittest.TestCase):
    def setUp(self):
        self.orchestration = load_module()

    def plan(self, *, worker=False, db=False, client_release=False, enabled=True, **kwargs):
        return self.orchestration.plan_release(
            event_name="push",
            ref="refs/heads/main",
            impact={"worker": worker, "db": db, "client_release": client_release},
            auto_release_enabled=enabled,
            **kwargs,
        )

    def test_client_only_release_does_not_serialize_unrelated_worker_work(self):
        self.assertEqual(
            self.plan(client_release=True),
            {
                "publish_client": True,
                "deploy_worker": False,
                "run_migrations": False,
                "smoke_worker": False,
                "worker_readiness_required": False,
            },
        )

    def test_worker_and_client_release_requires_deploy_and_readiness(self):
        self.assertEqual(
            self.plan(worker=True, client_release=True),
            {
                "publish_client": True,
                "deploy_worker": True,
                "run_migrations": False,
                "smoke_worker": True,
                "worker_readiness_required": True,
            },
        )

    def test_db_worker_and_client_release_requires_migration_before_readiness(self):
        self.assertEqual(
            self.plan(worker=True, db=True, client_release=True),
            {
                "publish_client": True,
                "deploy_worker": True,
                "run_migrations": True,
                "smoke_worker": True,
                "worker_readiness_required": True,
            },
        )

    def test_worker_failure_blocks_client_publication(self):
        with self.assertRaisesRegex(
            self.orchestration.OrchestrationError,
            "Worker deployment/readiness did not succeed",
        ):
            self.orchestration.require_release_readiness(
                publish_client=True,
                worker_readiness_required=True,
                worker_result="failure",
                production_ready=False,
            )

    def test_db_migration_failure_blocks_client_publication(self):
        with self.assertRaisesRegex(
            self.orchestration.OrchestrationError,
            "Worker deployment/readiness did not succeed",
        ):
            self.orchestration.require_release_readiness(
                publish_client=True,
                worker_readiness_required=True,
                worker_result="failure",
                production_ready=False,
            )

    def test_release_disabled_keeps_backend_work_validation_only(self):
        self.assertEqual(
            self.plan(worker=True, db=True, client_release=True, enabled=False),
            {
                "publish_client": False,
                "deploy_worker": False,
                "run_migrations": False,
                "smoke_worker": False,
                "worker_readiness_required": False,
            },
        )

    def test_addon_only_or_unrelated_change_has_no_release_actions(self):
        self.assertEqual(
            self.plan(),
            {
                "publish_client": False,
                "deploy_worker": False,
                "run_migrations": False,
                "smoke_worker": False,
                "worker_readiness_required": False,
            },
        )

    def test_client_only_release_accepts_a_skipped_worker_job(self):
        self.orchestration.require_release_readiness(
            publish_client=True,
            worker_readiness_required=False,
            worker_result="skipped",
            production_ready=False,
        )

    def test_manual_release_requires_main_and_explicit_scope_confirmation(self):
        base = {
            "event_name": "workflow_dispatch",
            "impact": {"worker": False, "db": False, "client_release": True},
            "auto_release_enabled": False,
            "client_release_mode": "release",
        }
        with self.assertRaisesRegex(self.orchestration.OrchestrationError, "main"):
            self.orchestration.plan_release(
                **base,
                ref="refs/heads/feature/unsafe",
                confirm_manual_release_scope=True,
            )
        with self.assertRaisesRegex(self.orchestration.OrchestrationError, "confirmation"):
            self.orchestration.plan_release(
                **base,
                ref="refs/heads/main",
                confirm_manual_release_scope=False,
            )

    def test_manual_release_requires_an_explicit_impact_base_ref(self):
        with self.assertRaisesRegex(self.orchestration.OrchestrationError, "base_ref"):
            self.orchestration.plan_release(
                event_name="workflow_dispatch",
                ref="refs/heads/main",
                impact={"worker": False, "db": False, "client_release": True},
                auto_release_enabled=False,
                client_release_mode="release",
                confirm_manual_release_scope=True,
            )

    def test_confirmed_manual_backend_release_enforces_the_same_order(self):
        self.assertEqual(
            self.orchestration.plan_release(
                event_name="workflow_dispatch",
                ref="refs/heads/main",
                impact={"worker": True, "db": True, "client_release": True},
                auto_release_enabled=False,
                client_release_mode="release",
                confirm_manual_release_scope=True,
                base_ref="origin/main~1",
            ),
            {
                "publish_client": True,
                "deploy_worker": True,
                "run_migrations": True,
                "smoke_worker": True,
                "worker_readiness_required": True,
            },
        )

    def test_manual_worker_deploy_applies_an_impacted_migration_first(self):
        self.assertEqual(
            self.orchestration.plan_release(
                event_name="workflow_dispatch",
                ref="refs/heads/main",
                impact={"worker": True, "db": True, "client_release": False},
                auto_release_enabled=False,
                deploy_worker_requested=True,
            ),
            {
                "publish_client": False,
                "deploy_worker": True,
                "run_migrations": True,
                "smoke_worker": True,
                "worker_readiness_required": False,
            },
        )

    def test_confirmed_recovery_smokes_without_repeating_migration_or_deploy(self):
        self.assertEqual(
            self.orchestration.plan_release(
                event_name="workflow_dispatch",
                ref="refs/heads/main",
                impact={"worker": True, "db": True, "client_release": True},
                auto_release_enabled=False,
                client_release_mode="release",
                confirm_manual_release_scope=True,
                base_ref="origin/main~1",
                recover_worker_readiness_requested=True,
            ),
            {
                "publish_client": True,
                "deploy_worker": False,
                "run_migrations": False,
                "smoke_worker": True,
                "worker_readiness_required": True,
            },
        )

    def test_recovery_requires_a_backend_dependent_manual_release(self):
        with self.assertRaisesRegex(
            self.orchestration.OrchestrationError,
            "backend-dependent manual Client release",
        ):
            self.orchestration.plan_release(
                event_name="workflow_dispatch",
                ref="refs/heads/main",
                impact={"worker": False, "db": False, "client_release": True},
                auto_release_enabled=False,
                client_release_mode="release",
                confirm_manual_release_scope=True,
                base_ref="origin/main~1",
                recover_worker_readiness_requested=True,
            )

    def test_recovery_cannot_request_migration_or_deploy(self):
        with self.assertRaisesRegex(
            self.orchestration.OrchestrationError,
            "cannot request migration or deploy",
        ):
            self.orchestration.plan_release(
                event_name="workflow_dispatch",
                ref="refs/heads/main",
                impact={"worker": True, "db": True, "client_release": True},
                auto_release_enabled=False,
                client_release_mode="release",
                confirm_manual_release_scope=True,
                base_ref="origin/main~1",
                recover_worker_readiness_requested=True,
                deploy_worker_requested=True,
            )

    def test_plan_cli_emits_the_outputs_consumed_by_github_actions(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            impact_file = Path(temp_dir) / "impact.json"
            impact_file.write_text(
                json.dumps({"worker": True, "db": True, "client_release": True}),
                encoding="utf-8",
            )
            result = subprocess.run(
                [
                    sys.executable,
                    str(MODULE_PATH),
                    "plan",
                    "--impact-file",
                    str(impact_file),
                    "--event-name",
                    "push",
                    "--ref",
                    "refs/heads/main",
                    "--auto-release-enabled",
                    "true",
                ],
                cwd=REPO_ROOT,
                text=True,
                capture_output=True,
                check=False,
            )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(
            json.loads(result.stdout),
            {
                "publish_client": True,
                "deploy_worker": True,
                "run_migrations": True,
                "smoke_worker": True,
                "worker_readiness_required": True,
            },
        )

    def test_readiness_cli_fails_closed_when_worker_smoke_did_not_pass(self):
        result = subprocess.run(
            [
                sys.executable,
                str(MODULE_PATH),
                "require-readiness",
                "--publish-client",
                "true",
                "--worker-readiness-required",
                "true",
                "--worker-result",
                "success",
                "--production-ready",
                "false",
            ],
            cwd=REPO_ROOT,
            text=True,
            capture_output=True,
            check=False,
        )

        self.assertEqual(result.returncode, 2)
        self.assertIn("Worker deployment/readiness did not succeed", result.stderr)


if __name__ == "__main__":
    unittest.main()
