import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildKeystoneLootObjectivePage,
  classifyKeystoneLootSnapshot,
} from '../.tmp-test/keystoneObjectives.js'

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

test('snapshot presentation statuses are explicit and malformed data is unavailable', () => {
  assert.equal(classifyKeystoneLootSnapshot(null).status, 'unavailable')
  assert.equal(classifyKeystoneLootSnapshot('{bad').status, 'unavailable')
  assert.equal(classifyKeystoneLootSnapshot({ state: 'not_installed', installed: false, supported: false, favorites: [] }).status, 'not_installed')
  assert.equal(classifyKeystoneLootSnapshot({ state: 'installed_not_ready', installed: true, supported: false, favorites: [] }).status, 'not_ready')
  assert.equal(classifyKeystoneLootSnapshot({ state: 'unsupported_api', installed: true, supported: false, apiVersion: 9, favorites: [] }).status, 'unsupported')
  assert.equal(classifyKeystoneLootSnapshot(supported([])).status, 'empty')
  assert.equal(classifyKeystoneLootSnapshot(supported([favorite(1, 3)])).status, 'available')
})

test('display DTOs dedupe deterministically with V1 weights and derive Voidcore states', () => {
  const snapshot = supported([
    favorite(10, 1, { bonusIds: [1], future: 'secret' }),
    favorite(10, 3, { slotId: 15 }),
    favorite(11, 2),
    favorite(12, 5, { specId: 103 }),
    favorite(10, 2, { sourceId: 250 }),
  ], { voidcore: { checked: true, usedItems: [11] } })

  const page = buildKeystoneLootObjectivePage(snapshot, { limit: 50 })
  assert.equal(page.status, 'available')
  assert.deepEqual(page.objectives, [
    {
      itemId: 10, itemName: null, iconUrl: null, tier: 3, specId: 102,
      sourceType: 'dungeon', sourceId: 249, slotId: 15,
      slotName: null, itemClassName: null, itemSubClassName: null, statNames: [],
      voidcoreState: 'pending',
    },
    {
      itemId: 11, itemName: null, iconUrl: null, tier: 2, specId: 102,
      sourceType: 'dungeon', sourceId: 249, slotId: 13,
      slotName: null, itemClassName: null, itemSubClassName: null, statNames: [],
      voidcoreState: 'completed_with_voidcore',
    },
    {
      itemId: 10, itemName: null, iconUrl: null, tier: 2, specId: 102,
      sourceType: 'dungeon', sourceId: 250, slotId: 13,
      slotName: null, itemClassName: null, itemSubClassName: null, statNames: [],
      voidcoreState: 'pending',
    },
    {
      itemId: 12, itemName: null, iconUrl: null, tier: 5, specId: 103,
      sourceType: 'dungeon', sourceId: 249, slotId: 13,
      slotName: null, itemClassName: null, itemSubClassName: null, statNames: [],
      voidcoreState: 'pending',
    },
  ])
  assert.equal(JSON.stringify(page).includes('bonusIds'), false)
  assert.equal(JSON.stringify(page).includes('future'), false)
})

test('unchecked Voidcore is never presented as pending', () => {
  const page = buildKeystoneLootObjectivePage(supported([favorite(10, 3)], {
    voidcore: { checked: false, usedItems: [10] },
  }), { limit: 50 })
  assert.equal(page.objectives[0].voidcoreState, 'voidcore_not_checked')
})

test('filters preserve the dungeon namespace guard and cursors are filter-bound', () => {
  const snapshot = supported([
    favorite(1, 3),
    favorite(5, 2),
    favorite(2, 3, { sourceType: 'raid', sourceId: 249 }),
    favorite(3, 3, { sourceId: 250 }),
    favorite(4, 3, { specId: 103 }),
  ])
  const first = buildKeystoneLootObjectivePage(snapshot, {
    challengeMapId: 249, specId: 102, limit: 1,
  })
  assert.deepEqual(first.objectives.map(item => item.itemId), [1])
  assert.equal(typeof first.nextCursor, 'string')
  assert.throws(() => buildKeystoneLootObjectivePage(snapshot, {
    challengeMapId: 250, specId: 102, limit: 1, cursor: first.nextCursor,
  }), /cursor/i)
})

test('pagination is stable and a 2,000-favorite snapshot exposes only the requested page', () => {
  const snapshot = supported(Array.from({ length: 2000 }, (_, index) => favorite(index + 1, 3)))
  const first = buildKeystoneLootObjectivePage(snapshot, { limit: 50 })
  assert.equal(first.objectives.length, 50)
  assert.deepEqual(first.objectives.slice(0, 3).map(item => item.itemId), [1, 2, 3])
  const second = buildKeystoneLootObjectivePage(snapshot, { limit: 50, cursor: first.nextCursor })
  assert.deepEqual(second.objectives.slice(0, 3).map(item => item.itemId), [51, 52, 53])
})
