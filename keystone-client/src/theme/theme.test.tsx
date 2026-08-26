import { useEffect, type ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "./ThemeProvider";
import { applyThemeToDocument } from "./theme.dom";
import { getSelectableThemes, isThemeId, resolveThemeId, THEMES } from "./theme.registry";
import { readStoredTheme, writeStoredTheme } from "./theme.storage";
import { DEFAULT_THEME, THEME_STORAGE_KEY } from "./theme.types";
import type { ThemeAssetOverrides } from "./asset.registry";
import { useTheme } from "./useTheme";

// @ts-expect-error Production ThemeProvider must use the canonical registry.
const invalidThemeProviderProps: ComponentProps<typeof ThemeProvider> = { children: null, themes: [] };
void invalidThemeProviderProps;

const createRootMock = vi.fn();
const rootRenderMock = vi.fn();

vi.mock("react-dom/client", () => ({
  default: {
    createRoot: createRootMock,
  },
}));

vi.mock("../App", () => ({
  default: () => <div>Application child</div>,
}));

function ThemeProbe({ onMount }: { onMount?: () => void }) {
  const { setTheme, theme, themes } = useTheme();

  useEffect(() => {
    onMount?.();
  }, [onMount]);

  return (
    <>
      <output data-testid="theme">{theme}</output>
      <output data-testid="themes">{themes.map(({ id }) => id).join(",")}</output>
      <button onClick={() => setTheme("keystone")} type="button">Keystone</button>
      <button onClick={() => setTheme("poison")} type="button">Poison</button>
    </>
  );
}

describe("theme engine", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    createRootMock.mockReset();
    rootRenderMock.mockReset();
  });

  afterEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    document.documentElement.removeAttribute("style");
  });

  it("defines the stable Keystone and Poison theme IDs", () => {
    expect(THEMES.map(({ id }) => id)).toEqual(["keystone", "poison"]);
    expect(isThemeId("keystone")).toBe(true);
    expect(isThemeId("poison")).toBe(true);
    expect(resolveThemeId("poison")).toBe("poison");
  });

  it("offers only themes marked selectable by the registry", () => {
    expect(getSelectableThemes(THEMES).map(({ id }) => id)).toEqual(["keystone", "poison"]);
    expect(THEMES.find(({ id }) => id === "keystone")).toMatchObject({ selectable: true });
    expect(THEMES.find(({ id }) => id === "poison")).toMatchObject({ selectable: true });
  });

  it("uses Keystone as the default when no theme preference is stored", () => {
    expect(readStoredTheme()).toBe(DEFAULT_THEME);
  });

  it("restores a valid persisted Poison preference", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "poison");

    expect(readStoredTheme()).toBe("poison");
  });

  it("falls back to Keystone for invalid or corrupt stored values", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "corrupt-theme");

    expect(readStoredTheme()).toBe(DEFAULT_THEME);
    expect(resolveThemeId(null)).toBe(DEFAULT_THEME);
  });

  it("persists theme preferences under the exact storage key", () => {
    writeStoredTheme("poison");

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("poison");
    expect(localStorage.getItem("keystone.theme")).toBeNull();
  });

  it("applies the active theme through the document data-theme attribute", () => {
    applyThemeToDocument("poison");

    expect(document.documentElement.dataset.theme).toBe("poison");
    expect(document.documentElement.style.getPropertyValue("--theme-artwork-background")).toMatch(/background-main\.png"\)$/);
    expect(document.documentElement.style.getPropertyValue("--theme-artwork-overlay")).toMatch(/ambient-overlay\.png"\)$/);
    expect(document.documentElement.style.getPropertyValue("--theme-chrome-scalable-frame")).toMatch(/summary-card-frame\.png"\)$/);
    expect(document.documentElement.style.getPropertyValue("--theme-emblem-artwork")).toBe("none");
    expect(document.documentElement.style.getPropertyValue("--theme-emblem-fallback-visibility")).toBe("visible");
    expect(document.documentElement.style.getPropertyValue("--theme-app-badge-artwork")).toBe("none");
    expect(document.documentElement.style.getPropertyValue("--theme-panel-ornament")).toBe("none");
    expect(document.documentElement.style.getPropertyValue("--theme-serpentine-decoration")).toBe("none");
  });

  it("applies a registered transparent emblem and clears every optional slot when returning to Keystone", () => {
    const overrides: ThemeAssetOverrides = {
      poison: {
        "brand-theme-emblem": "/assets/poison/Emblem final (transparent).svg",
      },
    };

    applyThemeToDocument("poison", overrides);

    expect(document.documentElement.style.getPropertyValue("--theme-emblem-artwork")).toBe(
      'url("/assets/poison/Emblem final (transparent).svg")',
    );
    expect(document.documentElement.style.getPropertyValue("--theme-emblem-fallback-visibility")).toBe("hidden");

    applyThemeToDocument("keystone", overrides);

    expect(document.documentElement.dataset.theme).toBe("keystone");
    expect(document.documentElement.style.getPropertyValue("--theme-artwork-background")).toBe("none");
    expect(document.documentElement.style.getPropertyValue("--theme-artwork-overlay")).toBe("none");
    expect(document.documentElement.style.getPropertyValue("--theme-chrome-scalable-frame")).toBe("none");
    expect(document.documentElement.style.getPropertyValue("--theme-emblem-artwork")).toBe("none");
    expect(document.documentElement.style.getPropertyValue("--theme-app-badge-artwork")).toBe("none");
    expect(document.documentElement.style.getPropertyValue("--theme-panel-ornament")).toBe("none");
    expect(document.documentElement.style.getPropertyValue("--theme-serpentine-decoration")).toBe("none");
    expect(document.documentElement.style.getPropertyValue("--theme-emblem-fallback-visibility")).toBe("visible");
  });

  it("switches themes live through the provider without remounting application children", async () => {
    const user = userEvent.setup();
    const onMount = vi.fn();

    render(
      <ThemeProvider>
        <ThemeProbe onMount={onMount} />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("theme")).toHaveTextContent("keystone");
    expect(screen.getByTestId("themes")).toHaveTextContent("keystone,poison");
    expect(onMount).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Poison" }));
    expect(screen.getByTestId("theme")).toHaveTextContent("poison");
    expect(document.documentElement.dataset.theme).toBe("poison");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("poison");
    expect(onMount).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Keystone" }));
    expect(screen.getByTestId("theme")).toHaveTextContent("keystone");
    expect(document.documentElement.dataset.theme).toBe("keystone");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("keystone");
    expect(onMount).toHaveBeenCalledTimes(1);
  });

  it("applies the stored theme before createRoot is invoked", async () => {
    localStorage.setItem(THEME_STORAGE_KEY, "poison");
    createRootMock.mockImplementation(() => {
      expect(document.documentElement.dataset.theme).toBe("poison");
      return { render: rootRenderMock };
    });

    await import("../main");

    expect(createRootMock).toHaveBeenCalledOnce();
    expect(rootRenderMock).toHaveBeenCalledOnce();
  });
});
