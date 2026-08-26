import activeTabIndicator from "../assets/keystone-ui/02-active-tab-indicator.png.png";
import settingsButton from "../assets/keystone-ui/03-settings-button.png.png";
import footerWebButton from "../assets/keystone-ui/05-footer-web-button.png.png";
import rightHeroPanelFrame from "../assets/keystone-ui/09-right-hero-panel-frame.png.png";
import userPanelFrame from "../assets/keystone-ui/13-current-status-panel-frame.png.png";
import windowMinimizeButton from "../assets/keystone-ui/15-window-minimize-button.png.png";
import windowCloseButton from "../assets/keystone-ui/16-window-close-button.png.png";
import statusSuccessIcon from "../assets/keystone-ui/17-status-icon-success.png.png";
import accountsIcon from "../assets/keystone-ui/18-accounts-icon.png.png";
import lastSyncIcon from "../assets/keystone-ui/19-last-sync-icon.png.png";
import charactersIcon from "../assets/keystone-ui/20-characters-icon.png.png";
import appIconHd from "../assets/keystone-ui/21-app-icon-hd.png";
import versionIcon from "../assets/keystone-ui/22-version-icon.png";
import errorIcon from "../assets/keystone-ui/23-error-icon.png";
import warningIcon from "../assets/keystone-ui/24-warning-icon.png";
import dropdownIcon from "../assets/keystone-ui/25-dropdown-icon.png";
import avatarFrame from "../assets/keystone-ui/26-avatar.png";
import syncIcon from "../assets/keystone-ui/27-sync-icon.png";
import infoIcon from "../assets/keystone-ui/28-info-icon.png";
import appIcon from "../assets/keystone-ui/app-icon.png";
import poisonBackground from "../themes/assets/poison/backgrounds/background-main.png";
import poisonAppBadge from "../themes/assets/poison/branding/app-badge.png";
import poisonEmblem from "../themes/assets/poison/branding/emblem.png";
import poisonCloseButton from "../themes/assets/poison/frames/buttons/close-button.png";
import poisonMinimizeButton from "../themes/assets/poison/frames/buttons/minimize-button.png";
import poisonSettingsButton from "../themes/assets/poison/frames/buttons/settings-button.png";
import poisonSyncButtonFrame from "../themes/assets/poison/frames/buttons/sync-button-frame.png";
import poisonTrayButtonFrame from "../themes/assets/poison/frames/buttons/tray-button-frame.png";
import poisonWebButtonFrame from "../themes/assets/poison/frames/buttons/web-button-frame.png";
import poisonCharactersTableFrame from "../themes/assets/poison/frames/cards/characters-table-frame.png";
import poisonEmblemPanelFrame from "../themes/assets/poison/frames/cards/emblem-panel-frame.png";
import poisonStatusCardFrame from "../themes/assets/poison/frames/cards/status-card-frame.png";
import poisonSummaryAddonFrame from "../themes/assets/poison/frames/cards/summary-card-addon-frame.png";
import poisonSummaryFrame from "../themes/assets/poison/frames/cards/summary-card-frame.png";
import poisonVersionCardFrame from "../themes/assets/poison/frames/cards/version-card-frame.png";
import poisonProfileFrame from "../themes/assets/poison/frames/profile/profile-frame.png";
import poisonAccountsIcon from "../themes/assets/poison/icons/poison-accounts-icon.png";
import poisonCharactersIcon from "../themes/assets/poison/icons/poison-characters-icon.png";
import poisonErrorIcon from "../themes/assets/poison/icons/poison-error-icon.png";
import poisonInfoIcon from "../themes/assets/poison/icons/poison-info-icon.png";
import poisonLastSyncIcon from "../themes/assets/poison/icons/poison-last-sync-icon.png";
import poisonStatusSuccessIcon from "../themes/assets/poison/icons/poison-status-icon-success.png";
import poisonSyncIcon from "../themes/assets/poison/icons/poison-sync-icon.png";
import poisonVersionIcon from "../themes/assets/poison/icons/poison-version-icon.png";
import poisonWarningIcon from "../themes/assets/poison/icons/poison-warning-icon.png";
import poisonActiveTab from "../themes/assets/poison/navigation/tab-active-decoration.png";
import poisonInactiveTab from "../themes/assets/poison/navigation/tab-inactive-decoration.png";
import poisonAmbientOverlay from "../themes/assets/poison/overlays/ambient-overlay.png";
import type { ThemeId } from "./theme.types";

export const KEYSTONE_THEME_ASSETS = {
  "addon-status-current": statusSuccessIcon,
  "addon-status-error": errorIcon,
  "addon-status-local-newer": infoIcon,
  "addon-status-not-installed": errorIcon,
  "addon-status-offline-cache": infoIcon,
  "addon-status-operation": syncIcon,
  "addon-status-unavailable": errorIcon,
  "addon-status-update": warningIcon,
  "brand-emblem": appIconHd,
  "brand-mark": appIcon,
  "shell-active-tab": activeTabIndicator,
  "shell-avatar-frame": avatarFrame,
  "shell-footer-web": footerWebButton,
  "shell-settings": settingsButton,
  "shell-user-dropdown": dropdownIcon,
  "shell-user-panel": userPanelFrame,
  "shell-window-close": windowCloseButton,
  "shell-window-minimize": windowMinimizeButton,
  "sync-hero-frame": rightHeroPanelFrame,
  "sync-status-error": errorIcon,
  "sync-status-info": infoIcon,
  "sync-status-success": statusSuccessIcon,
  "sync-status-syncing": syncIcon,
  "sync-status-warning": warningIcon,
  "sync-summary-accounts": accountsIcon,
  "sync-summary-characters": charactersIcon,
  "sync-summary-last": lastSyncIcon,
  "sync-version": versionIcon,
} as const;

export type RequiredThemeAssetRole = keyof typeof KEYSTONE_THEME_ASSETS;

export const OPTIONAL_THEME_ASSET_ROLES = [
  "artwork-background",
  "artwork-overlay",
  "brand-theme-emblem",
  "brand-app-badge",
  "chrome-scalable-frame",
  "decoration-panel-ornament",
  "decoration-serpentine-amani",
  "shell-footer-tray",
  "shell-inactive-tab",
  "sync-action-frame",
  "sync-current-frame",
  "sync-summary-addon-frame",
  "sync-summary-frame",
  "sync-table-frame",
  "sync-version-frame",
] as const;

export type OptionalThemeAssetRole = (typeof OPTIONAL_THEME_ASSET_ROLES)[number];
export type ThemeAssetRole = RequiredThemeAssetRole | OptionalThemeAssetRole;
export type ThemeAssetOverrides = Partial<
  Record<ThemeId, Partial<Record<ThemeAssetRole, string>>>
>;

export const THEME_ASSET_OVERRIDES: ThemeAssetOverrides = {
  poison: {
    "addon-status-current": poisonStatusSuccessIcon,
    "addon-status-error": poisonErrorIcon,
    "addon-status-local-newer": poisonInfoIcon,
    "addon-status-not-installed": poisonErrorIcon,
    "addon-status-offline-cache": poisonInfoIcon,
    "addon-status-operation": poisonSyncIcon,
    "addon-status-unavailable": poisonErrorIcon,
    "addon-status-update": poisonWarningIcon,
    "artwork-background": poisonBackground,
    "artwork-overlay": poisonAmbientOverlay,
    "brand-emblem": poisonEmblem,
    "brand-mark": poisonAppBadge,
    "chrome-scalable-frame": poisonSummaryFrame,
    "shell-active-tab": poisonActiveTab,
    "shell-footer-tray": poisonTrayButtonFrame,
    "shell-footer-web": poisonWebButtonFrame,
    "shell-inactive-tab": poisonInactiveTab,
    "shell-settings": poisonSettingsButton,
    "shell-user-panel": poisonProfileFrame,
    "shell-window-close": poisonCloseButton,
    "shell-window-minimize": poisonMinimizeButton,
    "sync-action-frame": poisonSyncButtonFrame,
    "sync-current-frame": poisonStatusCardFrame,
    "sync-hero-frame": poisonEmblemPanelFrame,
    "sync-status-error": poisonErrorIcon,
    "sync-status-info": poisonInfoIcon,
    "sync-status-success": poisonStatusSuccessIcon,
    "sync-status-syncing": poisonSyncIcon,
    "sync-status-warning": poisonWarningIcon,
    "sync-summary-accounts": poisonAccountsIcon,
    "sync-summary-addon-frame": poisonSummaryAddonFrame,
    "sync-summary-characters": poisonCharactersIcon,
    "sync-summary-frame": poisonSummaryFrame,
    "sync-summary-last": poisonLastSyncIcon,
    "sync-table-frame": poisonCharactersTableFrame,
    "sync-version": poisonVersionIcon,
    "sync-version-frame": poisonVersionCardFrame,
  },
};

export const THEME_ASSET_CSS_PROPERTIES = {
  "artwork-background": "--theme-artwork-background",
  "artwork-overlay": "--theme-artwork-overlay",
  "brand-theme-emblem": "--theme-emblem-artwork",
  "brand-app-badge": "--theme-app-badge-artwork",
  "chrome-scalable-frame": "--theme-chrome-scalable-frame",
  "decoration-panel-ornament": "--theme-panel-ornament",
  "decoration-serpentine-amani": "--theme-serpentine-decoration",
} as const satisfies Partial<Record<OptionalThemeAssetRole, `--theme-${string}`>>;

export const THEME_EMBLEM_FALLBACK_CSS_PROPERTY = "--theme-emblem-fallback-visibility";

type ThemeDocumentAssetRole = keyof typeof THEME_ASSET_CSS_PROPERTIES;
export type ThemeAssetCssProperty =
  | (typeof THEME_ASSET_CSS_PROPERTIES)[ThemeDocumentAssetRole]
  | typeof THEME_EMBLEM_FALLBACK_CSS_PROPERTY;
export type ThemeAssetCssProperties = Record<ThemeAssetCssProperty, string>;

export function resolveThemeAsset(
  theme: ThemeId,
  role: RequiredThemeAssetRole,
  overrides?: ThemeAssetOverrides,
): string;
export function resolveThemeAsset(
  theme: ThemeId,
  role: OptionalThemeAssetRole,
  overrides?: ThemeAssetOverrides,
): string | undefined;

export function resolveThemeAsset(
  theme: ThemeId,
  role: ThemeAssetRole,
  overrides: ThemeAssetOverrides = THEME_ASSET_OVERRIDES,
): string | undefined {
  const override = overrides[theme]?.[role];
  if (override !== undefined) {
    return override;
  }
  return role in KEYSTONE_THEME_ASSETS
    ? KEYSTONE_THEME_ASSETS[role as RequiredThemeAssetRole]
    : undefined;
}

export function resolveThemeAssetCssProperties(
  theme: ThemeId,
  overrides: ThemeAssetOverrides = THEME_ASSET_OVERRIDES,
): ThemeAssetCssProperties {
  const properties = Object.fromEntries(
    (Object.entries(THEME_ASSET_CSS_PROPERTIES) as Array<
      [ThemeDocumentAssetRole, (typeof THEME_ASSET_CSS_PROPERTIES)[ThemeDocumentAssetRole]]
    >).map(([role, property]) => {
      const asset = resolveThemeAsset(theme, role, overrides);
      return [
        property,
        asset ? `url(${JSON.stringify(asset)})` : "none",
      ];
    }),
  );
  const emblem = resolveThemeAsset(theme, "brand-theme-emblem", overrides);
  return {
    ...properties,
    [THEME_EMBLEM_FALLBACK_CSS_PROPERTY]: emblem ? "hidden" : "visible",
  } as ThemeAssetCssProperties;
}
