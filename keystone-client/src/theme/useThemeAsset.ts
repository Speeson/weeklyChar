import {
  KEYSTONE_THEME_ASSETS,
  resolveThemeAsset,
  type OptionalThemeAssetRole,
  type RequiredThemeAssetRole,
  type ThemeAssetRole,
} from "./asset.registry";
import { useTheme } from "./useTheme";

export function useThemeAsset(role: RequiredThemeAssetRole): string;
export function useThemeAsset(role: OptionalThemeAssetRole): string | undefined;
export function useThemeAsset(role: ThemeAssetRole): string | undefined {
  const { theme } = useTheme();
  return role in KEYSTONE_THEME_ASSETS
    ? resolveThemeAsset(theme, role as RequiredThemeAssetRole)
    : resolveThemeAsset(theme, role as OptionalThemeAssetRole);
}
