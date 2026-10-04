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
  closeBehavior: "ask" as const,
  overlayEnabled: true,
  overlayShortcut: "Ctrl+Shift+K",
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
    await user.click(screen.getByRole("tab", { name: "Appearance" }));

    expect(screen.getByRole("button", { name: "Keystone" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("button").filter((button) => button.classList.contains("settings-theme-card")).map((button) => button.textContent)).toEqual([
      "Keystone", "Poison", "Void", "Frost", "Heaven",
    ]);
    expect(screen.getByTestId("application-theme")).toHaveTextContent("keystone");
    expect(onApplicationMount).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Void" }));
    expect(screen.getByRole("button", { name: "Void" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("application-theme")).toHaveTextContent("void");
    expect(document.documentElement.dataset.theme).toBe("void");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("void");
    expect(onApplicationMount).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Keystone" }));
    expect(screen.getByRole("button", { name: "Keystone" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("application-theme")).toHaveTextContent("keystone");
    expect(document.documentElement.dataset.theme).toBe("keystone");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("keystone");
    expect(onApplicationMount).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Void" }));

    firstView.unmount();
    document.documentElement.dataset.theme = "keystone";
    renderSettings(onApplicationMount);
    await user.click(screen.getByRole("tab", { name: "Appearance" }));
    expect(screen.getByRole("button", { name: "Void" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("application-theme")).toHaveTextContent("void");
    expect(document.documentElement.dataset.theme).toBe("void");
    expect(onApplicationMount).toHaveBeenCalledTimes(2);
  });
});
