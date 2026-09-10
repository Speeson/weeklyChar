import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_PLANNER_OPTIONS,
  PLANNER_DIAGNOSTIC_LABELS,
  PLANNER_REASON_LABELS,
  buildKeystonePlannerRequest,
  buildPlannerPreferencesPayload,
  capabilityAvailabilityLabel,
  createPlannerRequestIdentity,
  damageProfileLabel,
  defaultParticipantIds,
  isPlannerRequestCurrent,
  locksForParticipants,
  parseKeystonePlannerResponse,
  parsePlannerCharacters,
  parsePlannerPreferencesResponse,
  plannerPreferenceRows,
  togglePlannerParticipant,
  type KeystonePlannerResponse,
} from './keystonePlanner.ts'

const response: KeystonePlannerResponse = {
  teamId: 7,
  challengeMapId: null,
  targetLevel: 10,
  availability: { eligibleStoneCount: 1 },
  status: 'ok',
  diagnostics: { codes: [], unconfiguredUserIds: [], lockIssues: [] },
  recommendations: [{
    rank: 1,
    fingerprint: 'stone:10:62',
    stone: { characterId: 10, characterName: 'Arcana', ownerUserId: 1, ownerUsername: 'Speeson', challengeMapId: 399, dungeon: 'Ruby Life Pools', level: 11 },
    assignments: [{
      userId: 1, username: 'Speeson', characterId: 10, characterName: 'Arcana', wowClass: 'Mage',
      specId: 62, role: 'dps', lootSpecId: 64, playPreference: 'preferred', objectives: [{
        itemId: 123, itemName: 'Objeto', iconUrl: 'https://example.com/item.jpg', tier: 3,
        variantKey: '123:mythic', voidcoreState: 'pending',
      }], capabilities: [{
        capabilityId: 'BLOODLUST', name: 'Bloodlust', type: 'major_utility', iconSpellId: 80353,
        stacking: 'unique', mode: 'guaranteed', condition: null,
      }],
    }],
    vacancies: [{ role: 'tank', preferredCapabilities: ['BATTLE_REZ'] }],
    lootSummary: { weightedScore: 10, playersWithObjectives: 1, totalObjectives: 1, tierCounts: { bestInSlot: 1, mustHave: 0, niceToHave: 0, catalyst: 0, transmog: 0 } },
    levelSummary: { targetLevel: 10, stoneLevel: 11, levelDistance: 1 },
    preferenceSummary: { preferred: 1, available: 0, emergency: 0 },
    compositionSummary: {
      bloodlust: 'guaranteed', battleRez: 'none', damageProfile: 'magical', magicalDpsCount: 1,
      physicalDpsCount: 0, unknownDpsCount: 0, chaosBrandBeneficiaries: 1, mysticTouchBeneficiaries: 0,
      uniqueClassBuffCount: 1, uniqueCapabilities: [{
        capabilityId: 'BLOODLUST', name: 'Bloodlust', type: 'major_utility', iconSpellId: 80353,
        stacking: 'unique', availability: 'guaranteed',
      }],
    },
    reasonCodes: ['PARTY_INCOMPLETE', 'HAS_LOOT_OBJECTIVES', 'TARGET_LEVEL_NEARBY', 'BLOODLUST_GUARANTEED', 'BATTLE_REZ_MISSING'],
  }],
}

test('defensively parses the exact planner result and rejects unknown enums or stale scope', () => {
  assert.deepEqual(parseKeystonePlannerResponse(response, 7, null), response)
  assert.equal(parseKeystonePlannerResponse(response, 8, null), null)
  assert.equal(parseKeystonePlannerResponse({ ...response, diagnostics: { ...response.diagnostics, codes: ['FUTURE_CODE'] } }, 7, null), null)
  const malformed = structuredClone(response) as unknown as KeystonePlannerResponse
  malformed.recommendations[0].reasonCodes = ['UNKNOWN' as never]
  assert.equal(parseKeystonePlannerResponse(malformed, 7, null), null)
})

test('builders copy requests and produce full replacement preference payloads', () => {
  const request = buildKeystonePlannerRequest({
    participantUserIds: [1, 2], targetLevel: 10, challengeMapId: 399,
    options: { ...DEFAULT_PLANNER_OPTIONS }, locks: [{ type: 'role', userId: 2, role: 'healer' }],
  })
  assert.deepEqual(request, {
    participantUserIds: [1, 2], targetLevel: 10, challengeMapId: 399,
    options: DEFAULT_PLANNER_OPTIONS, locks: [{ type: 'role', userId: 2, role: 'healer' }],
  })
  assert.deepEqual(buildPlannerPreferencesPayload([{ characterId: 10, specId: 62, playPreference: 'disabled', lootSpecId: 62 }]), {
    preferences: [{ characterId: 10, specId: 62, playPreference: 'disabled', lootSpecId: 62 }],
  })
})

test('preference rows default every known spec to disabled without inferring a playable spec', () => {
  const rows = plannerPreferenceRows([{ id: 10, name: 'Arcana', realm: 'Dun Modr', wowClass: 'Mage' }], [])
  assert.equal(rows.length, 3)
  assert.ok(rows.every(row => row.playPreference === 'disabled' && row.lootSpecId === row.specId))
  const saved = parsePlannerPreferencesResponse({ preferences: [{
    characterId: 10, specId: 62, role: 'dps', playPreference: 'preferred', lootSpecId: 64, updatedAt: '2026-09-10 10:00:00',
  }] })
  assert.ok(saved)
  assert.equal(plannerPreferenceRows([{ id: 10, name: 'Arcana', realm: 'Dun Modr', wowClass: 'Mage' }], saved!)[0].lootSpecId, 64)
  assert.deepEqual(plannerPreferenceRows([{ id: 10, name: 'Arcana', realm: 'Dun Modr', wowClass: null }], saved!), [{
    characterId: 10, specId: 62, playPreference: 'preferred', lootSpecId: 64,
  }])
})

test('character parser rejects missing class while accepting an explicit null class', () => {
  assert.deepEqual(parsePlannerCharacters([{ id: 10, name: 'Arcana', realm: 'Dun Modr', wowClass: null }]), [{ id: 10, name: 'Arcana', realm: 'Dun Modr', wowClass: null }])
  assert.equal(parsePlannerCharacters([{ id: 10, name: 'Arcana', realm: 'Dun Modr' }]), null)
})

test('participant defaults, five-member limit, lock cleanup and request identities are deterministic', () => {
  assert.deepEqual(defaultParticipantIds(2, [{ userId: 1 }, { userId: 2 }]), [2])
  assert.deepEqual(togglePlannerParticipant([1, 2, 3, 4, 5], 6), [1, 2, 3, 4, 5])
  assert.deepEqual(togglePlannerParticipant([1, 2], 2), [1])
  assert.deepEqual(locksForParticipants([
    { type: 'role', userId: 1, role: 'tank' },
    { type: 'character', userId: 2, characterId: 20 },
  ], [1]), [{ type: 'role', userId: 1, role: 'tank' }])
  const first = createPlannerRequestIdentity(7, null, 1)
  assert.equal(isPlannerRequestCurrent(first, createPlannerRequestIdentity(7, null, 1)), true)
  assert.equal(isPlannerRequestCurrent(first, createPlannerRequestIdentity(7, 399, 1)), false)
  assert.equal(isPlannerRequestCurrent(first, createPlannerRequestIdentity(7, null, 2)), false)
})

test('presentation maps exhaustively cover the fixed public enums', () => {
  assert.equal(Object.keys(PLANNER_REASON_LABELS).length, 11)
  assert.equal(Object.keys(PLANNER_DIAGNOSTIC_LABELS).length, 7)
  assert.deepEqual(['guaranteed', 'conditional', 'none'].map(capabilityAvailabilityLabel), ['Garantizado', 'Condicional', 'No disponible'])
  assert.deepEqual(['magical', 'physical', 'mixed', 'unknown'].map(value => damageProfileLabel(value as 'magical' | 'physical' | 'mixed' | 'unknown')), [
    'Daño predominantemente mágico', 'Daño predominantemente físico', 'Daño mixto', 'Perfil de daño sin determinar',
  ])
})
