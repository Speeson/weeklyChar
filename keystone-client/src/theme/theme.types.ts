export const THEME_IDS = ["keystone", "poison"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export type ThemeDefinition = {
  id: ThemeId;
  label: string;
  description: string;
};

export const DEFAULT_THEME: ThemeId = "keystone";
export const THEME_STORAGE_KEY = "keystone-client.theme";
