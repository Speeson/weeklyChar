from __future__ import annotations

import sys
import threading
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
CLIENT_ROOT = REPO_ROOT / "keystone-client"
sys.path.insert(0, str(CLIENT_ROOT))

from character_service import (  # noqa: E402
    CHARACTER_REFRESH_FAILED,
    CharacterService,
    CharacterServiceError,
    keystone_display,
    sanitize_character,
)


class FakeResponse:
    def __init__(self, payload=None, *, ok=True, status_code=200):
        self._payload = payload
        self.ok = ok
        self.status_code = status_code

    def json(self):
        return self._payload


class FakeSession:
    def __init__(self, payload):
        self.payload = payload
        self.get_calls = []
        self.post_calls = []
        self.get_response = FakeResponse(payload)

    def get(self, url, **kwargs):
        self.get_calls.append((url, kwargs))
        return self.get_response

    def post(self, url, **kwargs):
        self.post_calls.append((url, kwargs))
        return FakeResponse({"status": "ok"})


def character(**overrides):
    value = {
        "id": 7,
        "name": "Auralis",
        "realm": "Zul'jin",
        "region": "EU",
        "wowAccount": "ACCOUNT_A",
        "wowClass": "Paladin",
        "avatarUrl": "https://render.worldofwarcraft.com/avatar.jpg",
        "ilvl": 302.4,
        "rioScore": 0,
        "currentKeystone": {
            "level": 10,
            "dungeon": "The Stonevault",
            "challengeMapId": 999,
            "mapId": 1,
            "updatedAt": "2026-08-23T10:00:00Z",
            "updatedReason": "LOGIN",
        },
    }
    value.update(overrides)
    return value


class CharacterServiceTests(unittest.TestCase):
    def setUp(self):
        self.saved = None
        self.events = []
        self.config = {
            "api_url": "https://api.test",
            "access_token": "access-secret",
            "sync_token": "sync-secret",
            "cached_characters": [],
        }

    def make_service(self, payload=None, *, fetcher=None):
        session = FakeSession(payload if payload is not None else [])
        service = CharacterService(
            config_loader=lambda: self.config,
            config_saver=lambda cfg: setattr(self, "saved", dict(cfg)),
            session=session,
            raiderio_fetcher=fetcher,
            emit=lambda event, data: self.events.append((event, data)),
        )
        return service, session

    def test_sanitizes_rendering_dto_and_preserves_zero_score(self):
        dto = sanitize_character(character(sync_token="must-not-leak", unknown={"x": 1}))

        self.assertEqual(
            dto,
            {
                "id": "7",
                "name": "Auralis",
                "realm": "Zul'jin",
                "region": "eu",
                "wowAccount": "ACCOUNT_A",
                "wowClass": "Paladin",
                "avatarUrl": "https://render.worldofwarcraft.com/avatar.jpg",
                "ilvl": 302,
                "rioScore": 0.0,
                "currentKeystone": {
                    "level": 10,
                    "dungeon": "The Stonevault",
                    "challengeMapId": 999,
                    "mapId": 1,
                },
                "keystoneDisplay": "+10 Stonevault (SV)",
            },
        )
        self.assertNotIn("sync_token", str(dto))

    def test_rejects_malformed_rows_and_unsafe_avatar_urls(self):
        self.assertIsNone(sanitize_character({"name": "", "realm": "Realm"}))
        dto = sanitize_character(character(avatarUrl="file:///C:/secret.txt", ilvl="bad", rioScore=float("nan")))

        self.assertIsNone(dto["avatarUrl"])
        self.assertIsNone(dto["ilvl"])
        self.assertIsNone(dto["rioScore"])

    def test_keystone_display_preserves_legacy_abbreviations_and_fallbacks(self):
        self.assertEqual(
            keystone_display({"level": 8, "challengeMapId": 402, "dungeon": "ignored"}),
            "+8 Algeth'ar Academy (AA)",
        )
        self.assertEqual(keystone_display({"level": 4, "dungeon": "Unknown Dungeon"}), "+4 Unknown Dungeon")
        self.assertEqual(keystone_display(None), "—")

    def test_cached_characters_are_available_before_remote_refresh(self):
        self.config["cached_characters"] = [character()]
        service, _session = self.make_service()

        state = service.get_state()

        self.assertEqual(state["source"], "cache")
        self.assertEqual(state["characters"][0]["name"], "Auralis")
        self.assertFalse(state["refreshing"])

    def test_refresh_uses_api_enriches_missing_fields_and_updates_cache(self):
        remote = character(avatarUrl=None, wowClass=None, rioScore=None, ilvl=301)
        fetch_calls = []

        def fetcher(name, realm, region):
            fetch_calls.append((name, realm, region))
            return "https://cdn.test/avatar.jpg", 0, "Mage", 344

        service, session = self.make_service([remote], fetcher=fetcher)

        state = service.refresh()

        self.assertEqual(fetch_calls, [("Auralis", "Zul'jin", "eu")])
        self.assertEqual(state["characters"][0]["rioScore"], 0.0)
        self.assertEqual(state["characters"][0]["wowClass"], "Mage")
        self.assertEqual(state["characters"][0]["ilvl"], 301)
        self.assertEqual(self.saved["cached_characters"], state["characters"])
        self.assertEqual(session.post_calls[0][1]["json"]["rioScore"], 0)
        self.assertNotIn("access-secret", str(state))
        self.assertEqual(self.events[-1][0], "characters.updated")

    def test_refresh_failure_preserves_usable_cache_and_exposes_safe_error(self):
        self.config["cached_characters"] = [character()]
        service, session = self.make_service()
        session.get_response = FakeResponse(None, ok=False, status_code=503)

        with self.assertRaises(CharacterServiceError) as caught:
            service.refresh()

        state = service.get_state()
        self.assertEqual(caught.exception.code, CHARACTER_REFRESH_FAILED)
        self.assertEqual([row["name"] for row in state["characters"]], ["Auralis"])
        self.assertEqual(state["lastError"], "No se pudieron actualizar los personajes.")
        self.assertNotIn("503", state["lastError"])

    def test_refresh_merges_cache_into_latest_config_without_overwriting_settings(self):
        latest = dict(self.config)
        latest["lang"] = "en"
        saved = []
        service = CharacterService(
            config_loader=lambda: dict(latest),
            config_saver=lambda cfg: saved.append(dict(cfg)),
            session=FakeSession([character()]),
            raiderio_fetcher=lambda *_args: (None, None, None, None),
        )
        stale = dict(self.config)
        stale["lang"] = "es"

        service.refresh(stale)

        self.assertEqual(saved[-1]["lang"], "en")
        self.assertEqual(saved[-1]["cached_characters"][0]["name"], "Auralis")

    def test_reset_prevents_in_flight_refresh_from_republishing_old_account(self):
        started = threading.Event()
        release = threading.Event()
        service, _session = self.make_service([character()])

        def delayed_fetch(_cfg):
            started.set()
            release.wait(timeout=2)
            return [sanitize_character(character())]

        service._fetch_remote = delayed_fetch
        starting = service.refresh_async()
        self.assertTrue(starting["refreshing"])
        self.assertTrue(started.wait(timeout=2))

        service.reset()
        release.set()
        self.assertTrue(service.wait_for_idle())

        self.assertEqual(service.get_state()["characters"], [])
        self.assertIsNone(self.saved)


if __name__ == "__main__":
    unittest.main()
