import type { Character } from "./types";

export type CharacterSortKey = "name" | "realm" | "ilvl" | "keystone" | "rioScore";
export type SortDirection = "asc" | "desc";

const CLASS_COLORS: Record<string, string> = {
  "death knight": "#C41E3A",
  "demon hunter": "#A330C9",
  druid: "#FF7C0A",
  evoker: "#33937F",
  hunter: "#AAD372",
  mage: "#3FC7EB",
  monk: "#00FF98",
  paladin: "#F48CBA",
  priest: "#C0C0C0",
  rogue: "#FFF468",
  shaman: "#0070DD",
  warlock: "#8788EE",
  warrior: "#C69B3A",
};

const ITEM_LEVEL_ANCHORS = [
  [250, "#00C800"],
  [274, "#0064E6"],
  [297, "#A032F0"],
  [321, "#FF556E"],
  [344, "#FF9100"],
] as const;

const RAIDER_IO_ANCHORS = [
  [0, "#00C800"],
  [1125, "#0064E6"],
  [2250, "#A032F0"],
  [3375, "#FF556E"],
  [4500, "#FF9100"],
] as const;

export const MISSING_CHARACTER_VALUE = "\u2014";
export const UNKNOWN_CLASS_COLOR = "#DDE2F0";
export const MISSING_VALUE_COLOR = "#8793A9";

export function classColor(wowClass: string | null | undefined): string {
  return CLASS_COLORS[String(wowClass ?? "").trim().toLowerCase()] ?? UNKNOWN_CLASS_COLOR;
}

export function itemLevelColor(value: number | null | undefined): string | null {
  return gradientColor(value, ITEM_LEVEL_ANCHORS);
}

export function raiderIoColor(value: number | null | undefined): string | null {
  return gradientColor(value, RAIDER_IO_ANCHORS);
}

export function displayNumber(value: number | null | undefined): string {
  return isFiniteNumber(value) ? String(Math.round(value)) : MISSING_CHARACTER_VALUE;
}

export function sortCharacters(
  characters: Character[],
  key: CharacterSortKey,
  direction: SortDirection,
): Character[] {
  return [...characters].sort((left, right) => {
    const leftValue = sortValue(left, key);
    const rightValue = sortValue(right, key);
    const leftMissing = leftValue === null;
    const rightMissing = rightValue === null;
    if (leftMissing !== rightMissing) {
      return leftMissing ? 1 : -1;
    }
    if (leftMissing && rightMissing) {
      return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    }

    const comparison = typeof leftValue === "number" && typeof rightValue === "number"
      ? leftValue - rightValue
      : String(leftValue).localeCompare(String(rightValue), undefined, { sensitivity: "base" });
    return direction === "asc" ? comparison : -comparison;
  });
}

function sortValue(character: Character, key: CharacterSortKey): string | number | null {
  if (key === "keystone") {
    return finiteOrNull(character.currentKeystone?.level);
  }
  if (key === "ilvl" || key === "rioScore") {
    return finiteOrNull(character[key]);
  }
  const value = character[key].trim();
  return value || null;
}

function gradientColor(
  value: number | null | undefined,
  anchors: ReadonlyArray<readonly [number, string]>,
): string | null {
  if (!isFiniteNumber(value)) {
    return null;
  }
  if (value <= anchors[0][0]) {
    return anchors[0][1];
  }
  const last = anchors[anchors.length - 1];
  if (value >= last[0]) {
    return last[1];
  }

  for (let index = 1; index < anchors.length; index += 1) {
    const upper = anchors[index];
    const lower = anchors[index - 1];
    if (value <= upper[0]) {
      const ratio = (value - lower[0]) / (upper[0] - lower[0]);
      return interpolateHex(lower[1], upper[1], ratio);
    }
  }
  return last[1];
}

function interpolateHex(start: string, end: string, ratio: number): string {
  const channel = (offset: number) => {
    const from = Number.parseInt(start.slice(offset, offset + 2), 16);
    const to = Number.parseInt(end.slice(offset, offset + 2), 16);
    return Math.round(from + (to - from) * ratio).toString(16).padStart(2, "0");
  };
  return `#${channel(1)}${channel(3)}${channel(5)}`.toUpperCase();
}

function finiteOrNull(value: number | null | undefined): number | null {
  return isFiniteNumber(value) ? value : null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
