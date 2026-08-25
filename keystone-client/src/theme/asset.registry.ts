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

export type ThemeAssetRole = keyof typeof KEYSTONE_THEME_ASSETS;
export type ThemeAssetOverrides = Partial<
  Record<ThemeId, Partial<Record<ThemeAssetRole, string>>>
>;

export const THEME_ASSET_OVERRIDES = {
  poison: {},
} as const satisfies ThemeAssetOverrides;

export function resolveThemeAsset(
  theme: ThemeId,
  role: ThemeAssetRole,
  overrides: ThemeAssetOverrides = THEME_ASSET_OVERRIDES,
): string {
  return overrides[theme]?.[role] ?? KEYSTONE_THEME_ASSETS[role];
}
