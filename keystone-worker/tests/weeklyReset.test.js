import test from 'node:test'
import assert from 'node:assert/strict'
import { currentEuWeeklyResetUnix } from '../.tmp-test/weeklyReset.js'

function unix(value) {
  return Math.floor(new Date(value).getTime() / 1000)
}

test('uses the current Wednesday 04:00 UTC after EU weekly reset', () => {
  assert.equal(
    currentEuWeeklyResetUnix(Date.parse('2026-08-05T04:00:00Z')),
    unix('2026-08-05T04:00:00Z'),
  )
  assert.equal(
    currentEuWeeklyResetUnix(Date.parse('2026-08-05T12:30:00Z')),
    unix('2026-08-05T04:00:00Z'),
  )
})

test('uses the previous Wednesday 04:00 UTC before the reset happens', () => {
  assert.equal(
    currentEuWeeklyResetUnix(Date.parse('2026-08-05T03:59:59Z')),
    unix('2026-07-29T04:00:00Z'),
  )
})

test('is stable across local summer time because it is based on UTC', () => {
  assert.equal(
    currentEuWeeklyResetUnix(Date.parse('2026-03-25T08:00:00Z')),
    unix('2026-03-25T04:00:00Z'),
  )
  assert.equal(
    currentEuWeeklyResetUnix(Date.parse('2026-10-28T08:00:00Z')),
    unix('2026-10-28T04:00:00Z'),
  )
})
