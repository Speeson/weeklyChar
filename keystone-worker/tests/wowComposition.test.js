import assert from 'node:assert/strict'
import test from 'node:test'
import {
  WOW_CAPABILITIES,
  WOW_SPECIALIZATIONS,
  capabilitiesForSpec,
  normalizeWowClass,
  wowSpecialization,
  wowSpecializationsForClass,
} from '../.tmp-test/wowComposition.js'

const REQUIRED_CAPABILITIES = [
  'BLOODLUST',
  'BATTLE_REZ',
  'CHAOS_BRAND',
  'MYSTIC_TOUCH',
  'MARK_OF_THE_WILD',
  'ARCANE_INTELLECT',
  'BATTLE_SHOUT',
  'POWER_WORD_FORTITUDE',
  'SKYFURY',
]

test('Retail specialization catalog has unique IDs, valid roles and conservative damage profiles', () => {
  assert.equal(WOW_SPECIALIZATIONS.length, 40)
  assert.equal(new Set(WOW_SPECIALIZATIONS.map(spec => spec.id)).size, 40)
  assert.deepEqual(wowSpecialization(1480), {
    id: 1480,
    name: 'Devourer',
    wowClass: 'Demon Hunter',
    role: 'dps',
    damageProfile: 'magical',
  })

  for (const specialization of WOW_SPECIALIZATIONS) {
    assert.ok(['tank', 'healer', 'dps'].includes(specialization.role))
    assert.ok(['physical', 'magical', null].includes(specialization.damageProfile))
    if (specialization.role !== 'dps') assert.equal(specialization.damageProfile, null)
  }
  assert.equal(wowSpecialization(251).damageProfile, null)
  assert.equal(wowSpecialization(263).damageProfile, null)
  assert.equal(wowSpecialization(259).damageProfile, null)
})

test('class and role lookups use the same specialization source of truth', () => {
  assert.equal(normalizeWowClass('  death knight '), 'Death Knight')
  assert.equal(normalizeWowClass('demon hunter'), 'Demon Hunter')
  assert.equal(normalizeWowClass('not-a-class'), null)
  assert.deepEqual(wowSpecializationsForClass('Paladin').map(spec => [spec.id, spec.role]), [
    [65, 'healer'], [66, 'tank'], [70, 'dps'],
  ])
})

test('capability catalog is unique, internally consistent and duplicate-free per spec', () => {
  assert.deepEqual(WOW_CAPABILITIES.map(capability => capability.id), REQUIRED_CAPABILITIES)
  assert.equal(new Set(WOW_CAPABILITIES.map(capability => capability.id)).size, WOW_CAPABILITIES.length)

  for (const capability of WOW_CAPABILITIES) {
    assert.equal(capability.stacking, 'unique')
    assert.ok(Number.isSafeInteger(capability.iconSpellId) && capability.iconSpellId > 0)
    assert.ok(capability.spells.some(spell => spell.id === capability.iconSpellId))
    assert.equal(new Set(capability.spells.map(spell => spell.id)).size, capability.spells.length)
    assert.ok(capability.providers.length > 0)
    const providerIdentities = capability.providers.map(provider =>
      `${provider.wowClass}:${(provider.specIds ?? []).join(',')}`)
    assert.equal(new Set(providerIdentities).size, providerIdentities.length)
    for (const provider of capability.providers) {
      const classSpecs = wowSpecializationsForClass(provider.wowClass)
      assert.ok(classSpecs.length > 0)
      if (provider.specIds) {
        for (const specId of provider.specIds) {
          assert.equal(wowSpecialization(specId)?.wowClass, provider.wowClass)
        }
      }
      assert.equal(provider.mode === 'conditional', Boolean(provider.condition))
    }
  }

  for (const specialization of WOW_SPECIALIZATIONS) {
    const resolved = capabilitiesForSpec(specialization.id)
    assert.equal(new Set(resolved.map(capability => capability.capabilityId)).size, resolved.length)
  }
  assert.deepEqual(capabilitiesForSpec(62).map(value => value.capabilityId), [
    'BLOODLUST', 'ARCANE_INTELLECT',
  ])
  assert.deepEqual(capabilitiesForSpec(104).map(value => value.capabilityId), [
    'BATTLE_REZ', 'MARK_OF_THE_WILD',
  ])
  assert.deepEqual(capabilitiesForSpec(253), [{
    capabilityId: 'BLOODLUST',
    mode: 'conditional',
    condition: 'Requires an eligible Hunter pet or specialization ability.',
  }])
})
