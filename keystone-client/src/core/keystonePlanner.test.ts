import { beforeEach, describe, expect, it, vi } from "vitest";
import { coreRequest } from "./client";
import { DEFAULT_KEYSTONE_PLANNER_OPTIONS, getKeystonePlanner, parseKeystonePlannerResponse } from "./keystonePlanner";
import type { KeystonePlannerRequest } from "./types";

vi.mock("./client", () => ({ coreRequest: vi.fn() }));

const request: KeystonePlannerRequest = {
  participantUserIds: [2, 3], targetLevel: 12, challengeMapId: 399, stoneCharacterId: 10,
  options: { ...DEFAULT_KEYSTONE_PLANNER_OPTIONS }, locks: [],
};

function response() {
  return {
    teamId: 7, challengeMapId: 399, targetLevel: 12, availability: { eligibleStoneCount: 1 }, status: "ok",
    diagnostics: { codes: [], unconfiguredUserIds: [], lockIssues: [] },
    recommendations: [{
      rank: 1, fingerprint: "10:2:62|12:3:66",
      stone: { characterId: 10, characterName: "Bakuhatsu", ownerUserId: 2, ownerUsername: "Speeson", challengeMapId: 399, dungeon: "Ruby Life Pools", level: 12 },
      assignments: [{
        userId: 2, username: "Speeson", characterId: 10, characterName: "Bakuhatsu", wowClass: "Mage",
        specId: 62, role: "dps", lootSpecId: 62, playPreference: "preferred", objectives: [{ itemId: 1,
          itemName: "Báculo", iconUrl: null, tier: 3, variantKey: "planner:1", voidcoreState: "pending" }], capabilities: [],
      }],
      vacancies: [{ role: "tank", preferredCapabilities: ["BATTLE_REZ"], candidateClasses: [{
        wowClass: "Druid",
        contributions: [{ capabilityId: "BATTLE_REZ", availability: "guaranteed" }],
        reasonCodes: ["PROVIDES_BATTLE_REZ"],
        specIds: [104],
      }] }],
      lootSummary: { weightedScore: 80, playersWithObjectives: 1, totalObjectives: 1, tierCounts: { bestInSlot: 1, mustHave: 0, niceToHave: 0, catalyst: 0, transmog: 0 } },
      levelSummary: { targetLevel: 12, stoneLevel: 12, levelDistance: 0 },
      preferenceSummary: { preferred: 1, available: 0, emergency: 0 },
      compositionSummary: { bloodlust: "guaranteed", battleRez: "none", uniqueCapabilities: [], damageProfile: "magical", magicalDpsCount: 1, physicalDpsCount: 0, unknownDpsCount: 0, chaosBrandBeneficiaries: 1, mysticTouchBeneficiaries: 0, uniqueClassBuffCount: 1 },
      reasonCodes: ["PARTY_INCOMPLETE", "HAS_LOOT_OBJECTIVES", "TARGET_LEVEL_EXACT"],
    }],
  };
}

describe("Keystone Planner core bridge", () => {
  beforeEach(() => vi.mocked(coreRequest).mockReset());

  it("sends the exact stone identity and returns the allowlisted response", async () => {
    vi.mocked(coreRequest).mockResolvedValueOnce({ ...response(), privateNote: "SECRET" });
    const result = await getKeystonePlanner(7, request);
    expect(coreRequest).toHaveBeenCalledWith("teams.keystone_planner", {
      ...request, teamId: 7, participantUserIds: [2, 3], options: { ...DEFAULT_KEYSTONE_PLANNER_OPTIONS }, locks: [],
      locale: "es_ES",
    });
    expect(result.recommendations[0].stone.characterId).toBe(10);
    expect(JSON.stringify(result)).not.toContain("SECRET");
  });

  it("forwards the selected English metadata locale", async () => {
    vi.mocked(coreRequest).mockResolvedValueOnce(response());
    await getKeystonePlanner(7, request, "en_US");
    expect(coreRequest).toHaveBeenCalledWith("teams.keystone_planner", expect.objectContaining({ locale: "en_US" }));
  });

  it("forwards the explicit optional-party-fill choice", async () => {
    vi.mocked(coreRequest).mockResolvedValueOnce(response());
    await getKeystonePlanner(7, {
      ...request, options: { ...request.options, fillComposition: false },
    });
    expect(coreRequest).toHaveBeenCalledWith("teams.keystone_planner", expect.objectContaining({
      options: expect.objectContaining({ fillComposition: false }),
    }));
  });

  it("rejects stale or mismatched exact-stone responses", () => {
    expect(parseKeystonePlannerResponse({ ...response(), recommendations: [{ ...response().recommendations[0], stone: { ...response().recommendations[0].stone, characterId: 12 } }] }, 7, request)).toBeNull();
    expect(parseKeystonePlannerResponse({ ...response(), availability: { eligibleStoneCount: 2 } }, 7, request)).toBeNull();
  });

  it("accepts at most five ranked recommendations", () => {
    const item = response().recommendations[0];
    const ranked = (count: number) => Array.from({ length: count }, (_, index) => ({
      ...item, rank: index + 1, fingerprint: `recommendation-${index + 1}`,
    }));
    expect(parseKeystonePlannerResponse({ ...response(), recommendations: ranked(5) }, 7, request)?.recommendations).toHaveLength(5);
    expect(parseKeystonePlannerResponse({ ...response(), recommendations: ranked(6) }, 7, request)).toBeNull();
  });

  it("preserves class-only external candidates and accepts legacy vacancies", () => {
    const parsed = parseKeystonePlannerResponse(response(), 7, request);
    expect(parsed?.recommendations[0].vacancies[0].candidateClasses).toEqual([{
      wowClass: "Druid",
      contributions: [{ capabilityId: "BATTLE_REZ", availability: "guaranteed" }],
      reasonCodes: ["PROVIDES_BATTLE_REZ"],
    }]);
    expect(JSON.stringify(parsed)).not.toContain("specIds");

    const legacy = response();
    Reflect.deleteProperty(legacy.recommendations[0].vacancies[0], "candidateClasses");
    expect(parseKeystonePlannerResponse(legacy, 7, request)?.recommendations[0].vacancies[0]).toEqual({
      role: "tank", preferredCapabilities: ["BATTLE_REZ"],
    });
  });

  it("rejects malformed external class candidates", () => {
    const malformed = response();
    malformed.recommendations[0].vacancies[0].candidateClasses[0].contributions[0].availability = "none";
    expect(parseKeystonePlannerResponse(malformed, 7, request)).toBeNull();
  });

  it("preserves bounded modern vacancy explainability and exact Advanced specs", () => {
    const modern = response();
    Object.assign(modern.recommendations[0].compositionSummary, {
      groupDefensives: [{ capabilityId: "MAJOR_GROUP_DR", name: "Darkness", spellId: 196718,
        availability: "conditional", tier: "S", relevance: 3, score: 500 }],
      dungeonUtilities: [{ capabilityId: "INTERRUPT", name: "Pummel", spellId: 6552,
        availability: "guaranteed", tier: "S", relevance: 3, score: 1000 }],
    });
    Object.assign(modern.recommendations[0].vacancies[0], {
      recommendationMode: "advanced",
      recommendedClass: "Druid",
      recommendedSpecId: 104,
      recommendedSpecName: "Guardian Druid",
      offensiveGainPct: 0.031,
      offensiveBand: 0,
      offensiveReasons: ["MARK_OF_THE_WILD: +3.10%"],
      offensiveProvenance: [{ specId: 251, source: "simc", confidence: "high", method: "exact_profile" }],
      defensiveContribution: { tiers: { S: 1000, A: 0, B: 0, C: 0 }, reasons: ["Mark of the Wild"] },
      defensiveBand: 0,
      dungeonUtilityContribution: { tiers: { S: 0, A: 500, B: 0, C: 0 }, reasons: ["Remove Corruption"] },
      dungeonUtilityBand: 1,
      recommendations: [{
        id: "tank:104", wowClass: "Druid", specId: 104, specName: "Guardian Druid",
        offensiveGainPct: 0.031, damageProfile: "physical",
        buffsDebuffs: [{ capabilityId: "MARK_OF_THE_WILD", name: "Mark of the Wild", spellId: 1126,
          availability: "guaranteed" }],
        utilities: [],
        groupDefensives: [{ capabilityId: "GROUP_HEALING_CD", name: "Heart of the Wild", spellId: 319454,
          availability: "conditional", tier: "A", relevance: 2, score: 100 }],
        dungeonUtilities: [{ capabilityId: "CURSE_DISPEL", name: "Remove Corruption", spellId: 2782,
          availability: "guaranteed", tier: "A", relevance: 2, score: 100 }],
      }],
    });
    const vacancy = parseKeystonePlannerResponse(modern, 7, request)?.recommendations[0].vacancies[0];
    expect(vacancy).toMatchObject({
      recommendationMode: "advanced", recommendedClass: "Druid", recommendedSpecId: 104,
      offensiveBand: 0, defensiveBand: 0, dungeonUtilityBand: 1,
      recommendations: [{
        id: "tank:104", specId: 104, damageProfile: "physical",
        groupDefensives: [{ name: "Heart of the Wild", tier: "A" }],
        dungeonUtilities: [{ name: "Remove Corruption", relevance: 2 }],
      }],
    });
    expect(parseKeystonePlannerResponse(modern, 7, request)?.recommendations[0].compositionSummary).toMatchObject({
      groupDefensives: [{ name: "Darkness", tier: "S", score: 500 }],
      dungeonUtilities: [{ name: "Pummel", relevance: 3, score: 1000 }],
    });
  });

  it("does not dispatch malformed exact-stone requests", async () => {
    await expect(getKeystonePlanner(7, { ...request, stoneCharacterId: 0 })).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(coreRequest).not.toHaveBeenCalled();
  });

  it("rejects incomplete or extended modern option documents before dispatch", async () => {
    const { dungeonUtility: _missing, ...incompleteOptions } = request.options;
    await expect(getKeystonePlanner(7, {
      ...request, options: incompleteOptions,
    } as KeystonePlannerRequest)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(getKeystonePlanner(7, {
      ...request, options: { ...request.options, classBuffs: true },
    } as KeystonePlannerRequest)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(coreRequest).not.toHaveBeenCalled();
  });
});
