import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assignOffensiveBands,
  assignTierVectorBands,
  rankVacancyCompletions,
  scoreAdvancedOffensive,
  scoreDungeonUtility,
  scoreGroupDefense,
  scoreQuickCompletionOffensive,
  scoreQuickOffensive,
} from '../.tmp-test/plannerVacancyScoring.js'

test('Quick scores candidate class buffs only against known DPS and ignores duplicates', () => {
  const warrior = scoreQuickOffensive([251], ['Warrior'])
  assert.ok(Math.abs(warrior.gainPct - 0.04768821014595473) < 1e-12)
  assert.equal(warrior.provenance.every(item => item.specId === 251 && item.source === 'simc'), true)
  assert.equal(scoreQuickOffensive([250, 65], ['Warrior']).gainPct, 0)
  assert.equal(scoreQuickOffensive([251, 71], ['Warrior']).gainPct, 0)
  assert.equal(scoreQuickOffensive([251], ['Hunter']).gainPct, 0)
})

test('Quick combines multiple unique buffs multiplicatively without double counting', () => {
  const battleShout = 0.04768821014595473
  const markOfTheWild = 0.030374014332037815
  assert.ok(Math.abs(scoreQuickOffensive([251], ['Warrior', 'Druid']).gainPct
    - ((1 + battleShout) * (1 + markOfTheWild) - 1)) < 1e-12)
  assert.ok(Math.abs(scoreQuickOffensive([251], ['Warrior', 'Warrior']).gainPct - battleShout) < 1e-12)
})

test('Quick scores class-level external DPS as recipients when the selected party has none', () => {
  const result = scoreQuickCompletionOffensive([250, 257], [
    { role: 'dps', wowClass: 'Warrior' },
    { role: 'dps', wowClass: 'Mage' },
    { role: 'dps', wowClass: 'Druid' },
  ])

  assert.ok(result.gainPct > 0)
  assert.equal(result.recipients.length, 3)
  assert.equal(result.interactions.some(interaction => interaction.provider === 'candidate'), true)
  assert.equal(result.provenance.length > 0, true)
})

test('Advanced scores both directions and never credits a candidates own provider buff', () => {
  const result = scoreAdvancedOffensive([64], [72])
  const frostMageReceivesBattleShout = 0.0000795281228164857
  const furyReceivesArcaneIntellect = 0.0002027040025985638
  assert.ok(Math.abs(result.gainPct
    - ((frostMageReceivesBattleShout + furyReceivesArcaneIntellect) / 2)) < 1e-12)
  assert.equal(result.interactions.some(item => item.recipientSpecId === 72 && item.buffId === 'BATTLE_SHOUT'), false)
})

test('Advanced candidate specs can buff each other and combine recipient buffs multiplicatively', () => {
  const result = scoreAdvancedOffensive([64], [72, 262])
  assert.equal(result.interactions.some(item => item.provider === 'candidate' && item.recipientSpecId === 72
    && item.buffId === 'SKYFURY'), true)
  assert.equal(result.interactions.some(item => item.provider === 'candidate' && item.recipientSpecId === 262
    && item.buffId === 'BATTLE_SHOUT'), true)
  const frost = result.recipients.find(item => item.specId === 64)
  assert.ok(Math.abs(frost.gainPct
    - ((1 + 0.0000795281228164857) * (1 + 0.01726710587970932) - 1)) < 1e-12)
})

test('offensive bands use max 0.5 percentage points or 25 percent of the band leader', () => {
  assert.deepEqual(assignOffensiveBands([0.048, 0.0455, 0.042, 0.021]), [0, 0, 0, 1])
  assert.deepEqual(assignOffensiveBands([0.15, 0.05]), [0, 1])
  assert.deepEqual(assignOffensiveBands([0.01, 0.006, 0.0049]), [0, 0, 1])
})

test('defense and utility bands preserve semantic tiers while absorbing small score differences', () => {
  assert.deepEqual(assignTierVectorBands([
    { S: 1000, A: 0, B: 0, C: 0 },
    { S: 750, A: 9000, B: 0, C: 0 },
    { S: 500, A: 12000, B: 0, C: 0 },
    { S: 0, A: 1000, B: 0, C: 0 },
  ]), [0, 0, 1, 2])
})

test('group defense excludes personals, respects exact specs and applies best-only coverage once', () => {
  const havoc = scoreGroupDefense([], [577])
  assert.equal(havoc.reasons.some(reason => reason.includes('Darkness')), true)
  assert.equal(havoc.reasons.some(reason => /Blur|Netherwalk/u.test(reason)), false)
  assert.equal(scoreGroupDefense([], [577]).reasons.some(reason => reason.includes("Sigil of Chains")), false)
  const onePaladin = scoreGroupDefense([], [70])
  const duplicatePaladin = scoreGroupDefense([70], [70])
  assert.equal(onePaladin.tiers.S > 0, true)
  assert.equal(duplicatePaladin.reasons.some(reason => reason.includes('Devotion Aura')), false)
})

test('dungeon utility applies relevance and marginal diminishing coverage', () => {
  const blindingVale = scoreDungeonUtility([], [262], 584)
  const den = scoreDungeonUtility([], [262], 586)
  assert.equal(blindingVale.reasons.some(reason => reason.includes('Purge') && reason.includes('0/3')), false)
  assert.equal(den.reasons.some(reason => reason.includes('Purge') && reason.includes('3/3')), true)
  assert.equal(den.tiers.A > blindingVale.tiers.A, true)
  const one = scoreDungeonUtility([], [71], 586)
  const withExistingInterrupt = scoreDungeonUtility([72], [71], 586)
  assert.equal(withExistingInterrupt.tiers.S < one.tiers.S, true)
})

test('Advanced selected-dungeon utility can change the exact-spec recommendation order', () => {
  const options = {
    mode: 'advanced', bloodlust: false, battleRez: false, offensiveSynergy: false,
    groupDefense: false, dungeonUtility: true,
  }
  const blindingVale = rankVacancyCompletions([250, 65, 251], ['dps'], 584, options)
  const voidscarArena = rankVacancyCompletions([250, 65, 251], ['dps'], 585, options)
  assert.equal(blindingVale[0].stableKey, 'dps:Druid:102')
  assert.equal(voidscarArena[0].stableKey, 'dps:Demon Hunter:1480')
})

test('completion ranking is role-compatible, mode-specific, permutation-free and deterministic', () => {
  const quick = rankVacancyCompletions([250, 65, 251], ['dps', 'dps'], 586, {
    mode: 'quick', bloodlust: true, battleRez: true, offensiveSynergy: true,
    groupDefense: true, dungeonUtility: true,
  })
  assert.equal(quick.every(completion => completion.selections.every(selection => selection.specId === undefined)), true)
  assert.equal(new Set(quick.map(completion => completion.stableKey)).size, quick.length)
  assert.equal(quick.some(completion => completion.stableKey.includes('Warrior')
    && completion.stableKey.includes('Monk')), true)
  const reverse = quick.find(completion => completion.stableKey.includes('Monk')
    && completion.stableKey.includes('Warrior'))
  assert.equal(quick.filter(completion => completion.stableKey === reverse.stableKey).length, 1)
  assert.equal(quick.every(completion => Object.values(completion.defense.tiers).every(value => value === 0)
    && Object.values(completion.dungeonUtility.tiers).every(value => value === 0)), true)

  const advanced = rankVacancyCompletions([250, 65, 251], ['dps'], 586, {
    mode: 'advanced', bloodlust: true, battleRez: true, offensiveSynergy: true,
    groupDefense: true, dungeonUtility: true,
  })
  assert.equal(advanced.every(completion => completion.selections[0].specId > 0), true)
  assert.equal(advanced.every(completion => completion.selections[0].role === 'dps'), true)
  assert.deepEqual(
    advanced.map(completion => completion.stableKey),
    rankVacancyCompletions([250, 65, 251], ['dps'], 586, {
      mode: 'advanced', bloodlust: true, battleRez: true, offensiveSynergy: true,
      groupDefense: true, dungeonUtility: true,
    }).map(completion => completion.stableKey),
  )
})

test('Quick ignores defense and dungeon options even when manipulated true', () => {
  const enabled = rankVacancyCompletions([250, 65, 251], ['dps'], 586, {
    mode: 'quick', bloodlust: false, battleRez: false, offensiveSynergy: true,
    groupDefense: true, dungeonUtility: true,
  })
  const disabled = rankVacancyCompletions([250, 65, 251], ['dps'], 584, {
    mode: 'quick', bloodlust: false, battleRez: false, offensiveSynergy: true,
    groupDefense: false, dungeonUtility: false,
  })
  assert.deepEqual(enabled.map(item => item.stableKey), disabled.map(item => item.stableKey))
})
