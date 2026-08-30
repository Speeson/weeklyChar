import { beforeEach, describe, expect, it, vi } from "vitest";
import { coreRequest } from "./client";
import type { KeystoneSelectorObjective } from "./types";
import {
  getKeystoneSelector,
  getTeam,
  listTeams,
  parseKeystoneSelector,
  parseTeamDetail,
  parseTeamList,
  groupSelectorObjectives,
  selectorObjectivesForSpec,
  teamStoneCounts,
} from "./teams";

vi.mock("./client", () => ({ coreRequest: vi.fn() }));

const tiers = { bestInSlot: 1, mustHave: 0, niceToHave: 0, catalyst: 0, transmog: 0, other: 1 };
const objective: KeystoneSelectorObjective = {
  itemId: 12345, itemName: "Báculo", iconUrl: "https://cdn.test/item.jpg", tier: 99,
  specIds: [62], sourceType: "dungeon", sourceId: 588, slotId: 16, slotName: "Mano principal",
  itemClassName: "Arma", itemSubClassName: "Báculo", statNames: ["Intelecto", "Celeridad"],
  voidcoreState: "pending",
};
const selector = {
  teamId: 7, challengeMapId: 588,
  availability: { stoneCount: 1, stones: [{ characterId: 10, characterName: "Auralis", ownerUserId: 2, ownerUsername: "ana", level: 12 }] },
  summary: { charactersWithObjectives: 1, totalObjectives: 1, tiers },
  characters: [{
    userId: 2, username: "ana", characterId: 10, characterName: "Auralis", realm: "Zul'jin", region: "eu",
    wowClass: "Mage", avatarUrl: "https://cdn.test/avatar.jpg", ilvl: 300, rioScore: 2500,
    totalObjectives: 1, tierCounts: tiers, specs: [{ specId: 62, objectiveCount: 1, tierCounts: tiers }],
    objectives: [objective],
  }],
};

describe("Teams core bridge", () => {
  beforeEach(() => vi.mocked(coreRequest).mockReset());

  it("uses the three dedicated commands and validates IDs before dispatch", async () => {
    vi.mocked(coreRequest)
      .mockResolvedValueOnce([{ id: 7, name: "Raid", memberCount: 2 }])
      .mockResolvedValueOnce({ id: 7, name: "Raid", members: [] })
      .mockResolvedValueOnce(selector);
    await listTeams(); await getTeam(7); await getKeystoneSelector(7, 588);
    expect(coreRequest).toHaveBeenNthCalledWith(1, "teams.list");
    expect(coreRequest).toHaveBeenNthCalledWith(2, "teams.get", { teamId: 7 });
    expect(coreRequest).toHaveBeenNthCalledWith(3, "teams.keystone_selector", { teamId: 7, challengeMapId: 588 });
    await expect(getTeam(0)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(getKeystoneSelector(7, Number.MAX_SAFE_INTEGER + 1)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(coreRequest).toHaveBeenCalledTimes(3);
  });

  it("parses Team lists, tolerates additive fields, and projects no sensitive fields", () => {
    const parsed = parseTeamList([{ id: 7, name: "Raid", memberCount: 2, inviteCode: "SECRET", future: true }]);
    expect(parsed).toEqual([{ id: 7, name: "Raid", memberCount: 2 }]);
    expect(JSON.stringify(parsed)).not.toContain("SECRET");
    expect(parseTeamList([{ id: 0, name: "Raid", memberCount: 2 }])).toBeNull();
    expect(parseTeamList([{ id: 7, name: "", memberCount: 2 }])).toBeNull();
  });

  it("parses a compact Team dashboard without raw character or member fields", () => {
    const parsed = parseTeamDetail({
      id: 7, name: "Raid", inviteCode: "SECRET", members: [{ userId: 2, username: "ana", avatarUrl: "https://ignored.test/member.jpg", characters: [{
        characterId: 10, name: "Auralis", realm: "Zul'jin", region: "eu", wowClass: "Mage",
        avatarUrl: "https://cdn.test/avatar.jpg", ilvl: 300, rioScore: 2500,
        currentKeystone: { level: 12, challengeMapId: 588, dungeon: "Altar of Fangs", mapId: 1 },
        wowAccount: "ACCOUNT", vault: { secret: true }, keystoneLoot: { raw: true },
      }] }],
    }, 7);
    expect(parsed).toEqual({ id: 7, name: "Raid", members: [{ userId: 2, username: "ana", characters: [{
      characterId: 10, name: "Auralis", realm: "Zul'jin", region: "eu", wowClass: "Mage",
      avatarUrl: "https://cdn.test/avatar.jpg", ilvl: 300, rioScore: 2500,
      currentKeystone: { level: 12, challengeMapId: 588, dungeon: "Altar of Fangs" },
    }] }] });
    expect(JSON.stringify(parsed)).not.toMatch(/SECRET|ACCOUNT|vault|keystoneLoot|member\.jpg/);
    expect(parseTeamDetail({ id: 7, name: "Raid", members: [{ userId: -1, username: "ana", characters: [] }] }, 7)).toBeNull();
  });

  it("accepts the sanitized bridge characterId and nullable keystone map contract", () => {
    const character = {
      characterId: 10, name: "Auralis", realm: "Zul'jin", region: "eu", wowClass: "Mage",
      avatarUrl: null, ilvl: null, rioScore: null,
    };
    const team = (currentKeystone: unknown) => ({
      id: 7, name: "Raid", members: [{ userId: 2, username: "ana", characters: [
        { ...character, currentKeystone },
      ] }],
    });

    expect(parseTeamDetail(team(null), 7)?.members[0].characters[0].currentKeystone).toBeNull();
    expect(parseTeamDetail(team({ level: 10, challengeMapId: 588, dungeon: null }), 7)
      ?.members[0].characters[0].currentKeystone?.challengeMapId).toBe(588);
    expect(parseTeamDetail(team({ level: 10, challengeMapId: null, dungeon: null }), 7)
      ?.members[0].characters[0].currentKeystone?.challengeMapId).toBeNull();
    for (const challengeMapId of ["588", 0, -1, 1.5]) {
      expect(parseTeamDetail(team({ level: 10, challengeMapId, dungeon: null }), 7)).toBeNull();
    }
    expect(parseTeamDetail(team({ level: 10, dungeon: null }), 7)).toBeNull();
  });

  it("strictly parses Selector tooltip metadata, Voidcore states, and unknown positive tiers", () => {
    const parsed = parseKeystoneSelector({ ...selector, future: true }, 7, 588);
    expect(parsed?.characters[0].objectives[0]).toMatchObject({
      tier: 99, slotName: "Mano principal", itemClassName: "Arma", itemSubClassName: "Báculo",
      statNames: ["Intelecto", "Celeridad"], voidcoreState: "pending",
    });
    expect(JSON.stringify(parsed)).not.toMatch(/bonusIds|gems|enchant|keystoneLoot/);
    expect(parseKeystoneSelector({ ...selector, characters: [{ ...selector.characters[0], objectives: [{ ...objective, voidcoreState: "unknown" }] }] }, 7, 588)).toBeNull();
    expect(parseKeystoneSelector({ ...selector, challengeMapId: 587 }, 7, 588)).toBeNull();
    expect(parseKeystoneSelector({ ...selector, characters: [{ ...selector.characters[0], objectives: [{ ...objective, statNames: [42] }] }] }, 7, 588)).toBeNull();
  });

  it("rejects malformed bridge results with structured CoreErrors", async () => {
    vi.mocked(coreRequest).mockResolvedValueOnce([{ id: "7" }]).mockResolvedValueOnce({ id: 7 }).mockResolvedValueOnce({ ...selector, summary: null });
    await expect(listTeams()).rejects.toMatchObject({ code: "INVALID_TEAM_RESPONSE" });
    await expect(getTeam(7)).rejects.toMatchObject({ code: "INVALID_TEAM_RESPONSE" });
    await expect(getKeystoneSelector(7, 588)).rejects.toMatchObject({ code: "INVALID_SELECTOR_RESPONSE" });
  });

  it("derives Team stone counts without aggregate fan-out", () => {
    const counts = teamStoneCounts({ id: 7, name: "Raid", members: [{ userId: 1, username: "one", characters: [
      { characterId: 1, name: "A", realm: "R", region: "eu", wowClass: null, avatarUrl: null, ilvl: null, rioScore: null, currentKeystone: { level: 10, challengeMapId: 399, dungeon: null } },
      { characterId: 2, name: "B", realm: "R", region: "eu", wowClass: null, avatarUrl: null, ilvl: null, rioScore: null, currentKeystone: { level: 8, challengeMapId: 399, dungeon: null } },
      { characterId: 3, name: "C", realm: "R", region: "eu", wowClass: null, avatarUrl: null, ilvl: null, rioScore: null, currentKeystone: { level: 8, challengeMapId: null, dungeon: null } },
    ] }] });
    expect(counts.get(399)).toBe(2);
    expect(counts.get(585)).toBeUndefined();
  });

  it("filters specs and separates future tiers from completed Voidcore", () => {
    const items: KeystoneSelectorObjective[] = [
      { ...objective, itemId: 1, tier: 3, specIds: [62, 64] },
      { ...objective, itemId: 2, tier: 99, specIds: [64] },
      { ...objective, itemId: 3, tier: 2, specIds: [62], voidcoreState: "completed_with_voidcore" },
    ];
    expect(selectorObjectivesForSpec(items, 62).map(item => item.itemId)).toEqual([1, 3]);
    const grouped = groupSelectorObjectives(items);
    expect(grouped.groups.map(group => group.key)).toEqual(["bestInSlot", "other"]);
    expect(grouped.completed.map(item => item.itemId)).toEqual([3]);
  });
});
