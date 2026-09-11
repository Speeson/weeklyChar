import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "../core/i18n";
import type { KeystoneSelectorObjective } from "../core/types";
import { renderWithTheme } from "../test/renderWithTheme";
import { TeamItemTooltip } from "./TeamItemTooltip";

function objective(overrides: Partial<KeystoneSelectorObjective> = {}): KeystoneSelectorObjective {
  return {
    itemId: 123, itemName: "Exact item", iconUrl: null, tier: 3, specIds: [62],
    sourceType: "dungeon", sourceId: 588, slotId: 16, slotName: null,
    itemClassName: null, itemSubClassName: null, statNames: [], primaryStatNames: [],
    secondaryStatNames: [], otherStatNames: [], qualityType: "EPIC", itemLevel: 402,
    variantKey: "bonus:1498,6652", voidcoreState: "pending", ...overrides,
  };
}

describe("TeamItemTooltip exact variant metadata", () => {
  it.each([
    ["es", "domain=es"],
    ["en", "domain=www"],
  ] as const)("passes the exact item variant to Wowhead in %s", (language, domain) => {
    renderWithTheme(<I18nProvider language={language}><TeamItemTooltip objective={objective()} /></I18nProvider>);
    const link = screen.getByRole("link", { name: "Exact item" });
    expect(link).toHaveAttribute("href", "https://www.wowhead.com/item=123");
    expect(link).toHaveAttribute("data-wowhead", expect.stringContaining(domain));
    expect(link).toHaveAttribute("data-wowhead", expect.stringContaining("bonus=1498:6652"));
    expect(link).toHaveAttribute("data-wowhead", expect.stringContaining("ilvl=402"));
    expect(link).toHaveAttribute("data-wowhead", expect.stringContaining("spec=62"));
  });

  it("omits unavailable item-level and bonus parameters for legacy objectives", () => {
    renderWithTheme(<I18nProvider language="en"><TeamItemTooltip objective={objective({ itemLevel: null, variantKey: "base" })} /></I18nProvider>);
    const target = screen.getByRole("link", { name: "Exact item" });
    expect(target.getAttribute("data-wowhead")).not.toContain("ilvl=");
    expect(target.getAttribute("data-wowhead")).not.toContain("bonus=");
  });
});
