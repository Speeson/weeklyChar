import test from 'node:test'
import assert from 'node:assert/strict'
import { formatSparkQuantity } from './sparkQuantity'


test('formats mixed carried and banked Sparks', () => {
  assert.equal(formatSparkQuantity({
    itemQuantity: 6,
    bankQuantity: 3,
    bankQuantityKnown: true,
  }), '6 (3 en el banco)')
})

test('formats an all-banked total without losing the total', () => {
  assert.equal(formatSparkQuantity({
    itemQuantity: 3,
    bankQuantity: 3,
    bankQuantityKnown: true,
  }), '3 (3 en el banco)')
})

test('omits noisy known-zero bank text', () => {
  assert.equal(formatSparkQuantity({
    itemQuantity: 6,
    bankQuantity: 0,
    bankQuantityKnown: true,
  }), '6')
})

test('omits bank text when bank quantity is not trustworthy', () => {
  assert.equal(formatSparkQuantity({
    itemQuantity: 6,
    bankQuantity: 3,
    bankQuantityKnown: false,
  }), '6')
})
