import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    ["es", "Nivel de objeto 402"],
    ["en", "Item Level 402"],
  ] as const)("renders exact item level in %s", async (language, label) => {
    const user = userEvent.setup();
    renderWithTheme(<I18nProvider language={language}><TeamItemTooltip objective={objective()} /></I18nProvider>);
    await user.hover(screen.getByRole("button", { name: "Exact item" }));
    expect(await screen.findByText(label)).toBeInTheDocument();
    expect(screen.getByRole("tooltip").querySelector(".teams-tooltip__name")).toHaveClass("teams-tooltip__name--quality-epic");
  });

  it("omits the item-level line for legacy objectives", async () => {
    const user = userEvent.setup();
    renderWithTheme(<I18nProvider language="en"><TeamItemTooltip objective={objective({ itemLevel: null, variantKey: "base" })} /></I18nProvider>);
    await user.hover(screen.getByRole("button", { name: "Exact item" }));
    expect(screen.queryByText(/Item Level/u)).not.toBeInTheDocument();
  });
});
