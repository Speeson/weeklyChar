import assert from 'node:assert/strict'
import test from 'node:test'

import { buildKeystoneLootDungeonSummary } from '../.tmp-test/keystoneSelector.js'

function favorite(itemId, tier, overrides = {}) {
  return {
    sourceId: 249,
    sourceType: 'dungeon',
    specId: 102,
    itemId,
    tier,
    slotId: 13,
    ...overrides,
  }
}

function supported(favorites, overrides = {}) {
  return {
    state: 'supported',
    installed: true,
    supported: true,
    apiVersion: 2,
    addonVersion: '2.13.1',
    characterKey: 'Realm-Character-1',
    updatedAt: 1787935845,
    favorites,
    voidcore: { checked: false, usedItems: [] },
    ...overrides,
  }
}

function character(id, name, keystoneLoot, overrides = {}) {
  return {
    userId: 1,
    username: 'owner',
    characterId: id,
    characterName: name,
    realm: 'Zul\'jin',
    region: 'eu',
    wowClass: 'Druid',
    avatarUrl: `https://example.test/${name}.jpg`,
    ilvl: 700,
    rioScore: 2500,
    keystoneLoot,
    ...overrides,
  }
}

test('selector dedupes top-level objectives across specs while preserving actionable per-spec counts', () => {
  const sources = [
    character(1, 'MultiSpec', supported([
      favorite(10, 1, { specId: 102 }),
      favorite(10, 3, { specId: 103, slotId: 15 }),
      favorite(11, 2),
      favorite(12, 5),
      favorite(13, 4),
      favorite(14, 99),
      favorite(15, 3, { sourceType: 'raid' }),
      favorite(16, 3, { sourceId: 250 }),
    ], { voidcore: { checked: true, usedItems: [11] } })),
    character(2, 'CompletedOnly', supported([
      favorite(21, 3),
    ], { voidcore: { checked: true, usedItems: [21] } })),
    character(3, 'Unchecked', supported([
      favorite(20, 2),
    ], { voidcore: { checked: false, usedItems: [20] } })),
  ]
  const availability = {
    stoneCount: 1,
    stones: [{
      characterId: 9,
      characterName: 'Keyholder',
      ownerUserId: 1,
      ownerUsername: 'owner',
      level: 12,
    }],
  }

  const result = buildKeystoneLootDungeonSummary(7, 249, availability, sources)

  assert.equal(result.teamId, 7)
  assert.equal(result.challengeMapId, 249)
  assert.deepEqual(result.availability, availability)
  assert.deepEqual(result.summary, {
    charactersWithObjectives: 2,
    totalObjectives: 5,
    tiers: {
      bestInSlot: 1,
      mustHave: 1,
      niceToHave: 0,
      catalyst: 1,
      transmog: 1,
      other: 1,
    },
  })
  assert.deepEqual(result.characters.map(entry => entry.characterName), ['MultiSpec', 'Unchecked'])

  const multi = result.characters[0]
  assert.equal(multi.totalObjectives, 4)
  assert.deepEqual(multi.tierCounts, {
    bestInSlot: 1,
    mustHave: 0,
    niceToHave: 0,
    catalyst: 1,
    transmog: 1,
    other: 1,
  })
  assert.deepEqual(multi.specs, [
    {
      specId: 102,
      objectiveCount: 4,
      tierCounts: {
        bestInSlot: 0, mustHave: 0, niceToHave: 1,
        catalyst: 1, transmog: 1, other: 1,
      },
    },
    {
      specId: 103,
      objectiveCount: 1,
      tierCounts: {
        bestInSlot: 1, mustHave: 0, niceToHave: 0,
        catalyst: 0, transmog: 0, other: 0,
      },
    },
  ])
  assert.equal(multi.specs.reduce((total, spec) => total + spec.objectiveCount, 0), 5)
  assert.deepEqual(multi.objectives.find(objective => objective.itemId === 10), {
    itemId: 10,
    itemName: null,
    iconUrl: null,
    tier: 3,
    specIds: [102, 103],
    sourceType: 'dungeon',
    sourceId: 249,
    slotId: 15,
    slotName: null,
    itemClassName: null,
    itemSubClassName: null,
    statNames: [],
    voidcoreState: 'pending',
  })
  assert.equal(multi.objectives.find(objective => objective.itemId === 11).voidcoreState, 'completed_with_voidcore')
  assert.equal(result.characters[1].objectives[0].voidcoreState, 'voidcore_not_checked')
})

test('selector character ordering follows total, BiS, Must, name, realm and stable ID', () => {
  const sources = [
    character(9, 'Zulu', supported([favorite(1, 2)])),
    character(8, 'Bravo', supported([favorite(2, 2)])),
    character(7, 'Alpha', supported([favorite(3, 2)]), { realm: 'Zul\'jin' }),
    character(6, 'Alpha', supported([favorite(4, 2)]), { realm: 'Argent Dawn' }),
    character(5, 'Alpha', supported([favorite(5, 2)]), { realm: 'Argent Dawn' }),
    character(4, 'NoMust', supported([favorite(6, 1)])),
    character(3, 'Bis', supported([favorite(7, 3)])),
    character(2, 'Many', supported([favorite(8, 1), favorite(9, 1)])),
  ]

  const result = buildKeystoneLootDungeonSummary(1, 249, { stoneCount: 0, stones: [] }, sources)

  assert.deepEqual(result.characters.map(entry => entry.characterId), [2, 3, 5, 6, 7, 8, 9, 4])
})

test('selector ignores unsupported, malformed, empty and wrong-dungeon snapshots', () => {
  const sources = [
    character(1, 'Malformed', '{'),
    character(2, 'Unsupported', { state: 'unsupported_api', installed: true, supported: false, favorites: [] }),
    character(3, 'Empty', supported([])),
    character(4, 'OtherDungeon', supported([favorite(1, 3, { sourceId: 250 })])),
  ]

  const result = buildKeystoneLootDungeonSummary(1, 249, { stoneCount: 0, stones: [] }, sources)

  assert.deepEqual(result.summary, {
    charactersWithObjectives: 0,
    totalObjectives: 0,
    tiers: {
      bestInSlot: 0, mustHave: 0, niceToHave: 0,
      catalyst: 0, transmog: 0, other: 0,
    },
  })
  assert.deepEqual(result.characters, [])
})

test('selector remains deterministic at the 2,000-favorite snapshot limit', () => {
  const favorites = Array.from({ length: 2000 }, (_, index) => favorite(2000 - index, 1))
  const source = character(1, 'Stress', supported(favorites))

  const result = buildKeystoneLootDungeonSummary(1, 249, { stoneCount: 0, stones: [] }, [source])

  assert.equal(result.summary.totalObjectives, 2000)
  assert.equal(result.summary.tiers.niceToHave, 2000)
  assert.equal(result.characters[0].objectives.length, 2000)
  assert.deepEqual(result.characters[0].objectives.slice(0, 3).map(objective => objective.itemId), [1, 2, 3])
  assert.deepEqual(result.characters[0].objectives.slice(-3).map(objective => objective.itemId), [1998, 1999, 2000])
})

test('selector response contains only the objective privacy allowlist', () => {
  const raw = supported([favorite(10, 3, {
    bonusIds: [1], gems: [2], enchant: 3, futureSecret: 'hidden',
  })], { privateSnapshotField: 'hidden' })
  const result = buildKeystoneLootDungeonSummary(
    1,
    249,
    { stoneCount: 0, stones: [] },
    [character(1, 'PrivateFields', raw)],
  )
  const serialized = JSON.stringify(result)

  for (const forbidden of [
    'keystoneLoot', 'favorites', 'usedItems', 'characterKey', 'bonusIds',
    'gems', 'enchant', 'privateSnapshotField', 'futureSecret', 'score', 'weight',
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden)
  }
})
