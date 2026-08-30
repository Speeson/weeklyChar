from __future__ import annotations

import json
import sys
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
    ok = True
    status_code = 200
    text = ""


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


if __name__ == "__main__":
    unittest.main()
