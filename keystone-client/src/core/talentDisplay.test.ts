import { describe, expect, it } from "vitest";
import type { TalentNodeSnapshot, TalentTreeSnapshot } from "./types";
import { localizedClassName, localizedHeroTreeName, localizedSpecName, talentPurchasedRanks } from "./talentDisplay";

describe("talent display", () => {
  it("localizes captured English identities without changing English UI", () => {
    const hero = { subTreeId: 24, name: "Elune's Chosen" } as TalentTreeSnapshot;
    expect(localizedSpecName(102, "Balance", "es")).toBe("Equilibrio");
    expect(localizedHeroTreeName(hero, "es")).toBe("Elegido de Elune");
    expect(localizedClassName("Druid", "es")).toBe("Druida");
    expect(localizedSpecName(102, "Balance", "en")).toBe("Balance");
  });

  it("treats Blizzard's selected active entry as purchased when node rank is transiently zero", () => {
    const node = {
      activeEntryId: 10,
      ranksPurchased: 0,
      entries: [{ entryId: 10, selected: true, rank: 1 }],
    } as TalentNodeSnapshot;
    expect(talentPurchasedRanks(node)).toBe(1);
  });
});
