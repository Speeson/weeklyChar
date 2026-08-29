import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildTeamObjectivesPath,
  createTeamObjectiveRequestIdentity,
  isTeamObjectiveRequestCurrent,
  mergeTeamObjectivePages,
  parseTeamObjectivesResponse,
  teamObjectiveStatusMessage,
  teamObjectiveRequestErrorMessage,
  type TeamObjectivesResponse,
} from './keystoneLootObjectives.ts'

const objective = {
  itemId: 12345,
  itemName: null,
  iconUrl: null,
  tier: 99,
  specId: 66,
  sourceType: 'dungeon',
  sourceId: 250,
  slotId: null,
  slotName: null,
  itemClassName: null,
  itemSubClassName: null,
  statNames: [],
  voidcoreState: 'voidcore_not_checked',
}

test('team parser accepts available and every exact privacy/product status', () => {
  const available = parseTeamObjectivesResponse({
    status: 'available',
    updatedAt: 1_800_000_000,
    objectives: [{ ...objective, future: true, bonusIds: [1], gems: [2], enchant: 3 }],
    nextCursor: 'opaque',
    keystoneLoot: { favorites: [], characterKey: 'forbidden', usedItems: [12345] },
  })
  assert.deepEqual(available, {
    status: 'available', updatedAt: 1_800_000_000, objectives: [objective], nextCursor: 'opaque',
  })

  for (const status of ['sharing_disabled', 'no_keystoneloot', 'unsupported', 'no_targets'] as const) {
    assert.deepEqual(parseTeamObjectivesResponse({ status, future: true }), { status })
  }
})

test('team parser rejects malformed envelopes, DTO fields, timestamps and cursors', () => {
  const valid = { status: 'available', updatedAt: 1_800_000_000, objectives: [objective], nextCursor: null }
  const invalid = [
    null,
    { status: 'invented' },
    { ...valid, updatedAt: -1 },
    { ...valid, nextCursor: 42 },
    { ...valid, objectives: [{ ...objective, itemId: 0 }] },
    { ...valid, objectives: [{ ...objective, itemName: 42 }] },
    { ...valid, objectives: [{ ...objective, iconUrl: 'http://unsafe.test/icon.jpg' }] },
    { ...valid, objectives: [{ ...objective, tier: 0 }] },
    { ...valid, objectives: [{ ...objective, specId: 0 }] },
    { ...valid, objectives: [{ ...objective, sourceType: '' }] },
    { ...valid, objectives: [{ ...objective, sourceId: 0 }] },
    { ...valid, objectives: [{ ...objective, slotId: '13' }] },
    { ...valid, objectives: [{ ...objective, itemClassName: 4 }] },
    { ...valid, objectives: [{ ...objective, statNames: ['x'.repeat(129)] }] },
    { ...valid, objectives: [{ ...objective, statNames: [819] }] },
    { ...valid, objectives: [{ ...objective, voidcoreState: 'maybe' }] },
    { status: 'available', updatedAt: 1, nextCursor: null },
    { status: 'sharing_disabled', objectives: [] },
  ]
  for (const value of invalid) assert.equal(parseTeamObjectivesResponse(value), null)
})

test('team paths use challengeMapId and specId with bounded pagination', () => {
  assert.equal(buildTeamObjectivesPath(7, 11, { dungeonId: null, specId: null }),
    '/api/teams/7/characters/11/keystone-loot/objectives?limit=50')
  assert.equal(buildTeamObjectivesPath(7, 11, { dungeonId: 250, specId: 66, cursor: 'a+/=' }),
    '/api/teams/7/characters/11/keystone-loot/objectives?limit=50&challengeMapId=250&specId=66&cursor=a%2B%2F%3D')
})

test('team request identity rejects late stones, members, filters and pages', () => {
  const first = createTeamObjectiveRequestIdentity(7, 11, 250, 66, null, 1)
  assert.equal(isTeamObjectiveRequestCurrent(first, first), true)
  assert.equal(isTeamObjectiveRequestCurrent(first,
    createTeamObjectiveRequestIdentity(7, 12, 250, 66, null, 2)), false)
  assert.equal(isTeamObjectiveRequestCurrent(first,
    createTeamObjectiveRequestIdentity(7, 11, 249, 66, null, 3)), false)
  assert.equal(isTeamObjectiveRequestCurrent(first,
    createTeamObjectiveRequestIdentity(7, 11, 250, 65, 'next', 4)), false)
})

test('team page merge appends only available pages and product copy is explicit', () => {
  const first = { status: 'available', updatedAt: 1, objectives: [objective], nextCursor: 'next' } as TeamObjectivesResponse
  const second = { status: 'available', updatedAt: 1, objectives: [{ ...objective, itemId: 2 }], nextCursor: null } as TeamObjectivesResponse
  const merged = mergeTeamObjectivePages(first, second, true)
  assert.equal(merged.status, 'available')
  if (merged.status === 'available') {
    assert.deepEqual(merged.objectives.map(item => item.itemId), [12345, 2])
  }
  assert.equal(teamObjectiveStatusMessage('sharing_disabled'), 'Este miembro no comparte sus objetivos de KeystoneLoot con el equipo.')
  assert.equal(teamObjectiveStatusMessage('no_keystoneloot'), 'No hay datos de KeystoneLoot disponibles para este personaje.')
  assert.equal(teamObjectiveStatusMessage('unsupported'), 'La versión de KeystoneLoot de este personaje no es compatible.')
  assert.equal(teamObjectiveStatusMessage('no_targets'), 'No hay objetivos para esta mazmorra y especialización.')
  assert.equal(teamObjectiveRequestErrorMessage(new TypeError('Failed to fetch')), 'No se pudieron cargar los objetivos.')
  assert.equal(teamObjectiveRequestErrorMessage(new Error('Ya no tienes acceso.')), 'Ya no tienes acceso.')
})
