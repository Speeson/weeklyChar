import type { Language } from "./i18n";
import type { KeystoneSelectorObjective } from "./types";

type SlotMetadata = Pick<KeystoneSelectorObjective, "slotId" | "slotName" | "itemClassName" | "itemSubClassName">;

function normalized(value: string | null): string {
  return (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function includesAny(value: string, terms: string[]): boolean {
  return terms.some(term => value.includes(term));
}

function weaponLabel(subClass: string, language: Language): string | null {
  const oneHand = includesAny(subClass, ["one-handed", "one handed", "una mano"]);
  const twoHand = includesAny(subClass, ["two-handed", "two handed", "dos manos"]);
  const hand = oneHand ? (language === "es" ? "1M " : "1H ") : twoHand ? (language === "es" ? "2M " : "2H ") : "";
  if (includesAny(subClass, ["sword", "espada"])) return `${hand}${language === "es" ? "Esp." : "Sword"}`;
  if (includesAny(subClass, ["mace", "maza"])) return `${hand}${language === "es" ? "Maza" : "Mace"}`;
  if (includesAny(subClass, ["axe", "hacha"])) return `${hand}${language === "es" ? "Hacha" : "Axe"}`;
  if (includesAny(subClass, ["polearm", "arma de asta", "armas de asta"])) return language === "es" ? "Arm. Asta" : "Polearm";
  if (includesAny(subClass, ["staff", "staves", "baculo", "baston"])) return language === "es" ? "Bastón" : "Staff";
  if (includesAny(subClass, ["dagger", "daga"])) return language === "es" ? "Daga" : "Dagger";
  if (includesAny(subClass, ["fist weapon", "arma de puno", "armas de puno"])) return language === "es" ? "Puño" : "Fist";
  if (includesAny(subClass, ["crossbow", "ballesta"])) return language === "es" ? "Ballesta" : "Crossbow";
  if (includesAny(subClass, ["bow", "arco"])) return language === "es" ? "Arco" : "Bow";
  if (includesAny(subClass, ["gun", "arma de fuego", "armas de fuego"])) return language === "es" ? "Fusil" : "Gun";
  if (includesAny(subClass, ["wand", "varita"])) return language === "es" ? "Varita" : "Wand";
  if (includesAny(subClass, ["shield", "escudo"])) return language === "es" ? "Escudo" : "Shield";
  return null;
}

const SLOT_TERMS: Array<[string[], string, string]> = [
  [["head", "cabeza"], "Cabeza", "Head"],
  [["neck", "cuello"], "Cuello", "Neck"],
  [["shoulder", "hombro"], "Hombros", "Shoulders"],
  [["back", "cloak", "cape", "espalda", "capa"], "Espalda", "Back"],
  [["chest", "robe", "pecho", "torso"], "Pecho", "Chest"],
  [["wrist", "muneca"], "Muñec.", "Wrist"],
  [["main hand", "mano principal"], "Mano ppal.", "Main hand"],
  [["off hand", "mano secundaria"], "Mano sec.", "Off hand"],
  [["hands", "gloves", "manos"], "Manos", "Hands"],
  [["waist", "cintura"], "Cintura", "Waist"],
  [["legs", "piernas"], "Piernas", "Legs"],
  [["feet", "pies"], "Pies", "Feet"],
  [["finger", "ring", "dedo", "anillo"], "Anillo", "Ring"],
  [["trinket", "abalorio"], "Abal.", "Trinket"],
];

const SLOT_ID_LABELS: Record<number, [string, string]> = {
  1: ["Cabeza", "Head"], 2: ["Cuello", "Neck"], 3: ["Hombros", "Shoulders"],
  5: ["Pecho", "Chest"], 6: ["Cintura", "Waist"], 7: ["Piernas", "Legs"],
  8: ["Pies", "Feet"], 9: ["Muñec.", "Wrist"], 10: ["Manos", "Hands"],
  11: ["Anillo", "Ring"], 12: ["Anillo", "Ring"], 13: ["Abal.", "Trinket"],
  14: ["Abal.", "Trinket"], 15: ["Espalda", "Back"], 16: ["Mano ppal.", "Main hand"],
  17: ["Mano sec.", "Off hand"],
};

export function compactItemSlotLabel(objective: SlotMetadata, language: Language): string | null {
  const itemClass = normalized(objective.itemClassName);
  const subClass = normalized(objective.itemSubClassName);
  const weapon = weaponLabel(subClass, language);
  if (weapon && (itemClass === "arma" || includesAny(itemClass, ["weapon"]) || objective.slotId === 16 || objective.slotId === 17)) return weapon;

  const slot = normalized(objective.slotName);
  const matched = SLOT_TERMS.find(([terms]) => includesAny(slot, terms));
  if (matched) return language === "es" ? matched[1] : matched[2];

  const fallback = objective.slotId === null ? null : SLOT_ID_LABELS[objective.slotId];
  return fallback ? fallback[language === "es" ? 0 : 1] : null;
}
