import {
  THEME_ASSET_OVERRIDES,
  resolveThemeAssetCssProperties,
  type ThemeAssetOverrides,
} from "./asset.registry";
import { resolveThemeId } from "./theme.registry";
import type { ThemeId } from "./theme.types";

export function applyThemeToDocument(
  theme: ThemeId,
  overrides: ThemeAssetOverrides = THEME_ASSET_OVERRIDES,
): void {
  const resolvedTheme = resolveThemeId(theme);
  const root = document.documentElement;
  root.dataset.theme = resolvedTheme;
  for (const [property, value] of Object.entries(resolveThemeAssetCssProperties(resolvedTheme, overrides))) {
    root.style.setProperty(property, value);
  }
}
