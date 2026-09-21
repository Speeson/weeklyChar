import type { TalentEntrySnapshot, TalentNodeSnapshot, TalentTreeSnapshot } from "./types";
import { specName, wowClassName } from "./wowSpecs";

const spanishHeroTrees: Record<number, string> = {
  24: "Elección de Elune",
  39: "Furiasolar",
  49: "Forjador de luz",
};

const HERO_TREES: ReadonlyArray<readonly [string, string, (readonly string[])?]> = [
  ["Deathbringer", "Libramorte", ["Portamuerte"]], ["Rider of the Apocalypse", "Jinete del Apocalipsis"], ["San'layn", "San'layn"],
  ["Aldrachi Reaver", "Atracador Aldrachi"], ["Fel-Scarred", "Marcado por la vileza", ["Marcado"]], ["Annihilator", "Aniquilador"],
  ["Elune's Chosen", "Elección de Elune", ["Elegido de Elune"]], ["Druid of the Claw", "Druida de la Zarpa"], ["Keeper of the Grove", "Vigilante de la arboleda"], ["Wildstalker", "Acechador salvaje"],
  ["Chronowarden", "Cronoguarda"], ["Flameshaper", "Moldeallamas"], ["Scalecommander", "Escamandante"],
  ["Dark Ranger", "Forestal oscuro"], ["Pack Leader", "Líder de manada"], ["Sentinel", "Centinela"],
  ["Frostfire", "Pirofrío"], ["Spellslinger", "Lanzahechizos"], ["Sunfury", "Furiasolar", ["Furia del Sol"]],
  ["Conduit of the Celestials", "Conducto de los Celestiales"], ["Master of Harmony", "Maestro de la armonía"], ["Shado-Pan", "Shadopan"],
  ["Herald of the Sun", "Heraldo del Sol"], ["Lightsmith", "Forjador de luz"], ["Templar", "Templario"],
  ["Archon", "Arconte"], ["Oracle", "Oráculo"], ["Voidweaver", "Tejevacío"],
  ["Deathstalker", "Mortacechador"], ["Fatebound", "Vinculado al destino"], ["Trickster", "Timador"],
  ["Farseer", "Vidente", ["Clarividente"]], ["Stormbringer", "Invocatormentas"], ["Totemic", "Totémico"],
  ["Diabolist", "Diabolista"], ["Hellcaller", "Clamainferno"], ["Soul Harvester", "Cosechador de almas"],
  ["Colossus", "Coloso"], ["Mountain Thane", "Señor feudal de la montaña"], ["Slayer", "Asesino"],
];

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase();
const HERO_BY_ALIAS = new Map(HERO_TREES.flatMap(([en, es, aliases = []]) => [en, es, ...aliases].map(alias => [normalize(alias), { en, es }] as const)));

export function activeTalentEntry(node: TalentNodeSnapshot): TalentEntrySnapshot | undefined {
  return node.entries.find(entry => entry.entryId === node.activeEntryId) ?? node.entries[0];
}

export function talentPurchasedRanks(node: TalentNodeSnapshot): number {
  const entry = activeTalentEntry(node);
  return Math.max(node.ranksPurchased || 0, entry?.selected ? entry.rank || 0 : 0);
}

export function localizedSpecName(specId: number | null | undefined, name: string | null | undefined, language: "es" | "en"): string | null {
  if (specId) return specName(specId, language, name ?? undefined);
  return name ?? null;
}

export function localizedClassName(name: string | null | undefined, language: "es" | "en"): string | null {
  return wowClassName(name, language);
}

export function localizedHeroTreeName(tree: TalentTreeSnapshot | undefined, language: "es" | "en"): string | null {
  if (!tree) return null;
  const catalog = tree.name ? HERO_BY_ALIAS.get(normalize(tree.name)) : null;
  if (language === "en") return catalog?.en ?? tree.name ?? null;
  return (tree.subTreeId ? spanishHeroTrees[tree.subTreeId] : null) ?? catalog?.es ?? tree.name ?? null;
}

export const HERO_TALENT_TREE_NAMES = HERO_TREES;
