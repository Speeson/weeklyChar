import {
  resolveThemeAssetCssProperties,
} from "./asset.registry";
import { resolveThemeId } from "./theme.registry";
import type { ThemeId } from "./theme.types";

export function applyThemeToDocument(theme: ThemeId): void {
  const resolvedTheme = resolveThemeId(theme);
  const root = document.documentElement;
  root.dataset.theme = resolvedTheme;
  for (const [property, value] of Object.entries(resolveThemeAssetCssProperties(resolvedTheme))) {
    root.style.setProperty(property, value);
  }
}
