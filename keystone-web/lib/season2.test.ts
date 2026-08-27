import assert from 'node:assert/strict'
import test from 'node:test'

import {
  compactKeystoneLabel,
  DUNGEON_ABBR_BY_ID,
  DUNGEON_ABBR_BY_NAME,
  DUNGEON_FULL_NAME_BY_ABBR,
  fullKeystoneLabel,
  MIDNIGHT_SEASON_2_DUNGEONS,
} from './season2.ts'

test('defines the exact Midnight Season 2 dungeon pool and portal spells', () => {
  assert.deepEqual(MIDNIGHT_SEASON_2_DUNGEONS, [
    { id: 588, name: 'Altar of Fangs', abbr: 'AOF', spellId: 1286812 },
    { id: 587, name: 'Murder Row', abbr: 'MR', spellId: 1286809 },
    { id: 586, name: 'Den of Nalorakk', abbr: 'DON', spellId: 1286807 },
    { id: 584, name: 'The Blinding Vale', abbr: 'BV', spellId: 1286801 },
    { id: 585, name: 'Voidscar Arena', abbr: 'VSA', spellId: 1286804 },
    { id: 249, name: "Kings' Rest", abbr: 'KR', spellId: 1286831 },
    { id: 250, name: 'Temple of Sethraliss', abbr: 'TOS', spellId: 1286828 },
    { id: 399, name: 'Ruby Life Pools', abbr: 'RLP', spellId: 393256 },
  ])
})

test('derives consistent dungeon lookups for current keystones and filters', () => {
  for (const dungeon of MIDNIGHT_SEASON_2_DUNGEONS) {
    assert.equal(DUNGEON_ABBR_BY_ID.get(dungeon.id), dungeon.abbr)
    assert.equal(DUNGEON_ABBR_BY_NAME.get(dungeon.name.toLowerCase()), dungeon.abbr)
    assert.equal(DUNGEON_FULL_NAME_BY_ABBR.get(dungeon.abbr), dungeon.name)
  }
})

test('uses compact Season 2 abbreviations while preserving full labels for title contexts', () => {
  const keystones = [
    {
      key: { level: 13, dungeon: 'Temple of Sethraliss', challengeMapId: 250 },
      compact: '+13 TOS',
      full: '+13 Temple of Sethraliss',
    },
    {
      key: { level: 11, dungeon: 'Ruby Life Pools', challengeMapId: 399 },
      compact: '+11 RLP',
      full: '+11 Ruby Life Pools',
    },
    {
      key: { level: 9, dungeon: 'Voidscar Arena', challengeMapId: 585 },
      compact: '+9 VSA',
      full: '+9 Voidscar Arena',
    },
  ]

  for (const { key, compact, full } of keystones) {
    assert.equal(compactKeystoneLabel(key), compact)
    assert.equal(fullKeystoneLabel(key), full)
  }
})
