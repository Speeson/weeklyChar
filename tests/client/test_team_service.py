from __future__ import annotations

import sys
import time
import unittest
from pathlib import Path

import requests

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "keystone-client" / "sidecar"))

from team_service import (  # noqa: E402
    TeamService, TeamServiceError, _objective, _planner_objective, _planner_request_valid, sanitize_planner,
    sanitize_selector,
)


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

    def post(self, url, **kwargs):
        self.calls.append((url, kwargs))
        if self.error:
            raise self.error
        return self.responses.pop(0)

    def put(self, url, **kwargs):
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
        selected = service.get_keystone_selector(self.cfg, 7, 588, "en_US")
        self.assertEqual(listed, [{"id": 7, "name": "Raid", "memberCount": 2}])
        self.assertEqual(detail, {"id": 7, "name": "Raid", "members": []})
        self.assertEqual(selected["teamId"], 7)
        self.assertTrue(session.calls[2][0].endswith("/api/teams/7/keystone-loot/dungeons/588/summary?locale=en_US"))
        self.assertTrue(all(call[1]["headers"] == {"Authorization": "Bearer access-secret"} for call in session.calls))
        self.assertTrue(all(call[1]["timeout"] == 10 for call in session.calls))
        self.assertNotIn("access-secret", str((listed, detail, selected)))
        self.assertNotIn("SECRET", str((listed, detail, selected)))

    def test_owner_planner_preferences_get_and_put_are_private_and_strict(self):
        saved = {"preferences": [{
            "characterId": 10, "specId": 66, "role": "tank",
            "playPreference": "preferred", "lootSpecId": 65,
            "updatedAt": "2026-09-11T00:00:00.000Z", "secret": "discard",
        }], "lootPreferences": [{
            "characterId": 10, "primaryLootSpecId": 65, "secondaryLootSpecIds": [70],
            "updatedAt": "2026-09-11T00:00:00.000Z",
        }], "onboardingCompleted": True}
        session = FakeSession([FakeResponse(saved), FakeResponse(saved)])
        service = TeamService(session=session)

        loaded = service.get_planner_preferences(self.cfg)
        update = {"preferences": [{
            "characterId": 10, "specId": 66, "playPreference": "preferred",
        }], "lootPreferences": [{
            "characterId": 10, "primaryLootSpecId": 65, "secondaryLootSpecIds": [70],
        }], "onboardingCompleted": True}
        updated = service.update_planner_preferences(self.cfg, update)

        expected = {"preferences": [{
            "characterId": 10, "specId": 66, "role": "tank",
            "playPreference": "preferred", "lootSpecId": 65,
            "updatedAt": "2026-09-11T00:00:00.000Z",
        }], "lootPreferences": [{
            "characterId": 10, "primaryLootSpecId": 65, "secondaryLootSpecIds": [70],
            "updatedAt": "2026-09-11T00:00:00.000Z",
        }], "onboardingCompleted": True}
        self.assertEqual(loaded, expected)
        self.assertEqual(updated, expected)
        self.assertTrue(session.calls[0][0].endswith("/api/me/planner/preferences"))
        self.assertTrue(session.calls[1][0].endswith("/api/me/planner/preferences"))
        self.assertEqual(session.calls[1][1]["json"], update)
        self.assertNotIn("access-secret", str((loaded, updated)))

    def test_legacy_owner_preferences_start_with_all_loot_specs_unselected(self):
        legacy = {"preferences": [{
            "characterId": 10, "specId": 66, "role": "tank",
            "playPreference": "preferred", "lootSpecId": 65,
            "updatedAt": "2026-09-11T00:00:00.000Z",
        }]}

        loaded = TeamService(session=FakeSession([FakeResponse(legacy)])).get_planner_preferences(self.cfg)

        self.assertEqual(loaded, {
            "preferences": legacy["preferences"],
            "lootPreferences": [],
            "onboardingCompleted": False,
        })

    def test_old_team_detail_without_readiness_keeps_member_provisionally_selectable(self):
        detail = {"id": 7, "name": "Raid", "members": [{
            "userId": 2, "username": "qa-member", "characters": [],
        }]}
        parsed = TeamService(session=FakeSession([FakeResponse(detail)])).get_team(self.cfg, 7)
        self.assertTrue(parsed["members"][0]["plannerConfigured"])

    def test_owner_planner_preferences_reject_bad_save_before_network(self):
        session = FakeSession([])
        service = TeamService(session=session)
        malformed = {"preferences": [{"characterId": 10, "specId": 66, "playPreference": "sometimes"}],
                     "lootPreferences": [{"characterId": 10, "primaryLootSpecId": 65,
                                          "secondaryLootSpecIds": []}], "onboardingCompleted": False}
        with self.assertRaises(TeamServiceError) as caught:
            service.update_planner_preferences(self.cfg, malformed)
        self.assertEqual(caught.exception.code, "INVALID_TEAM_REQUEST")
        self.assertEqual(session.calls, [])

    def test_selector_objective_projects_allowlisted_quality_and_classified_stats(self):
        objective = {
            "itemId": 10, "itemName": "Báculo", "iconUrl": None, "tier": 3,
            "specIds": [62], "sourceType": "dungeon", "sourceId": 399, "slotId": 16,
            "slotName": "Mano principal", "itemClassName": "Arma", "itemSubClassName": "Báculo",
            "statNames": ["Intelecto", "Celeridad", "Evitación"],
            "primaryStatNames": ["Intelecto"], "secondaryStatNames": ["Celeridad"],
            "otherStatNames": ["Evitación"], "qualityType": "EPIC",
            "itemLevel": 402, "variantKey": "bonus:1498,6652",
            "voidcoreState": "pending", "numericStats": {"Intelecto": 9999},
        }

        projected = _objective(objective)

        self.assertEqual(projected["qualityType"], "EPIC")
        self.assertEqual(projected["itemLevel"], 402)
        self.assertEqual(projected["variantKey"], "bonus:1498,6652")
        self.assertEqual(projected["primaryStatNames"], ["Intelecto"])
        self.assertEqual(projected["secondaryStatNames"], ["Celeridad"])
        self.assertEqual(projected["otherStatNames"], ["Evitación"])
        self.assertNotIn("numericStats", projected)
        owned = _objective({**objective, "owned": True})
        self.assertTrue(owned["owned"])
        self.assertNotIn("owned", projected)
        tracked = _objective({**objective, "upgradeTrack": "Hero"})
        self.assertEqual(tracked["upgradeTrack"], "Hero")
        self.assertNotIn("upgradeTrack", projected)
        for malformed in (
            {**objective, "qualityType": "MYTHIC"},
            {**objective, "upgradeTrack": "x" * 65},
            {**objective, "itemLevel": 0},
            {**objective, "itemLevel": 402.5},
            {**objective, "variantKey": ""},
            {**objective, "primaryStatNames": [42]},
            {**objective, "secondaryStatNames": ["Intelecto"]},
            {**objective, "otherStatNames": [], "statNames": ["Intelecto", "Celeridad", "Evitación"]},
            {**objective, "owned": "yes"},
            {**objective, "owned": None},
        ):
            with self.subTest(malformed=malformed):
                self.assertIsNone(_objective(malformed))

    def test_planner_objective_preserves_optional_upgrade_track(self):
        objective = {"itemId": 10, "itemName": "Báculo", "iconUrl": None,
                     "tier": 3, "variantKey": "bonus:1", "voidcoreState": "pending"}
        self.assertNotIn("upgradeTrack", _planner_objective(objective))
        self.assertEqual(_planner_objective({**objective, "upgradeTrack": "Hero"})["upgradeTrack"], "Hero")
        self.assertIsNone(_planner_objective({**objective, "upgradeTrack": "x" * 65}))

    def test_midnight_s2_exact_variant_restores_missing_upgrade_track_for_client_surfaces(self):
        selector = {
            "itemId": 10, "itemName": "Báculo", "iconUrl": None, "tier": 3,
            "specIds": [62], "sourceType": "dungeon", "sourceId": 399, "slotId": 16,
            "slotName": "Mano principal", "itemClassName": "Arma", "itemSubClassName": "Báculo",
            "statNames": [], "primaryStatNames": [], "secondaryStatNames": [], "otherStatNames": [],
            "qualityType": "EPIC", "itemLevel": 318, "variantKey": "bonus:1674,3188,12845",
            "voidcoreState": "pending",
        }
        planner = {key: selector[key] for key in (
            "itemId", "itemName", "iconUrl", "tier", "variantKey", "voidcoreState",
        )}

        self.assertEqual(_objective(selector)["upgradeTrack"], "Hero")
        self.assertEqual(_planner_objective(planner)["upgradeTrack"], "Hero")
        self.assertEqual(_objective({**selector, "variantKey": "bonus:1674,12833"})["upgradeTrack"], "Champion")
        self.assertEqual(_planner_objective({**planner, "variantKey": "bonus:1674,12849"})["upgradeTrack"], "Myth")
        self.assertEqual(_objective({**selector, "upgradeTrack": "Héroe"})["upgradeTrack"], "Héroe")
        self.assertNotIn("upgradeTrack", _objective({**selector, "variantKey": "bonus:1674,99999"}))

    def test_selector_accepts_owned_only_character_without_counting_it_as_pending(self):
        objective = {
            "itemId": 10, "itemName": "Báculo", "iconUrl": None, "tier": 3,
            "specIds": [62], "sourceType": "dungeon", "sourceId": 588, "slotId": 16,
            "slotName": "Mano principal", "itemClassName": "Arma", "itemSubClassName": "Báculo",
            "statNames": [], "primaryStatNames": [], "secondaryStatNames": [], "otherStatNames": [],
            "qualityType": "EPIC", "itemLevel": 402, "variantKey": "base",
            "voidcoreState": "pending", "owned": True,
        }
        zero_tiers = {"bestInSlot": 0, "mustHave": 0, "niceToHave": 0,
                      "catalyst": 0, "transmog": 0, "other": 0}
        payload = {
            "teamId": 7, "challengeMapId": 588,
            "availability": {"stoneCount": 0, "stones": []},
            "summary": {"charactersWithObjectives": 0, "totalObjectives": 0, "tiers": zero_tiers},
            "characters": [{
                "userId": 1, "username": "owner", "characterId": 10, "characterName": "OwnedOnly",
                "realm": "Zul'jin", "region": "eu", "wowClass": "Mage", "avatarUrl": None,
                "ilvl": 318, "rioScore": 3000, "totalObjectives": 0, "tierCounts": zero_tiers,
                "specs": [], "objectives": [objective],
            }],
        }

        sanitized = sanitize_selector(payload, 7, 588)

        self.assertIsNotNone(sanitized)
        self.assertEqual(sanitized["summary"]["charactersWithObjectives"], 0)
        self.assertTrue(sanitized["characters"][0]["objectives"][0]["owned"])

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

    def test_selector_rejects_unknown_blizzard_locale_before_network(self):
        session = FakeSession([])
        with self.assertRaises(TeamServiceError) as caught:
            TeamService(session=session).get_keystone_selector(self.cfg, 7, 588, "fr_FR")
        self.assertEqual(caught.exception.code, "INVALID_TEAM_REQUEST")
        self.assertEqual(session.calls, [])

    def test_exact_stone_planner_posts_private_bearer_and_sanitizes_response(self):
        request = {
            "participantUserIds": [1, 2], "targetLevel": 12, "challengeMapId": 588,
            "stoneCharacterId": 30,
            "options": {"optimizeComposition": True, "bloodlust": True, "battleRez": True,
                        "classBuffs": True, "damageSynergy": True},
            "locks": [],
        }
        response = {
            "teamId": 7, "challengeMapId": 588, "targetLevel": 12,
            "availability": {"eligibleStoneCount": 0}, "status": "no_valid_composition",
            "diagnostics": {"codes": ["NO_VALID_COMPOSITION"], "unconfiguredUserIds": [], "lockIssues": []},
            "recommendations": [], "access_token": "leak",
        }
        session = FakeSession([FakeResponse(response)])

        planned = TeamService(session=session).plan_keystone(self.cfg, 7, request)

        self.assertEqual(planned["status"], "no_valid_composition")
        self.assertNotIn("access_token", planned)
        self.assertTrue(session.calls[0][0].endswith("/api/teams/7/keystone-planner"))
        self.assertEqual(session.calls[0][1]["headers"], {"Authorization": "Bearer access-secret"})
        self.assertEqual(session.calls[0][1]["json"], request)
        self.assertEqual(session.calls[0][1]["timeout"], 15)

    def test_planner_preserves_bounded_external_classes_and_accepts_legacy_vacancies(self):
        candidate = {
            "wowClass": "Mage",
            "contributions": [{"capabilityId": "BLOODLUST", "availability": "guaranteed"}],
            "reasonCodes": ["PROVIDES_BLOODLUST"],
            "specIds": [62, 63, 64],
        }
        recommendation = {
            "rank": 1, "fingerprint": "external-party", "assignments": [],
            "stone": {"characterId": 30, "characterName": "Stone", "ownerUserId": 1,
                      "ownerUsername": "owner", "challengeMapId": 588, "dungeon": "Dungeon", "level": 12},
            "vacancies": [{"role": "dps", "preferredCapabilities": ["BLOODLUST"],
                           "candidateClasses": [candidate], "recommendationMode": "quick",
                           "recommendedClass": "Mage", "offensiveGainPct": 0.031,
                           "offensiveBand": 0, "defensiveBand": 0, "dungeonUtilityBand": 0,
                           "offensiveReasons": ["ARCANE_INTELLECT: +3.10%"],
                           "offensiveProvenance": [{"specId": 251, "source": "simc",
                                                      "confidence": "high", "method": "exact_profile"}],
                           "recommendations": [{
                               "id": "quick:Mage:dps", "wowClass": "Mage", "offensiveGainPct": 0.031,
                               "damageProfile": "magical",
                               "buffsDebuffs": [{"capabilityId": "ARCANE_INTELLECT",
                                                  "name": "Arcane Intellect", "spellId": 1459,
                                                  "availability": "guaranteed"}],
                               "utilities": [{"capabilityId": "INTERRUPT", "name": "Counterspell",
                                              "spellId": 2139, "availability": "guaranteed"}],
                           }],
                           "defensiveContribution": {"tiers": {"S": 0, "A": 0, "B": 0, "C": 0},
                                                       "reasons": []},
                           "dungeonUtilityContribution": {"tiers": {"S": 0, "A": 0, "B": 0, "C": 0},
                                                           "reasons": []}}],
            "lootSummary": {"weightedScore": 0, "playersWithObjectives": 0, "totalObjectives": 0,
                            "tierCounts": {"bestInSlot": 0, "mustHave": 0, "niceToHave": 0,
                                           "catalyst": 0, "transmog": 0}},
            "levelSummary": {"targetLevel": 12, "stoneLevel": 12, "levelDistance": 0},
            "preferenceSummary": {"preferred": 0, "available": 0, "emergency": 0},
            "compositionSummary": {"bloodlust": "none", "battleRez": "none", "damageProfile": "unknown",
                                   "magicalDpsCount": 0, "physicalDpsCount": 0, "unknownDpsCount": 0,
                                   "chaosBrandBeneficiaries": 0, "mysticTouchBeneficiaries": 0,
                                   "uniqueClassBuffCount": 0, "criticalRolesCovered": 0,
                                   "uniqueCapabilities": [],
                                   "armorSynergy": {"pairs": 0, "dominantType": None,
                                                    "counts": {"cloth": 0, "leather": 0, "mail": 0, "plate": 0}}},
            "reasonCodes": ["PARTY_INCOMPLETE", "NO_LOOT_OBJECTIVES", "TARGET_LEVEL_EXACT"],
        }
        payload = {"teamId": 7, "challengeMapId": 588, "targetLevel": 12,
                   "availability": {"eligibleStoneCount": 1}, "status": "ok",
                   "diagnostics": {"codes": [], "unconfiguredUserIds": [], "lockIssues": []},
                   "recommendations": [recommendation]}
        recommendation["compositionSummary"]["groupDefensives"] = [{
            "capabilityId": "MAJOR_GROUP_DR", "name": "Darkness", "spellId": 196718,
            "availability": "conditional", "tier": "S", "relevance": 3, "score": 500,
        }]
        recommendation["compositionSummary"]["dungeonUtilities"] = [{
            "capabilityId": "INTERRUPT", "name": "Pummel", "spellId": 6552,
            "availability": "guaranteed", "tier": "S", "relevance": 3, "score": 1000,
        }]

        sanitized = sanitize_planner(payload, 7, 588, 30, 12)

        self.assertEqual(sanitized["recommendations"][0]["vacancies"][0]["candidateClasses"], [{
            "wowClass": "Mage",
            "contributions": [{"capabilityId": "BLOODLUST", "availability": "guaranteed"}],
            "reasonCodes": ["PROVIDES_BLOODLUST"],
        }])
        self.assertEqual(sanitized["recommendations"][0]["vacancies"][0]["recommendedClass"], "Mage")
        self.assertEqual(sanitized["recommendations"][0]["vacancies"][0]["offensiveBand"], 0)
        self.assertEqual(sanitized["recommendations"][0]["compositionSummary"]["groupDefensives"][0]["name"],
                         "Darkness")
        self.assertEqual(sanitized["recommendations"][0]["compositionSummary"]["dungeonUtilities"][0]["score"],
                         1000)
        self.assertEqual(sanitized["recommendations"][0]["vacancies"][0]["recommendations"][0], {
            "id": "quick:Mage:dps", "wowClass": "Mage", "offensiveGainPct": 0.031,
            "damageProfile": "magical",
            "buffsDebuffs": [{"capabilityId": "ARCANE_INTELLECT", "name": "Arcane Intellect",
                               "spellId": 1459, "availability": "guaranteed"}],
            "utilities": [{"capabilityId": "INTERRUPT", "name": "Counterspell", "spellId": 2139,
                           "availability": "guaranteed"}],
        })
        recommendation["vacancies"][0].pop("candidateClasses")
        legacy = sanitize_planner(payload, 7, 588, 30, 12)
        self.assertNotIn("candidateClasses", legacy["recommendations"][0]["vacancies"][0])

    def test_exact_stone_planner_rejects_invalid_request_before_network(self):
        session = FakeSession([])
        request = {
            "participantUserIds": [1, 2], "targetLevel": 12, "challengeMapId": 588,
            "stoneCharacterId": True,
            "options": {"optimizeComposition": True, "bloodlust": True, "battleRez": True,
                        "classBuffs": True, "damageSynergy": True},
            "locks": [],
        }
        with self.assertRaises(TeamServiceError) as caught:
            TeamService(session=session).plan_keystone(self.cfg, 7, request)
        self.assertEqual(caught.exception.code, "INVALID_TEAM_REQUEST")
        self.assertEqual(session.calls, [])

    def test_exact_stone_planner_accepts_modern_options_without_legacy_mix(self):
        request = {
            "participantUserIds": [1, 2], "targetLevel": 12, "challengeMapId": 588,
            "stoneCharacterId": 30,
            "options": {"optimizeComposition": True, "recommendationMode": "advanced",
                        "bloodlust": True, "battleRez": True, "offensiveSynergy": True,
                        "groupDefense": True, "dungeonUtility": True},
            "locks": [],
        }
        self.assertTrue(_planner_request_valid(request))
        request["options"]["fillComposition"] = False
        self.assertTrue(_planner_request_valid(request))
        request["options"]["fillComposition"] = "yes"
        self.assertFalse(_planner_request_valid(request))
        request["options"]["fillComposition"] = False
        request["options"]["classBuffs"] = True
        self.assertFalse(_planner_request_valid(request))

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
