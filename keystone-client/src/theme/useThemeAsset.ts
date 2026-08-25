import { resolveThemeAsset, type ThemeAssetRole } from "./asset.registry";
import { useResolvedThemeId } from "./useTheme";

export function useThemeAsset(role: ThemeAssetRole): string {
  const theme = useResolvedThemeId();
  return resolveThemeAsset(theme, role);
}
