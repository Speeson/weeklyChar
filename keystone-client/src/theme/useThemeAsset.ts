import { resolveThemeAsset, type ThemeAssetRole } from "./asset.registry";
import { useTheme } from "./useTheme";

export function useThemeAsset(role: ThemeAssetRole): string {
  const { theme } = useTheme();
  return resolveThemeAsset(theme, role);
}
