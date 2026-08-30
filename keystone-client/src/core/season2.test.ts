import { describe, expect, it } from "vitest";
import { compactTeamKeystone, MIDNIGHT_SEASON_2_DUNGEONS, SEASON_2_DUNGEON_BY_ID } from "./season2";

describe("Client Season 2 display pool", () => {
  it("contains exactly the eight verified dungeon identifiers and abbreviations", () => {
    expect(MIDNIGHT_SEASON_2_DUNGEONS.map(({ id, abbr }) => [id, abbr])).toEqual([
      [588, "AOF"], [587, "MR"], [586, "DON"], [584, "BV"],
      [585, "VSA"], [249, "KR"], [250, "TOS"], [399, "RLP"],
    ]);
    expect(SEASON_2_DUNGEON_BY_ID.size).toBe(8);
    expect(SEASON_2_DUNGEON_BY_ID.has(1)).toBe(false);
  });

  it("uses the allowlisted abbreviation and a bounded display fallback", () => {
    expect(compactTeamKeystone(12, 399, "Ruby Life Pools")).toBe("+12 RLP");
    expect(compactTeamKeystone(9, 999, "Future Dungeon")).toBe("+9 Future Dungeon");
    expect(compactTeamKeystone(8, 999, null)).toBe("+8 ID 999");
  });
});
