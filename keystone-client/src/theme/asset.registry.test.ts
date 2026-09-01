import { describe, expect, expectTypeOf, it } from "vitest";
import {
  KEYSTONE_THEME_ASSETS,
  OPTIONAL_THEME_ASSET_ROLES,
  THEME_ASSET_OVERRIDES,
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
  "teams-loading-mark": "21-app-icon-hd.png",
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

const expectedPoisonAssets = {
  "brand-mark": "app-badge.png",
  "brand-emblem": "emblem.png",
  "teams-loading-mark": "app-badge.png",
  "shell-active-tab": "tab-active-decoration.png",
  "shell-settings": "settings-button.png",
  "shell-footer-web": "web-button-frame.png",
  "shell-user-panel": "profile-frame.png",
  "shell-window-minimize": "minimize-button.png",
  "shell-window-close": "close-button.png",
  "sync-hero-frame": "emblem-panel-frame.png",
  "sync-status-success": "poison-status-icon-success.png",
  "sync-summary-accounts": "poison-accounts-icon.png",
  "sync-summary-last": "poison-last-sync-icon.png",
  "sync-summary-characters": "poison-characters-icon.png",
  "sync-version": "poison-version-icon.png",
  "sync-status-error": "poison-error-icon.png",
  "sync-status-warning": "poison-warning-icon.png",
  "sync-status-syncing": "poison-sync-icon.png",
  "sync-status-info": "poison-info-icon.png",
} as const satisfies Partial<Record<RequiredThemeAssetRole, string>>;

const expectedPoisonDecorations = {
  "addon-action-check-frame": "check-for-updates-button-frame.png",
  "addon-action-install-frame": "install-keystonesync-button-frame.png",
  "addon-action-open-folder-frame": "open-addon-folder-button-frame.png",
  "addon-action-reinstall-long-frame": "reinstall-keystonesync-button-long-frame.png",
  "addon-action-reinstall-short-frame": "reinstall-keystonesync-button-short-frame.png",
  "addon-action-select-folder-frame": "select-addons-folder-button-frame.png",
  "addon-action-update-frame": "update-keystonesync-button-frame.png",
  "addon-divider": "addon-vertical-divider.png",
  "addon-main-frame": "addon-main-panel-frame.png",
  "addon-path-card-frame": "addon-path-card-frame.png",
  "addon-path-field-frame": "addon-path-field-frame.png",
  "addon-status-frame": "addon-status-panel-frame.png",
  "artwork-background": "background-main.png",
  "artwork-overlay": "ambient-overlay.png",
  "chrome-scalable-frame": "summary-card-frame.png",
  "shell-footer-tray": "tray-button-frame.png",
  "shell-inactive-tab": "tab-inactive-decoration.png",
  "sync-action-frame": "sync-button-frame.png",
  "sync-current-frame": "status-card-frame.png",
  "sync-summary-addon-frame": "summary-card-addon-frame.png",
  "sync-summary-frame": "summary-card-frame.png",
  "sync-table-frame": "characters-table-frame.png",
  "sync-version-frame": "version-card-frame.png",
} as const satisfies Partial<Record<OptionalThemeAssetRole, string>>;

const expectedVoidAssets = {
  "brand-mark": "app-icon.png",
  "brand-emblem": "app-icon-hd.png",
  "teams-loading-mark": "app-icon-hd.png",
  "shell-active-tab": "active-tab-indicator.png",
  "shell-avatar-frame": "avatar-frame.png",
  "shell-footer-web": "web-button.png",
  "shell-settings": "settings-button.png",
  "shell-user-dropdown": "dropdown-icon.png",
  "shell-user-panel": "user-panel-frame.png",
  "shell-window-close": "close-button.png",
  "shell-window-minimize": "minimize-button.png",
  "sync-hero-frame": "right-hero-panel-frame.png",
  "sync-status-error": "error.png",
  "sync-status-info": "info.png",
  "sync-status-success": "status-success.png",
  "sync-status-syncing": "sync.png",
  "sync-status-warning": "warning.png",
  "sync-summary-accounts": "accounts.png",
  "sync-summary-characters": "characters.png",
  "sync-summary-last": "last-sync.png",
  "sync-version": "version.png",
  "addon-status-operation": "sync.png",
  "addon-status-current": "status-success.png",
  "addon-status-update": "warning.png",
  "addon-status-local-newer": "info.png",
  "addon-status-offline-cache": "info.png",
  "addon-status-unavailable": "error.png",
  "addon-status-error": "error.png",
  "addon-status-not-installed": "error.png",
} as const satisfies Partial<Record<RequiredThemeAssetRole, string>>;

const expectedVoidDecorations = {
  "artwork-background": "background-main.png",
  "artwork-overlay": "overlay1.png",
  "artwork-overlay-alternative-2": "overlay2.png",
  "artwork-overlay-alternative-3": "overlay3.png",
  "shell-footer-tray": "tray-button.png",
} as const satisfies Partial<Record<OptionalThemeAssetRole, string>>;

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

  it("resolves production Poison branding, profile, controls, frames, and semantic raster icons", () => {
    for (const [role, fileName] of Object.entries(expectedPoisonAssets)) {
      expect(resolveThemeAsset("poison", role as RequiredThemeAssetRole)).toMatch(
        new RegExp(`/themes/assets/poison/.+/${fileName.replace(/\./g, "\\.")}$`),
      );
    }

    for (const [role, fileName] of Object.entries(expectedPoisonDecorations)) {
      expect(resolveThemeAsset("poison", role as OptionalThemeAssetRole)).toMatch(
        new RegExp(`/themes/assets/poison/.+/${fileName.replace(/\./g, "\\.")}$`),
      );
      expect(resolveThemeAsset("keystone", role as OptionalThemeAssetRole)).toBeUndefined();
    }
  });

  it("resolves Void through the canonical assets while keeping overlay1 as production default", () => {
    for (const [role, fileName] of Object.entries(expectedVoidAssets)) {
      expect(resolveThemeAsset("void", role as RequiredThemeAssetRole)).toMatch(
        new RegExp(`/themes/assets/void/.+/${fileName.replace(/\./g, "\\.")}$`),
      );
    }
    for (const [role, fileName] of Object.entries(expectedVoidDecorations)) {
      expect(resolveThemeAsset("void", role as OptionalThemeAssetRole)).toMatch(
        new RegExp(`/themes/assets/void/.+/${fileName.replace(/\./g, "\\.")}$`),
      );
    }

    expect(resolveThemeAsset("void", "artwork-overlay")).toMatch(/overlay1\.png$/);
    expect(resolveThemeAsset("void", "shell-inactive-tab")).toBeUndefined();
    expect(Object.values(THEME_ASSET_OVERRIDES.void ?? {}).some((asset) => asset.endsWith("empty-button.png"))).toBe(false);
  });

  it("keeps required-role fallback deterministic when an override set omits an asset", () => {
    const overrides: ThemeAssetOverrides = { poison: {} };

    expect(resolveThemeAsset("poison", "brand-mark", overrides)).toBe(
      resolveThemeAsset("keystone", "brand-mark"),
    );
    expect(resolveThemeAsset("poison", "sync-status-error", overrides)).toBe(
      resolveThemeAsset("keystone", "sync-status-error"),
    );
  });

  it("keeps unregistered decorative roles isolated instead of borrowing a Keystone raster", () => {
    const overrides: ThemeAssetOverrides = { poison: {} };
    for (const role of OPTIONAL_THEME_ASSET_ROLES) {
      expect(resolveThemeAsset("poison", role, overrides)).toBeUndefined();
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
      "--theme-artwork-overlay-alternative-2": "none",
      "--theme-artwork-overlay-alternative-3": "none",
      "--theme-chrome-scalable-frame": "none",
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
