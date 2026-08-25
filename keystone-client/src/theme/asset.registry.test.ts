import { describe, expect, expectTypeOf, it } from "vitest";
import {
  KEYSTONE_THEME_ASSETS,
  OPTIONAL_THEME_ASSET_ROLES,
  resolveThemeAssetCssProperties,
  resolveThemeAsset,
  type OptionalThemeAssetRole,
  type RequiredThemeAssetRole,
  type ThemeAssetOverrides,
  type ThemeAssetRole,
} from "./asset.registry";

const expectedKeystoneAssets = {
  "brand-mark": "app-icon.png",
  "brand-emblem": "21-app-icon-hd.png",
  "shell-active-tab": "02-active-tab-indicator.png.png",
  "shell-settings": "03-settings-button.png.png",
  "shell-footer-web": "05-footer-web-button.png.png",
  "shell-user-panel": "13-current-status-panel-frame.png.png",
  "shell-window-minimize": "15-window-minimize-button.png.png",
  "shell-window-close": "16-window-close-button.png.png",
  "shell-user-dropdown": "25-dropdown-icon.png",
  "shell-avatar-frame": "26-avatar.png",
  "sync-hero-frame": "09-right-hero-panel-frame.png.png",
  "sync-status-success": "17-status-icon-success.png.png",
  "sync-summary-accounts": "18-accounts-icon.png.png",
  "sync-summary-last": "19-last-sync-icon.png.png",
  "sync-summary-characters": "20-characters-icon.png.png",
  "sync-version": "22-version-icon.png",
  "sync-status-error": "23-error-icon.png",
  "sync-status-warning": "24-warning-icon.png",
  "sync-status-syncing": "27-sync-icon.png",
  "sync-status-info": "28-info-icon.png",
  "addon-status-operation": "27-sync-icon.png",
  "addon-status-current": "17-status-icon-success.png.png",
  "addon-status-update": "24-warning-icon.png",
  "addon-status-local-newer": "28-info-icon.png",
  "addon-status-offline-cache": "28-info-icon.png",
  "addon-status-unavailable": "23-error-icon.png",
  "addon-status-error": "23-error-icon.png",
  "addon-status-not-installed": "23-error-icon.png",
} as const satisfies Record<RequiredThemeAssetRole, string>;

describe("theme asset resolution", () => {
  it("resolves every semantic Keystone role to the exact existing bundled file", () => {
    for (const [role, fileName] of Object.entries(expectedKeystoneAssets)) {
      expect(resolveThemeAsset("keystone", role as RequiredThemeAssetRole)).toBe(
        KEYSTONE_THEME_ASSETS[role as RequiredThemeAssetRole],
      );
      expect(resolveThemeAsset("keystone", role as RequiredThemeAssetRole)).toMatch(
        new RegExp(`/assets/keystone-ui/${fileName.replace(/\./g, "\\.")}$`),
      );
    }
  });

  it("falls back to Keystone when Poison has no optional asset override", () => {
    expect(resolveThemeAsset("poison", "brand-mark")).toBe(
      resolveThemeAsset("keystone", "brand-mark"),
    );
    expect(resolveThemeAsset("poison", "sync-status-error")).toBe(
      resolveThemeAsset("keystone", "sync-status-error"),
    );
  });

  it("resolves missing decorative artwork roles safely without borrowing a Keystone raster", () => {
    for (const role of OPTIONAL_THEME_ASSET_ROLES) {
      expect(resolveThemeAsset("poison", role)).toBeUndefined();
      expect(resolveThemeAsset("keystone", role)).toBeUndefined();
    }
  });

  it("resolves a registered decorative override through the existing asset registry", () => {
    const overrides: ThemeAssetOverrides = {
      poison: {
        "artwork-background": "/assets/poison/background.webp",
        "decoration-serpentine-amani": "/assets/poison/serpent.svg",
      },
    };

    expect(resolveThemeAsset("poison", "artwork-background", overrides)).toBe(
      "/assets/poison/background.webp",
    );
    expect(resolveThemeAsset("poison", "decoration-serpentine-amani", overrides)).toBe(
      "/assets/poison/serpent.svg",
    );
    expect(resolveThemeAsset("keystone", "artwork-background", overrides)).toBeUndefined();
  });

  it("maps registered decorative overrides to the stable CSS slots", () => {
    const overrides: ThemeAssetOverrides = {
      poison: {
        "artwork-background": "/assets/poison/background.webp",
        "brand-theme-emblem": "/assets/poison/emblem.svg",
      },
    };

    expect(resolveThemeAssetCssProperties("poison", overrides)).toEqual({
      "--theme-app-badge-artwork": "none",
      "--theme-artwork-background": 'url("/assets/poison/background.webp")',
      "--theme-artwork-overlay": "none",
      "--theme-emblem-artwork": 'url("/assets/poison/emblem.svg")',
      "--theme-emblem-fallback-visibility": "hidden",
      "--theme-panel-ornament": "none",
      "--theme-serpentine-decoration": "none",
    });
  });

  it("restricts callers to the declared semantic asset contract", () => {
    expectTypeOf<ThemeAssetRole>().toEqualTypeOf<RequiredThemeAssetRole | OptionalThemeAssetRole>();
    expectTypeOf<(typeof OPTIONAL_THEME_ASSET_ROLES)[number]>().toEqualTypeOf<OptionalThemeAssetRole>();
    // @ts-expect-error Unknown roles must remain a compile-time error.
    resolveThemeAsset("keystone", "unknown-role");
  });
});
