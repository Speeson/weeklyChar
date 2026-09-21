import type { KeystonePlannerRole } from "./types";

import type { Language } from "./i18n";

export type ClientWowSpecialization = { id: number; name: string; nameEs: string; wowClass: string; role: KeystonePlannerRole };

const WOW_CLASS_NAMES_ES: Readonly<Record<string, string>> = {
  "death knight": "Caballero de la Muerte",
  "demon hunter": "Cazador de demonios",
  druid: "Druida",
  evoker: "Evocador",
  hunter: "Cazador",
  mage: "Mago",
  monk: "Monje",
  paladin: "Paladín",
  priest: "Sacerdote",
  rogue: "Pícaro",
  shaman: "Chamán",
  warlock: "Brujo",
  warrior: "Guerrero",
};

const WOW_CLASS_ICON_NAMES: Readonly<Record<string, string>> = {
  "death knight": "classicon_deathknight", "demon hunter": "classicon_demonhunter", druid: "classicon_druid",
  evoker: "classicon_evoker", hunter: "classicon_hunter", mage: "classicon_mage", monk: "classicon_monk",
  paladin: "classicon_paladin", priest: "classicon_priest", rogue: "classicon_rogue", shaman: "classicon_shaman",
  warlock: "classicon_warlock", warrior: "classicon_warrior",
};

// FileData IDs exposed by Blizzard's current official class pages (checked 2026-09-11).
// Keeping the IDs local makes the native client independent from an authenticated Game Data request.
const WOW_SPECIALIZATION_ICON_FILE_IDS: Readonly<Record<number, number>> = {
  62: 135932, 63: 135810, 64: 135846,
  65: 135920, 66: 236264, 70: 135873,
  71: 132355, 72: 132347, 73: 132341,
  102: 136096, 103: 132115, 104: 132276, 105: 136041,
  250: 135770, 251: 135773, 252: 135775,
  253: 461112, 254: 236179, 255: 461113,
  256: 135940, 257: 237542, 258: 136207,
  259: 236270, 260: 236286, 261: 132320,
  262: 136048, 263: 237581, 264: 136052,
  265: 136145, 266: 136172, 267: 136186,
  268: 608951, 269: 608953, 270: 608952,
  577: 1247264, 581: 1247265, 1480: 7455385,
  1467: 5198700, 1468: 4511811, 1473: 4511812,
};

// Mirrors the Worker's verified catalog in keystone-worker/src/wowComposition.ts.
export const WOW_SPECIALIZATIONS: readonly ClientWowSpecialization[] = [
  { id: 62, name: "Arcane", nameEs: "Arcano", wowClass: "Mage", role: "dps" }, { id: 63, name: "Fire", nameEs: "Fuego", wowClass: "Mage", role: "dps" }, { id: 64, name: "Frost", nameEs: "Escarcha", wowClass: "Mage", role: "dps" },
  { id: 65, name: "Holy", nameEs: "Sagrado", wowClass: "Paladin", role: "healer" }, { id: 66, name: "Protection", nameEs: "Protección", wowClass: "Paladin", role: "tank" }, { id: 70, name: "Retribution", nameEs: "Reprensión", wowClass: "Paladin", role: "dps" },
  { id: 71, name: "Arms", nameEs: "Armas", wowClass: "Warrior", role: "dps" }, { id: 72, name: "Fury", nameEs: "Furia", wowClass: "Warrior", role: "dps" }, { id: 73, name: "Protection", nameEs: "Protección", wowClass: "Warrior", role: "tank" },
  { id: 102, name: "Balance", nameEs: "Equilibrio", wowClass: "Druid", role: "dps" }, { id: 103, name: "Feral", nameEs: "Feral", wowClass: "Druid", role: "dps" }, { id: 104, name: "Guardian", nameEs: "Guardián", wowClass: "Druid", role: "tank" }, { id: 105, name: "Restoration", nameEs: "Restauración", wowClass: "Druid", role: "healer" },
  { id: 250, name: "Blood", nameEs: "Sangre", wowClass: "Death Knight", role: "tank" }, { id: 251, name: "Frost", nameEs: "Escarcha", wowClass: "Death Knight", role: "dps" }, { id: 252, name: "Unholy", nameEs: "Profano", wowClass: "Death Knight", role: "dps" },
  { id: 253, name: "Beast Mastery", nameEs: "Dominio de bestias", wowClass: "Hunter", role: "dps" }, { id: 254, name: "Marksmanship", nameEs: "Puntería", wowClass: "Hunter", role: "dps" }, { id: 255, name: "Survival", nameEs: "Supervivencia", wowClass: "Hunter", role: "dps" },
  { id: 256, name: "Discipline", nameEs: "Disciplina", wowClass: "Priest", role: "healer" }, { id: 257, name: "Holy", nameEs: "Sagrado", wowClass: "Priest", role: "healer" }, { id: 258, name: "Shadow", nameEs: "Sombra", wowClass: "Priest", role: "dps" },
  { id: 259, name: "Assassination", nameEs: "Asesinato", wowClass: "Rogue", role: "dps" }, { id: 260, name: "Outlaw", nameEs: "Forajido", wowClass: "Rogue", role: "dps" }, { id: 261, name: "Subtlety", nameEs: "Sutileza", wowClass: "Rogue", role: "dps" },
  { id: 262, name: "Elemental", nameEs: "Elemental", wowClass: "Shaman", role: "dps" }, { id: 263, name: "Enhancement", nameEs: "Mejora", wowClass: "Shaman", role: "dps" }, { id: 264, name: "Restoration", nameEs: "Restauración", wowClass: "Shaman", role: "healer" },
  { id: 265, name: "Affliction", nameEs: "Aflicción", wowClass: "Warlock", role: "dps" }, { id: 266, name: "Demonology", nameEs: "Demonología", wowClass: "Warlock", role: "dps" }, { id: 267, name: "Destruction", nameEs: "Destrucción", wowClass: "Warlock", role: "dps" },
  { id: 268, name: "Brewmaster", nameEs: "Maestro cervecero", wowClass: "Monk", role: "tank" }, { id: 269, name: "Windwalker", nameEs: "Viajero del viento", wowClass: "Monk", role: "dps" }, { id: 270, name: "Mistweaver", nameEs: "Tejedor de niebla", wowClass: "Monk", role: "healer" },
  { id: 577, name: "Havoc", nameEs: "Devastación", wowClass: "Demon Hunter", role: "dps" }, { id: 581, name: "Vengeance", nameEs: "Venganza", wowClass: "Demon Hunter", role: "tank" },
  { id: 1467, name: "Devastation", nameEs: "Devastación", wowClass: "Evoker", role: "dps" }, { id: 1468, name: "Preservation", nameEs: "Preservación", wowClass: "Evoker", role: "healer" }, { id: 1473, name: "Augmentation", nameEs: "Aumento", wowClass: "Evoker", role: "dps" },
  { id: 1480, name: "Devourer", nameEs: "Devorador", wowClass: "Demon Hunter", role: "dps" },
];

const SPECIALIZATION_BY_ID = new Map(WOW_SPECIALIZATIONS.map(spec => [spec.id, spec]));

export function specName(specId: number, language: Language = "en", fallback?: string): string {
  const spec = SPECIALIZATION_BY_ID.get(specId);
  return spec ? (language === "es" ? spec.nameEs : spec.name) : fallback ?? `${language === "es" ? "Especialización" : "Spec"} ${specId}`;
}

export function wowClassName(wowClass: string | null | undefined, language: Language): string | null {
  if (!wowClass) return null;
  const normalized = wowClass.trim().toLocaleLowerCase();
  const english = Object.keys(WOW_CLASS_NAMES_ES).find(key => key === normalized || WOW_CLASS_NAMES_ES[key].toLocaleLowerCase() === normalized);
  if (!english) return wowClass;
  if (language === "es") return WOW_CLASS_NAMES_ES[english];
  return english.split(" ").map(part => part[0].toUpperCase() + part.slice(1)).join(" ");
}

export function wowClassIconUrl(wowClass: string): string | null {
  const iconName = WOW_CLASS_ICON_NAMES[wowClass.trim().toLowerCase()];
  return iconName ? `https://render.worldofwarcraft.com/eu/icons/56/${iconName}.jpg` : null;
}

export function wowSpecializationIconUrl(specId: number): string | null {
  const fileDataId = WOW_SPECIALIZATION_ICON_FILE_IDS[specId];
  return fileDataId ? `https://render.worldofwarcraft.com/eu/icons/56/${fileDataId}.jpg` : null;
}

// Wowhead item 11845 (Handmade Leather Bag) uses the in-game INV_Misc_Bag_10 texture.
export function wowLootBagIconUrl(): string {
  return "https://wow.zamimg.com/images/wow/icons/large/inv_misc_bag_10.jpg";
}

export function specializationsForClass(wowClass: string | null): readonly ClientWowSpecialization[] {
  if (!wowClass) return [];
  const roleOrder: Readonly<Record<KeystonePlannerRole, number>> = { tank: 0, healer: 1, dps: 2 };
  return WOW_SPECIALIZATIONS
    .filter(spec => spec.wowClass.toLowerCase() === wowClass.toLowerCase())
    .sort((left, right) => roleOrder[left.role] - roleOrder[right.role]);
}
