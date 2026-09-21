import { describe, expect, it } from "vitest";
import type { TalentNodeSnapshot, TalentTreeSnapshot } from "./types";
import { HERO_TALENT_TREE_NAMES, localizedClassName, localizedHeroTreeName, localizedSpecName, talentPurchasedRanks } from "./talentDisplay";

describe("talent display", () => {
  it("localizes captured English identities without changing English UI", () => {
    const hero = { subTreeId: 24, name: "Elune's Chosen" } as TalentTreeSnapshot;
    expect(localizedSpecName(102, "Balance", "es")).toBe("Equilibrio");
    expect(localizedHeroTreeName(hero, "es")).toBe("Elección de Elune");
    expect(localizedClassName("Druid", "es")).toBe("Druida");
    expect(localizedSpecName(102, "Balance", "en")).toBe("Balance");
  });

  it("resolves every official hero-tree name in both languages, including legacy Spanish aliases", () => {
    for (const [en, es, aliases = []] of HERO_TALENT_TREE_NAMES) {
      expect(localizedHeroTreeName({ name: en } as TalentTreeSnapshot, "es"), en).toBe(es);
      expect(localizedHeroTreeName({ name: es } as TalentTreeSnapshot, "en"), es).toBe(en);
      for (const alias of aliases) expect(localizedHeroTreeName({ name: alias } as TalentTreeSnapshot, "en"), alias).toBe(en);
    }
  });

  it("uses the full European Spanish name for Fel-Scarred", () => {
    expect(localizedHeroTreeName({ name: "Fel-Scarred" } as TalentTreeSnapshot, "es")).toBe("Marcado por la vileza");
    expect(localizedHeroTreeName({ name: "Marcado" } as TalentTreeSnapshot, "es")).toBe("Marcado por la vileza");
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
