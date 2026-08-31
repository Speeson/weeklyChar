from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from slpp import slpp as lua


REPO_ROOT = Path(__file__).resolve().parents[2]
CLIENT_ROOT = REPO_ROOT / "keystone-client" / "sidecar"
FIXTURE_ROOT = REPO_ROOT / "tests" / "fixtures"

sys.path.insert(0, str(CLIENT_ROOT))

from sync_worker import SyncWorker, _keystone_loot_for_json, _normalize_ilvl  # noqa: E402


class FakeResponse:
    def __init__(self, *, ok=True, status_code=200, text=""):
        self.ok = ok
        self.status_code = status_code
        self.text = text


def load_savedvariables(name: str) -> dict:
    content = (FIXTURE_ROOT / "savedvariables" / name).read_text(encoding="utf-8").strip()
    table = content[content.index("=") + 1 :].strip()
    return lua.decode(table)


def json_normalized(value):
    return json.loads(json.dumps(value, sort_keys=True))


class SyncWorkerContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.config = {
            "api_url": "https://api.test",
            "sync_token": "sync-token",
        }

    def capture_sync_payloads(self, fixture_name: str):
        worker = SyncWorker(self.config)
        posts = []

        def fake_post(url, json, headers, timeout):
            posts.append({
                "url": url,
                "json": json,
                "headers": headers,
                "timeout": timeout,
            })
            return FakeResponse()

        with (
            mock.patch.object(
                worker,
                "_fetch_raiderio",
                return_value=("https://example.test/avatar.jpg", 2510.25, "Mage", 640),
            ),
            mock.patch("sync_worker.requests.post", side_effect=fake_post),
        ):
            worker._sync(str(FIXTURE_ROOT / "savedvariables" / fixture_name), "ACCOUNT-1")

        return posts

    def write_instance_savedvariables(
        self, root: Path, instance_id: str, characters: tuple[str, ...] = ("Bakuhatsu",)
    ) -> Path:
        entries = []
        for name in characters:
            entries.append(
                f'''["Everlight-{name}"] = {{
                    character = "{name}", realm = "Everlight", region = "eu",
                    hasKeystone = false,
                }}'''
            )
        path = root / "KeystoneSync.lua"
        path.write_text(
            "KeystoneSyncDB = {\n"
            f'  savedVariablesInstanceId = "{instance_id}",\n'
            f"  {','.join(entries)}\n"
            "}\n",
            encoding="utf-8",
        )
        return path

    def run_instance_sync(self, worker: SyncWorker, path: Path, responses=None):
        posts = []
        queued = list(responses or [])

        def fake_post(url, json, headers, timeout):
            posts.append({"url": url, "json": json})
            return queued.pop(0) if queued else FakeResponse()

        with (
            mock.patch.object(worker, "_fetch_raiderio", return_value=(None, None, None, None)),
            mock.patch("sync_worker.requests.post", side_effect=fake_post),
            mock.patch("sync_worker.cfg_module.save") as save_config,
        ):
            result = worker._sync(str(path), "ACCOUNT-1")
        return result, posts, save_config

    def test_basic_savedvariables_fixture_decodes_current_contract_blocks(self):
        decoded = load_savedvariables("basic.lua")

        character = decoded["Auralis-Everlight"]
        self.assertEqual(character["character"], "Auralis")
        self.assertEqual(character["realm"], "Everlight")
        self.assertEqual(character["vault"]["activities"][1]["level"], 10)
        self.assertEqual(character["preyHunts"]["normal"]["completed"], True)
        self.assertEqual(character["currencies"]["valorstones"]["quantity"], 1250)
        self.assertEqual(character["money"]["copper"], 12345678)
        self.assertEqual(character["mythicPlusSeason"]["bestRuns"][1]["challengeMapId"], 503)

    def test_raiderio_item_level_normalization_remains_available(self):
        self.assertEqual(_normalize_ilvl(642.6), 643)
        self.assertEqual(_normalize_ilvl("640"), 640)
        self.assertIsNone(_normalize_ilvl("invalid"))

    def test_all_savedvariables_fixtures_decode(self):
        for fixture in sorted((FIXTURE_ROOT / "savedvariables").glob("*.lua")):
            with self.subTest(fixture=fixture.name):
                decoded = load_savedvariables(fixture.name)
                self.assertIsInstance(decoded, dict)
                self.assertGreaterEqual(len(decoded), 1)

    def test_multiple_characters_fixture_posts_each_character(self):
        posts = self.capture_sync_payloads("multiple-characters.lua")

        self.assertEqual(len(posts), 2)
        self.assertEqual([post["json"]["character"] for post in posts], ["Auralis", "Bromm"])
        self.assertTrue(all(post["url"] == "https://api.test/api/keystones/update" for post in posts))
        self.assertTrue(all(post["headers"] == {"Authorization": "Bearer sync-token"} for post in posts))

    def test_empty_or_partial_fixture_defaults_and_omits_optional_blocks_safely(self):
        posts = self.capture_sync_payloads("empty-or-partial.lua")

        self.assertEqual(len(posts), 1)
        payload = posts[0]["json"]
        self.assertEqual(payload["character"], "Noystone")
        self.assertEqual(payload["region"], "eu")
        self.assertFalse(payload["hasKeystone"])
        self.assertIsNone(payload["keystoneLevel"])
        self.assertIsNone(payload["vault"])
        self.assertIsNone(payload["mythicPlusSeason"])
        self.assertEqual(payload["ilvl"], 600)

    def test_client_builds_worker_compatible_payload_from_savedvariables(self):
        [post] = self.capture_sync_payloads("basic.lua")
        expected = json.loads((FIXTURE_ROOT / "client-payload" / "basic-sync-payload.json").read_text(encoding="utf-8"))

        self.assertEqual(json_normalized(post["json"]), expected)

    def test_addon_local_only_fields_are_not_sent_to_worker(self):
        [post] = self.capture_sync_payloads("basic.lua")

        self.assertNotIn("keystoneWeeklyResetKey", post["json"])
        self.assertNotIn("mythicPlusSeasonUpdatedAt", post["json"])

    def test_season2_currency_contract_survives_savedvariables_payload(self):
        [post] = self.capture_sync_payloads("season2.lua")

        currencies = post["json"]["currencies"]
        self.assertEqual(currencies["heroMistcrest"]["id"], 3445)
        self.assertEqual(currencies["mythMistcrest"]["id"], 3446)
        self.assertEqual(currencies["venomblightManaflux"]["id"], 3465)
        self.assertEqual(currencies["tidalSparkDust"]["id"], 3509)
        self.assertEqual(currencies["nebulousVoidcore"]["id"], 3513)
        self.assertEqual(currencies["sparksOfTides"]["itemID"], 274476)
        self.assertEqual(currencies["sparksOfTides"]["currencyID"], 3509)
        self.assertEqual(currencies["sparksOfTides"]["itemQuantity"], 6)
        self.assertEqual(currencies["sparksOfTides"]["inventoryQuantity"], 3)
        self.assertEqual(currencies["sparksOfTides"]["bankQuantity"], 3)
        self.assertTrue(currencies["sparksOfTides"]["bankQuantityKnown"])
        self.assertEqual(currencies["sparksOfTides"]["bankUpdatedAt"], 2000000190)
        self.assertEqual(
            currencies["trovehuntersBounty"],
            {
                "itemID": 274374,
                "bagCount": 0,
                "hasBuff": True,
                "questCompleted": True,
                "iconFileID": 134269,
                "iconPath": "Interface\\\\Icons\\\\icon_treasuremap",
                "weekKey": "2026-08-26",
            },
        )
        self.assertNotIn("heroDawncrest", currencies)
        self.assertNotIn("radiantSparkDust", currencies)
        self.assertEqual(post["json"]["avatarUrl"], "https://example.test/avatar.jpg")
        self.assertEqual(post["json"]["rioScore"], 2510.25)
        self.assertEqual(post["json"]["wowClass"], "Mage")

    def test_keystoneloot_supported_block_reaches_payload_unchanged(self):
        [post] = self.capture_sync_payloads("keystoneloot.lua")
        expected = json.loads(
            (FIXTURE_ROOT / "client-payload" / "keystoneloot-sync-payload.json").read_text(encoding="utf-8")
        )

        self.assertEqual(json_normalized(post["json"]), expected)

    def test_keystoneloot_empty_arrays_survive_lua_to_json_transport(self):
        [post] = self.capture_sync_payloads("keystoneloot-empty.lua")

        snapshot = post["json"]["keystoneLoot"]
        self.assertEqual(snapshot["favorites"], [])
        self.assertEqual(snapshot["voidcore"]["usedItems"], [])
        self.assertFalse(snapshot["voidcore"]["checked"])

    def test_exact_favorite_variant_metadata_survives_json_normalization(self):
        snapshot = _keystone_loot_for_json({
            "favorites": {1: {
                "itemId": 251119,
                "bonusIds": {1: 6652, 2: 1498},
                "variantKey": "bonus:1498,6652",
                "itemLevel": 402,
                "qualityType": "EPIC",
            }},
        })

        self.assertEqual(snapshot["favorites"][0]["itemLevel"], 402)
        self.assertEqual(snapshot["favorites"][0]["qualityType"], "EPIC")
        self.assertEqual(snapshot["favorites"][0]["variantKey"], "bonus:1498,6652")

    def test_keystoneloot_unavailable_state_survives_transport(self):
        [post] = self.capture_sync_payloads("keystoneloot-unavailable.lua")

        self.assertEqual(
            post["json"]["keystoneLoot"],
            {
                "state": "installed_not_ready",
                "installed": True,
                "supported": False,
                "favorites": [],
            },
        )

    def test_historical_character_without_keystoneloot_omits_payload_property(self):
        [post] = self.capture_sync_payloads("basic.lua")

        self.assertNotIn("keystoneLoot", post["json"])

    def test_first_instance_observation_enrolls_after_sync_without_remote_reset(self):
        with tempfile.TemporaryDirectory() as temp:
            path = self.write_instance_savedvariables(Path(temp), "instance-A")
            worker = SyncWorker(dict(self.config))

            result, posts, save_config = self.run_instance_sync(worker, path)

        self.assertTrue(result)
        self.assertEqual([post["url"] for post in posts], [
            "https://api.test/api/keystones/update",
        ])
        self.assertEqual(
            worker.config["saved_variables_instances"],
            {"account-1": {"eu": "instance-A"}},
        )
        save_config.assert_called_once()

    def test_unchanged_instance_and_missing_character_do_not_reset(self):
        config = {
            **self.config,
            "saved_variables_instances": {"account-1": {"eu": "instance-A"}},
        }
        with tempfile.TemporaryDirectory() as temp:
            path = self.write_instance_savedvariables(Path(temp), "instance-A", ("Bakuhatsu",))
            worker = SyncWorker(config)

            result, posts, save_config = self.run_instance_sync(worker, path)

        self.assertTrue(result)
        self.assertEqual([post["json"]["character"] for post in posts], ["Bakuhatsu"])
        self.assertNotIn("/api/me/keystone-loot/reset", [post["url"] for post in posts])
        save_config.assert_not_called()

    def test_changed_instance_resets_before_sync_and_advances_baseline_once(self):
        config = {
            **self.config,
            "saved_variables_instances": {
                "account-1": {"eu": "instance-A"},
                "account-2": {"eu": "other-instance"},
            },
        }
        with tempfile.TemporaryDirectory() as temp:
            path = self.write_instance_savedvariables(Path(temp), "instance-B")
            worker = SyncWorker(config)

            result, posts, save_config = self.run_instance_sync(worker, path)
            second_result, second_posts, second_save = self.run_instance_sync(worker, path)

        self.assertTrue(result)
        self.assertEqual([post["url"] for post in posts], [
            "https://api.test/api/me/keystone-loot/reset",
            "https://api.test/api/keystones/update",
        ])
        self.assertEqual(posts[0]["json"], {"region": "eu", "wowAccount": "ACCOUNT-1"})
        self.assertEqual(worker.config["saved_variables_instances"]["account-1"]["eu"], "instance-B")
        self.assertEqual(
            worker.config["saved_variables_instances"]["account-2"]["eu"],
            "other-instance",
        )
        save_config.assert_called_once()
        self.assertTrue(second_result)
        self.assertEqual([post["url"] for post in second_posts], [
            "https://api.test/api/keystones/update",
        ])
        second_save.assert_not_called()

    def test_failed_reset_keeps_old_baseline_and_retries_next_sync(self):
        config = {
            **self.config,
            "saved_variables_instances": {"account-1": {"eu": "instance-A"}},
        }
        errors = []
        with tempfile.TemporaryDirectory() as temp:
            path = self.write_instance_savedvariables(Path(temp), "instance-B")
            worker = SyncWorker(config, on_error=errors.append)
            failure = FakeResponse(ok=False, status_code=503, text="unavailable")

            first_result, first_posts, first_save = self.run_instance_sync(worker, path, [failure])
            second_result, second_posts, second_save = self.run_instance_sync(worker, path, [failure])

        self.assertFalse(first_result)
        self.assertFalse(second_result)
        self.assertEqual(first_posts[0]["url"], "https://api.test/api/me/keystone-loot/reset")
        self.assertEqual(second_posts[0]["url"], "https://api.test/api/me/keystone-loot/reset")
        self.assertEqual(worker.config["saved_variables_instances"]["account-1"]["eu"], "instance-A")
        first_save.assert_not_called()
        second_save.assert_not_called()
        self.assertEqual(len(errors), 2)

    def test_character_sync_failure_after_reset_does_not_advance_baseline(self):
        config = {
            **self.config,
            "saved_variables_instances": {"account-1": {"eu": "instance-A"}},
        }
        with tempfile.TemporaryDirectory() as temp:
            path = self.write_instance_savedvariables(Path(temp), "instance-B")
            worker = SyncWorker(config)
            failure = FakeResponse(ok=False, status_code=500, text="failed")

            result, posts, save_config = self.run_instance_sync(
                worker, path, [FakeResponse(), failure]
            )

        self.assertFalse(result)
        self.assertEqual(len(posts), 2)
        self.assertEqual(worker.config["saved_variables_instances"]["account-1"]["eu"], "instance-A")
        save_config.assert_not_called()

    def test_config_persistence_failure_keeps_reset_retryable_in_memory(self):
        config = {
            **self.config,
            "saved_variables_instances": {"account-1": {"eu": "instance-A"}},
        }
        posts = []
        with tempfile.TemporaryDirectory() as temp:
            path = self.write_instance_savedvariables(Path(temp), "instance-B")
            worker = SyncWorker(config)

            def fake_post(url, json, headers, timeout):
                posts.append(url)
                return FakeResponse()

            with (
                mock.patch.object(worker, "_fetch_raiderio", return_value=(None, None, None, None)),
                mock.patch("sync_worker.requests.post", side_effect=fake_post),
                mock.patch("sync_worker.cfg_module.save", side_effect=OSError("disk full")),
            ):
                with self.assertRaises(OSError):
                    worker._sync(str(path), "ACCOUNT-1")
                with self.assertRaises(OSError):
                    worker._sync(str(path), "ACCOUNT-1")

        self.assertEqual(posts, [
            "https://api.test/api/me/keystone-loot/reset",
            "https://api.test/api/keystones/update",
            "https://api.test/api/me/keystone-loot/reset",
            "https://api.test/api/keystones/update",
        ])
        self.assertEqual(worker.config["saved_variables_instances"]["account-1"]["eu"], "instance-A")

    def test_invalid_savedvariables_never_reset_or_change_baseline(self):
        config = {
            **self.config,
            "saved_variables_instances": {"account-1": {"eu": "instance-A"}},
        }
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "KeystoneSync.lua"
            path.write_text("KeystoneSyncDB = { savedVariablesInstanceId = ", encoding="utf-8")
            worker = SyncWorker(config)
            with (
                mock.patch("sync_worker.requests.post") as post,
                mock.patch("sync_worker.cfg_module.save") as save_config,
            ):
                with self.assertRaises(Exception):
                    worker._sync(str(path), "ACCOUNT-1")

        post.assert_not_called()
        save_config.assert_not_called()
        self.assertEqual(worker.config["saved_variables_instances"]["account-1"]["eu"], "instance-A")

        missing = Path(temp) / "missing.lua"
        with mock.patch("sync_worker.requests.post") as missing_post:
            with self.assertRaises(FileNotFoundError):
                worker._sync(str(missing), "ACCOUNT-1")
        missing_post.assert_not_called()

    def test_watcher_retries_same_mtime_until_complete_sync_succeeds(self):
        worker = SyncWorker(dict(self.config))
        account = {"name": "ACCOUNT-1", "savedvars_path": "C:/WTF/KeystoneSync.lua"}
        with (
            mock.patch("sync_worker.wow_path.selected_savedvars_paths", return_value=[account]),
            mock.patch("sync_worker.os.path.exists", return_value=True),
            mock.patch("sync_worker.os.path.getmtime", return_value=123.0),
            mock.patch("sync_worker.time.sleep"),
            mock.patch.object(worker, "_sync", side_effect=[False, True]) as sync,
        ):
            worker._check()
            worker._check()

        self.assertEqual(sync.call_count, 2)
        self.assertEqual(worker._last_mtimes[account["savedvars_path"]], 123.0)


if __name__ == "__main__":
    unittest.main()
