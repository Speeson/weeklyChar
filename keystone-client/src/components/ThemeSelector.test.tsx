import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../core/i18n";
import type { ThemeDefinition } from "../theme/theme.types";
import { ThemeSelector } from "./ThemeSelector";

const selectableThemes: readonly ThemeDefinition[] = [
  {
    id: "keystone",
    label: "Keystone",
    description: "Keystone theme",
    selectable: true,
  },
  {
    id: "poison",
    label: "Poison",
    description: "Poison theme",
    selectable: true,
  },
];

describe("ThemeSelector", () => {
  it("renders the current registry option with a localized accessible name", () => {
    render(
      <I18nProvider language="en">
        <ThemeSelector
          onThemeChange={vi.fn()}
          theme="keystone"
          themes={selectableThemes}
        />
      </I18nProvider>,
    );

    const selector = screen.getByRole("combobox", { name: "Visual theme" });
    expect(selector).toHaveValue("keystone");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Keystone",
      "Poison",
    ]);
  });

  it("is keyboard reachable through a native selector", async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider language="es">
        <ThemeSelector
          onThemeChange={vi.fn()}
          theme="keystone"
          themes={selectableThemes}
        />
      </I18nProvider>,
    );

    await user.tab();
    const selector = screen.getByRole("combobox", { name: "Tema visual" });
    expect(selector).toHaveFocus();
    expect(selector.tagName).toBe("SELECT");
  });

  it("renders nothing until at least two themes are selectable", () => {
    const { container } = render(
      <ThemeSelector
        onThemeChange={vi.fn()}
        theme="keystone"
        themes={[
          selectableThemes[0],
          { ...selectableThemes[1], selectable: false },
        ]}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
