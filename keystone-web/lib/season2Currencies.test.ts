import assert from 'node:assert/strict'
import test from 'node:test'

import {
  formatTrovehunterStatus,
  MIDNIGHT_SEASON_2_CURRENCIES,
  migrateSeason2CurrencyVisibility,
  wowheadHref,
} from './season2Currencies.ts'

test('formats Trovehunter weekly completion as readable text', () => {
  assert.equal(formatTrovehunterStatus({ questCompleted: true }), 'Completed')
  assert.equal(formatTrovehunterStatus({ questCompleted: false }), 'Incomplete')
  assert.equal(formatTrovehunterStatus(undefined), '—')
})

test('builds direct Wowhead destinations for Season 2 tooltips', () => {
  assert.equal(wowheadHref('currency', 3445), 'https://www.wowhead.com/currency=3445')
  assert.equal(wowheadHref('item', 274476), 'https://www.wowhead.com/item=274476')
  assert.equal(wowheadHref('spell', 1254400), 'https://www.wowhead.com/spell=1254400')
})

test('defines canonical Season 2 labels, IDs, types, and live icon names', () => {
  assert.deepEqual(
    MIDNIGHT_SEASON_2_CURRENCIES.map(({ key, label, wowheadType, wowheadId, iconName }) => ({
      key,
      label,
      wowheadType,
      wowheadId,
      iconName,
    })),
    [
      { key: 'heroMistcrest', label: 'Hero Mistcrest', wowheadType: 'currency', wowheadId: 3445, iconName: 'inv_121_crest_hero' },
      { key: 'mythMistcrest', label: 'Myth Mistcrest', wowheadType: 'currency', wowheadId: 3446, iconName: 'inv_121_crest_myth' },
      { key: 'venomblightManaflux', label: 'Venomblight Manaflux', wowheadType: 'currency', wowheadId: 3465, iconName: 'inv_10_blacksmithing_craftedoptional_blacksmithdye_earth' },
      { key: 'tidalSparkDust', label: 'Tidal Spark Dust', wowheadType: 'currency', wowheadId: 3509, iconName: 'inv_enchanting_dust_color3' },
      { key: 'sparksOfTides', label: 'Spark of Tides', wowheadType: 'item', wowheadId: 274476, iconName: 'inv_12_profession_questandcrafting_sparkwhole_green' },
      { key: 'cofferKeyShards', label: 'Coffer Key Shards', wowheadType: 'currency', wowheadId: 3310, iconName: 'inv_gizmo_hardenedadamantitetube' },
      { key: 'restoredCofferKey', label: 'Restored Coffer Key', wowheadType: 'currency', wowheadId: 3028, iconName: 'inv_misc_key_15' },
      { key: 'nebulousVoidcore', label: 'Nebulous Voidcore', wowheadType: 'currency', wowheadId: 3513, iconName: 'inv_1205_voidforge_fluctuatingvoidcores_green' },
      { key: 'trovehuntersBounty', label: "Trovehunter's Bounty", wowheadType: 'item', wowheadId: 274374, iconName: 'icon_treasuremap' },
    ],
  )
})

test('migrates old visibility preferences without retaining Season 1 keys', () => {
  assert.deepEqual(
    migrateSeason2CurrencyVisibility({
      heroDawncrest: false,
      mythDawncrest: true,
      dawnlightManaflux: false,
      radiantSparkDust: true,
      cofferKeyShards: false,
      customFutureKey: false,
    }),
    {
      heroMistcrest: false,
      mythMistcrest: true,
      venomblightManaflux: false,
      tidalSparkDust: true,
      sparksOfTides: true,
      cofferKeyShards: false,
      restoredCofferKey: true,
      nebulousVoidcore: true,
      trovehuntersBounty: true,
      customFutureKey: false,
    },
  )
})

test('canonical preferences win when old and new keys coexist', () => {
  const migrated = migrateSeason2CurrencyVisibility({
    heroDawncrest: false,
    heroMistcrest: true,
  })

  assert.equal(migrated.heroMistcrest, true)
  assert.equal('heroDawncrest' in migrated, false)
})
