export type WowRole = 'tank' | 'healer' | 'dps'
export type WowArmorType = 'cloth' | 'leather' | 'mail' | 'plate'
export type WowDamageProfile = 'physical' | 'magical' | null
export type WowCombatStyle = 'melee' | 'ranged' | 'hybrid'
export type WowClassName =
  | 'Death Knight'
  | 'Demon Hunter'
  | 'Druid'
  | 'Evoker'
  | 'Hunter'
  | 'Mage'
  | 'Monk'
  | 'Paladin'
  | 'Priest'
  | 'Rogue'
  | 'Shaman'
  | 'Warlock'
  | 'Warrior'

export type CapabilityId =
  | 'BLOODLUST'
  | 'BATTLE_REZ'
  | 'CHAOS_BRAND'
  | 'MYSTIC_TOUCH'
  | 'MARK_OF_THE_WILD'
  | 'ARCANE_INTELLECT'
  | 'BATTLE_SHOUT'
  | 'POWER_WORD_FORTITUDE'
  | 'SKYFURY'

export type CapabilityType = 'major_utility' | 'class_buff' | 'damage_debuff'
export type CapabilityProviderMode = 'guaranteed' | 'conditional'

export type WowSpecialization = {
  id: number
  name: string
  wowClass: WowClassName
  role: WowRole
  damageProfile: WowDamageProfile
}

export type CapabilityProvider = {
  wowClass: WowClassName
  specIds?: readonly number[]
  mode: CapabilityProviderMode
  condition?: string
}

export type CapabilityDefinition = {
  id: CapabilityId
  name: string
  type: CapabilityType
  stacking: 'unique'
  iconSpellId: number
  spells: readonly { id: number, name: string }[]
  providers: readonly CapabilityProvider[]
}

export type ResolvedCapability = {
  capabilityId: CapabilityId
  mode: CapabilityProviderMode
  condition: string | null
}

const WOW_CLASS_ARMOR: Readonly<Record<WowClassName, WowArmorType>> = {
  'Death Knight': 'plate',
  'Demon Hunter': 'leather',
  Druid: 'leather',
  Evoker: 'mail',
  Hunter: 'mail',
  Mage: 'cloth',
  Monk: 'leather',
  Paladin: 'plate',
  Priest: 'cloth',
  Rogue: 'leather',
  Shaman: 'mail',
  Warlock: 'cloth',
  Warrior: 'plate',
}

export function armorTypeForClass(wowClass: WowClassName): WowArmorType {
  return WOW_CLASS_ARMOR[wowClass]
}

// Verified against Blizzard's current class pages on 2026-09-13. The distinction is deliberately
// coarse: it protects materially different party alternatives without claiming interrupt cooldowns
// or performance. Devourer is hybrid because Blizzard describes both mid-range and melee gameplay.
// https://worldofwarcraft.blizzard.com/en-us/game/classes/druid
// https://worldofwarcraft.blizzard.com/en-us/game/classes/hunter
// https://worldofwarcraft.blizzard.com/en-gb/news/24262570
const MELEE_SPECIALIZATION_IDS = new Set([
  65, 66, 70, 71, 72, 73, 103, 104, 250, 251, 252, 255, 259, 260, 261, 263,
  268, 269, 270, 577, 581,
])
const RANGED_SPECIALIZATION_IDS = new Set([
  62, 63, 64, 102, 105, 253, 254, 256, 257, 258, 262, 264, 265, 266, 267,
  1467, 1468, 1473,
])
const HYBRID_SPECIALIZATION_IDS = new Set([1480])

export function combatStyleForSpec(specId: number): WowCombatStyle | null {
  if (MELEE_SPECIALIZATION_IDS.has(specId)) return 'melee'
  if (RANGED_SPECIALIZATION_IDS.has(specId)) return 'ranged'
  if (HYBRID_SPECIALIZATION_IDS.has(specId)) return 'hybrid'
  return null
}

// Verified 2026-09-10. Primary class/role references:
// https://worldofwarcraft.blizzard.com/en-us/game/classes
// https://worldofwarcraft.blizzard.com/en-us/news/24262570
// Numeric IDs follow Blizzard's Playable Specialization Game Data resources and the
// already transported KeystoneLoot spec IDs. Devourer (1480) is a Demon Hunter spec.
// Damage affinity is intentionally conservative: hybrid/patch-sensitive profiles stay null.
export const WOW_SPECIALIZATIONS: readonly WowSpecialization[] = [
  { id: 62, name: 'Arcane', wowClass: 'Mage', role: 'dps', damageProfile: 'magical' },
  { id: 63, name: 'Fire', wowClass: 'Mage', role: 'dps', damageProfile: 'magical' },
  { id: 64, name: 'Frost', wowClass: 'Mage', role: 'dps', damageProfile: 'magical' },
  { id: 65, name: 'Holy', wowClass: 'Paladin', role: 'healer', damageProfile: null },
  { id: 66, name: 'Protection', wowClass: 'Paladin', role: 'tank', damageProfile: null },
  { id: 70, name: 'Retribution', wowClass: 'Paladin', role: 'dps', damageProfile: null },
  { id: 71, name: 'Arms', wowClass: 'Warrior', role: 'dps', damageProfile: 'physical' },
  { id: 72, name: 'Fury', wowClass: 'Warrior', role: 'dps', damageProfile: 'physical' },
  { id: 73, name: 'Protection', wowClass: 'Warrior', role: 'tank', damageProfile: null },
  { id: 102, name: 'Balance', wowClass: 'Druid', role: 'dps', damageProfile: 'magical' },
  { id: 103, name: 'Feral', wowClass: 'Druid', role: 'dps', damageProfile: 'physical' },
  { id: 104, name: 'Guardian', wowClass: 'Druid', role: 'tank', damageProfile: null },
  { id: 105, name: 'Restoration', wowClass: 'Druid', role: 'healer', damageProfile: null },
  { id: 250, name: 'Blood', wowClass: 'Death Knight', role: 'tank', damageProfile: null },
  { id: 251, name: 'Frost', wowClass: 'Death Knight', role: 'dps', damageProfile: null },
  { id: 252, name: 'Unholy', wowClass: 'Death Knight', role: 'dps', damageProfile: null },
  { id: 253, name: 'Beast Mastery', wowClass: 'Hunter', role: 'dps', damageProfile: null },
  { id: 254, name: 'Marksmanship', wowClass: 'Hunter', role: 'dps', damageProfile: null },
  { id: 255, name: 'Survival', wowClass: 'Hunter', role: 'dps', damageProfile: null },
  { id: 256, name: 'Discipline', wowClass: 'Priest', role: 'healer', damageProfile: null },
  { id: 257, name: 'Holy', wowClass: 'Priest', role: 'healer', damageProfile: null },
  { id: 258, name: 'Shadow', wowClass: 'Priest', role: 'dps', damageProfile: 'magical' },
  { id: 259, name: 'Assassination', wowClass: 'Rogue', role: 'dps', damageProfile: null },
  { id: 260, name: 'Outlaw', wowClass: 'Rogue', role: 'dps', damageProfile: 'physical' },
  { id: 261, name: 'Subtlety', wowClass: 'Rogue', role: 'dps', damageProfile: 'physical' },
  { id: 262, name: 'Elemental', wowClass: 'Shaman', role: 'dps', damageProfile: 'magical' },
  { id: 263, name: 'Enhancement', wowClass: 'Shaman', role: 'dps', damageProfile: null },
  { id: 264, name: 'Restoration', wowClass: 'Shaman', role: 'healer', damageProfile: null },
  { id: 265, name: 'Affliction', wowClass: 'Warlock', role: 'dps', damageProfile: 'magical' },
  { id: 266, name: 'Demonology', wowClass: 'Warlock', role: 'dps', damageProfile: 'magical' },
  { id: 267, name: 'Destruction', wowClass: 'Warlock', role: 'dps', damageProfile: 'magical' },
  { id: 268, name: 'Brewmaster', wowClass: 'Monk', role: 'tank', damageProfile: null },
  { id: 269, name: 'Windwalker', wowClass: 'Monk', role: 'dps', damageProfile: 'physical' },
  { id: 270, name: 'Mistweaver', wowClass: 'Monk', role: 'healer', damageProfile: null },
  { id: 577, name: 'Havoc', wowClass: 'Demon Hunter', role: 'dps', damageProfile: null },
  { id: 581, name: 'Vengeance', wowClass: 'Demon Hunter', role: 'tank', damageProfile: null },
  { id: 1467, name: 'Devastation', wowClass: 'Evoker', role: 'dps', damageProfile: 'magical' },
  { id: 1468, name: 'Preservation', wowClass: 'Evoker', role: 'healer', damageProfile: null },
  { id: 1473, name: 'Augmentation', wowClass: 'Evoker', role: 'dps', damageProfile: 'magical' },
  { id: 1480, name: 'Devourer', wowClass: 'Demon Hunter', role: 'dps', damageProfile: 'magical' },
]

// Current provider references checked 2026-09-10:
// https://warcraft.wiki.gg/wiki/Bloodlust_effect
// https://warcraft.wiki.gg/wiki/Resurrect
// https://warcraft.wiki.gg/wiki/Skyfury
// https://warcraft.wiki.gg/wiki/Patch_12.0.1/API_changes
export const WOW_CAPABILITIES: readonly CapabilityDefinition[] = [
  {
    id: 'BLOODLUST', name: 'Bloodlust', type: 'major_utility', stacking: 'unique',
    iconSpellId: 2825,
    spells: [
      { id: 2825, name: 'Bloodlust' }, { id: 32182, name: 'Heroism' },
      { id: 80353, name: 'Time Warp' }, { id: 264667, name: 'Primal Rage' },
      { id: 390386, name: 'Fury of the Aspects' },
    ],
    providers: [
      { wowClass: 'Shaman', mode: 'guaranteed' },
      { wowClass: 'Mage', mode: 'guaranteed' },
      { wowClass: 'Evoker', mode: 'guaranteed' },
      { wowClass: 'Hunter', mode: 'conditional', condition: 'Requires an eligible Hunter pet or specialization ability.' },
    ],
  },
  {
    id: 'BATTLE_REZ', name: 'Battle Resurrection', type: 'major_utility', stacking: 'unique',
    iconSpellId: 20484,
    spells: [
      { id: 20484, name: 'Rebirth' }, { id: 61999, name: 'Raise Ally' },
      { id: 20707, name: 'Soulstone' }, { id: 391054, name: 'Intercession' },
    ],
    providers: [
      { wowClass: 'Druid', mode: 'guaranteed' },
      { wowClass: 'Death Knight', mode: 'guaranteed' },
      { wowClass: 'Warlock', mode: 'guaranteed' },
      { wowClass: 'Paladin', mode: 'guaranteed' },
    ],
  },
  {
    id: 'CHAOS_BRAND', name: 'Chaos Brand', type: 'damage_debuff', stacking: 'unique',
    iconSpellId: 1490, spells: [{ id: 1490, name: 'Chaos Brand' }],
    providers: [{ wowClass: 'Demon Hunter', mode: 'guaranteed' }],
  },
  {
    id: 'MYSTIC_TOUCH', name: 'Mystic Touch', type: 'damage_debuff', stacking: 'unique',
    iconSpellId: 113746, spells: [{ id: 113746, name: 'Mystic Touch' }],
    providers: [{ wowClass: 'Monk', mode: 'guaranteed' }],
  },
  {
    id: 'MARK_OF_THE_WILD', name: 'Mark of the Wild', type: 'class_buff', stacking: 'unique',
    iconSpellId: 1126, spells: [{ id: 1126, name: 'Mark of the Wild' }],
    providers: [{ wowClass: 'Druid', mode: 'guaranteed' }],
  },
  {
    id: 'ARCANE_INTELLECT', name: 'Arcane Intellect', type: 'class_buff', stacking: 'unique',
    iconSpellId: 1459, spells: [{ id: 1459, name: 'Arcane Intellect' }],
    providers: [{ wowClass: 'Mage', mode: 'guaranteed' }],
  },
  {
    id: 'BATTLE_SHOUT', name: 'Battle Shout', type: 'class_buff', stacking: 'unique',
    iconSpellId: 6673, spells: [{ id: 6673, name: 'Battle Shout' }],
    providers: [{ wowClass: 'Warrior', mode: 'guaranteed' }],
  },
  {
    id: 'POWER_WORD_FORTITUDE', name: 'Power Word: Fortitude', type: 'class_buff', stacking: 'unique',
    iconSpellId: 21562, spells: [{ id: 21562, name: 'Power Word: Fortitude' }],
    providers: [{ wowClass: 'Priest', mode: 'guaranteed' }],
  },
  {
    id: 'SKYFURY', name: 'Skyfury', type: 'class_buff', stacking: 'unique',
    iconSpellId: 462854, spells: [{ id: 462854, name: 'Skyfury' }],
    providers: [{ wowClass: 'Shaman', mode: 'guaranteed' }],
  },
]

const SPECIALIZATION_BY_ID = new Map(WOW_SPECIALIZATIONS.map(spec => [spec.id, spec]))
const CLASS_BY_LOWER_NAME = new Map<string, WowClassName>()
for (const specialization of WOW_SPECIALIZATIONS) {
  CLASS_BY_LOWER_NAME.set(specialization.wowClass.toLowerCase(), specialization.wowClass)
}

export function wowSpecialization(specId: number): WowSpecialization | null {
  return SPECIALIZATION_BY_ID.get(specId) ?? null
}

export function normalizeWowClass(value: string | null | undefined): WowClassName | null {
  if (typeof value !== 'string') return null
  return CLASS_BY_LOWER_NAME.get(value.trim().toLowerCase()) ?? null
}

export function wowSpecializationsForClass(wowClass: WowClassName): readonly WowSpecialization[] {
  return WOW_SPECIALIZATIONS.filter(spec => spec.wowClass === wowClass)
}

export function capabilitiesForSpec(specId: number): readonly ResolvedCapability[] {
  const specialization = wowSpecialization(specId)
  if (!specialization) return []
  const resolved: ResolvedCapability[] = []
  for (const capability of WOW_CAPABILITIES) {
    const provider = capability.providers.find(candidate => candidate.wowClass === specialization.wowClass
      && (candidate.specIds === undefined || candidate.specIds.includes(specId)))
    if (provider) {
      resolved.push({
        capabilityId: capability.id,
        mode: provider.mode,
        condition: provider.condition ?? null,
      })
    }
  }
  return resolved
}
