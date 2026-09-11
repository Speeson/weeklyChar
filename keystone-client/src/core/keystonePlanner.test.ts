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
      vacancies: [{ role: "tank", preferredCapabilities: ["battle_rez"] }],
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
    });
    expect(result.recommendations[0].stone.characterId).toBe(10);
    expect(JSON.stringify(result)).not.toContain("SECRET");
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

  it("does not dispatch malformed exact-stone requests", async () => {
    await expect(getKeystonePlanner(7, { ...request, stoneCharacterId: 0 })).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(coreRequest).not.toHaveBeenCalled();
  });
});
