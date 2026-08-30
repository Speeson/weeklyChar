from __future__ import annotations

import sys
import time
import unittest
from pathlib import Path

import requests

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "keystone-client" / "sidecar"))

from team_service import TeamService, TeamServiceError  # noqa: E402


class FakeResponse:
    def __init__(self, payload=None, status_code=200, json_error=None):
        self.payload = payload
        self.status_code = status_code
        self.ok = 200 <= status_code < 300
        self.json_error = json_error

    def json(self):
        if self.json_error:
            raise self.json_error
        return self.payload


class FakeSession:
    def __init__(self, responses=None, error=None):
        self.responses = list(responses or [])
        self.error = error
        self.calls = []

    def get(self, url, **kwargs):
        self.calls.append((url, kwargs))
        if self.error:
            raise self.error
        return self.responses.pop(0)


class TeamServiceTests(unittest.TestCase):
    def setUp(self):
        self.cfg = {"api_url": "https://api.test", "access_token": "access-secret", "sync_token": "sync-secret", "login_at": time.time()}

    def test_success_paths_apply_private_bearer_and_return_only_safe_fields(self):
        selector = {"teamId": 7, "challengeMapId": 588, "availability": {"stoneCount": 0, "stones": []}, "summary": {"charactersWithObjectives": 0, "totalObjectives": 0, "tiers": {"bestInSlot": 0, "mustHave": 0, "niceToHave": 0, "catalyst": 0, "transmog": 0, "other": 0}}, "characters": [], "access_token": "leak"}
        session = FakeSession([
            FakeResponse([{"id": 7, "name": "Raid", "memberCount": 2, "inviteCode": "SECRET"}]),
            FakeResponse({"id": 7, "name": "Raid", "inviteCode": "SECRET", "members": []}),
            FakeResponse(selector),
        ])
        service = TeamService(session=session)
        listed = service.list_teams(self.cfg)
        detail = service.get_team(self.cfg, 7)
        selected = service.get_keystone_selector(self.cfg, 7, 588)
        self.assertEqual(listed, [{"id": 7, "name": "Raid", "memberCount": 2}])
        self.assertEqual(detail, {"id": 7, "name": "Raid", "members": []})
        self.assertEqual(selected["teamId"], 7)
        self.assertTrue(all(call[1]["headers"] == {"Authorization": "Bearer access-secret"} for call in session.calls))
        self.assertTrue(all(call[1]["timeout"] == 10 for call in session.calls))
        self.assertNotIn("access-secret", str((listed, detail, selected)))
        self.assertNotIn("SECRET", str((listed, detail, selected)))

    def test_status_codes_map_to_stable_safe_errors(self):
        expected = {400: "INVALID_TEAM_REQUEST", 401: "SESSION_EXPIRED", 403: "TEAM_ACCESS_DENIED", 404: "TEAM_NOT_FOUND", 429: "API_THROTTLED", 503: "API_UNAVAILABLE"}
        for status, code in expected.items():
            with self.subTest(status=status):
                service = TeamService(session=FakeSession([FakeResponse({"token": "server-secret"}, status)]))
                with self.assertRaises(TeamServiceError) as caught:
                    service.get_team(self.cfg, 7)
                self.assertEqual(caught.exception.code, code)
                self.assertNotIn("secret", caught.exception.message)

    def test_timeout_connection_and_malformed_json_are_controlled(self):
        cases = [
            (requests.Timeout("access-secret"), "API_TIMEOUT"),
            (requests.ConnectionError("access-secret"), "API_UNAVAILABLE"),
        ]
        for error, code in cases:
            with self.subTest(code=code):
                with self.assertRaises(TeamServiceError) as caught:
                    TeamService(session=FakeSession(error=error)).list_teams(self.cfg)
                self.assertEqual(caught.exception.code, code)
                self.assertNotIn("access-secret", caught.exception.message)
        with self.assertRaises(TeamServiceError) as caught:
            TeamService(session=FakeSession([FakeResponse(json_error=ValueError("access-secret"))])).list_teams(self.cfg)
        self.assertEqual(caught.exception.code, "INVALID_TEAM_RESPONSE")
        self.assertNotIn("access-secret", caught.exception.message)

    def test_missing_access_token_expires_session_without_network(self):
        session = FakeSession([])
        with self.assertRaises(TeamServiceError) as caught:
            TeamService(session=session).list_teams({"api_url": "https://api.test"})
        self.assertEqual(caught.exception.code, "SESSION_EXPIRED")
        self.assertEqual(session.calls, [])

    def test_malformed_success_payloads_are_rejected(self):
        with self.assertRaises(TeamServiceError) as caught:
            TeamService(session=FakeSession([FakeResponse([{"id": 0, "name": "Raid", "memberCount": 2}])])).list_teams(self.cfg)
        self.assertEqual(caught.exception.code, "INVALID_TEAM_RESPONSE")

    def test_team_keystone_map_id_preserves_nullable_worker_contract(self):
        character = {"id": 10, "name": "Auralis", "realm": "Zul'jin", "region": "eu",
                     "wowClass": None, "avatarUrl": None, "ilvl": None, "rioScore": None}

        def payload(current):
            return {"id": 7, "name": "Raid", "members": [{"userId": 2, "username": "ana",
                    "characters": [{**character, "currentKeystone": current}]}]}

        accepted = [None, {"level": 10, "challengeMapId": 588, "dungeon": None},
                    {"level": 10, "challengeMapId": None, "dungeon": None}]
        for current in accepted:
            with self.subTest(current=current):
                detail = TeamService(session=FakeSession([FakeResponse(payload(current))])).get_team(self.cfg, 7)
                self.assertEqual(detail["members"][0]["characters"][0]["currentKeystone"], current)

        for malformed in ("588", 0, -1, 1.5):
            with self.subTest(malformed=malformed):
                service = TeamService(session=FakeSession([FakeResponse(payload(
                    {"level": 10, "challengeMapId": malformed, "dungeon": None}
                ))]))
                with self.assertRaises(TeamServiceError) as caught:
                    service.get_team(self.cfg, 7)
                self.assertEqual(caught.exception.code, "INVALID_TEAM_RESPONSE")

        with self.assertRaises(TeamServiceError):
            TeamService(session=FakeSession([FakeResponse(payload(
                {"level": 10, "dungeon": None}
            ))])).get_team(self.cfg, 7)


if __name__ == "__main__":
    unittest.main()
