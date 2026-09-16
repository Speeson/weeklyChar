import assert from 'node:assert/strict'
import test from 'node:test'
import { formatVaultReward } from './vaultRewards.ts'

test('formats the exact Blizzard reward track and preserves legacy item levels', () => {
  assert.equal(formatVaultReward(318, 'Myth', 'es'), 'ilvl 318 (Mito)')
  assert.equal(formatVaultReward(305, 'Hero', 'es'), 'ilvl 305 (Héroe)')
  assert.equal(formatVaultReward(292, 'Champion', 'en'), 'ilvl 292 (Champion)')
  assert.equal(formatVaultReward(318, null, 'es'), 'ilvl 318')
  assert.equal(formatVaultReward(null, 'Myth', 'es'), null)
})
