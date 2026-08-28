import assert from 'node:assert/strict'
import test from 'node:test'

import {
  deriveAvailableStones,
  formatRecommendationSummary,
  parseTeamRecommendationsResponse,
  recommendedSpecIdForCharacter,
  type PlannerMember,
  type TeamRecommendationsResponse,
} from './keystoneRecommendations.ts'

function member(userId: number, username: string, characters: PlannerMember['characters']): PlannerMember {
  return { userId, username, characters }
}

function character(
  id: number,
  name: string,
  level: number | null,
  challengeMapId: number | null,
  dungeon: string | null,
  realm = "Zul'jin",
): PlannerMember['characters'][number] {
  return {
    id,
    name,
    realm,
    region: 'eu',
    wowClass: 'Druid',
    avatarUrl: `https://example.test/${name}.jpg`,
    currentKeystone: level === null && challengeMapId === null && dungeon === null
      ? null
      : { level, challengeMapId, dungeon, updatedAt: 1_777_777_777 },
  }
}

test('derives only real positive team keystones and retains their owner and character identity', () => {
  const stones = deriveAvailableStones([
    member(10, 'Spee', [
      character(101, 'Makabe', 12, 249, "Kings' Rest"),
      character(102, 'NoKey', null, null, null),
      character(103, 'ZeroLevel', 0, 250, 'Temple of Sethraliss'),
      character(104, 'NoMap', 10, null, 'Unknown'),
      character(105, 'DecimalMap', 9, 249.5, "Kings' Rest"),
    ]),
  ])

  assert.deepEqual(stones, [{
    memberUserId: 10,
    memberUsername: 'Spee',
    characterId: 101,
    character: 'Makabe',
    realm: "Zul'jin",
    region: 'eu',
    wowClass: 'Druid',
    avatarUrl: 'https://example.test/Makabe.jpg',
    level: 12,
    dungeon: "Kings' Rest",
    challengeMapId: 249,
  }])
})

test('keeps same-dungeon stones distinct and sorts level dungeon character then realm without mutation', () => {
  const members = [
    member(20, 'Bravo', [
      character(202, 'Zulu', 10, 249, "Kings' Rest", 'Realm B'),
      character(203, 'Alpha', 11, 399, 'Ruby Life Pools', 'Realm A'),
    ]),
    member(10, 'Alpha', [
      character(101, 'Beta', 10, 249, "Kings' Rest", 'Realm B'),
      character(102, 'Beta', 10, 249, "Kings' Rest", 'Realm A'),
      character(103, 'Gamma', 10, 588, 'Altar of Fangs', 'Realm C'),
    ]),
  ]
  const originalIds = members.flatMap(item => item.characters.map(char => char.id))

  const stones = deriveAvailableStones(members)

  assert.deepEqual(stones.map(stone => stone.characterId), [203, 103, 102, 101, 202])
  assert.equal(stones.filter(stone => stone.challengeMapId === 249).length, 3)
  assert.deepEqual(members.flatMap(item => item.characters.map(char => char.id)), originalIds)
})

test('formats only non-zero recommendation categories in KeystoneLoot display order', () => {
  assert.equal(formatRecommendationSummary({
    bis: 2,
    must: 1,
    nice: 0,
    catalyst: 0,
    transmog: 0,
    totalPending: 3,
    voidcoreExcluded: 1,
  }), '2 BiS · 1 Must')

  assert.equal(formatRecommendationSummary({
    bis: 0,
    must: 1,
    nice: 0,
    catalyst: 1,
    transmog: 2,
    totalPending: 4,
    voidcoreExcluded: 0,
  }), '1 Must · 1 Catalyst · 2 Transmog')
})

test('recommended-character highlighting matches exact IDs rather than names or realms', () => {
  const response: TeamRecommendationsResponse = {
    teamId: 1,
    challengeMapId: 249,
    members: [{
      userId: 10,
      username: 'Spee',
      status: 'recommended',
      recommended: {
        characterId: 101,
        character: 'Makabe',
        realm: "Zul'jin",
        region: 'eu',
        wowClass: 'Druid',
        avatarUrl: null,
        ilvl: 712,
        rioScore: 2840.5,
        specId: 102,
        score: 125,
        summary: {
          bis: 1,
          must: 0,
          nice: 1,
          catalyst: 0,
          transmog: 0,
          totalPending: 2,
          voidcoreExcluded: 0,
        },
      },
    }],
  }

  assert.equal(recommendedSpecIdForCharacter(response, 101), 102)
  assert.equal(recommendedSpecIdForCharacter(response, 999), null)
})

test('recommendation responses reject invented statuses instead of treating them as no_targets', () => {
  const invalid = {
    teamId: 1,
    challengeMapId: 249,
    members: [{ userId: 10, username: 'Spee', status: 'maybe', recommended: null }],
  }

  assert.equal(parseTeamRecommendationsResponse(invalid, 1, 249), null)
})
