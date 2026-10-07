import assert from 'node:assert/strict'
import test from 'node:test'
import { currentVault, currentVaultWeekKey } from './vaultWeek.ts'

test('Great Vault expires on Wednesday at 04:00 UTC', () => {
  const before = Date.parse('2026-10-07T03:59:59Z')
  const after = Date.parse('2026-10-07T04:00:00Z')
  assert.equal(currentVaultWeekKey(before), '2026-09-30')
  assert.equal(currentVaultWeekKey(after), '2026-10-07')
  assert.notEqual(currentVault({ weekKey: '2026-09-30' }, before), null)
  assert.equal(currentVault({ weekKey: '2026-09-30' }, after), null)
  assert.equal(currentVault({}, after), null)
})
