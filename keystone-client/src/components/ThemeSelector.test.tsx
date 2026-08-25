import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../core/i18n";
import type { ThemeDefinition, ThemeId } from "../theme/theme.types";
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

const futureThemeId = "future-theme" as ThemeId;

function UnavailableThemeHarness() {
  const [theme, setTheme] = useState<ThemeId>("poison");

  return (
    <I18nProvider language="en">
      <ThemeSelector
        onThemeChange={setTheme}
        theme={theme}
        themes={[
          selectableThemes[0],
          { ...selectableThemes[1], selectable: false },
          {
            id: futureThemeId,
            label: "Future",
            description: "Future theme",
            selectable: true,
          },
        ]}
      />
    </I18nProvider>
  );
}

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

  it("truthfully represents an unavailable current theme and allows recovery", async () => {
    const user = userEvent.setup();
    render(<UnavailableThemeHarness />);

    const selector = screen.getByRole("combobox", { name: "Visual theme" });
    expect(selector).toHaveValue("poison");
    expect(screen.getByRole("option", { name: "Poison (current theme unavailable)" })).toBeDisabled();

    await user.selectOptions(selector, "keystone");
    expect(selector).toHaveValue("keystone");
  });
});
