export type WowheadType = "item" | "spell" | "currency";
export type WowheadOption = string | number | boolean | readonly number[] | null | undefined;

export function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

export function wowheadDomainForLanguage(language: string): "es" | "www" {
  return language.toLowerCase().startsWith("es") ? "es" : "www";
}

export function talentTooltipSpellId(spellId: unknown, overriddenSpellId: unknown): number | null {
  // Blizzard's TalentDisplay uses definitionInfo.spellID for the visible talent tooltip;
  // overriddenSpellID identifies the spell that the talent replaces.
  return positiveInteger(spellId) ?? positiveInteger(overriddenSpellId);
}

export function blizzardIconUrl(iconPath: unknown, region = "eu", iconFileID?: unknown): string | null {
  const safeRegion = /^(eu|us|kr|tw)$/i.test(region) ? region.toLowerCase() : "eu";
  const fileDataId = positiveInteger(iconFileID)
    ?? (typeof iconPath === "string" ? positiveInteger(Number(iconPath.match(/^FileData ID (\d+)$/i)?.[1])) : null);
  if (fileDataId) return `https://render.worldofwarcraft.com/${safeRegion}/icons/56/${fileDataId}.jpg`;
  if (typeof iconPath !== "string" || !iconPath) return null;
  if (/^https:\/\//i.test(iconPath)) return iconPath;
  const match = iconPath.replace(/\\/g, "/").match(/(?:^|\/)icons\/([a-z0-9_-]+)(?:\.blp)?$/i);
  if (!match) return null;
  return `https://render.worldofwarcraft.com/${safeRegion}/icons/56/${match[1].toLowerCase()}.jpg`;
}

export function buildWowheadTooltip({
  type, id, language, options = {},
}: {
  type: WowheadType;
  id: number;
  language: string;
  options?: Record<string, WowheadOption>;
}): { href: string; dataWowhead: string } | null {
  const safeId = positiveInteger(id);
  if (!safeId) return null;
  const params = [`domain=${wowheadDomainForLanguage(language)}`];
  for (const [key, value] of Object.entries(options)) {
    if (!/^[a-z][a-z0-9]*$/i.test(key) || value === null || value === undefined || value === "") continue;
    if (Array.isArray(value)) {
      const values = value.map(positiveInteger).filter((candidate): candidate is number => candidate !== null);
      if (values.length > 0) params.push(`${key}=${values.join(":")}`);
    } else if (typeof value === "number") {
      const safeValue = positiveInteger(value);
      if (safeValue) params.push(`${key}=${safeValue}`);
    } else if (typeof value === "boolean") {
      params.push(`${key}=${value ? "true" : "false"}`);
    } else if (typeof value === "string" && /^[\w.:-]+$/.test(value)) {
      params.push(`${key}=${value}`);
    }
  }
  return { href: `https://www.wowhead.com/${type}=${safeId}`, dataWowhead: params.join("&") };
}
