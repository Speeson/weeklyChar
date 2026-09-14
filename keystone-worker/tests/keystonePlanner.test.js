import assert from 'node:assert/strict'
import test from 'node:test'

import { solveKeystonePlanner } from '../.tmp-test/keystonePlanner.js'
import { keystoneLootTierWeight } from '../.tmp-test/keystoneRecommendations.js'

const off = {
  optimizeComposition: false,
  bloodlust: false,
  battleRez: false,
  classBuffs: false,
  damageSynergy: false,
}

const quick = {
  optimizeComposition: true,
  recommendationMode: 'quick',
  bloodlust: true,
  battleRez: true,
  offensiveSynergy: true,
  groupDefense: false,
  dungeonUtility: false,
}

const advanced = {
  ...quick,
  recommendationMode: 'advanced',
  groupDefense: true,
  dungeonUtility: true,
}

function objective(itemId, tier, overrides = {}) {
  return {
    itemId,
    tier,
    specId: 62,
    sourceType: 'dungeon',
    sourceId: 100,
    variantKey: 'base',
    voidcoreState: 'pending',
    ...overrides,
  }
}

function candidate(userId, specId, overrides = {}) {
  return {
    userId,
    username: `user-${userId}`,
    characterId: userId * 10,
    characterName: `character-${userId}`,
    specId,
    lootSpecId: specId,
    playPreference: 'available',
    objectives: [],
    ...overrides,
  }
}

function stone(overrides = {}) {
  return {
    characterId: 10,
    characterName: 'character-1',
    ownerUserId: 1,
    ownerUsername: 'user-1',
    challengeMapId: 100,
    dungeon: 'Alpha',
    level: 10,
    ...overrides,
  }
}

function input(candidates, overrides = {}) {
  return {
    participantUserIds: [...new Set(candidates.map(entry => entry.userId))],
    targetLevel: 10,
    options: off,
    candidates,
    stones: [stone()],
    locks: [],
    ...overrides,
  }
}

function completeParty(overrides = []) {
  const candidates = [
    candidate(1, 104),
    candidate(2, 105),
    candidate(3, 260),
    candidate(4, 258),
    candidate(5, 62),
  ]
  for (const replacement of overrides) candidates[replacement.index] = replacement.value
  return candidates
}

function first(result) {
  assert.equal(result.status, 'ok')
  return result.recommendations[0]
}

test('five players produce exactly 1 tank, 1 healer and 3 dps', () => {
  const recommendation = first(solveKeystonePlanner(input(completeParty())))
  assert.deepEqual(recommendation.assignments.map(entry => entry.role).sort(), ['dps', 'dps', 'dps', 'healer', 'tank'])
  assert.deepEqual(recommendation.vacancies, [])
})

test('two, three and four players receive the exact vacancies to reach 1/1/3', () => {
  const cases = [
    [[candidate(1, 104), candidate(2, 105)], ['dps', 'dps', 'dps']],
    [[candidate(1, 104), candidate(2, 105), candidate(3, 260)], ['dps', 'dps']],
    [[candidate(1, 104), candidate(2, 260), candidate(3, 258), candidate(4, 62)], ['healer']],
  ]
  for (const [candidates, vacancies] of cases) {
    assert.deepEqual(first(solveKeystonePlanner(input(candidates))).vacancies.map(entry => entry.role), vacancies)
  }
})

test('role overflow and mathematically impossible compositions return no valid composition', () => {
  const twoTanks = solveKeystonePlanner(input([candidate(1, 104), candidate(2, 66), candidate(3, 260)]))
  assert.equal(twoTanks.status, 'no_valid_composition')
  assert.deepEqual(twoTanks.diagnostics.codes, ['NO_VALID_COMPOSITION'])

  const fourDps = solveKeystonePlanner(input([
    candidate(1, 104), candidate(2, 260), candidate(3, 258), candidate(4, 62), candidate(5, 71),
  ]))
  assert.equal(fourDps.status, 'no_valid_composition')

  const noTank = solveKeystonePlanner(input([
    candidate(1, 105), candidate(2, 270), candidate(3, 260), candidate(4, 258), candidate(5, 62),
  ]))
  assert.equal(noTank.status, 'no_valid_composition')
})

test('disabled is never used and an otherwise unconfigured participant is explicit', () => {
  const result = solveKeystonePlanner(input([
    candidate(1, 104, { playPreference: 'disabled' }), candidate(2, 105),
  ]))
  assert.equal(result.status, 'unconfigured_participants')
  assert.deepEqual(result.diagnostics.unconfiguredUserIds, [1])
})

test('preferred beats available and available beats emergency at equal higher criteria', () => {
  const base = [candidate(1, 104), candidate(2, 105)]
  const preferred = first(solveKeystonePlanner(input([
    ...base,
    candidate(3, 260, { playPreference: 'available' }),
    candidate(3, 261, { playPreference: 'preferred' }),
  ], { participantUserIds: [1, 2, 3] })))
  assert.equal(preferred.assignments.find(entry => entry.userId === 3).specId, 261)

  const available = first(solveKeystonePlanner(input([
    ...base,
    candidate(3, 260, { playPreference: 'emergency' }),
    candidate(3, 261, { playPreference: 'available' }),
  ], { participantUserIds: [1, 2, 3] })))
  assert.equal(available.assignments.find(entry => entry.userId === 3).specId, 261)
})

test('modern Quick returns jointly ranked classes while Advanced returns exact specs', () => {
  const candidates = [candidate(1, 104), candidate(2, 105), candidate(3, 251)]
  const quickResult = solveKeystonePlanner(input(candidates, {
    options: quick,
    stones: [stone({ challengeMapId: 586 })],
  }))
  assert.equal(quickResult.status, 'ok')
  assert.equal(quickResult.recommendations.length, 5)
  assert.equal(quickResult.recommendations.every(recommendation => recommendation.vacancies.every(vacancy =>
    vacancy.recommendationMode === 'quick' && vacancy.recommendedClass && vacancy.recommendedSpecId === undefined)), true)
  for (const recommendation of quickResult.recommendations) {
    for (const vacancy of recommendation.vacancies) {
      assert.ok(vacancy.recommendations.length > 0)
      assert.equal(vacancy.recommendations[0].wowClass, vacancy.recommendedClass)
      for (const alternative of vacancy.recommendations) {
        assert.equal(alternative.specId, undefined)
        assert.equal(typeof alternative.id, 'string')
        assert.equal(typeof alternative.offensiveGainPct, 'number')
        assert.ok(alternative.buffsDebuffs.every(capability => Number.isInteger(capability.spellId)))
        assert.ok(alternative.utilities.every(capability => Number.isInteger(capability.spellId)))
      }
    }
  }
  assert.equal(new Set(quickResult.recommendations.map(recommendation => recommendation.fingerprint)).size, 5)

  const advancedResult = solveKeystonePlanner(input(candidates, {
    options: advanced,
    stones: [stone({ challengeMapId: 586 })],
  }))
  assert.equal(advancedResult.status, 'ok')
  assert.equal(advancedResult.recommendations.every(recommendation => recommendation.vacancies.every(vacancy =>
    vacancy.recommendationMode === 'advanced' && Number.isInteger(vacancy.recommendedSpecId)
      && typeof vacancy.recommendedSpecName === 'string')), true)
  assert.equal(advancedResult.recommendations.every(recommendation => recommendation.vacancies.every(vacancy =>
    vacancy.recommendations[0].specId === vacancy.recommendedSpecId
      && vacancy.recommendations.every(alternative => Number.isInteger(alternative.specId)
        && typeof alternative.specName === 'string'))), true)
})

test('modern vacancy recommendations expose party essentials supplied by their selected externals', () => {
  const candidates = [candidate(1, 73), candidate(2, 257), candidate(3, 260)]
  for (const options of [quick, advanced]) {
    const recommendation = first(solveKeystonePlanner(input(candidates, {
      options,
      stones: [stone({ challengeMapId: 586 })],
    })))
    const selectedUtilityIds = new Set(recommendation.vacancies.flatMap(vacancy =>
      vacancy.recommendations[0].utilities.map(capability => capability.capabilityId)))
    assert.equal(selectedUtilityIds.has('BLOODLUST'), true)
    assert.equal(selectedUtilityIds.has('BATTLE_REZ'), true)
  }
})

test('modern optional fill can rank only selected members without external vacancies', () => {
  const candidates = [candidate(1, 104), candidate(2, 105)]
  const result = solveKeystonePlanner(input(candidates, {
    options: { ...quick, fillComposition: false },
    stones: [stone({ challengeMapId: 586 })],
  }))

  assert.equal(result.status, 'ok')
  assert.ok(result.recommendations.length > 0)
  assert.equal(result.recommendations.every(recommendation => recommendation.assignments.length === 2), true)
  assert.equal(result.recommendations.every(recommendation => recommendation.vacancies.length === 0), true)
  assert.equal(result.recommendations.every(recommendation =>
    recommendation.reasonCodes.includes('PARTY_INCOMPLETE')), true)
})

test('Quick external DPS do not collapse to zero gain when the selected party has only supports', () => {
  const result = solveKeystonePlanner(input([candidate(1, 250), candidate(2, 257)], {
    options: quick,
    stones: [stone({ challengeMapId: 586 })],
  }))

  assert.equal(result.status, 'ok')
  assert.ok(result.recommendations.length > 0)
  const vacancies = result.recommendations[0].vacancies
  assert.equal(vacancies.length, 3)
  assert.equal(vacancies.every(vacancy => vacancy.offensiveGainPct > 0), true)
  assert.equal(vacancies.every(vacancy => vacancy.recommendations.length < 13), true)
})

test('modern recommendations collapse equivalent external completions and expose only their stratum', () => {
  const result = solveKeystonePlanner(input([
    candidate(1, 66), candidate(2, 257), candidate(3, 265), candidate(4, 266),
  ], {
    options: advanced,
    stones: [stone({ challengeMapId: 588 })],
  }))

  assert.equal(result.status, 'ok')
  assert.ok(result.recommendations.length > 1)
  const firstVacancy = result.recommendations[0].vacancies[0]
  assert.deepEqual(firstVacancy.recommendations.map(alternative => alternative.specId), [62, 63, 64])
  assert.equal(firstVacancy.recommendedSpecId, 62)
  assert.equal(result.recommendations.length <= 5, true)
})

test('modern vacancy alternatives expose presentation-safe damage profiles', () => {
  const candidates = [candidate(1, 66), candidate(2, 257), candidate(3, 265), candidate(4, 266)]
  const advancedResult = first(solveKeystonePlanner(input(candidates, {
    options: { ...advanced, optimizeComposition: false },
    stones: [stone({ challengeMapId: 588 })],
  })))
  const advancedAlternatives = advancedResult.vacancies[0].recommendations
  assert.equal(advancedAlternatives.find(item => item.specId === 102)?.damageProfile, 'magical')
  assert.equal(advancedAlternatives.find(item => item.specId === 103)?.damageProfile, 'physical')
  assert.equal(advancedAlternatives.find(item => item.specId === 71)?.damageProfile, 'physical')

  const quickResult = first(solveKeystonePlanner(input(candidates, {
    options: { ...quick, optimizeComposition: false },
    stones: [stone({ challengeMapId: 588 })],
  })))
  const quickAlternatives = quickResult.vacancies[0].recommendations
  assert.equal(quickAlternatives.find(item => item.wowClass === 'Mage')?.damageProfile, 'magical')
  assert.equal(quickAlternatives.find(item => item.wowClass === 'Warrior')?.damageProfile, 'physical')
  assert.equal(quickAlternatives.find(item => item.wowClass === 'Druid')?.damageProfile, 'mixed')
})

test('Advanced recommendations expose ranked group-defense and dungeon-utility abilities', () => {
  const recommendation = first(solveKeystonePlanner(input(completeParty(), {
    options: advanced,
    stones: [stone({ challengeMapId: 588 })],
  })))

  assert.ok(recommendation.compositionSummary.groupDefensives.length > 0)
  assert.ok(recommendation.compositionSummary.dungeonUtilities.length > 4)
  for (const capability of [
    ...recommendation.compositionSummary.groupDefensives,
    ...recommendation.compositionSummary.dungeonUtilities,
  ]) {
    assert.equal(typeof capability.name, 'string')
    assert.equal(Number.isInteger(capability.spellId), true)
    assert.match(capability.tier, /^[SABC]$/u)
    assert.equal(Number.isInteger(capability.relevance), true)
    assert.equal(Number.isInteger(capability.score), true)
  }
})

test('modern incomplete-party presentation stays within a bounded solver budget', () => {
  const holder = [250, 251, 252].map(specId => candidate(1, specId, { characterId: 10 }))
  const alternatives = [105, 66, 260, 62, 253, 267, 577, 263]
  const candidates = [
    ...holder,
    ...[2, 3, 4].flatMap(userId => alternatives.map((specId, index) => candidate(userId, specId, {
      characterId: userId * 100 + index,
    }))),
  ]
  const startedAt = performance.now()
  const result = solveKeystonePlanner(input(candidates, {
    participantUserIds: [1, 2, 3, 4],
    options: advanced,
    stones: [stone({ challengeMapId: 586 })],
  }))
  const elapsedMs = performance.now() - startedAt

  assert.equal(result.status, 'ok')
  assert.equal(result.recommendations.length, 5)
  assert.equal(result.recommendations.every(recommendation => recommendation.vacancies.every(vacancy =>
    vacancy.recommendations.length > 0)), true)
  assert.ok(elapsedMs < 350, `dense modern solve took ${elapsedMs.toFixed(1)}ms`)
})

test('dense solves evaluate each candidate loot source at most once per dungeon', () => {
  let objectiveIterations = 0
  const trackedObjectives = (specId, itemId) => new Proxy([
    objective(itemId, 3, { specId }),
  ], {
    get(target, property, receiver) {
      if (property !== Symbol.iterator) return Reflect.get(target, property, receiver)
      return function iterator() {
        objectiveIterations += 1
        return target[Symbol.iterator]()
      }
    },
  })
  const holder = [250, 251, 252].map((specId, index) => candidate(1, specId, {
    characterId: 10,
    objectives: trackedObjectives(specId, 1000 + index),
  }))
  const alternatives = [105, 66, 260, 62, 253, 267, 577, 263]
  const candidates = [
    ...holder,
    ...[2, 3, 4].flatMap(userId => alternatives.map((specId, index) => candidate(userId, specId, {
      characterId: userId * 100 + index,
      objectives: trackedObjectives(specId, userId * 1000 + index),
    }))),
  ]

  const result = solveKeystonePlanner(input(candidates, {
    participantUserIds: [1, 2, 3, 4],
    options: quick,
  }))

  assert.equal(result.status, 'ok')
  assert.ok(objectiveIterations <= candidates.length,
    `candidate objective sources were scanned ${objectiveIterations} times for ${candidates.length} candidates`)
})

test('modern explanations stay neutral when composition optimization is disabled', () => {
  const result = solveKeystonePlanner(input([
    candidate(1, 104), candidate(2, 105), candidate(3, 251),
  ], { options: { ...quick, optimizeComposition: false } }))
  assert.equal(result.status, 'ok')
  assert.equal(result.recommendations.every(recommendation => recommendation.vacancies.every(vacancy =>
    vacancy.offensiveGainPct === 0
      && vacancy.offensiveBand === 0
      && vacancy.offensiveReasons.length === 0
      && vacancy.defensiveContribution.tiers.S === 0
      && vacancy.dungeonUtilityContribution.tiers.S === 0)), true)
})

test('modern equivalence bands return loot to the foreground before exact offensive gain', () => {
  const richerLoot = candidate(3, 251, { objectives: [objective(777, 1, { specId: 251, sourceId: 100 })] })
  const alternatives = [
    candidate(1, 104), candidate(2, 105),
    richerLoot,
    candidate(3, 72, { characterId: 31, characterName: 'lower-loot-warrior' }),
  ]
  const result = first(solveKeystonePlanner(input(alternatives, { options: quick })))
  assert.equal(result.assignments.find(assignment => assignment.userId === 3)?.specId, 251)
  assert.equal(result.lootSummary.weightedScore > 0, true)
})

test('available critical role beats preferred DPS when it is the only support option', () => {
  const recommendation = first(solveKeystonePlanner(input([
    candidate(1, 66, { playPreference: 'available' }),
    candidate(1, 70, { playPreference: 'preferred' }),
    candidate(2, 62, { playPreference: 'preferred' }),
  ], { participantUserIds: [1, 2] })))

  assert.equal(recommendation.assignments.find(entry => entry.userId === 1).specId, 66)
  assert.deepEqual(recommendation.vacancies.map(entry => entry.role), ['healer', 'dps', 'dps'])
})

test('loot cannot make an available played spec beat the preferred played spec', () => {
  const recommendation = first(solveKeystonePlanner(input([
    candidate(1, 66, { playPreference: 'preferred', lootSpecId: 70 }),
    candidate(1, 70, {
      playPreference: 'available', lootSpecId: 70,
      objectives: [objective(7, 3, { specId: 70 })],
    }),
    candidate(2, 62, { playPreference: 'preferred' }),
  ], { participantUserIds: [1, 2] })))

  assert.equal(recommendation.assignments.find(entry => entry.userId === 1).specId, 66)
})

test('same-armor party synergy breaks an otherwise equal tank assignment tie', () => {
  const recommendation = first(solveKeystonePlanner(input([
    candidate(1, 104, { playPreference: 'available' }),
    candidate(1, 250, { characterId: 11, playPreference: 'available' }),
    candidate(2, 260, { playPreference: 'preferred' }),
    candidate(3, 259, { playPreference: 'preferred' }),
    candidate(4, 269, { playPreference: 'preferred' }),
  ], {
    participantUserIds: [1, 2, 3, 4],
    stones: [stone({ ownerUserId: 2, characterId: 20 })],
  })))

  assert.equal(recommendation.assignments.find(entry => entry.userId === 1).specId, 104)
  assert.equal(recommendation.compositionSummary.armorSynergy.pairs, 6)
  assert.equal(recommendation.compositionSummary.armorSynergy.dominantType, 'leather')
})

test('modern loot ranking precedes the same-armor sharing heuristic', () => {
  const recommendation = first(solveKeystonePlanner(input([
    candidate(1, 104, { playPreference: 'available' }),
    candidate(1, 250, {
      characterId: 11,
      playPreference: 'available',
      objectives: [objective(778, 1, { specId: 250, sourceId: 100 })],
    }),
    candidate(2, 260, { playPreference: 'preferred' }),
    candidate(3, 259, { playPreference: 'preferred' }),
    candidate(4, 269, { playPreference: 'preferred' }),
  ], {
    participantUserIds: [1, 2, 3, 4],
    options: { ...quick, optimizeComposition: false },
    stones: [stone({ ownerUserId: 2, characterId: 20 })],
  })))

  assert.equal(recommendation.assignments.find(entry => entry.userId === 1).specId, 250)
  assert.equal(recommendation.lootSummary.weightedScore > 0, true)
})

test('emergency can save the only valid party', () => {
  const recommendation = first(solveKeystonePlanner(input([
    candidate(1, 104, { playPreference: 'emergency' }),
    candidate(1, 102, { playPreference: 'preferred' }),
    candidate(2, 105), candidate(3, 260), candidate(4, 258), candidate(5, 62),
  ], { participantUserIds: [1, 2, 3, 4, 5] })))
  assert.equal(recommendation.assignments.find(entry => entry.userId === 1).specId, 104)
  assert.equal(recommendation.preferenceSummary.emergency, 1)
})

test('one user occupies exactly one slot despite multiple characters and specs', () => {
  const recommendation = first(solveKeystonePlanner(input([
    candidate(1, 104), candidate(1, 102), candidate(1, 105, { characterId: 11 }), candidate(2, 105),
  ], { participantUserIds: [1, 2] })))
  assert.equal(recommendation.assignments.length, 2)
  assert.equal(new Set(recommendation.assignments.map(entry => entry.userId)).size, 2)
})

test('stone ownership forces the exact owner character and any configured spec on it', () => {
  const recommendation = first(solveKeystonePlanner(input([
    candidate(1, 104, { characterId: 10 }),
    candidate(1, 66, { characterId: 11, characterName: 'holder' }),
    candidate(2, 105),
  ], {
    participantUserIds: [1, 2],
    stones: [stone({ characterId: 11, characterName: 'holder' })],
  })))
  assert.equal(recommendation.assignments.find(entry => entry.userId === 1).characterId, 11)
})

test('unplayable holder character and stones owned by non-participants are discarded', () => {
  const candidates = [candidate(1, 104), candidate(2, 105)]
  assert.equal(solveKeystonePlanner(input(candidates, {
    stones: [stone({ characterId: 99 })],
  })).status, 'no_valid_composition')
  assert.equal(solveKeystonePlanner(input(candidates, {
    stones: [stone({ ownerUserId: 9, characterId: 90 })],
  })).status, 'no_valid_composition')
})

test('played spec derives role while lootSpec exclusively selects objectives', () => {
  const recommendation = first(solveKeystonePlanner(input([
    candidate(1, 104, {
      lootSpecId: 102,
      objectives: [objective(1, 3, { specId: 102 }), objective(2, 3, { specId: 104 })],
    }),
    candidate(2, 105),
  ])))
  const owner = recommendation.assignments.find(entry => entry.userId === 1)
  assert.equal(owner.role, 'tank')
  assert.equal(owner.lootSpecId, 102)
  assert.deepEqual(owner.objectives.map(entry => entry.itemId), [1])
  assert.equal(recommendation.lootSummary.weightedScore, 100)
})

test('target level and enabled utilities outrank personal loot', () => {
  const options = { ...off, optimizeComposition: true, bloodlust: true, battleRez: true }
  const candidates = [
    candidate(1, 104), candidate(2, 105),
    candidate(3, 260, { objectives: [objective(1, 1, { specId: 260, sourceId: 200 })] }),
    candidate(3, 262),
  ]
  const result = solveKeystonePlanner(input(candidates, {
    participantUserIds: [1, 2, 3],
    options,
    stones: [
      stone({ challengeMapId: 100, level: 10, dungeon: 'Close' }),
      stone({ challengeMapId: 200, level: 1, dungeon: 'Loot' }),
    ],
  }))
  assert.equal(first(result).stone.challengeMapId, 100)
  assert.equal(first(result).assignments.find(entry => entry.userId === 3).specId, 262)
})

test('target level distance precedes equal personal loot and player coverage', () => {
  const candidates = [
    candidate(1, 104),
    candidate(2, 105, { objectives: [objective(2, 1, { specId: 105, sourceId: 200 })] }),
    candidate(3, 260, {
      objectives: [
        objective(3, 2, { specId: 260, sourceId: 200 }),
        objective(4, 2, { specId: 260, sourceId: 100 }),
        objective(5, 1, { specId: 260, sourceId: 100 }),
      ],
    }),
  ]
  const recommendation = first(solveKeystonePlanner(input(candidates, {
    stones: [stone({ challengeMapId: 100, level: 10 }), stone({ challengeMapId: 200, level: 20 })],
  })))
  assert.equal(recommendation.lootSummary.weightedScore, 85)
  assert.equal(recommendation.lootSummary.playersWithObjectives, 1)
  assert.equal(recommendation.stone.challengeMapId, 100)
})

test('level distance breaks ties only after loot and player coverage', () => {
  const recommendation = first(solveKeystonePlanner(input([candidate(1, 104), candidate(2, 105)], {
    targetLevel: 12,
    stones: [stone({ challengeMapId: 100, level: 8 }), stone({ challengeMapId: 200, level: 11 })],
  })))
  assert.equal(recommendation.stone.challengeMapId, 200)
  assert.equal(recommendation.levelSummary.levelDistance, 1)
})

test('preferences break ties after level and before utilities', () => {
  const result = solveKeystonePlanner(input([
    candidate(1, 104), candidate(2, 105),
    candidate(3, 260, { playPreference: 'preferred' }),
    candidate(3, 262, { playPreference: 'available' }),
  ], {
    participantUserIds: [1, 2, 3],
    options: { ...off, optimizeComposition: true, bloodlust: true },
  }))
  assert.equal(first(result).assignments.find(entry => entry.userId === 3).specId, 260)
})

test('BiS Must Nice Catalyst and Transmog use the shared exact weights', () => {
  const tiers = [3, 2, 1, 5, 4]
  const recommendation = first(solveKeystonePlanner(input([
    candidate(1, 104, {
      objectives: tiers.map((tier, index) => objective(index + 1, tier, { specId: 104 })),
    }),
    candidate(2, 105),
  ])))
  assert.equal(recommendation.lootSummary.weightedScore, tiers.reduce(
    (total, tier) => total + keystoneLootTierWeight(tier), 0,
  ))
  assert.deepEqual(recommendation.lootSummary.tierCounts, {
    bestInSlot: 1, mustHave: 1, niceToHave: 1, catalyst: 1, transmog: 1,
  })
})

test('Voidcore, dungeon namespace, numeric source ID and loot spec filters are exact', () => {
  const recommendation = first(solveKeystonePlanner(input([
    candidate(1, 104, { objectives: [
      objective(1, 3, { specId: 104, voidcoreState: 'completed_with_voidcore' }),
      objective(2, 3, { specId: 104, sourceType: 'raid' }),
      objective(3, 3, { specId: 104, sourceId: '100' }),
      objective(4, 3, { specId: 102 }),
      objective(5, 3, { specId: 104 }),
    ] }),
    candidate(2, 105),
  ])))
  assert.deepEqual(recommendation.assignments[0].objectives.map(entry => entry.itemId), [5])
})

test('objective dedupe keeps exact variants separate and strongest duplicate once', () => {
  const recommendation = first(solveKeystonePlanner(input([
    candidate(1, 104, { objectives: [
      objective(1, 1, { specId: 104, variantKey: 'a' }),
      objective(1, 3, { specId: 104, variantKey: 'a' }),
      objective(1, 2, { specId: 104, variantKey: 'b' }),
    ] }),
    candidate(2, 105),
  ])))
  assert.equal(recommendation.lootSummary.weightedScore, 160)
  assert.equal(recommendation.lootSummary.totalObjectives, 2)
})

test('privacy-filtered candidates with no objectives contribute zero loot', () => {
  const recommendation = first(solveKeystonePlanner(input([candidate(1, 104), candidate(2, 105)])))
  assert.deepEqual(recommendation.lootSummary, {
    weightedScore: 0,
    playersWithObjectives: 0,
    totalObjectives: 0,
    tierCounts: { bestInSlot: 0, mustHave: 0, niceToHave: 0, catalyst: 0, transmog: 0 },
  })
})

test('Bloodlust exposes guaranteed, Hunter conditional and none states', () => {
  const statuses = [
    [62, 'guaranteed'],
    [253, 'conditional'],
    [260, 'none'],
  ]
  for (const [specId, expected] of statuses) {
    const recommendation = first(solveKeystonePlanner(input([
      candidate(1, 104), candidate(2, 105), candidate(3, specId),
    ])))
    assert.equal(recommendation.compositionSummary.bloodlust, expected)
  }
})

test('Bloodlust comparator orders guaranteed over conditional over none when enabled', () => {
  const result = solveKeystonePlanner(input([
    candidate(1, 104), candidate(2, 105),
    candidate(3, 262), candidate(3, 253), candidate(3, 260),
  ], {
    participantUserIds: [1, 2, 3],
    options: { ...off, optimizeComposition: true, bloodlust: true },
  }))
  assert.deepEqual(result.recommendations.map(recommendation => ({
    specId: recommendation.assignments.find(entry => entry.userId === 3).specId,
    bloodlust: recommendation.compositionSummary.bloodlust,
  })), [
    { specId: 262, bloodlust: 'guaranteed' },
    { specId: 253, bloodlust: 'conditional' },
    { specId: 260, bloodlust: 'none' },
  ])
})

test('disabled Bloodlust option and optimizeComposition false remove utility ranking', () => {
  const candidates = [candidate(1, 104), candidate(2, 105), candidate(3, 260), candidate(3, 262)]
  for (const options of [off, { ...off, optimizeComposition: true, bloodlust: false }]) {
    const recommendation = first(solveKeystonePlanner(input(candidates, {
      participantUserIds: [1, 2, 3], options,
    })))
    assert.equal(recommendation.assignments.find(entry => entry.userId === 3).specId, 260)
  }
})

test('Battle Resurrection comparator can be enabled and disabled independently', () => {
  const candidates = [candidate(1, 73), candidate(2, 270), candidate(3, 62), candidate(3, 265)]
  const disabled = first(solveKeystonePlanner(input(candidates, {
    participantUserIds: [1, 2, 3], options: { ...off, optimizeComposition: true },
  })))
  assert.equal(disabled.assignments.find(entry => entry.userId === 3).specId, 62)
  const enabled = first(solveKeystonePlanner(input(candidates, {
    participantUserIds: [1, 2, 3],
    options: { ...off, optimizeComposition: true, battleRez: true },
  })))
  assert.equal(enabled.assignments.find(entry => entry.userId === 3).specId, 265)
  assert.equal(enabled.compositionSummary.battleRez, 'guaranteed')
})

test('duplicate capability providers remain individual but aggregate once', () => {
  const recommendation = first(solveKeystonePlanner(input([
    candidate(1, 104), candidate(2, 105), candidate(3, 102),
  ])))
  assert.equal(recommendation.assignments.filter(entry => entry.capabilities.some(
    capability => capability.capabilityId === 'MARK_OF_THE_WILD',
  )).length, 3)
  assert.equal(recommendation.compositionSummary.uniqueCapabilities.filter(
    capability => capability.capabilityId === 'MARK_OF_THE_WILD',
  ).length, 1)
  assert.equal(recommendation.compositionSummary.uniqueClassBuffCount, 1)
})

test('Chaos Brand and Mystic Touch count only matching assigned DPS affinities', () => {
  const chaos = first(solveKeystonePlanner(input([
    candidate(1, 581), candidate(2, 105), candidate(3, 1480), candidate(4, 62), candidate(5, 258),
  ])))
  assert.equal(chaos.compositionSummary.chaosBrandBeneficiaries, 3)

  const mystic = first(solveKeystonePlanner(input([
    candidate(1, 268), candidate(2, 105), candidate(3, 269), candidate(4, 260), candidate(5, 71),
  ])))
  assert.equal(mystic.compositionSummary.mysticTouchBeneficiaries, 3)
})

test('damage synergy breaks only otherwise equal recommendations', () => {
  const recommendation = first(solveKeystonePlanner(input([
    candidate(1, 104), candidate(2, 105), candidate(3, 62), candidate(4, 258),
    candidate(5, 260), candidate(5, 1480),
  ], {
    participantUserIds: [1, 2, 3, 4, 5],
    options: { ...off, optimizeComposition: true, damageSynergy: true },
  })))
  assert.equal(recommendation.assignments.find(entry => entry.userId === 5).specId, 1480)
  assert.equal(recommendation.compositionSummary.chaosBrandBeneficiaries, 3)
})

test('null affinity is neutral and damage profile covers magical physical mixed and unknown', () => {
  const cases = [
    [[62], 'magical', [1, 0, 0]],
    [[260], 'physical', [0, 1, 0]],
    [[62, 260, 253], 'mixed', [1, 1, 1]],
    [[253, 70], 'unknown', [0, 0, 2]],
  ]
  for (const [specIds, profile, counts] of cases) {
    const candidates = [candidate(1, 104), ...specIds.map((specId, index) => candidate(index + 2, specId))]
    const summary = first(solveKeystonePlanner(input(candidates))).compositionSummary
    assert.equal(summary.damageProfile, profile)
    assert.deepEqual([summary.magicalDpsCount, summary.physicalDpsCount, summary.unknownDpsCount], counts)
  }
})

test('incomplete DPS vacancy recommends Bloodlust classes once with guaranteed providers first', () => {
  const recommendation = first(solveKeystonePlanner(input([
    candidate(1, 104), candidate(2, 105), candidate(3, 260), candidate(4, 258),
  ], { options: { ...off, optimizeComposition: true, bloodlust: true } })))
  const vacancy = recommendation.vacancies[0]
  assert.deepEqual(vacancy.preferredCapabilities, ['BLOODLUST'])
  assert.deepEqual(vacancy.candidateClasses.slice(0, 4).map(item => item.wowClass), [
    'Evoker', 'Mage', 'Shaman', 'Hunter',
  ])
  assert.equal(new Set(vacancy.candidateClasses.map(item => item.wowClass)).size, vacancy.candidateClasses.length)
  assert.deepEqual(vacancy.candidateClasses[0].contributions.find(
    contribution => contribution.capabilityId === 'BLOODLUST',
  ), { capabilityId: 'BLOODLUST', availability: 'guaranteed' })
  assert.deepEqual(vacancy.candidateClasses[3].contributions.find(
    contribution => contribution.capabilityId === 'BLOODLUST',
  ), { capabilityId: 'BLOODLUST', availability: 'conditional' })
})

test('external offensive recommendations compare effective magical and physical beneficiaries', () => {
  const magical = first(solveKeystonePlanner(input([
    candidate(1, 66), candidate(2, 257), candidate(3, 265), candidate(4, 266),
  ], { options: { ...off, optimizeComposition: true, classBuffs: true, damageSynergy: true } })))
  const magicalClasses = magical.vacancies[0].candidateClasses.map(item => item.wowClass)
  assert.ok(magicalClasses.indexOf('Mage') < magicalClasses.indexOf('Warrior'))
  assert.ok(magicalClasses.indexOf('Demon Hunter') < magicalClasses.indexOf('Warrior'))
  assert.ok(magicalClasses.indexOf('Warrior') < magicalClasses.indexOf('Rogue'))

  const physical = first(solveKeystonePlanner(input([
    candidate(1, 66), candidate(2, 257), candidate(3, 260), candidate(4, 103),
  ], { options: { ...off, optimizeComposition: true, classBuffs: true, damageSynergy: true } })))
  const physicalClasses = physical.vacancies[0].candidateClasses.map(item => item.wowClass)
  assert.ok(physicalClasses.indexOf('Monk') < physicalClasses.indexOf('Mage'))
  assert.ok(physicalClasses.indexOf('Warrior') < physicalClasses.indexOf('Mage'))
})

test('external vacancies expose role-compatible classes without specialization IDs', () => {
  const recommendation = first(solveKeystonePlanner(input([
    candidate(1, 104), candidate(2, 260),
  ], { options: { ...off, optimizeComposition: true, bloodlust: true, battleRez: true } })))
  assert.deepEqual(recommendation.vacancies.map(item => item.role), ['healer', 'dps', 'dps'])
  for (const vacancy of recommendation.vacancies) {
    assert.ok(vacancy.candidateClasses.length > 0)
    assert.equal('recommendations' in vacancy, false)
    assert.equal(new Set(vacancy.candidateClasses.map(item => item.wowClass)).size, vacancy.candidateClasses.length)
    assert.ok(vacancy.candidateClasses.every(item => !('specId' in item) && !('specIds' in item)))
  }
})

test('disabled composition optimization uses stable class order for external vacancies', () => {
  const recommendation = first(solveKeystonePlanner(input([
    candidate(1, 104), candidate(2, 105), candidate(3, 260), candidate(4, 258),
  ], { options: off })))
  assert.deepEqual(recommendation.vacancies[0].candidateClasses.map(item => item.wowClass), [
    'Death Knight', 'Demon Hunter', 'Druid', 'Evoker', 'Hunter', 'Mage', 'Monk', 'Paladin', 'Priest',
    'Rogue', 'Shaman', 'Warlock', 'Warrior',
  ])
})

test('assignment character and role locks constrain candidates', () => {
  const candidates = [
    candidate(1, 104), candidate(1, 66, { characterId: 11 }),
    candidate(2, 105), candidate(2, 270, { characterId: 21 }),
    candidate(3, 260), candidate(3, 268, { characterId: 31 }),
  ]
  const assignment = first(solveKeystonePlanner(input(candidates, {
    participantUserIds: [1, 2, 3],
    stones: [stone({ characterId: 11 })],
    locks: [{ type: 'assignment', userId: 1, characterId: 11, specId: 66 }],
  })))
  assert.equal(assignment.assignments.find(entry => entry.userId === 1).specId, 66)

  const character = first(solveKeystonePlanner(input(candidates, {
    participantUserIds: [1, 2, 3],
    locks: [{ type: 'character', userId: 2, characterId: 21 }],
  })))
  assert.equal(character.assignments.find(entry => entry.userId === 2).characterId, 21)

  const role = first(solveKeystonePlanner(input(candidates, {
    participantUserIds: [1, 2, 3],
    locks: [{ type: 'role', userId: 3, role: 'dps' }],
  })))
  assert.equal(role.assignments.find(entry => entry.userId === 3).role, 'dps')
})

test('contradictory or foreign-user locks produce deterministic invalid input diagnostics', () => {
  const candidates = [candidate(1, 104), candidate(1, 66, { characterId: 11 }), candidate(2, 105)]
  const contradictory = solveKeystonePlanner(input(candidates, {
    locks: [
      { type: 'character', userId: 1, characterId: 10 },
      { type: 'assignment', userId: 1, characterId: 11, specId: 66 },
    ],
  }))
  assert.equal(contradictory.status, 'invalid_input')
  assert.deepEqual(contradictory.diagnostics.lockIssues, ['LOCKS_HAVE_NO_CANDIDATE:1'])

  const foreign = solveKeystonePlanner(input(candidates, {
    locks: [{ type: 'role', userId: 9, role: 'tank' }],
  }))
  assert.deepEqual(foreign.diagnostics.lockIssues, ['LOCK_USER_NOT_SELECTED:9'])
})

test('participant validation distinguishes invalid input from unconfigured and no composition', () => {
  assert.equal(solveKeystonePlanner(input([candidate(1, 104)], {
    participantUserIds: [1],
  })).status, 'invalid_input')
  assert.equal(solveKeystonePlanner(input([candidate(1, 104)], {
    participantUserIds: [1, 1],
  })).status, 'invalid_input')
  assert.equal(solveKeystonePlanner(input([candidate(1, 104)], {
    participantUserIds: [1, 2],
  })).status, 'unconfigured_participants')
})

test('Top 5 is ranked capped and carries stable fingerprints and ranks', () => {
  const result = solveKeystonePlanner(input([candidate(1, 104), candidate(2, 105)], {
    stones: [
      stone({ challengeMapId: 104, level: 14, dungeon: 'D' }),
      stone({ challengeMapId: 101, level: 11, dungeon: 'A' }),
      stone({ challengeMapId: 103, level: 13, dungeon: 'C' }),
      stone({ challengeMapId: 102, level: 12, dungeon: 'B' }),
      stone({ challengeMapId: 105, level: 15, dungeon: 'E' }),
      stone({ challengeMapId: 106, level: 16, dungeon: 'F' }),
    ],
  }))
  assert.deepEqual(result.recommendations.map(entry => [entry.rank, entry.stone.challengeMapId]), [
    [1, 101], [2, 102], [3, 103], [4, 104], [5, 105],
  ])
  assert.equal(new Set(result.recommendations.map(entry => entry.fingerprint)).size, 5)
})

test('exact duplicate stone plus assignments is emitted once', () => {
  const duplicate = stone()
  const result = solveKeystonePlanner(input([candidate(1, 104), candidate(2, 105)], {
    stones: [duplicate, { ...duplicate }],
  }))
  assert.equal(result.recommendations.length, 1)
})

test('Top 5 collapses dominated same-character specialization variants with one functional profile', () => {
  const sharedObjectives = [objective(1, 3, { specId: 62 })]
  const result = solveKeystonePlanner(input([
    candidate(1, 104),
    candidate(2, 62, {
      playPreference: 'preferred', lootSpecId: 62, primaryLootSpecId: 62,
      objectives: sharedObjectives,
    }),
    candidate(2, 64, {
      playPreference: 'available', lootSpecId: 62, primaryLootSpecId: 62,
      objectives: sharedObjectives,
    }),
  ], { participantUserIds: [1, 2] }))

  assert.equal(result.status, 'ok')
  assert.equal(result.recommendations.length, 1)
  assert.equal(result.recommendations[0].assignments.find(entry => entry.userId === 2).specId, 62)
})

test('Top 5 collapses loot-only variants and keeps the highest-ranked functional recommendation', () => {
  const result = solveKeystonePlanner(input([
    candidate(1, 104),
    candidate(2, 62, {
      lootSpecId: 62,
      objectives: [objective(1, 1, { specId: 62, variantKey: 'arcane' })],
    }),
    candidate(2, 64, {
      lootSpecId: 64,
      objectives: [objective(2, 3, { specId: 64, variantKey: 'frost' })],
    }),
  ], { participantUserIds: [1, 2] }))

  assert.equal(result.status, 'ok')
  assert.equal(result.recommendations.length, 1)
  assert.equal(result.recommendations[0].assignments.find(entry => entry.userId === 2).specId, 64)
  assert.equal(result.recommendations[0].lootSummary.weightedScore, 100)
})

test('Top 5 preserves same-character melee and ranged alternatives', () => {
  for (const specIds of [[102, 103], [253, 255]]) {
    const result = solveKeystonePlanner(input([
      candidate(1, 104),
      candidate(2, specIds[0], { characterId: 20 }),
      candidate(2, specIds[1], { characterId: 20 }),
    ], { participantUserIds: [1, 2] }))

    assert.equal(result.status, 'ok')
    assert.deepEqual(new Set(result.recommendations.map(recommendation =>
      recommendation.assignments.find(entry => entry.userId === 2).specId)), new Set(specIds))
  }
})

test('Top 5 preserves role and damage-profile distinctions', () => {
  const cases = [
    [
      [candidate(1, 105), candidate(2, 66, { lootSpecId: 70 }), candidate(2, 70, { lootSpecId: 70 })],
      new Set([66, 70]),
    ],
    [
      [candidate(1, 104), candidate(2, 259, { lootSpecId: 260 }), candidate(2, 260, { lootSpecId: 260 })],
      new Set([259, 260]),
    ],
  ]

  for (const [candidates, expectedSpecs] of cases) {
    const result = solveKeystonePlanner(input(candidates, { participantUserIds: [1, 2] }))
    assert.equal(result.status, 'ok')
    assert.deepEqual(new Set(result.recommendations.map(recommendation =>
      recommendation.assignments.find(entry => entry.userId === 2).specId)), expectedSpecs)
  }
})

test('candidate input order cannot change recommendation order or payload', () => {
  const candidates = [
    candidate(1, 104), candidate(2, 105), candidate(3, 260), candidate(3, 261),
  ]
  const forward = solveKeystonePlanner(input(candidates, { participantUserIds: [1, 2, 3] }))
  const reverse = solveKeystonePlanner(input([...candidates].reverse(), { participantUserIds: [3, 2, 1] }))
  assert.deepEqual(forward, reverse)
  assert.deepEqual(solveKeystonePlanner(input(candidates, { participantUserIds: [1, 2, 3] })), forward)
})

test('class buff option counts unique buffs but cannot overtake preferences', () => {
  const recommendation = first(solveKeystonePlanner(input([
    candidate(1, 104), candidate(2, 270),
    candidate(3, 260, { playPreference: 'preferred' }),
    candidate(3, 258, { playPreference: 'available' }),
  ], {
    participantUserIds: [1, 2, 3],
    options: { ...off, optimizeComposition: true, classBuffs: true },
  })))
  assert.equal(recommendation.assignments.find(entry => entry.userId === 3).specId, 260)
})

test('class buff count ranks otherwise equal candidates when explicitly enabled', () => {
  const candidates = [candidate(1, 73), candidate(2, 270), candidate(3, 70), candidate(3, 258)]
  const disabled = first(solveKeystonePlanner(input(candidates, {
    participantUserIds: [1, 2, 3], options: { ...off, optimizeComposition: true },
  })))
  assert.equal(disabled.assignments.find(entry => entry.userId === 3).specId, 70)
  const enabled = first(solveKeystonePlanner(input(candidates, {
    participantUserIds: [1, 2, 3],
    options: { ...off, optimizeComposition: true, classBuffs: true },
  })))
  assert.equal(enabled.assignments.find(entry => entry.userId === 3).specId, 258)
})
