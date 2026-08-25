import { resolveThemeId } from "./theme.registry";
import { THEME_STORAGE_KEY, type ThemeId } from "./theme.types";

export function readStoredTheme(): ThemeId {
  try {
    return resolveThemeId(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return resolveThemeId(undefined);
  }
}

export function writeStoredTheme(theme: ThemeId): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, resolveThemeId(theme));
  } catch {
    // Storage can be unavailable in restricted WebView contexts.
  }
}
