const SPEC_NAMES: Readonly<Record<number, string>> = {
  62: 'Arcane',
  63: 'Fire',
  64: 'Frost',
  65: 'Holy',
  66: 'Protection',
  70: 'Retribution',
  71: 'Arms',
  72: 'Fury',
  73: 'Protection',
  102: 'Balance',
  103: 'Feral',
  104: 'Guardian',
  105: 'Restoration',
  250: 'Blood',
  251: 'Frost',
  252: 'Unholy',
  253: 'Beast Mastery',
  254: 'Marksmanship',
  255: 'Survival',
  256: 'Discipline',
  257: 'Holy',
  258: 'Shadow',
  259: 'Assassination',
  260: 'Outlaw',
  261: 'Subtlety',
  262: 'Elemental',
  263: 'Enhancement',
  264: 'Restoration',
  265: 'Affliction',
  266: 'Demonology',
  267: 'Destruction',
  268: 'Brewmaster',
  269: 'Windwalker',
  270: 'Mistweaver',
  577: 'Havoc',
  581: 'Vengeance',
  1467: 'Devastation',
  1468: 'Preservation',
  1473: 'Augmentation',
  1480: 'Devourer',
}

const SPEC_IDS_BY_CLASS: Readonly<Record<string, readonly number[]>> = {
  'Death Knight': [250, 251, 252],
  'Demon Hunter': [577, 581],
  Druid: [102, 103, 104, 105],
  Evoker: [1467, 1468, 1473, 1480],
  Hunter: [253, 254, 255],
  Mage: [62, 63, 64],
  Monk: [268, 269, 270],
  Paladin: [65, 66, 70],
  Priest: [256, 257, 258],
  Rogue: [259, 260, 261],
  Shaman: [262, 263, 264],
  Warlock: [265, 266, 267],
  Warrior: [71, 72, 73],
}

export function specName(specId: number): string {
  return SPEC_NAMES[specId] ?? `Spec ${specId}`
}

export function specOptionsForClass(wowClass: string | null | undefined): Array<{ id: number, name: string }> {
  return (SPEC_IDS_BY_CLASS[wowClass ?? ''] ?? []).map(id => ({ id, name: specName(id) }))
}
