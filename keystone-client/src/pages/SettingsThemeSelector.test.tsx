import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "../theme/ThemeProvider";
import { THEME_STORAGE_KEY } from "../theme/theme.types";
import { useTheme } from "../theme/useTheme";
import { SettingsPage } from "./SettingsPage";

const initialSettings = {
  startMinimized: false,
  minimizeOnClose: false,
  lang: "es" as const,
};

function ApplicationContent({ onMount }: { onMount: () => void }) {
  const { theme } = useTheme();

  useEffect(onMount, [onMount]);

  return <output data-testid="application-theme">{theme}</output>;
}

function renderSettings(onApplicationMount = vi.fn()) {
  return render(
    <ThemeProvider>
      <ApplicationContent onMount={onApplicationMount} />
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

  it("selects, applies, persists, restores, and switches the canonical themes without remounting application content", async () => {
    const user = userEvent.setup();
    const onApplicationMount = vi.fn();
    const firstView = renderSettings(onApplicationMount);
    const selector = screen.getByRole("combobox", { name: "Tema visual" });

    expect(selector.tagName).toBe("SELECT");
    expect(selector).toHaveValue("keystone");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Keystone",
      "Poison",
    ]);
    expect(screen.getByTestId("application-theme")).toHaveTextContent("keystone");
    expect(onApplicationMount).toHaveBeenCalledTimes(1);

    await user.tab();
    await user.tab();
    await user.tab();
    expect(selector).toHaveFocus();

    await user.selectOptions(selector, "poison");
    expect(selector).toHaveValue("poison");
    expect(screen.getByTestId("application-theme")).toHaveTextContent("poison");
    expect(document.documentElement.dataset.theme).toBe("poison");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("poison");
    expect(onApplicationMount).toHaveBeenCalledTimes(1);

    await user.selectOptions(selector, "keystone");
    expect(selector).toHaveValue("keystone");
    expect(screen.getByTestId("application-theme")).toHaveTextContent("keystone");
    expect(document.documentElement.dataset.theme).toBe("keystone");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("keystone");
    expect(onApplicationMount).toHaveBeenCalledTimes(1);

    await user.selectOptions(selector, "poison");

    firstView.unmount();
    document.documentElement.dataset.theme = "keystone";
    renderSettings(onApplicationMount);
    expect(screen.getByRole("combobox", { name: "Tema visual" })).toHaveValue("poison");
    expect(screen.getByTestId("application-theme")).toHaveTextContent("poison");
    expect(document.documentElement.dataset.theme).toBe("poison");
    expect(onApplicationMount).toHaveBeenCalledTimes(2);
  });
});
