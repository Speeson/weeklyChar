import type { KeystonePlannerRole } from "./types";

export type ClientWowSpecialization = { id: number; name: string; wowClass: string; role: KeystonePlannerRole };

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
  268: 608951, 269: 608952, 270: 608953,
  577: 1247264, 581: 1247265, 1480: 7455385,
  1467: 5198700, 1468: 4511811, 1473: 4511812,
};

// Mirrors the Worker's verified catalog in keystone-worker/src/wowComposition.ts.
export const WOW_SPECIALIZATIONS: readonly ClientWowSpecialization[] = [
  { id: 62, name: "Arcane", wowClass: "Mage", role: "dps" }, { id: 63, name: "Fire", wowClass: "Mage", role: "dps" }, { id: 64, name: "Frost", wowClass: "Mage", role: "dps" },
  { id: 65, name: "Holy", wowClass: "Paladin", role: "healer" }, { id: 66, name: "Protection", wowClass: "Paladin", role: "tank" }, { id: 70, name: "Retribution", wowClass: "Paladin", role: "dps" },
  { id: 71, name: "Arms", wowClass: "Warrior", role: "dps" }, { id: 72, name: "Fury", wowClass: "Warrior", role: "dps" }, { id: 73, name: "Protection", wowClass: "Warrior", role: "tank" },
  { id: 102, name: "Balance", wowClass: "Druid", role: "dps" }, { id: 103, name: "Feral", wowClass: "Druid", role: "dps" }, { id: 104, name: "Guardian", wowClass: "Druid", role: "tank" }, { id: 105, name: "Restoration", wowClass: "Druid", role: "healer" },
  { id: 250, name: "Blood", wowClass: "Death Knight", role: "tank" }, { id: 251, name: "Frost", wowClass: "Death Knight", role: "dps" }, { id: 252, name: "Unholy", wowClass: "Death Knight", role: "dps" },
  { id: 253, name: "Beast Mastery", wowClass: "Hunter", role: "dps" }, { id: 254, name: "Marksmanship", wowClass: "Hunter", role: "dps" }, { id: 255, name: "Survival", wowClass: "Hunter", role: "dps" },
  { id: 256, name: "Discipline", wowClass: "Priest", role: "healer" }, { id: 257, name: "Holy", wowClass: "Priest", role: "healer" }, { id: 258, name: "Shadow", wowClass: "Priest", role: "dps" },
  { id: 259, name: "Assassination", wowClass: "Rogue", role: "dps" }, { id: 260, name: "Outlaw", wowClass: "Rogue", role: "dps" }, { id: 261, name: "Subtlety", wowClass: "Rogue", role: "dps" },
  { id: 262, name: "Elemental", wowClass: "Shaman", role: "dps" }, { id: 263, name: "Enhancement", wowClass: "Shaman", role: "dps" }, { id: 264, name: "Restoration", wowClass: "Shaman", role: "healer" },
  { id: 265, name: "Affliction", wowClass: "Warlock", role: "dps" }, { id: 266, name: "Demonology", wowClass: "Warlock", role: "dps" }, { id: 267, name: "Destruction", wowClass: "Warlock", role: "dps" },
  { id: 268, name: "Brewmaster", wowClass: "Monk", role: "tank" }, { id: 269, name: "Windwalker", wowClass: "Monk", role: "dps" }, { id: 270, name: "Mistweaver", wowClass: "Monk", role: "healer" },
  { id: 577, name: "Havoc", wowClass: "Demon Hunter", role: "dps" }, { id: 581, name: "Vengeance", wowClass: "Demon Hunter", role: "tank" },
  { id: 1467, name: "Devastation", wowClass: "Evoker", role: "dps" }, { id: 1468, name: "Preservation", wowClass: "Evoker", role: "healer" }, { id: 1473, name: "Augmentation", wowClass: "Evoker", role: "dps" },
  { id: 1480, name: "Devourer", wowClass: "Demon Hunter", role: "dps" },
];

const SPECIALIZATION_BY_ID = new Map(WOW_SPECIALIZATIONS.map(spec => [spec.id, spec]));

export function specName(specId: number): string {
  return SPECIALIZATION_BY_ID.get(specId)?.name ?? `Spec ${specId}`;
}

export function wowClassIconUrl(wowClass: string): string | null {
  const iconName = WOW_CLASS_ICON_NAMES[wowClass.trim().toLowerCase()];
  return iconName ? `https://render.worldofwarcraft.com/eu/icons/56/${iconName}.jpg` : null;
}

export function wowSpecializationIconUrl(specId: number): string | null {
  const fileDataId = WOW_SPECIALIZATION_ICON_FILE_IDS[specId];
  return fileDataId ? `https://render.worldofwarcraft.com/eu/icons/56/${fileDataId}.jpg` : null;
}

export function specializationsForClass(wowClass: string | null): readonly ClientWowSpecialization[] {
  if (!wowClass) return [];
  const roleOrder: Readonly<Record<KeystonePlannerRole, number>> = { tank: 0, healer: 1, dps: 2 };
  return WOW_SPECIALIZATIONS
    .filter(spec => spec.wowClass.toLowerCase() === wowClass.toLowerCase())
    .sort((left, right) => roleOrder[left.role] - roleOrder[right.role]);
}
