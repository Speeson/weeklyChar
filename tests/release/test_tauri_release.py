from __future__ import annotations

import base64
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import tauri_release  # noqa: E402


PUBLIC_KEY = base64.b64encode(
    (
        "untrusted comment: minisign public key: 69E7080618B2D4A1\n"
        "RWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO3\n"
    ).encode("utf-8")
).decode("ascii")


class TauriReleaseTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        (self.tmp / "keystone-client").mkdir()
        (self.tmp / "keystone-client" / "src-tauri").mkdir(parents=True)
        (self.tmp / "keystone-client" / "src" / "generated").mkdir(parents=True)
        (self.tmp / "keystone-client" / "VERSION").write_text("0.3.0\n", encoding="utf-8")
        (self.tmp / "keystone-client" / "package.json").write_text(
            json.dumps({"name": "keystone-client", "version": "0.1.0"}), encoding="utf-8"
        )
        (self.tmp / "keystone-client" / "package-lock.json").write_text(
            json.dumps(
                {
                    "name": "keystone-client",
                    "version": "0.1.0",
                    "lockfileVersion": 3,
                    "packages": {"": {"name": "keystone-client", "version": "0.1.0"}},
                }
            ),
            encoding="utf-8",
        )
        (self.tmp / "keystone-client" / "src-tauri" / "tauri.conf.json").write_text(
            json.dumps(
                {
                    "productName": "KeystoneClient",
                    "version": "0.1.0",
                    "bundle": {},
                    "plugins": {"updater": {"pubkey": PUBLIC_KEY}},
                }
            ),
            encoding="utf-8",
        )
        (self.tmp / "keystone-client" / "src-tauri" / "Cargo.toml").write_text(
            '[package]\nname = "keystone-client"\nversion = "0.1.0"\n\n[dependencies]\nserde = "1"\n',
            encoding="utf-8",
        )

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def test_version_validation_reports_drift(self):
        with self.assertRaisesRegex(tauri_release.ReleaseError, "package.json"):
            tauri_release.validate_versions(self.tmp)

    def test_sync_versions_updates_every_manifest_and_embedded_notes(self):
        tauri_release.sync_versions(self.tmp, "0.4.0", "Notas de la version")

        versions = tauri_release.read_versions(self.tmp)
        self.assertEqual(set(versions.values()), {"0.4.0"})
        generated = (self.tmp / "keystone-client" / "src" / "generated" / "release.ts").read_text(
            encoding="utf-8"
        )
        self.assertIn('version: "0.4.0"', generated)
        self.assertIn('notes: "Notas de la version"', generated)
        package_lock = json.loads(
            (self.tmp / "keystone-client" / "package-lock.json").read_text(encoding="utf-8")
        )
        self.assertEqual(package_lock["version"], "0.4.0")
        self.assertEqual(package_lock["packages"][""]["version"], "0.4.0")

    def test_release_config_uses_the_production_key_from_the_base_config(self):
        output = self.tmp / "release.conf.json"
        tauri_release.write_release_config(self.tmp, "0.4.0", output)

        payload = json.loads(output.read_text(encoding="utf-8"))
        self.assertEqual(payload["version"], "0.4.0")
        self.assertEqual(payload["bundle"]["targets"], ["nsis"])
        self.assertTrue(payload["bundle"]["createUpdaterArtifacts"])
        self.assertNotIn("plugins", payload)

    def test_release_config_rejects_placeholder_and_malformed_public_keys(self):
        config_path = self.tmp / "keystone-client" / "src-tauri" / "tauri.conf.json"
        config = json.loads(config_path.read_text(encoding="utf-8"))

        for invalid_key in ("LOCAL_BUILD_ONLY_REPLACED_BY_RELEASE_CONFIG", "not-base64"):
            with self.subTest(invalid_key=invalid_key):
                config["plugins"]["updater"]["pubkey"] = invalid_key
                config_path.write_text(json.dumps(config), encoding="utf-8")
                with self.assertRaisesRegex(tauri_release.ReleaseError, "public key"):
                    tauri_release.write_release_config(
                        self.tmp, "0.4.0", self.tmp / "release.json"
                    )

    def test_manifest_embeds_signature_and_canonical_download(self):
        signature = self.tmp / "installer.sig"
        signature.write_text("trusted-signature\n", encoding="utf-8")
        output = self.tmp / "latest.json"

        tauri_release.write_update_manifest(
            version="0.4.0",
            notes="Cambios seguros",
            pub_date="2026-08-23T12:00:00Z",
            installer_url=(
                "https://github.com/Speeson/weeklyChar/releases/download/"
                "client-v0.4.0/KeystoneClientSetup.exe"
            ),
            signature_file=signature,
            output=output,
        )

        payload = json.loads(output.read_text(encoding="utf-8"))
        self.assertEqual(payload["version"], "0.4.0")
        self.assertEqual(payload["pub_date"], "2026-08-23T12:00:00Z")
        windows = payload["platforms"]["windows-x86_64"]
        self.assertEqual(windows["signature"], "trusted-signature")
        self.assertTrue(windows["url"].endswith("/client-v0.4.0/KeystoneClientSetup.exe"))

    def test_manifest_rejects_missing_signature_and_unencoded_url(self):
        signature = self.tmp / "installer.sig"
        signature.write_text("\n", encoding="utf-8")
        with self.assertRaisesRegex(tauri_release.ReleaseError, "signature is empty"):
            tauri_release.write_update_manifest(
                version="0.4.0",
                notes="Notas",
                pub_date="2026-08-23T12:00:00Z",
                installer_url="https://example.test/KeystoneClientSetup.exe",
                signature_file=signature,
                output=self.tmp / "latest.json",
            )

    def test_release_preflight_accepts_consistent_signed_asset_contract(self):
        tauri_release.sync_versions(self.tmp, "0.4.0", "Notas")
        source = self.tmp / "KeystoneClient_0.4.0_x64-setup.exe"
        installer = self.tmp / "KeystoneClientSetup.exe"
        signature = self.tmp / "KeystoneClientSetup.exe.sig"
        manifest = self.tmp / "latest.json"
        source.write_bytes(b"signed installer bytes")
        installer.write_bytes(source.read_bytes())
        signature.write_text("signed-payload\n", encoding="utf-8")
        tauri_release.write_update_manifest(
            version="0.4.0",
            notes="Notas",
            pub_date="2026-08-23T12:00:00Z",
            installer_url=(
                "https://github.com/Speeson/weeklyChar/releases/download/"
                "client-v0.4.0/KeystoneClientSetup.exe"
            ),
            signature_file=signature,
            output=manifest,
        )

        tauri_release.validate_release_artifacts(
            root=self.tmp,
            expected_version="0.4.0",
            source_installer=source,
            installer=installer,
            signature_file=signature,
            manifest_file=manifest,
        )

    def test_release_preflight_rejects_version_url_signature_and_byte_mismatches(self):
        tauri_release.sync_versions(self.tmp, "0.4.0", "Notas")
        source = self.tmp / "KeystoneClient_0.4.0_x64-setup.exe"
        installer = self.tmp / "KeystoneClientSetup.exe"
        signature = self.tmp / "KeystoneClientSetup.exe.sig"
        manifest = self.tmp / "latest.json"
        source.write_bytes(b"installer bytes")
        installer.write_bytes(source.read_bytes())
        signature.write_text("expected-signature\n", encoding="utf-8")

        def write_manifest(*, version="0.4.0", url_version="0.4.0", sig="expected-signature"):
            manifest.write_text(
                json.dumps(
                    {
                        "version": version,
                        "platforms": {
                            "windows-x86_64": {
                                "url": (
                                    "https://github.com/Speeson/weeklyChar/releases/download/"
                                    f"client-v{url_version}/KeystoneClientSetup.exe"
                                ),
                                "signature": sig,
                            }
                        },
                    }
                ),
                encoding="utf-8",
            )

        cases = (
            ("manifest version", {"version": "0.4.1"}),
            ("manifest URL", {"url_version": "0.4.1"}),
            ("manifest signature", {"sig": "different-signature"}),
        )
        for error, changes in cases:
            with self.subTest(error=error):
                write_manifest(**changes)
                with self.assertRaisesRegex(tauri_release.ReleaseError, error):
                    tauri_release.validate_release_artifacts(
                        root=self.tmp,
                        expected_version="0.4.0",
                        source_installer=source,
                        installer=installer,
                        signature_file=signature,
                        manifest_file=manifest,
                    )

        write_manifest()
        installer.write_bytes(b"different installer bytes")
        with self.assertRaisesRegex(tauri_release.ReleaseError, "installer bytes"):
            tauri_release.validate_release_artifacts(
                root=self.tmp,
                expected_version="0.4.0",
                source_installer=source,
                installer=installer,
                signature_file=signature,
                manifest_file=manifest,
            )

        installer.write_bytes(source.read_bytes())
        wrong_source = self.tmp / "KeystoneClient_0.4.1_x64-setup.exe"
        wrong_source.write_bytes(source.read_bytes())
        with self.assertRaisesRegex(tauri_release.ReleaseError, "source installer"):
            tauri_release.validate_release_artifacts(
                root=self.tmp,
                expected_version="0.4.0",
                source_installer=wrong_source,
                installer=installer,
                signature_file=signature,
                manifest_file=manifest,
            )

        signature.write_text("trusted-signature", encoding="utf-8")
        with self.assertRaisesRegex(tauri_release.ReleaseError, "URL-encoded"):
            tauri_release.write_update_manifest(
                version="0.4.0",
                notes="Notas",
                pub_date="2026-08-23T12:00:00Z",
                installer_url="https://example.test/Keystone Client Setup.exe",
                signature_file=signature,
                output=self.tmp / "latest.json",
            )


if __name__ == "__main__":
    unittest.main()
