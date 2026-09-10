import assert from 'node:assert/strict'
import test from 'node:test'

import { specName, specOptionsForClass } from './wowSpecs.ts'

test('returns readable names for known current specializations', () => {
  assert.equal(specName(102), 'Balance')
  assert.equal(specName(260), 'Outlaw')
  assert.equal(specName(1473), 'Augmentation')
  assert.equal(specName(1480), 'Devourer')
})

test('uses a safe future-compatible fallback for unknown specialization IDs', () => {
  assert.equal(specName(9999), 'Spec 9999')
})

test('returns centralized class specialization options without duplicating labels', () => {
  assert.deepEqual(specOptionsForClass('Druid'), [
    { id: 102, name: 'Balance' },
    { id: 103, name: 'Feral' },
    { id: 104, name: 'Guardian' },
    { id: 105, name: 'Restoration' },
  ])
  assert.deepEqual(specOptionsForClass('Unknown'), [])
})

test('keeps the 40-spec catalog and assigns Devourer to Demon Hunter', () => {
  const classes = [
    'Death Knight', 'Demon Hunter', 'Druid', 'Evoker', 'Hunter', 'Mage', 'Monk',
    'Paladin', 'Priest', 'Rogue', 'Shaman', 'Warlock', 'Warrior',
  ]
  const all = classes.flatMap(specOptionsForClass)
  assert.equal(all.length, 40)
  assert.deepEqual(specOptionsForClass('Demon Hunter').at(-1), { id: 1480, name: 'Devourer' })
  assert.equal(specOptionsForClass('Evoker').some(spec => spec.id === 1480), false)
})
