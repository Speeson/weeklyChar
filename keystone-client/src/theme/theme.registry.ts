import {
  DEFAULT_THEME,
  THEME_IDS,
  type ThemeDefinition,
  type ThemeId,
} from "./theme.types";

export const THEMES: readonly ThemeDefinition[] = [
  {
    id: "keystone",
    label: "Keystone",
    description: "The original dark blue and gold KeystoneClient style.",
  },
  {
    id: "poison",
    label: "Poison",
    description: "A dark toxic skin with acid-green energy and organic glow.",
  },
];

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}

export function resolveThemeId(value: unknown): ThemeId {
  return isThemeId(value) ? value : DEFAULT_THEME;
}
