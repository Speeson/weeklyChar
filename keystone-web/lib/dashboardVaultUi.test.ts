import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const dashboard = readFileSync(new URL('../app/dashboard/page.tsx', import.meta.url), 'utf8')
const summary = readFileSync(new URL('../app/summary/page.tsx', import.meta.url), 'utf8')

test('dashboard character vault details work with pointer, keyboard and touch focus', () => {
  assert.match(dashboard, /role="tooltip"/u)
  assert.match(dashboard, /useId/u)
  assert.match(dashboard, /tabIndex=\{showTooltip \? 0 : undefined\}/u)
  assert.match(dashboard, /aria-describedby=\{showTooltip \? tooltipId : undefined\}/u)
  assert.match(dashboard, /group-focus-within:opacity-100/u)
})

test('vault reward item levels come from each unlocked slot in every category', () => {
  for (const source of [dashboard, summary]) {
    assert.match(source, /rewardItemLevel/u)
    assert.match(source, /rewardUpgradeTrack/u)
    assert.match(source, /formatVaultReward/u)
    assert.match(source, /raid/u)
    assert.match(source, /dungeons/u)
    assert.match(source, /world/u)
    assert.doesNotMatch(source, /mythicPlusVaultItemLevel/u)
    assert.match(source, /topRuns/u)
  }
})
