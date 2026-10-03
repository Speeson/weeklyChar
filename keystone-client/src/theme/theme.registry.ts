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
    selectable: true,
  },
  {
    id: "poison",
    label: "Poison",
    description: "A dark toxic skin with acid-green energy and organic glow.",
    selectable: true,
  },
  {
    id: "void",
    label: "Void",
    description: "A dark cosmic skin with restrained violet and indigo energy.",
    selectable: true,
  },
  {
    id: "frost",
    label: "Frost",
    description: "A quiet glacial skin with deep blue surfaces and soft ice highlights.",
    selectable: true,
  },
  {
    id: "heaven",
    label: "Heaven",
    description: "A warm celestial skin with muted gold light and readable dark surfaces.",
    selectable: true,
  },
];

export function getSelectableThemes(
  themes: readonly ThemeDefinition[] = THEMES,
): readonly ThemeDefinition[] {
  return themes.filter(({ selectable }) => selectable);
}

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}

export function resolveThemeId(value: unknown): ThemeId {
  return isThemeId(value) ? value : DEFAULT_THEME;
}
