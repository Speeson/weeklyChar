import type { TalentEntrySnapshot, TalentNodeSnapshot, TalentTreeSnapshot } from "./types";

const spanishSpecs: Record<number, string> = {
  62: "Arcano",
  66: "Protección",
  102: "Equilibrio",
};

const spanishClasses: Record<string, string> = {
  druid: "Druida",
  mage: "Mago",
  paladin: "Paladín",
};

const spanishHeroTrees: Record<number, string> = {
  24: "Elegido de Elune",
  39: "Furia del Sol",
  49: "Forjador de luz",
};

export function activeTalentEntry(node: TalentNodeSnapshot): TalentEntrySnapshot | undefined {
  return node.entries.find(entry => entry.entryId === node.activeEntryId) ?? node.entries[0];
}

export function talentPurchasedRanks(node: TalentNodeSnapshot): number {
  const entry = activeTalentEntry(node);
  return Math.max(node.ranksPurchased || 0, entry?.selected ? entry.rank || 0 : 0);
}

export function localizedSpecName(specId: number | null | undefined, name: string | null | undefined, language: "es" | "en"): string | null {
  if (language !== "es") return name ?? null;
  return (specId ? spanishSpecs[specId] : null) ?? name ?? null;
}

export function localizedClassName(name: string | null | undefined, language: "es" | "en"): string | null {
  if (!name || language !== "es") return name ?? null;
  return spanishClasses[name.toLowerCase()] ?? name;
}

export function localizedHeroTreeName(tree: TalentTreeSnapshot | undefined, language: "es" | "en"): string | null {
  if (!tree) return null;
  if (language !== "es") return tree.name ?? null;
  return (tree.subTreeId ? spanishHeroTrees[tree.subTreeId] : null)
    ?? (tree.name?.toLowerCase() === "elune's chosen" ? "Elegido de Elune" : tree.name ?? null);
}
