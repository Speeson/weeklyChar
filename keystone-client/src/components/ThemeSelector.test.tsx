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
  it("renders the current registry themes as preview cards", () => {
    render(
      <I18nProvider language="en">
        <ThemeSelector
          onThemeChange={vi.fn()}
          theme="keystone"
          themes={selectableThemes}
        />
      </I18nProvider>,
    );

    expect(screen.getByRole("heading", { name: "Visual theme" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Visual theme" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keystone" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Poison" })).toHaveAttribute("aria-pressed", "false");
  });

  it("is keyboard reachable through the preview cards", async () => {
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
    expect(screen.getByRole("button", { name: "Keystone" })).toHaveFocus();
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

    expect(screen.getByText("Poison (current theme unavailable)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Poison" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Keystone" }));
    expect(screen.getByRole("button", { name: "Keystone" })).toHaveAttribute("aria-pressed", "true");
  });
});
