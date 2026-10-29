import { describe, expect, it } from "vitest";
import {
  addCurrency, defaultCurrencyLayout, loadCurrencyLayout, moveCurrency,
  removeCurrency, saveCurrencyLayout,
} from "./currencyLayout";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

describe("currency layout", () => {
  it("starts with eleven cards in two groups and sixteen fixed slots", () => {
    const layout = defaultCurrencyLayout();
    expect(layout).toHaveLength(16);
    expect(layout.slice(0, 8)).toEqual([
      "heroMistcrest", "cofferKeyShards", "tidalSparkDust", "venomblightManaflux",
      "untaintedManaCrystals", null, null, null,
    ]);
    expect(layout.slice(8)).toEqual([
      "mythMistcrest", "restoredCofferKey", "sparksOfTides", "nebulousVoidcore",
      "trovehuntersBounty", "scaleboundHeraldFlute", null, null,
    ]);
  });

  it("click-add fills the first empty position and leaves a full layout unchanged", () => {
    const layout = defaultCurrencyLayout();
    expect(addCurrency(layout, "veteranMistcrest")[5]).toBe("veteranMistcrest");
    const full = [...layout];
    for (const key of ["adventurerMistcrest", "veteranMistcrest", "championMistcrest", "afflictedSoul", "tormentedSoul"] as const) {
      const empty = full.indexOf(null);
      full[empty] = key;
    }
    expect(addCurrency(full, "voidlightMarl")).toEqual(full);
  });

  it("replaces a targeted occupied slot and swaps two placed cards", () => {
    const layout = defaultCurrencyLayout();
    const replaced = addCurrency(layout, "veteranMistcrest", 0);
    expect(replaced[0]).toBe("veteranMistcrest");
    expect(replaced).not.toContain("heroMistcrest");
    const swapped = moveCurrency(layout, 0, 8);
    expect(swapped[0]).toBe("mythMistcrest");
    expect(swapped[8]).toBe("heroMistcrest");
  });

  it("moves to an empty slot and removes cards without compacting holes", () => {
    const layout = defaultCurrencyLayout();
    const moved = moveCurrency(layout, 0, 15);
    expect(moved[0]).toBeNull();
    expect(moved[15]).toBe("heroMistcrest");
    expect(removeCurrency(moved, 15)[15]).toBeNull();
  });

  it("isolates users and safely drops invalid or obsolete slot entries", () => {
    const storage = memoryStorage();
    saveCurrencyLayout("Alice", addCurrency(defaultCurrencyLayout(), "undercoin", 5), storage);
    expect(loadCurrencyLayout("alice", storage)[5]).toBe("undercoin");
    expect(loadCurrencyLayout("bob", storage)[5]).toBeNull();
    storage.setItem("keystone-client.currency-layout.v1:alice", JSON.stringify([
      "heroMistcrest", "heroMistcrest", "futureCurrency", ...Array(13).fill(null),
    ]));
    const sanitized = loadCurrencyLayout("alice", storage);
    expect(sanitized[0]).toBe("heroMistcrest");
    expect(sanitized[1]).toBeNull();
    expect(sanitized[2]).toBeNull();
  });
});
