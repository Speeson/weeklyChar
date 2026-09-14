import assert from 'node:assert/strict'
import test from 'node:test'

import {
  OFFENSIVE_PROVIDER_BY_CLASS,
  PLANNER_RANKING_DATA_VERSION,
  dungeonRelevance,
  offensiveProfileForSpec,
  utilityEntriesForSpec,
} from '../.tmp-test/plannerRankingData.js'

test('production ranking data is versioned and excludes Hunters Mark from its six offensive providers', () => {
  assert.equal(PLANNER_RANKING_DATA_VERSION, 'midnight-s2-v1')
  assert.deepEqual([...OFFENSIVE_PROVIDER_BY_CLASS.entries()], [
    ['Druid', 'MARK_OF_THE_WILD'],
    ['Warrior', 'BATTLE_SHOUT'],
    ['Mage', 'ARCANE_INTELLECT'],
    ['Shaman', 'SKYFURY'],
    ['Demon Hunter', 'CHAOS_BRAND'],
    ['Monk', 'MYSTIC_TOUCH'],
  ])
  assert.equal([...OFFENSIVE_PROVIDER_BY_CLASS.values()].includes('HUNTERS_MARK'), false)
})

test('SimC profiles preserve exact evidence while production gains clamp negative noise to zero', () => {
  const frostDeathKnight = offensiveProfileForSpec(251)
  assert.deepEqual(frostDeathKnight?.provenance, {
    source: 'simc', confidence: 'high', method: 'exact_profile',
  })
  assert.equal(frostDeathKnight?.gains.ARCANE_INTELLECT, 0)
  assert.equal(frostDeathKnight?.gains.BATTLE_SHOUT, 0.04768821014595473)
  assert.equal(frostDeathKnight?.gains.CHAOS_BRAND, 0.027817898814354258)
})

test('missing SimC specs use deterministic archetype medians with honest provenance', () => {
  const feral = offensiveProfileForSpec(103)?.provenance
  assert.equal(feral?.source, 'archetype_estimate')
  assert.equal(feral?.confidence, 'medium')
  assert.equal(feral?.method, 'per_buff_archetype_median')
  assert.deepEqual(feral?.donorSpecIds, [70, 71, 72, 251, 252, 255, 259, 260, 261, 263, 269, 577])
  assert.equal(offensiveProfileForSpec(102)?.provenance.confidence, 'medium')
  assert.equal(offensiveProfileForSpec(1467)?.provenance.confidence, 'medium')
  assert.equal(offensiveProfileForSpec(1473)?.provenance.confidence, 'low')
  assert.deepEqual(offensiveProfileForSpec(102)?.gains, offensiveProfileForSpec(1467)?.gains)
})

test('utility projection preserves exact-spec access and central availability factors', () => {
  const vengeance = utilityEntriesForSpec(581)
  const havoc = utilityEntriesForSpec(577)
  assert.equal(vengeance.some(entry => entry.abilityName === "Sigil of Chains"
    && entry.spellId === 202138 && entry.availabilityFactor === 1), true)
  assert.equal(havoc.some(entry => entry.abilityName === "Sigil of Chains"), false)
  assert.equal(havoc.some(entry => entry.abilityName === 'Darkness' && entry.availabilityFactor === 0.5), true)
  assert.equal(havoc.some(entry => ['Blur', 'Netherwalk'].includes(entry.abilityName)), false)
})

test('dungeon relevance exposes selected-dungeon zero and full values without deleting capabilities', () => {
  assert.equal(dungeonRelevance(584, 'PURGE_MAGIC'), 0)
  assert.equal(dungeonRelevance(586, 'PURGE_MAGIC'), 3)
  assert.equal(dungeonRelevance(399, 'INTERRUPT'), 3)
  assert.equal(dungeonRelevance(999, 'INTERRUPT'), 0)
})
