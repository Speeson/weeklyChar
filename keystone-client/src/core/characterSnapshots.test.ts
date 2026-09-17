import { describe, expect, it } from "vitest";
import { CHARACTER_CURRENCIES, currencyCapState, trovehunterStatus } from "./characterSnapshots";

describe("character currency semantics", () => {
  it("contains exactly the approved ten cards and only Hero/Myth Mistcrests", () => {
    expect(CHARACTER_CURRENCIES).toHaveLength(10);
    expect(CHARACTER_CURRENCIES.map(value => value.key)).toContain("untaintedManaCrystals");
    expect(CHARACTER_CURRENCIES.filter(value => value.key.toLowerCase().includes("mistcrest")).map(value => value.key))
      .toEqual(["heroMistcrest", "mythMistcrest"]);
  });

  it("marks Coffer maxed from weekly progress even with zero owned", () => {
    expect(currencyCapState({ quantity: 0, quantityEarnedThisWeek: 600, maxWeeklyQuantity: 600 }).isMaxed).toBe(true);
  });

  it("marks Untainted weekly maxed without marking its total cap", () => {
    expect(currencyCapState({ quantity: 143, quantityEarnedThisWeek: 250, maxWeeklyQuantity: 250, maxQuantity: 1000 }))
      .toEqual({ isWeeklyMaxed: true, isSeasonMaxed: false, isTotalMaxed: false, isMaxed: true });
  });

  it("separates seasonal total-earned caps from owned-total caps", () => {
    expect(currencyCapState({ quantity: 2, totalEarned: 450, maxQuantity: 450, useTotalEarnedForMaxQty: true }).isSeasonMaxed).toBe(true);
    expect(currencyCapState({ quantity: 8, maxQuantity: 8, useTotalEarnedForMaxQty: false }).isTotalMaxed).toBe(true);
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
