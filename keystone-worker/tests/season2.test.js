import assert from 'node:assert/strict'
import test from 'node:test'

import { isSupportedSeason2Dungeon } from '../.tmp-test/season2.js'

test('Worker Season 2 validation accepts exactly the approved dungeon pool', () => {
  const approved = [249, 250, 399, 584, 585, 586, 587, 588]
  for (const challengeMapId of approved) {
    assert.equal(isSupportedSeason2Dungeon(challengeMapId), true, `approved ID ${challengeMapId}`)
  }

  for (const challengeMapId of [1, 248, 251, 398, 400, 583, 589, 999]) {
    assert.equal(isSupportedSeason2Dungeon(challengeMapId), false, `accidental ID ${challengeMapId}`)
  }
})
