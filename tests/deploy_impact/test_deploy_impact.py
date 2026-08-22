from __future__ import annotations

import json
import subprocess
import sys
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import deploy_impact  # noqa: E402


class DeployImpactTests(unittest.TestCase):
    def assertImpact(self, paths, expected_true, *, addon_changed=False):
        impact = deploy_impact.classify_paths(paths, addon_changed=addon_changed, repo_root=REPO_ROOT)
        for dimension in deploy_impact.DIMENSIONS:
            self.assertEqual(
                impact.dimensions[dimension],
                dimension in expected_true,
                f"{dimension} mismatch for {paths}",
            )
        return impact

    def test_web_source_file_impacts_web(self):
        self.assertImpact(["keystone-web/app/summary/page.tsx"], {"web"})

    def test_web_package_and_config_impact_web(self):
        self.assertImpact(["keystone-web/package.json", "keystone-web/next.config.ts"], {"web"})

    def test_web_readme_is_no_product_impact(self):
        impact = self.assertImpact(["keystone-web/README.md"], set())
        self.assertEqual(impact.known_no_impact_paths, ["keystone-web/README.md"])

    def test_worker_source_impacts_worker(self):
        self.assertImpact(["keystone-worker/src/index.ts"], {"worker"})

    def test_worker_config_and_package_impact_worker(self):
        self.assertImpact(["keystone-worker/wrangler.jsonc", "keystone-worker/package-lock.json"], {"worker"})

    def test_worker_tests_only_are_no_deploy_impact(self):
        impact = self.assertImpact(["keystone-worker/tests/keystoneRoutes.test.js"], set())
        self.assertEqual(impact.known_no_impact_paths, ["keystone-worker/tests/keystoneRoutes.test.js"])

    def test_db_migration_impacts_db_and_worker(self):
        self.assertImpact(["keystone-worker/migrations/9999_example.sql"], {"worker", "db"})

    def test_client_source_impacts_build_and_release(self):
        self.assertImpact(["keystone-client/sync_worker.py"], {"client_build", "client_release"})

    def test_client_bridge_migration_files_are_build_only(self):
        paths = [
            "keystone-client/auth_service.py",
            "keystone-client/addon_service.py",
            "keystone-client/bridge_main.py",
            "keystone-client/bridge_protocol.py",
            "keystone-client/settings_service.py",
            "keystone-client/sync_service.py",
            "keystone-client/wow_service.py",
        ]
        for path in paths:
            with self.subTest(path=path):
                impact = self.assertImpact([path], {"client_build"})
                self.assertEqual(impact.reasons["client_release"], [])

    def test_client_next_migration_paths_are_build_only(self):
        paths = [
            "keystone-client-next/src/App.tsx",
            "keystone-client-next/src/components/example.tsx",
            "keystone-client-next/src-tauri/src/lib.rs",
            "keystone-client-next/src-tauri/tauri.conf.json",
            "keystone-client-next/package.json",
            "keystone-client-next/package-lock.json",
            "keystone-client-next/src/App.test.tsx",
        ]
        for path in paths:
            with self.subTest(path=path):
                impact = self.assertImpact([path], {"client_build"})
                self.assertEqual(impact.reasons["client_release"], [])

    def test_client_sidecar_build_helper_is_build_only(self):
        impact = self.assertImpact(["scripts/build_client_sidecar.py"], {"client_build"})
        self.assertEqual(impact.reasons["client_release"], [])

    def test_client_resource_impacts_build_and_release(self):
        self.assertImpact(["keystone-client/bg.jpg"], {"client_build", "client_release"})

    def test_client_build_scripts_are_build_only(self):
        self.assertImpact(["keystone-client/build.bat"], {"client_build"})
        self.assertImpact(["keystone-client/build_installer.bat"], {"client_build"})

    def test_client_installer_behavior_impacts_build_and_release(self):
        self.assertImpact(["keystone-client/installer/KeystoneClient.iss"], {"client_build", "client_release"})

    def test_client_version_generated_bump_is_build_only(self):
        self.assertImpact(["keystone-client/VERSION"], {"client_build"})
        self.assertImpact(["keystone-client/installer/version.ini"], {"client_build"})

    def test_external_addon_flag_impacts_addon_release_only(self):
        self.assertImpact([], {"addon", "addon_release"}, addon_changed=True)

    def test_addon_updater_code_impacts_client_distribution(self):
        self.assertImpact(["keystone-client/addon_updater.py"], {"client_build", "client_release"})

    def test_client_tests_are_no_release_impact(self):
        self.assertImpact(["tests/client/test_sync_worker.py"], set())

    def test_root_docs_and_skills_are_no_product_impact(self):
        self.assertImpact(["docs/ARCHITECTURE.md", ".agents/skills/deploy-impact/SKILL.md", "AGENTS.md"], set())

    def test_github_workflows_are_known_no_product_impact(self):
        impact = self.assertImpact([".github/workflows/deploy.yml"], set())
        self.assertEqual(impact.known_no_impact_paths, [".github/workflows/deploy.yml"])

    def test_deploy_impact_tooling_is_no_product_impact(self):
        self.assertImpact(["scripts/deploy_impact.py"], set())

    def test_changesets_and_release_tooling_are_no_product_impact(self):
        impact = self.assertImpact(
            [
                ".changes/pending/client-addon-updater.json",
                ".changes/releases/client-v0.3.0/release-notes.md",
                "scripts/release_changes.py",
                "scripts/release_state.py",
            ],
            set(),
        )
        self.assertEqual(impact.unknown_paths, [])

    def test_multiple_files_union_impacts_all_relevant_dimensions(self):
        self.assertImpact(
            ["keystone-worker/src/index.ts", "keystone-web/app/page.tsx", "keystone-client/main.py"],
            {"worker", "web", "client_build", "client_release"},
        )

    def test_path_normalization_handles_backslashes_and_leading_dot(self):
        self.assertImpact([".\\keystone-worker\\src\\index.ts"], {"worker"})

    def test_absolute_path_inside_repo_is_normalized(self):
        absolute = str(REPO_ROOT / "keystone-web" / "app" / "summary" / "page.tsx")
        impact = deploy_impact.classify_paths([absolute], repo_root=REPO_ROOT)
        self.assertTrue(impact.dimensions["web"])
        self.assertEqual(impact.reasons["web"], ["keystone-web/app/summary/page.tsx"])

    def test_outside_path_is_reported(self):
        impact = deploy_impact.classify_paths(["../outside.txt"], repo_root=REPO_ROOT)
        self.assertEqual(impact.outside_paths, ["../outside.txt"])
        self.assertFalse(any(impact.dimensions.values()))

    def test_unknown_path_is_reported_without_implicit_impact(self):
        impact = deploy_impact.classify_paths(["new-service/config.toml"], repo_root=REPO_ROOT)
        self.assertEqual(impact.unknown_paths, ["new-service/config.toml"])
        self.assertFalse(any(impact.dimensions.values()))

    def test_strict_cli_fails_for_unknown_paths(self):
        result = subprocess.run(
            [
                sys.executable,
                str(REPO_ROOT / "scripts" / "deploy_impact.py"),
                "--files",
                "new-service/config.toml",
                "--strict",
                "--json",
            ],
            cwd=REPO_ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 2)
        payload = json.loads(result.stdout)
        self.assertEqual(payload["unknown_paths"], ["new-service/config.toml"])

    def test_json_cli_output_is_machine_readable(self):
        result = subprocess.run(
            [
                sys.executable,
                str(REPO_ROOT / "scripts" / "deploy_impact.py"),
                "--files",
                "keystone-worker/src/index.ts",
                "--json",
            ],
            cwd=REPO_ROOT,
            text=True,
            capture_output=True,
            check=True,
        )
        payload = json.loads(result.stdout)
        self.assertTrue(payload["worker"])
        self.assertFalse(payload["web"])
        self.assertEqual(payload["reasons"]["worker"], ["keystone-worker/src/index.ts"])

    def test_cli_can_allow_empty_changed_path_sets(self):
        result = subprocess.run(
            [
                sys.executable,
                str(REPO_ROOT / "scripts" / "deploy_impact.py"),
                "--allow-empty",
                "--json",
                "--strict",
            ],
            cwd=REPO_ROOT,
            text=True,
            capture_output=True,
            check=True,
        )
        payload = json.loads(result.stdout)
        self.assertFalse(any(payload[dimension] for dimension in deploy_impact.DIMENSIONS))
        self.assertEqual(payload["unknown_paths"], [])


if __name__ == "__main__":
    unittest.main()
