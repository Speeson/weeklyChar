import { describe, expect, expectTypeOf, it } from "vitest";
import {
  KEYSTONE_THEME_ASSETS,
  resolveThemeAsset,
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
} as const satisfies Record<ThemeAssetRole, string>;

describe("theme asset resolution", () => {
  it("resolves every semantic Keystone role to the exact existing bundled file", () => {
    for (const [role, fileName] of Object.entries(expectedKeystoneAssets)) {
      expect(resolveThemeAsset("keystone", role as ThemeAssetRole)).toBe(
        KEYSTONE_THEME_ASSETS[role as ThemeAssetRole],
      );
      expect(resolveThemeAsset("keystone", role as ThemeAssetRole)).toMatch(
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

  it("restricts callers to the declared semantic asset contract", () => {
    expectTypeOf<Parameters<typeof resolveThemeAsset>[1]>().toEqualTypeOf<ThemeAssetRole>();
    // @ts-expect-error Unknown roles must remain a compile-time error.
    resolveThemeAsset("keystone", "unknown-role");
  });
});
