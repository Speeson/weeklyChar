import { resolveThemeId } from "./theme.registry";
import type { ThemeId } from "./theme.types";

export function applyThemeToDocument(theme: ThemeId): void {
  document.documentElement.dataset.theme = resolveThemeId(theme);
}
