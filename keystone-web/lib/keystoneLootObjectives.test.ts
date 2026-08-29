import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildOwnerObjectivesPath,
  characterObjectiveTitle,
  createObjectiveRequestIdentity,
  formatObjectiveFreshness,
  isObjectiveRequestCurrent,
  mergeObjectivePages,
  objectiveItemName,
  objectiveSourceLabel,
  ownerObjectiveStatusMessage,
  parseOwnerObjectivesResponse,
  tierPresentation,
  voidcorePresentation,
  type OwnerObjectivesResponse,
} from './keystoneLootObjectives.ts'
import { DUNGEON_NAME_BY_ID } from './season2.ts'

const objective = {
  itemId: 12345,
  itemName: 'Guardia de prueba',
  iconUrl: 'https://render.worldofwarcraft.com/eu/icons/12345.jpg',
  tier: 3,
  specId: 102,
  sourceType: 'dungeon',
  sourceId: 249,
  slotId: 13,
  voidcoreState: 'pending',
} as const

const snapshot = {
  updatedAt: 1_800_000_000,
  addonVersion: '2.13.1',
  apiVersion: 2 as const,
  voidcoreChecked: true,
}

function available(overrides: Record<string, unknown> = {}) {
  return {
    status: 'available', snapshot, objectives: [objective], nextCursor: 'next-page', ...overrides,
  }
}

test('runtime parser accepts available, empty and every explicit owner status', () => {
  const parsed = parseOwnerObjectivesResponse(available())
  assert.deepEqual(parsed, available())

  assert.equal(parseOwnerObjectivesResponse({
    status: 'empty', snapshot, objectives: [], nextCursor: null,
  })?.status, 'empty')

  for (const status of ['not_installed', 'not_ready', 'unsupported', 'unavailable'] as const) {
    assert.equal(parseOwnerObjectivesResponse({
      status, snapshot: null, objectives: [], nextCursor: null, future: 'ignored',
    })?.status, status)
  }
})

test('runtime parser fails closed for malformed DTOs and responses', () => {
  const invalid = [
    null,
    { ...available(), status: 'invented' },
    { ...available(), objectives: [{ ...objective, itemId: 0 }] },
    { ...available(), objectives: [{ ...objective, tier: 0 }] },
    { ...available(), objectives: [{ ...objective, specId: -1 }] },
    { ...available(), objectives: [{ ...objective, voidcoreState: 'maybe' }] },
    { ...available(), objectives: [{ ...objective, sourceType: '' }] },
    { ...available(), objectives: [{ ...objective, itemName: 123 }] },
    { ...available(), objectives: [{ ...objective, slotId: '13' }] },
    { ...available(), nextCursor: 123 },
    { ...available(), snapshot: { ...snapshot, apiVersion: 3 } },
    { status: 'available', snapshot, nextCursor: null },
    { status: 'empty', snapshot: null, objectives: [], nextCursor: null },
  ]
  for (const value of invalid) assert.equal(parseOwnerObjectivesResponse(value), null)
})

test('presentation helpers cover tier, source, item and Voidcore fallbacks', () => {
  assert.equal(tierPresentation(1).label, 'Nice to have')
  assert.equal(tierPresentation(2).label, 'Must have')
  assert.equal(tierPresentation(3).label, 'Best in Slot')
  assert.equal(tierPresentation(4).label, 'Transmog')
  assert.equal(tierPresentation(5).label, 'Catalyst')
  assert.equal(tierPresentation(99).label, 'Prioridad 99')
  assert.equal(objectiveItemName({ ...objective, itemName: null }), 'Objeto #12345')
  assert.equal(objectiveSourceLabel(objective, DUNGEON_NAME_BY_ID), "Kings' Rest")
  assert.equal(objectiveSourceLabel({ ...objective, sourceId: 999 }), 'Mazmorra 999')
  assert.equal(objectiveSourceLabel({ ...objective, sourceType: 'raid', sourceId: 249 }), 'Banda · fuente 249')
  assert.equal(objectiveSourceLabel({ ...objective, sourceType: 'catalyst' }), 'Catalyst')
  assert.equal(objectiveSourceLabel({ ...objective, sourceType: 'custom' }), 'Personalizado')
  assert.equal(objectiveSourceLabel({ ...objective, sourceType: 'future', sourceId: 'abc' }), 'future · abc')

  assert.equal(voidcorePresentation('pending').label, 'Pendiente')
  assert.equal(voidcorePresentation('completed_with_voidcore').label, 'Completado con Voidcore')
  assert.equal(voidcorePresentation('voidcore_not_checked').label, 'Estado de Voidcore sin verificar')
})

test('freshness is relative, exact and warns only beyond 24 hours', () => {
  const recent = formatObjectiveFreshness(1_800_000_000, 1_800_003_600)
  assert.equal(recent.relative, 'Actualizado hace 1 h')
  assert.equal(recent.stale, false)
  assert.match(recent.exact, /\d/u)

  const boundary = formatObjectiveFreshness(1_800_000_000, 1_800_086_400)
  assert.equal(boundary.stale, false)
  const stale = formatObjectiveFreshness(1_800_000_000, 1_800_086_401)
  assert.equal(stale.stale, true)
  assert.equal(stale.warning, 'Puede estar desactualizado')
})

test('request paths are exact, server-filtered and cursor-safe', () => {
  assert.equal(buildOwnerObjectivesPath(10, { dungeonId: null, specId: null }),
    '/api/me/characters/10/keystone-loot/objectives?limit=50')
  assert.equal(buildOwnerObjectivesPath(10, { dungeonId: 249, specId: 102, cursor: 'a+/=' }),
    '/api/me/characters/10/keystone-loot/objectives?limit=50&sourceType=dungeon&sourceId=249&specId=102&cursor=a%2B%2F%3D')
})

test('pagination appends while a filter reset replaces prior objectives', () => {
  const first = available({ nextCursor: 'next' }) as OwnerObjectivesResponse
  const second = available({
    objectives: [{ ...objective, itemId: 67890 }], nextCursor: null,
  }) as OwnerObjectivesResponse
  assert.deepEqual(mergeObjectivePages(first, second, true).objectives.map(item => item.itemId), [12345, 67890])
  assert.deepEqual(mergeObjectivePages(first, second, false).objectives.map(item => item.itemId), [67890])
})

test('request identities reject late character and filter responses', () => {
  const characterA = createObjectiveRequestIdentity(10, null, null, null, 1)
  const characterB = createObjectiveRequestIdentity(20, null, null, null, 2)
  assert.equal(isObjectiveRequestCurrent(characterA, characterB), false)

  const dungeonX = createObjectiveRequestIdentity(20, 249, 102, null, 3)
  const dungeonY = createObjectiveRequestIdentity(20, 250, 102, null, 4)
  assert.equal(isObjectiveRequestCurrent(dungeonX, dungeonY), false)
  assert.equal(isObjectiveRequestCurrent(dungeonY, dungeonY), true)
})

test('status and character copy remain explicit and disambiguated', () => {
  assert.equal(characterObjectiveTitle({ name: 'Makabe', realm: "Zul'jin" }), "Makabe — Zul'jin")
  assert.equal(characterObjectiveTitle({ name: 'Makabe', realm: 'Dun Modr' }), 'Makabe — Dun Modr')
  assert.equal(ownerObjectiveStatusMessage('empty'), 'No hay objetivos de KeystoneLoot para estos filtros.')
  assert.equal(ownerObjectiveStatusMessage('not_installed'), 'KeystoneLoot no está instalado para este personaje.')
  assert.equal(ownerObjectiveStatusMessage('not_ready'), 'KeystoneLoot todavía no ha generado sus objetivos para este personaje.')
  assert.equal(ownerObjectiveStatusMessage('unsupported'), 'La versión instalada de KeystoneLoot no es compatible.')
  assert.equal(ownerObjectiveStatusMessage('unavailable'), 'No hay datos de KeystoneLoot disponibles para este personaje.')
})
