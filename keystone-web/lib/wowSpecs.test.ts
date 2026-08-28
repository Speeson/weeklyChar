import assert from 'node:assert/strict'
import test from 'node:test'

import { specName } from './wowSpecs.ts'

test('returns readable names for known current specializations', () => {
  assert.equal(specName(102), 'Balance')
  assert.equal(specName(260), 'Outlaw')
  assert.equal(specName(1473), 'Augmentation')
  assert.equal(specName(1480), 'Devourer')
})

test('uses a safe future-compatible fallback for unknown specialization IDs', () => {
  assert.equal(specName(9999), 'Spec 9999')
})
