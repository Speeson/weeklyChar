import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ThemeDefinition } from "../theme/theme.types";

const { selectableThemes } = vi.hoisted(() => ({
  selectableThemes: [
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
  ] as const,
}));

vi.mock("../theme/theme.registry", async (importOriginal) => {
  const registry = await importOriginal<typeof import("../theme/theme.registry")>();
  return { ...registry, THEMES: selectableThemes satisfies readonly ThemeDefinition[] };
});

import { ThemeProvider } from "../theme/ThemeProvider";
import { THEME_STORAGE_KEY } from "../theme/theme.types";
import { SettingsPage } from "./SettingsPage";

const initialSettings = {
  startMinimized: false,
  minimizeOnClose: false,
  lang: "es" as const,
};

function renderSettings() {
  return render(
    <ThemeProvider>
      <SettingsPage
        appVersion="0.4.1"
        initialSettings={initialSettings}
        onSettingsChanged={vi.fn()}
        preview
      />
    </ThemeProvider>,
  );
}

describe("Settings theme integration", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it("applies, persists, and restores a registry-selectable theme when Settings reopens", async () => {
    const user = userEvent.setup();
    const firstView = renderSettings();
    const selector = screen.getByRole("combobox", { name: "Tema visual" });

    expect(selector).toHaveValue("keystone");
    await user.selectOptions(selector, "poison");
    expect(document.documentElement.dataset.theme).toBe("poison");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("poison");

    firstView.unmount();
    renderSettings();
    expect(screen.getByRole("combobox", { name: "Tema visual" })).toHaveValue("poison");
  });
});
