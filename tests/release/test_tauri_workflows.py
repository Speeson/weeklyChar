from __future__ import annotations

import json
import re
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


def workflow_job(workflow: str, job_name: str) -> str:
    match = re.search(
        rf"(?ms)^  {re.escape(job_name)}:\r?\n(.*?)(?=^  [a-zA-Z0-9_-]+:\r?\n|\Z)",
        workflow,
    )
    if match is None:
        raise AssertionError(f"Workflow job not found: {job_name}")
    return match.group(0)


class TauriWorkflowContractTests(unittest.TestCase):
    def test_public_product_identity_is_stable(self):
        config = json.loads(
            (REPO_ROOT / "keystone-client" / "src-tauri" / "tauri.conf.json").read_text(
                encoding="utf-8"
            )
        )
        package = json.loads(
            (REPO_ROOT / "keystone-client" / "package.json").read_text(encoding="utf-8")
        )
        self.assertEqual(config["productName"], "KeystoneClient")
        self.assertEqual(config["mainBinaryName"], "KeystoneClient")
        self.assertEqual(config["identifier"], "dev.esgarpe.keystoneclient")
        self.assertEqual(config["bundle"]["targets"], ["nsis"])
        self.assertEqual(package["name"], "keystone-client")
        self.assertNotIn("Next", json.dumps(config))
        main_rs = (REPO_ROOT / "keystone-client" / "src-tauri" / "src" / "main.rs").read_text(
            encoding="utf-8"
        )
        self.assertIn("keystone_client_lib::run()", main_rs)
        self.assertNotIn("keystone_client_next_lib", main_rs)

    def test_base_build_config_contains_the_production_updater_public_key(self):
        config = json.loads(
            (REPO_ROOT / "keystone-client" / "src-tauri" / "tauri.conf.json").read_text(
                encoding="utf-8"
            )
        )

        updater = config["plugins"]["updater"]
        self.assertNotIn("PLACEHOLDER", updater["pubkey"].upper())
        self.assertNotIn("LOCAL_BUILD_ONLY", updater["pubkey"].upper())
        self.assertGreater(len(updater["pubkey"]), 80)
        self.assertEqual(
            updater["endpoints"],
            ["https://github.com/Speeson/weeklyChar/releases/latest/download/latest.json"],
        )
        self.assertEqual(updater["windows"]["installMode"], "passive")
        self.assertFalse(config["bundle"]["createUpdaterArtifacts"])

    def test_nsis_installer_replaces_the_machine_wide_legacy_install(self):
        config = json.loads(
            (REPO_ROOT / "keystone-client" / "src-tauri" / "tauri.conf.json").read_text(
                encoding="utf-8"
            )
        )

        nsis = config["bundle"]["windows"]["nsis"]
        self.assertEqual(nsis["installMode"], "perMachine")
        self.assertEqual(nsis["installerHooks"], "windows/installer-hooks.nsh")

    def test_nsis_legacy_migration_fails_closed_without_removing_user_data(self):
        hooks = (
            REPO_ROOT
            / "keystone-client"
            / "src-tauri"
            / "windows"
            / "installer-hooks.nsh"
        ).read_text(encoding="utf-8")

        self.assertIn("{B5D12F8B-FC43-4E22-A3E1-4B2D84A4C910}_is1", hooks)
        self.assertIn("ExecWait", hooks)
        self.assertIn("/VERYSILENT /SUPPRESSMSGBOXES /NORESTART", hooks)
        self.assertIn("Abort", hooks)
        self.assertIn(
            'ReadRegStr $KeystoneLegacyAutostart HKCU '
            '"Software\\Microsoft\\Windows\\CurrentVersion\\Run" "KeystoneClient"',
            hooks,
        )
        self.assertIn("!macro NSIS_HOOK_POSTINSTALL", hooks)
        self.assertIn(
            'WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Run" '
            '"KeystoneClient"',
            hooks,
        )
        self.assertIn('"$INSTDIR\\KeystoneClient.exe" --autostart', hooks)
        self.assertNotIn("APPDATA", hooks.upper())
        self.assertNotIn("RMDir", hooks)
        self.assertNotIn("Delete", hooks)

    def test_legacy_inno_build_entrypoints_are_removed_but_migration_hook_remains(self):
        legacy_build_paths = (
            REPO_ROOT / "keystone-client" / "build_installer.bat",
            REPO_ROOT / "keystone-client" / "installer" / "KeystoneClient.iss",
            REPO_ROOT / "keystone-client" / "installer" / "version.ini",
        )
        for path in legacy_build_paths:
            self.assertFalse(path.exists(), str(path))
        self.assertTrue(
            (
                REPO_ROOT
                / "keystone-client"
                / "src-tauri"
                / "windows"
                / "installer-hooks.nsh"
            ).is_file()
        )

    def test_build_workflow_packages_tauri_instead_of_legacy_inno(self):
        workflow = (REPO_ROOT / ".github" / "workflows" / "build-client.yml").read_text(
            encoding="utf-8"
        )
        self.assertIn("scripts/build_client_sidecar.py --clean", workflow)
        self.assertIn("npm run tauri:build -- --bundles nsis", workflow)
        self.assertIn("dist-client/KeystoneClientSetup.exe", workflow)
        self.assertNotIn("build_installer.bat", workflow)
        self.assertNotIn("innosetup", workflow.lower())

    def test_release_workflow_requires_signatures_and_manifest(self):
        workflow = (REPO_ROOT / ".github" / "workflows" / "release-client.yml").read_text(
            encoding="utf-8"
        )
        for required in (
            "TAURI_SIGNING_PRIVATE_KEY",
            "TAURI_SIGNING_PRIVATE_KEY_PASSWORD",
            "write-release-config",
            "verify_updater_signature",
            "preflight-release",
            "KeystoneClientSetup.exe.sig",
            "latest.json",
            "release-dry-run",
            "git push --atomic",
        ):
            self.assertIn(required, workflow)
        self.assertNotIn("build_installer.bat", workflow)
        self.assertNotIn("TAURI_UPDATER_PUBLIC_KEY", workflow)
        self.assertIn("Missing TAURI_SIGNING_PRIVATE_KEY_PASSWORD secret.", workflow)
        self.assertIn("cargo check --locked", workflow)
        self.assertIn("cargo test --locked", workflow)
        self.assertIn(
            "cargo check --manifest-path keystone-client/src-tauri/Cargo.toml",
            workflow,
        )
        self.assertIn('"KeystoneClient_$($version)_x64-setup.exe"', workflow)
        self.assertIn("inputs.mode == 'release'", workflow)

    def test_release_workflow_runs_bridge_tests(self):
        workflow = (REPO_ROOT / ".github" / "workflows" / "release-client.yml").read_text(
            encoding="utf-8"
        )

        self.assertIn("python -m unittest discover -s tests/client_bridge", workflow)

    def test_workflows_build_the_sidecar_before_rust_validation(self):
        for name in ("build-client.yml", "release-client.yml"):
            with self.subTest(workflow=name):
                workflow = (REPO_ROOT / ".github" / "workflows" / name).read_text(
                    encoding="utf-8"
                )
                self.assertLess(
                    workflow.index("- name: Build clean Python sidecar"),
                    workflow.index("- name: Validate Rust"),
                )

    def test_release_builds_sidecar_before_version_lock_refresh_and_fails_closed(self):
        workflow = (REPO_ROOT / ".github" / "workflows" / "release-client.yml").read_text(
            encoding="utf-8"
        )

        self.assertLess(
            workflow.index("- name: Build clean Python sidecar"),
            workflow.index("- name: Synchronize Tauri release metadata"),
        )
        self.assertIn(
            "cargo check --manifest-path keystone-client/src-tauri/Cargo.toml\n"
            "          if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }",
            workflow,
        )

    def test_deploy_passes_signing_secrets_only_to_release_workflow(self):
        workflow = (REPO_ROOT / ".github" / "workflows" / "deploy.yml").read_text(
            encoding="utf-8"
        )
        self.assertGreaterEqual(workflow.count("secrets: inherit"), 2)
        self.assertIn("vars.TAURI_CLIENT_RELEASE_ENABLED == 'true'", workflow)
        self.assertIn("release_orchestration.py plan", workflow)

    def test_deploy_graph_gates_client_publication_on_worker_readiness(self):
        workflow = (REPO_ROOT / ".github" / "workflows" / "deploy.yml").read_text(
            encoding="utf-8"
        )

        worker = workflow_job(workflow, "worker")
        release_gate = workflow_job(workflow, "release-gate")
        client_release = workflow_job(workflow, "client-release")

        self.assertIn("needs.impact.outputs.deploy_worker", worker)
        self.assertIn("needs.impact.outputs.smoke_worker", worker)
        self.assertIn("needs:\n      - impact\n      - worker", release_gate)
        self.assertIn("release_orchestration.py require-readiness", release_gate)
        self.assertIn("needs.worker.outputs.production_ready", release_gate)
        self.assertIn("needs:\n      - impact\n      - release-gate", client_release)
        self.assertIn("release_gate_passed: true", client_release)

    def test_worker_deploy_runs_migration_then_production_smoke(self):
        workflow = (REPO_ROOT / ".github" / "workflows" / "deploy-worker.yml").read_text(
            encoding="utf-8"
        )

        deploy = workflow_job(workflow, "deploy")
        smoke = workflow_job(workflow, "smoke")

        self.assertIn("- migrate", deploy)
        self.assertIn("- deploy", smoke)
        self.assertIn("/api/health", smoke)
        self.assertIn(
            "/api/teams/1/keystone-loot/dungeons/249/summary",
            smoke,
        )
        self.assertIn('"401"', smoke)
        self.assertIn("production_ready=true", smoke)
        self.assertIn("inputs.run_smoke", smoke)
        self.assertIn("WORKER_SMOKE_BYPASS_TOKEN", smoke)
        self.assertIn("X-KeystoneSync-Smoke-Token", smoke)

    def test_guarded_recovery_smokes_without_migration_or_deploy(self):
        workflow = (REPO_ROOT / ".github" / "workflows" / "deploy.yml").read_text(
            encoding="utf-8"
        )

        self.assertIn("recover_worker_readiness:", workflow)
        self.assertIn("--recover-worker-readiness-requested", workflow)
        self.assertIn("smoke_worker", workflow)
        self.assertIn("run_smoke:", workflow)

    def test_direct_client_workflow_cannot_publish_without_orchestrator_gate(self):
        workflow = (REPO_ROOT / ".github" / "workflows" / "release-client.yml").read_text(
            encoding="utf-8"
        )

        dispatch = workflow.split("workflow_dispatch:", 1)[1].split("permissions:", 1)[0]
        self.assertNotIn("          - release\n", dispatch)
        self.assertIn("release_gate_passed", workflow)
        self.assertIn("Publication must run through Deploy Orchestrator", workflow)

    def test_production_orchestrator_serializes_complete_release_chains(self):
        workflow = (REPO_ROOT / ".github" / "workflows" / "deploy.yml").read_text(
            encoding="utf-8"
        )

        pre_jobs = workflow.split("jobs:", 1)[0]
        self.assertIn("keystonesync-production-orchestrator", pre_jobs)
        self.assertIn("cancel-in-progress:", pre_jobs)

    def test_direct_worker_dispatch_is_validation_only(self):
        workflow = (REPO_ROOT / ".github" / "workflows" / "deploy-worker.yml").read_text(
            encoding="utf-8"
        )

        call_inputs, dispatch = workflow.split("workflow_dispatch:", 1)
        dispatch = dispatch.split("permissions:", 1)[0]
        self.assertIn("deploy:", call_inputs)
        self.assertIn("run_migrations:", call_inputs)
        self.assertNotIn("deploy:", dispatch)
        self.assertNotIn("run_migrations:", dispatch)


if __name__ == "__main__":
    unittest.main()
