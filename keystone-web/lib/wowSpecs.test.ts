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
