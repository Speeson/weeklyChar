import assert from 'node:assert/strict'
import test from 'node:test'

import {
  parsePlannerPreferencePayload,
  validatePlannerPreferenceDomain,
} from '../.tmp-test/plannerPreferences.js'

test('new preference document separates played specs from character loot priorities', () => {
  const parsed = parsePlannerPreferencePayload({
    preferences: [
      { characterId: 10, specId: 66, playPreference: 'preferred' },
      { characterId: 10, specId: 70, playPreference: 'available' },
    ],
    lootPreferences: [{ characterId: 10, primaryLootSpecId: 70, secondaryLootSpecIds: [66] }],
    onboardingCompleted: true,
  })

  assert.equal(parsed.legacy, false)
  assert.equal(parsed.onboardingCompleted, true)
  assert.deepEqual(parsed.lootPreferences, [
    { characterId: 10, primaryLootSpecId: 70, secondaryLootSpecIds: [66] },
  ])
  assert.deepEqual(parsed.preferences.map(row => ({
    characterId: row.characterId,
    specId: row.specId,
    playPreference: row.playPreference,
  })), [
    { characterId: 10, specId: 66, playPreference: 'preferred' },
    { characterId: 10, specId: 70, playPreference: 'available' },
  ])

  assert.doesNotThrow(() => validatePlannerPreferenceDomain(parsed, [
    { id: 10, wow_class: 'Paladin' },
  ]))
})

test('legacy per-played-spec loot choices convert deterministically to primary and secondary', () => {
  const parsed = parsePlannerPreferencePayload({ preferences: [
    { characterId: 10, specId: 66, playPreference: 'available', lootSpecId: 66 },
    { characterId: 10, specId: 70, playPreference: 'preferred', lootSpecId: 70 },
  ] })

  assert.equal(parsed.legacy, true)
  assert.equal(parsed.onboardingCompleted, undefined)
  assert.deepEqual(parsed.lootPreferences, [
    { characterId: 10, primaryLootSpecId: 70, secondaryLootSpecIds: [66] },
  ])
})

test('active characters require one valid primary and loot specs stay inside their class', () => {
  const characters = [{ id: 10, wow_class: 'Paladin' }]
  const noLoot = parsePlannerPreferencePayload({
    preferences: [{ characterId: 10, specId: 66, playPreference: 'preferred' }],
    lootPreferences: [],
  })
  assert.throws(() => validatePlannerPreferenceDomain(noLoot, characters), /botin principal/u)

  assert.throws(() => parsePlannerPreferencePayload({
    preferences: [{ characterId: 10, specId: 66, playPreference: 'preferred' }],
    lootPreferences: [{ characterId: 10, primaryLootSpecId: 66, secondaryLootSpecIds: [66] }],
  }), /principal y secundaria/u)

  const wrongClass = parsePlannerPreferencePayload({
    preferences: [{ characterId: 10, specId: 66, playPreference: 'preferred' }],
    lootPreferences: [{ characterId: 10, primaryLootSpecId: 62, secondaryLootSpecIds: [] }],
  })
  assert.throws(() => validatePlannerPreferenceDomain(wrongClass, characters), /loot spec/u)
})
