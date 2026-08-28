import assert from 'node:assert/strict'
import test from 'node:test'
import {
  TIER_WEIGHTS,
  compareRecommendationCandidates,
  recommendKeystoneLootTarget,
} from '../.tmp-test/keystoneRecommendations.js'

function snapshot(favorites, voidcore = { checked: false, usedItems: [] }) {
  return {
    state: 'supported',
    installed: true,
    supported: true,
    apiVersion: 2,
    addonVersion: '2.13.1',
    characterKey: 'Realm-Character-1',
    updatedAt: 1787935845,
    favorites,
    voidcore,
  }
}

function favorite(itemId, tier, overrides = {}) {
  return {
    sourceId: 249,
    sourceType: 'dungeon',
    specId: 102,
    itemId,
    tier,
    ...overrides,
  }
}

function character(id, name, favorites, overrides = {}) {
  return {
    id,
    name,
    realm: 'Zul\'jin',
    region: 'eu',
    wowClass: 'Druid',
    avatarUrl: null,
    ilvl: 700,
    rioScore: 2500,
    keystoneLoot: snapshot(favorites),
    ...overrides,
  }
}

function candidate(overrides = {}) {
  return {
    characterId: 1,
    character: 'Alpha',
    realm: 'Realm',
    region: 'eu',
    wowClass: 'Druid',
    avatarUrl: null,
    ilvl: 700,
    rioScore: 2500,
    specId: 102,
    score: 100,
    summary: {
      bis: 1,
      must: 0,
      nice: 0,
      catalyst: 0,
      transmog: 0,
      totalPending: 1,
      voidcoreExcluded: 0,
    },
    ...overrides,
  }
}

test('KeystoneLoot tier weights match API v2 semantics exactly', () => {
  assert.deepEqual(TIER_WEIGHTS, { 1: 25, 2: 60, 3: 100, 4: 5, 5: 15 })
})

test('mixed tiers produce the exact score and aggregate summary', () => {
  const result = recommendKeystoneLootTarget([
    character(1, 'Makabe', [
      favorite(1, 3),
      favorite(2, 3),
      favorite(3, 2),
      favorite(4, 1),
      favorite(5, 5),
      favorite(6, 4),
    ]),
  ], 249)

  assert.equal(result.score, 305)
  assert.deepEqual(result.summary, {
    bis: 2,
    must: 1,
    nice: 1,
    catalyst: 1,
    transmog: 1,
    totalPending: 6,
    voidcoreExcluded: 0,
  })
})

test('only exact numeric dungeon source identity is scored', () => {
  const result = recommendKeystoneLootTarget([
    character(1, 'Makabe', [
      favorite(1, 3),
      favorite(2, 3, { sourceId: 250 }),
      favorite(3, 3, { sourceId: '249' }),
      favorite(4, 3, { sourceId: 'catalyst', sourceType: 'catalyst' }),
      favorite(5, 3, { sourceType: 'raid' }),
      favorite(6, 3, { sourceType: 'custom' }),
      favorite(7, 3, { sourceType: undefined }),
    ]),
  ], 249)

  assert.equal(result.score, 100)
  assert.equal(result.summary.totalPending, 1)
})

test('multiple specs on one character and multiple characters rank separate candidates', () => {
  const result = recommendKeystoneLootTarget([
    character(1, 'Makabe', [favorite(1, 2), favorite(2, 1, { specId: 103 })]),
    character(2, 'OtherDruid', [favorite(3, 3, { specId: 102 })]),
  ], 249)

  assert.equal(result.characterId, 2)
  assert.equal(result.specId, 102)
  assert.equal(result.score, 100)
})

test('duplicate item in one candidate counts once at its highest known weight', () => {
  const result = recommendKeystoneLootTarget([
    character(1, 'Makabe', [favorite(1, 1), favorite(1, 3), favorite(1, 2)]),
  ], 249)

  assert.equal(result.score, 100)
  assert.deepEqual(result.summary, {
    bis: 1,
    must: 0,
    nice: 0,
    catalyst: 0,
    transmog: 0,
    totalPending: 1,
    voidcoreExcluded: 0,
  })
})

test('the same item may count independently for separate specs', () => {
  const result = recommendKeystoneLootTarget([
    character(1, 'Makabe', [favorite(1, 2), favorite(1, 3, { specId: 103 })]),
  ], 249)

  assert.equal(result.specId, 103)
  assert.equal(result.score, 100)
})

test('authoritative Voidcore excludes unique used items without penalizing pending items', () => {
  const checked = character(1, 'Makabe', [favorite(1, 3), favorite(1, 2), favorite(2, 1)], {
    keystoneLoot: snapshot(
      [favorite(1, 3), favorite(1, 2), favorite(2, 1)],
      { checked: true, usedItems: [1] },
    ),
  })

  const result = recommendKeystoneLootTarget([checked], 249)

  assert.equal(result.score, 25)
  assert.equal(result.summary.totalPending, 1)
  assert.equal(result.summary.voidcoreExcluded, 1)
})

test('unchecked Voidcore does not exclude listed items', () => {
  const unchecked = character(1, 'Makabe', [favorite(1, 3)], {
    keystoneLoot: snapshot([favorite(1, 3)], { checked: false, usedItems: [1] }),
  })

  const result = recommendKeystoneLootTarget([unchecked], 249)

  assert.equal(result.score, 100)
  assert.equal(result.summary.voidcoreExcluded, 0)
})

test('unknown tiers score zero and cannot create a recommendation', () => {
  assert.equal(recommendKeystoneLootTarget([
    character(1, 'Makabe', [favorite(1, 99)]),
  ], 249), null)
})

test('candidate comparison follows every deterministic tie-break level', () => {
  const summary = candidate().summary
  const cases = [
    [candidate({ score: 101 }), candidate({ score: 100 })],
    [candidate({ summary: { ...summary, bis: 2 } }), candidate({ summary: { ...summary, bis: 1 } })],
    [candidate({ summary: { ...summary, must: 2 } }), candidate({ summary: { ...summary, must: 1 } })],
    [candidate({ summary: { ...summary, nice: 2 } }), candidate({ summary: { ...summary, nice: 1 } })],
    [candidate({ summary: { ...summary, catalyst: 2 } }), candidate({ summary: { ...summary, catalyst: 1 } })],
    [candidate({ summary: { ...summary, transmog: 2 } }), candidate({ summary: { ...summary, transmog: 1 } })],
    [candidate({ ilvl: 701 }), candidate({ ilvl: 700 })],
    [candidate({ rioScore: 2501 }), candidate({ rioScore: 2500 })],
    [candidate({ character: 'Alpha' }), candidate({ character: 'Beta' })],
    [candidate({ realm: 'A-Realm' }), candidate({ realm: 'B-Realm' })],
    [candidate({ specId: 102 }), candidate({ specId: 103 })],
  ]

  for (const [preferred, other] of cases) {
    assert.ok(compareRecommendationCandidates(preferred, other) < 0)
    assert.ok(compareRecommendationCandidates(other, preferred) > 0)
  }
})

test('missing ilvl and Raider.IO rank below real values', () => {
  assert.ok(compareRecommendationCandidates(candidate({ ilvl: 1 }), candidate({ ilvl: null })) < 0)
  assert.ok(compareRecommendationCandidates(candidate({ rioScore: 1 }), candidate({ rioScore: null })) < 0)
})

test('equal missing metrics continue to deterministic name realm and spec fallbacks', () => {
  const missing = { ilvl: null, rioScore: null }
  assert.ok(compareRecommendationCandidates(
    candidate({ ...missing, character: 'Alpha' }),
    candidate({ ...missing, character: 'Beta' }),
  ) < 0)
})
