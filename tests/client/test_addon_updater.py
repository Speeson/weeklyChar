from __future__ import annotations

import io
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

import requests


REPO_ROOT = Path(__file__).resolve().parents[2]
CLIENT_ROOT = REPO_ROOT / "keystone-client"
sys.path.insert(0, str(CLIENT_ROOT))

import addon_installer  # noqa: E402
import addon_updater  # noqa: E402


def write_addon(parent: Path, version: str, *, missing_listed_file: bool = False) -> Path:
    addon = parent / "KeystoneSync"
    addon.mkdir(parents=True, exist_ok=True)
    (addon / "KeystoneSync.toc").write_text(
        "\n".join(
            [
                "## Interface: 120005",
                "## Title: KeystoneSync",
                f"## Version: {version}",
                "## SavedVariables: KeystoneSyncDB",
                "",
                "KeystoneSync.lua",
            ]
        ),
        encoding="utf-8",
    )
    if not missing_listed_file:
        (addon / "KeystoneSync.lua").write_text("-- addon\n", encoding="utf-8")
    return addon


def zip_bytes(entries: dict[str, str], *, symlink: str | None = None) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in entries.items():
            archive.writestr(name, content)
        if symlink:
            info = zipfile.ZipInfo(symlink)
            info.external_attr = 0o120777 << 16
            archive.writestr(info, "target")
    return buffer.getvalue()


def addon_zip_bytes(version: str, *, missing_toc: bool = False, missing_listed_file: bool = False, extra: dict[str, str] | None = None) -> bytes:
    entries = {}
    if not missing_toc:
        entries["KeystoneSync/KeystoneSync.toc"] = "\n".join(
            [
                "## Interface: 120005",
                "## Title: KeystoneSync",
                f"## Version: {version}",
                "## SavedVariables: KeystoneSyncDB",
                "",
                "KeystoneSync.lua",
            ]
        )
    if not missing_listed_file:
        entries["KeystoneSync/KeystoneSync.lua"] = "-- addon\n"
    entries.update(extra or {})
    return zip_bytes(entries)


def release_payload(version: str = "0.1.17", **overrides):
    payload = {
        "tag_name": f"v{version}",
        "draft": False,
        "prerelease": False,
        "html_url": f"https://github.com/Speeson/KeystoneSync/releases/tag/v{version}",
        "assets": [
            {
                "name": f"KeystoneSync-v{version}.zip",
                "browser_download_url": f"https://example.test/KeystoneSync-v{version}.zip",
            }
        ],
    }
    payload.update(overrides)
    return payload


class FakeJsonResponse:
    def __init__(self, payload=None, *, error=None, json_error=None, status_code=200):
        self.payload = payload
        self.error = error
        self.json_error = json_error
        self.status_code = status_code

    def raise_for_status(self):
        if self.error:
            raise self.error

    def json(self):
        if self.json_error:
            raise self.json_error
        return self.payload


class FakeDownloadResponse:
    def __init__(self, chunks, *, error=None, headers=None):
        self.chunks = chunks if isinstance(chunks, list) else [chunks]
        self.error = error
        self.headers = headers or {}

    def raise_for_status(self):
        if self.error:
            raise self.error

    def iter_content(self, chunk_size=1024):
        yield from self.chunks


class FakeSession:
    def __init__(self, responses=None, *, error=None):
        self.responses = list(responses or [])
        self.error = error
        self.calls = []

    def get(self, *args, **kwargs):
        self.calls.append({"args": args, "kwargs": kwargs})
        if self.error:
            raise self.error
        if not self.responses:
            raise AssertionError("Unexpected HTTP request")
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


class AddonUpdaterTests(unittest.TestCase):
    def test_semver_parsing_and_comparison(self):
        self.assertEqual(addon_updater.parse_semver("v0.1.17"), (0, 1, 17))
        self.assertEqual(addon_updater.compare_versions("0.1.16", "0.1.16"), 0)
        self.assertLess(addon_updater.compare_versions("0.1.16", "0.1.17"), 0)
        self.assertLess(addon_updater.compare_versions("0.1.17", "0.2.0"), 0)
        self.assertLess(addon_updater.compare_versions("0.9.9", "1.0.0"), 0)
        self.assertGreater(addon_updater.compare_versions("0.1.18", "0.1.17"), 0)
        for value in ("", "0.1", "latest"):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    addon_updater.parse_semver(value)

    def test_release_discovery_validates_stable_exact_asset_contract(self):
        release = addon_updater.parse_latest_release(release_payload("0.1.17"))

        self.assertEqual(release.version, "0.1.17")
        self.assertEqual(release.tag, "v0.1.17")
        self.assertEqual(release.asset_name, "KeystoneSync-v0.1.17.zip")

    def test_release_discovery_rejects_bad_metadata(self):
        cases = [
            release_payload("0.1.17", assets=[]),
            release_payload("0.1.17", draft=True),
            release_payload("0.1.17", prerelease=True),
            release_payload("0.1.17", assets=[{"name": "KeystoneSync-v0.1.18.zip", "browser_download_url": "https://example.test/a.zip"}]),
            release_payload("0.1.17", tag_name="latest"),
            {"tag_name": "v0.1.17"},
        ]
        for payload in cases:
            with self.subTest(payload=payload):
                with self.assertRaises(addon_updater.AddonUpdateError):
                    addon_updater.parse_latest_release(payload)

    def test_fetch_latest_release_handles_http_rate_limit_server_timeout_connection_and_json_failures(self):
        cases = [
            FakeSession([FakeJsonResponse(error=requests.HTTPError("404"))]),
            FakeSession([FakeJsonResponse(error=requests.HTTPError("403"))]),
            FakeSession([FakeJsonResponse(error=requests.HTTPError("500"))]),
            FakeSession(error=requests.Timeout("timeout")),
            FakeSession(error=requests.ConnectionError("connection")),
            FakeSession([FakeJsonResponse(json_error=ValueError("bad json"))]),
            FakeSession([FakeJsonResponse(payload=[])]),
        ]
        for session in cases:
            with self.subTest(session=session):
                with self.assertRaises(addon_updater.AddonUpdateError):
                    addon_updater.fetch_latest_release(session=session, client_version="0.2.1")

    def test_fetch_latest_release_sends_user_agent_and_timeout(self):
        session = FakeSession([FakeJsonResponse(release_payload("0.1.17"))])
        addon_updater.fetch_latest_release(session=session, client_version="0.2.1")

        call = session.calls[0]
        self.assertEqual(call["kwargs"]["timeout"], addon_updater.REQUEST_TIMEOUT_SECONDS)
        self.assertIn("KeystoneClient/0.2.1", call["kwargs"]["headers"]["User-Agent"])

    def test_installed_status_distinguishes_missing_valid_invalid_and_corrupt(self):
        with tempfile.TemporaryDirectory() as tmp:
            addons = Path(tmp)
            self.assertEqual(addon_updater.installed_status(addons)["status"], "not_installed")

            write_addon(addons, "0.1.16")
            self.assertEqual(addon_updater.installed_status(addons)["status"], "installed_valid")

            (addons / "KeystoneSync" / "KeystoneSync.toc").write_text("## Version: local\nKeystoneSync.lua\n", encoding="utf-8")
            self.assertEqual(addon_updater.installed_status(addons)["status"], "installed_version_invalid")

            (addons / "KeystoneSync" / "KeystoneSync.toc").write_text("## Version: 0.1.16\n## SavedVariables: KeystoneSyncDB\nMissing.lua\n", encoding="utf-8")
            self.assertEqual(addon_updater.installed_status(addons)["status"], "corrupt")

            (addons / "KeystoneSync" / "KeystoneSync.toc").write_text("## Version: 0.1.16\n## SavedVariables: KeystoneSyncDB\nC:/outside.lua\n", encoding="utf-8")
            self.assertEqual(addon_updater.installed_status(addons)["status"], "corrupt")

    def test_check_for_update_handles_remote_states(self):
        release = FakeJsonResponse(release_payload("0.1.17"))
        with tempfile.TemporaryDirectory() as tmp:
            addons = Path(tmp) / "AddOns"
            addons.mkdir()
            self.assertEqual(addon_updater.check_for_update(addons, session=FakeSession([release])).status, "not_installed")

            write_addon(addons, "0.1.16")
            self.assertEqual(addon_updater.check_for_update(addons, session=FakeSession([FakeJsonResponse(release_payload("0.1.17"))])).status, "update_available")

            (addons / "KeystoneSync" / "KeystoneSync.toc").write_text("## Version: 0.1.17\n## SavedVariables: KeystoneSyncDB\nKeystoneSync.lua\n", encoding="utf-8")
            self.assertEqual(addon_updater.check_for_update(addons, session=FakeSession([FakeJsonResponse(release_payload("0.1.17"))])).status, "up_to_date")

            (addons / "KeystoneSync" / "KeystoneSync.toc").write_text("## Version: 0.1.18\n## SavedVariables: KeystoneSyncDB\nKeystoneSync.lua\n", encoding="utf-8")
            self.assertEqual(addon_updater.check_for_update(addons, session=FakeSession([FakeJsonResponse(release_payload("0.1.17"))])).status, "installed_newer")

    def test_download_valid_stream_uses_part_file_and_returns_final_zip(self):
        release = addon_updater.ReleaseInfo("0.1.17", "v0.1.17", "KeystoneSync-v0.1.17.zip", "https://example.test/addon.zip")
        data = addon_zip_bytes("0.1.17")
        session = FakeSession([FakeDownloadResponse([data[:10], data[10:]])])
        with tempfile.TemporaryDirectory() as tmp:
            path = addon_updater.download_release_asset(release, tmp, session=session, client_version="0.2.1")
            self.assertTrue(path.is_file())
            self.assertFalse((Path(tmp) / "KeystoneSync-v0.1.17.zip.part").exists())
            self.assertEqual(path.read_bytes(), data)

    def test_download_rejects_partial_http_and_oversized_content(self):
        release = addon_updater.ReleaseInfo("0.1.17", "v0.1.17", "KeystoneSync-v0.1.17.zip", "https://example.test/addon.zip")
        cases = [
            FakeDownloadResponse(b"", error=requests.HTTPError("bad")),
            FakeDownloadResponse(b"x", headers={"Content-Length": str(addon_updater.MAX_ADDON_ZIP_BYTES + 1)}),
            FakeDownloadResponse([b"x" * (addon_updater.MAX_ADDON_ZIP_BYTES + 1)]),
            FakeDownloadResponse([]),
        ]
        for response in cases:
            with self.subTest(response=response), tempfile.TemporaryDirectory() as tmp:
                with self.assertRaises(addon_updater.AddonUpdateError):
                    addon_updater.download_release_asset(release, tmp, session=FakeSession([response]))
                self.assertEqual(list(Path(tmp).glob("*")), [])

    def test_zip_validation_accepts_valid_package(self):
        with tempfile.TemporaryDirectory() as tmp:
            zip_path = Path(tmp) / "addon.zip"
            zip_path.write_bytes(addon_zip_bytes("0.1.17"))
            addon_updater.validate_release_zip(zip_path, "0.1.17")

    def test_zip_validation_rejects_untrusted_or_inconsistent_packages(self):
        oversized = zip_bytes({"KeystoneSync/KeystoneSync.toc": "## Version: 0.1.17\n", "KeystoneSync/big.bin": "x" * (addon_updater.MAX_UNCOMPRESSED_BYTES + 1)})
        cases = [
            addon_zip_bytes("0.1.17", missing_toc=True),
            addon_zip_bytes("0.1.17", missing_listed_file=True),
            zip_bytes({"Other/KeystoneSync.toc": "## Version: 0.1.17\n"}),
            zip_bytes({"KeystoneSync/KeystoneSync.toc": "## Version: 0.1.17\n", "evil.txt": "bad"}),
            zip_bytes({"../evil.txt": "bad"}),
            zip_bytes({"/KeystoneSync/KeystoneSync.toc": "bad"}),
            zip_bytes({"C:/KeystoneSync.toc": "bad"}),
            zip_bytes({"KeystoneSync/KeystoneSync.toc": "## Version: 0.1.17\n## SavedVariables: KeystoneSyncDB\nC:/outside.lua\n"}),
            zip_bytes({"KeystoneSync/KeystoneSync.toc": "## Version: local\n## SavedVariables: KeystoneSyncDB\nKeystoneSync.lua\n", "KeystoneSync/KeystoneSync.lua": "-- addon"}),
            addon_zip_bytes("0.1.18"),
            zip_bytes({"KeystoneSync/KeystoneSync.toc": "## Version: 0.1.17\n"}, symlink="KeystoneSync/link.lua"),
            oversized,
            b"not a zip",
        ]
        with tempfile.TemporaryDirectory() as tmp:
            for idx, data in enumerate(cases):
                with self.subTest(idx=idx):
                    zip_path = Path(tmp) / f"bad-{idx}.zip"
                    zip_path.write_bytes(data if isinstance(data, bytes) else data)
                    with self.assertRaises(addon_updater.AddonUpdateError):
                        addon_updater.validate_release_zip(zip_path, "0.1.17")

    def test_cache_stores_only_latest_valid_package_and_ignores_invalid_cache(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            old_zip = root / "old.zip"
            new_zip = root / "new.zip"
            old_zip.write_bytes(addon_zip_bytes("0.1.16"))
            new_zip.write_bytes(addon_zip_bytes("0.1.17"))

            old_cache = addon_updater.store_validated_cache(old_zip, "0.1.16", cache_root=root / "cache")
            self.assertTrue(old_cache.path.exists())
            new_cache = addon_updater.store_validated_cache(new_zip, "0.1.17", cache_root=root / "cache")
            self.assertTrue(new_cache.path.exists())
            self.assertFalse(old_cache.path.exists())

            invalid = root / "cache" / "KeystoneSync-v0.1.18.zip"
            invalid.write_bytes(addon_zip_bytes("0.1.17"))
            cached = addon_updater.get_cached_release(root / "cache")
            self.assertEqual(cached.version, "0.1.17")
            self.assertFalse(invalid.exists())

    def test_safe_replacement_clean_install_upgrade_and_rollback(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            addons = root / "AddOns"
            addons.mkdir()
            source_17 = write_addon(root / "source17", "0.1.17")

            addon_installer.install_from_source(addons, source_17, expected_version="0.1.17")
            self.assertEqual(addon_installer.read_addon_version(addons / "KeystoneSync" / "KeystoneSync.toc"), "0.1.17")
            self.assertFalse((addons / "KeystoneSync.backup").exists())

            source_18 = write_addon(root / "source18", "0.1.18")
            addon_installer.install_from_source(addons, source_18, expected_version="0.1.18")
            self.assertEqual(addon_installer.read_addon_version(addons / "KeystoneSync" / "KeystoneSync.toc"), "0.1.18")

            bad = root / "bad" / "KeystoneSync"
            bad.mkdir(parents=True)
            (bad / "KeystoneSync.toc").write_text("## Version: 0.1.19\n## SavedVariables: KeystoneSyncDB\nMissing.lua\n", encoding="utf-8")
            with self.assertRaises(Exception):
                addon_installer.install_from_source(addons, bad, expected_version="0.1.19")
            self.assertEqual(addon_installer.read_addon_version(addons / "KeystoneSync" / "KeystoneSync.toc"), "0.1.18")
            self.assertFalse((addons / "KeystoneSync.backup").exists())

    def test_failed_fresh_install_leaves_no_partial_destination(self):
        with tempfile.TemporaryDirectory() as tmp:
            addons = Path(tmp) / "AddOns"
            addons.mkdir()
            bad = Path(tmp) / "bad" / "KeystoneSync"
            bad.mkdir(parents=True)
            (bad / "KeystoneSync.toc").write_text("## Version: 0.1.17\n## SavedVariables: KeystoneSyncDB\nMissing.lua\n", encoding="utf-8")
            with self.assertRaises(Exception):
                addon_installer.install_from_source(addons, bad, expected_version="0.1.17")
            self.assertFalse((addons / "KeystoneSync").exists())

    def test_install_best_available_prefers_remote_and_updates_cache(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            addons = root / "AddOns"
            cache = root / "cache"
            addons.mkdir()
            write_addon(addons, "0.1.16")
            cached_zip = root / "cached.zip"
            cached_zip.write_bytes(addon_zip_bytes("0.1.16"))
            addon_updater.store_validated_cache(cached_zip, "0.1.16", cache)

            session = FakeSession(
                [
                    FakeJsonResponse(release_payload("0.1.17")),
                    FakeDownloadResponse(addon_zip_bytes("0.1.17")),
                ]
            )
            result = addon_updater.install_best_available(addons, session=session, cache_root=cache)

            self.assertEqual(result.source, "remote")
            self.assertEqual(result.version, "0.1.17")
            self.assertEqual(addon_installer.read_addon_version(addons / "KeystoneSync" / "KeystoneSync.toc"), "0.1.17")
            self.assertEqual(addon_updater.get_cached_release(cache).version, "0.1.17")

    def test_remote_unavailable_valid_cache_update_reinstall_and_no_downgrade(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            cache = root / "cache"
            cache_zip = root / "cached.zip"
            cache_zip.write_bytes(addon_zip_bytes("0.1.17"))
            addon_updater.store_validated_cache(cache_zip, "0.1.17", cache)

            addons = root / "AddOns"
            addons.mkdir()
            write_addon(addons, "0.1.16")
            result = addon_updater.install_best_available(addons, session=FakeSession(error=requests.Timeout("offline")), cache_root=cache)
            self.assertEqual(result.source, "cache")
            self.assertEqual(addon_installer.read_addon_version(addons / "KeystoneSync" / "KeystoneSync.toc"), "0.1.17")

            reinstall = addon_updater.install_best_available(addons, session=FakeSession(error=requests.Timeout("offline")), cache_root=cache)
            self.assertEqual(reinstall.source, "cache")

            write_addon(addons, "0.1.18")
            with self.assertRaises(addon_updater.AddonUpdateError):
                addon_updater.install_best_available(addons, session=FakeSession(error=requests.Timeout("offline")), cache_root=cache)
            self.assertEqual(addon_installer.read_addon_version(addons / "KeystoneSync" / "KeystoneSync.toc"), "0.1.18")

    def test_no_installed_addon_no_network_no_cache_fails_without_filesystem_change(self):
        with tempfile.TemporaryDirectory() as tmp:
            addons = Path(tmp) / "AddOns"
            addons.mkdir()
            with self.assertRaises(addon_updater.AddonUpdateError):
                addon_updater.install_best_available(addons, session=FakeSession(error=requests.ConnectionError("offline")), cache_root=Path(tmp) / "cache")
            self.assertFalse((addons / "KeystoneSync").exists())

    def test_update_addon_downloads_valid_package_and_installs(self):
        release = addon_updater.ReleaseInfo("0.1.17", "v0.1.17", "KeystoneSync-v0.1.17.zip", "https://example.test/KeystoneSync-v0.1.17.zip")
        session = FakeSession([FakeDownloadResponse(addon_zip_bytes("0.1.17"))])
        with tempfile.TemporaryDirectory() as tmp:
            addons = Path(tmp) / "AddOns"
            addons.mkdir()
            addon_updater.update_addon(addons, release, session=session, cache_root=Path(tmp) / "cache")
            self.assertEqual(addon_installer.read_addon_version(addons / "KeystoneSync" / "KeystoneSync.toc"), "0.1.17")


if __name__ == "__main__":
    unittest.main()
