export type Season2CurrencyKey =
  | 'heroMistcrest'
  | 'mythMistcrest'
  | 'venomblightManaflux'
  | 'tidalSparkDust'
  | 'sparksOfTides'
  | 'cofferKeyShards'
  | 'restoredCofferKey'
  | 'nebulousVoidcore'
  | 'trovehuntersBounty'

export type Season2CurrencyMetadata = {
  key: Season2CurrencyKey
  label: string
  color: string
  wowheadType: 'currency' | 'item'
  wowheadId: number
  iconName: string
  valueType?: 'trovehunterStatus'
}

export const MIDNIGHT_SEASON_2_CURRENCIES: Season2CurrencyMetadata[] = [
  { key: 'heroMistcrest', label: 'Hero Mistcrest', color: 'text-purple-400', wowheadType: 'currency', wowheadId: 3445, iconName: 'inv_121_crest_hero' },
  { key: 'mythMistcrest', label: 'Myth Mistcrest', color: 'text-purple-400', wowheadType: 'currency', wowheadId: 3446, iconName: 'inv_121_crest_myth' },
  { key: 'venomblightManaflux', label: 'Venomblight Manaflux', color: 'text-orange-300', wowheadType: 'currency', wowheadId: 3465, iconName: 'inv_10_blacksmithing_craftedoptional_blacksmithdye_earth' },
  { key: 'tidalSparkDust', label: 'Tidal Spark Dust', color: 'text-pink-400', wowheadType: 'currency', wowheadId: 3509, iconName: 'inv_enchanting_dust_color3' },
  { key: 'sparksOfTides', label: 'Spark of Tides', color: 'text-cyan-300', wowheadType: 'item', wowheadId: 274476, iconName: 'inv_12_profession_questandcrafting_sparkwhole_green' },
  { key: 'cofferKeyShards', label: 'Coffer Key Shards', color: 'text-sky-400', wowheadType: 'currency', wowheadId: 3310, iconName: 'inv_gizmo_hardenedadamantitetube' },
  { key: 'restoredCofferKey', label: 'Restored Coffer Key', color: 'text-purple-400', wowheadType: 'currency', wowheadId: 3028, iconName: 'inv_misc_key_15' },
  { key: 'nebulousVoidcore', label: 'Nebulous Voidcore', color: 'text-violet-300', wowheadType: 'currency', wowheadId: 3513, iconName: 'inv_1205_voidforge_fluctuatingvoidcores_green' },
  { key: 'trovehuntersBounty', label: "Trovehunter's Bounty", color: 'text-amber-300', wowheadType: 'item', wowheadId: 274374, iconName: 'icon_treasuremap', valueType: 'trovehunterStatus' },
]

export const DEFAULT_SEASON_2_CURRENCY_VISIBILITY: Record<Season2CurrencyKey, boolean> =
  Object.fromEntries(MIDNIGHT_SEASON_2_CURRENCIES.map(currency => [currency.key, true])) as Record<Season2CurrencyKey, boolean>

export function formatTrovehunterStatus(info: { questCompleted?: boolean } | null | undefined): string {
  if (!info) return '—'
  return info.questCompleted ? 'Completed' : 'Incomplete'
}

export function wowheadHref(type: 'currency' | 'item' | 'spell', id: number): string {
  return `https://www.wowhead.com/${type}=${id}`
}

const LEGACY_VISIBILITY_KEYS: Record<string, Season2CurrencyKey> = {
  heroDawncrest: 'heroMistcrest',
  mythDawncrest: 'mythMistcrest',
  dawnlightManaflux: 'venomblightManaflux',
  radiantSparkDust: 'tidalSparkDust',
}

export function migrateSeason2CurrencyVisibility(
  visibility: Record<string, boolean> | null | undefined,
): Record<string, boolean> {
  const source = visibility ?? {}
  const migrated: Record<string, boolean> = {
    ...DEFAULT_SEASON_2_CURRENCY_VISIBILITY,
  }

  for (const [key, value] of Object.entries(source)) {
    if (!(key in LEGACY_VISIBILITY_KEYS)) migrated[key] = value
  }

  for (const [legacyKey, canonicalKey] of Object.entries(LEGACY_VISIBILITY_KEYS)) {
    if (!(canonicalKey in source) && legacyKey in source) migrated[canonicalKey] = source[legacyKey]
  }

  return migrated
}
