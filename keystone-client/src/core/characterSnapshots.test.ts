import { describe, expect, it } from "vitest";
import { CHARACTER_CURRENCIES, currencyCapState, trovehunterStatus, voidcoreQuestCompleted } from "./characterSnapshots";

describe("character currency semantics", () => {
  it("offers 22 distinct tracked currencies and items for the layout", () => {
    expect(CHARACTER_CURRENCIES).toHaveLength(22);
    expect(new Set(CHARACTER_CURRENCIES.map(value => value.key)).size).toBe(22);
    expect(CHARACTER_CURRENCIES.map(value => value.key)).toContain("untaintedManaCrystals");
    expect(CHARACTER_CURRENCIES.filter(value => value.key.toLowerCase().includes("mistcrest")).map(value => value.key))
      .toEqual(["adventurerMistcrest", "veteranMistcrest", "championMistcrest", "heroMistcrest", "mythMistcrest"]);
    expect(CHARACTER_CURRENCIES.map(value => value.key)).toEqual(expect.arrayContaining([
      "scaleboundHeraldFlute", "afflictedSoul", "tormentedSoul", "ascendantVenomstone",
      "undercoin", "remnantOfAnguish", "timewarpedBadge", "tradersTender", "voidlightMarl",
    ]));
  });

  it("marks Coffer maxed from weekly progress even with zero owned", () => {
    expect(currencyCapState({ quantity: 0, quantityEarnedThisWeek: 600, maxWeeklyQuantity: 600 }).isMaxed).toBe(true);
  });

  it("uses only the current week's Orin quest completion", () => {
    const now = Date.parse("2026-10-07T04:00:00Z");
    expect(voidcoreQuestCompleted({ questCompleted: true, weekKey: "2026-10-07" }, now)).toBe(true);
    expect(voidcoreQuestCompleted({ questCompleted: true, weekKey: "2026-09-30" }, now)).toBe(false);
    expect(voidcoreQuestCompleted({ questCompleted: true }, now)).toBe(false);
  });

  it("marks Untainted weekly maxed without marking its total cap", () => {
    expect(currencyCapState({ quantity: 143, quantityEarnedThisWeek: 250, maxWeeklyQuantity: 250, maxQuantity: 1000 }))
      .toMatchObject({ isWeeklyMaxed: true, isSeasonMaxed: false, isTotalMaxed: false, isMaxed: true });
  });

  it("separates seasonal total-earned caps from owned-total caps", () => {
    expect(currencyCapState({ quantity: 2, totalEarned: 450, maxQuantity: 450, useTotalEarnedForMaxQty: true }).isSeasonMaxed).toBe(true);
    expect(currencyCapState({ quantity: 8, maxQuantity: 8, useTotalEarnedForMaxQty: false }).isTotalMaxed).toBe(true);
  });

  it("ignores the obsolete Mistcrest cap mirrored from total earned", () => {
    const stale = { quantity: 73, totalEarned: 73, maxQuantity: 73, maxWeeklyQuantity: 0, canEarnPerWeek: false, useTotalEarnedForMaxQty: true };
    expect(currencyCapState(stale, "heroMistcrest").isMaxed).toBe(false);
    expect(currencyCapState(stale, "heroMistcrest").maxQuantity).toBe(0);
    expect(currencyCapState({ ...stale, maxQuantity: 100 }, "heroMistcrest").maxQuantity).toBe(100);
    expect(currencyCapState(stale, "tidalSparkDust").isMaxed).toBe(true);
  });

  it("derives every Trovehunter state from the weekly flag, bags, and active aura", () => {
    expect(trovehunterStatus(undefined)).toEqual({ obtained: false, detail: null, known: false });
    expect(trovehunterStatus({ questCompleted: false, bagCount: 0, hasBuff: false }))
      .toEqual({ obtained: false, detail: null, known: true });
    expect(trovehunterStatus({ questCompleted: true, bagCount: 1, hasBuff: false }))
      .toEqual({ obtained: true, detail: "inBags", known: true });
    expect(trovehunterStatus({ questCompleted: true, bagCount: 0, hasBuff: true }))
      .toEqual({ obtained: true, detail: "active", known: true });
    expect(trovehunterStatus({ questCompleted: true, bagCount: 0, hasBuff: false }))
      .toEqual({ obtained: true, detail: "claimed", known: true });
    expect(trovehunterStatus({ questCompleted: true }))
      .toEqual({ obtained: true, detail: null, known: true });
    expect(trovehunterStatus({}))
      .toEqual({ obtained: false, detail: null, known: false });
  });

  it("treats a held map or active aura as obtained when the weekly flag is transiently false", () => {
    expect(trovehunterStatus({ questCompleted: false, bagCount: 1, hasBuff: false }).obtained).toBe(true);
    expect(trovehunterStatus({ questCompleted: false, bagCount: 0, hasBuff: true }).obtained).toBe(true);
  });
});
