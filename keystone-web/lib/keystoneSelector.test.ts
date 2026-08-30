import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildKeystoneSelectorPath,
  createKeystoneSelectorRequestIdentity,
  groupSelectorObjectives,
  isKeystoneSelectorRequestCurrent,
  parseKeystoneSelectorResponse,
  selectorDungeonOptions,
  selectorObjectivesForSpec,
  type KeystoneSelectorObjective,
} from './keystoneSelector.ts'

const tiers = {
  bestInSlot: 1,
  mustHave: 1,
  niceToHave: 0,
  catalyst: 0,
  transmog: 0,
  other: 1,
}

const objective: KeystoneSelectorObjective = {
  itemId: 12345,
  itemName: 'Vestidura segura',
  iconUrl: 'https://render.worldofwarcraft.com/eu/icons/56/object.jpg',
  tier: 3,
  specIds: [62, 64],
  sourceType: 'dungeon',
  sourceId: 399,
  slotId: 5,
  slotName: 'Chest',
  itemClassName: 'Armor',
  itemSubClassName: 'Cloth',
  statNames: ['Haste', 'Intellect'],
  voidcoreState: 'pending',
}

function validResponse() {
  return {
    teamId: 7,
    challengeMapId: 399,
    availability: {
      stoneCount: 2,
      stones: [
        { characterId: 10, characterName: 'Bakuhatsu', ownerUserId: 1, ownerUsername: 'Speeson', level: 14 },
        { characterId: 20, characterName: 'Arcana', ownerUserId: 2, ownerUsername: 'Member', level: 12 },
      ],
    },
    summary: { charactersWithObjectives: 2, totalObjectives: 4, tiers },
    characters: [
      {
        userId: 1,
        username: 'Speeson',
        characterId: 10,
        characterName: 'Bakuhatsu',
        realm: "Zul'jin",
        region: 'eu',
        wowClass: 'Mage',
        avatarUrl: null,
        ilvl: 712,
        rioScore: 2800,
        totalObjectives: 3,
        tierCounts: tiers,
        specs: [
          { specId: 62, objectiveCount: 2, tierCounts: tiers },
          { specId: 64, objectiveCount: 2, tierCounts: tiers },
        ],
        objectives: [
          objective,
          { ...objective, itemId: 12346, tier: 2, specIds: [64] },
          { ...objective, itemId: 12347, tier: 99, specIds: [62], voidcoreState: 'completed_with_voidcore' },
        ],
      },
      {
        userId: 2,
        username: 'Member',
        characterId: 20,
        characterName: 'Arcana',
        realm: 'Dun Modr',
        region: 'eu',
        wowClass: null,
        avatarUrl: 'https://render.worldofwarcraft.com/eu/avatar.jpg',
        ilvl: null,
        rioScore: null,
        totalObjectives: 1,
        tierCounts: { ...tiers, bestInSlot: 0, mustHave: 0, other: 1 },
        specs: [{ specId: 64, objectiveCount: 1, tierCounts: tiers }],
        objectives: [{ ...objective, itemId: 22222, tier: 99, specIds: [64] }],
      },
    ],
    future: 'ignored',
    keystoneLoot: { favorites: ['forbidden'] },
  }
}

test('Selector parser accepts and projects the strict aggregate contract in server order', () => {
  const parsed = parseKeystoneSelectorResponse(validResponse(), 7, 399)
  assert.ok(parsed)
  assert.equal(parsed.teamId, 7)
  assert.deepEqual(parsed.characters.map(character => character.characterId), [10, 20])
  assert.deepEqual(parsed.characters[0].objectives[0].statNames, ['Haste', 'Intellect'])
  assert.equal('future' in parsed, false)
  assert.equal(JSON.stringify(parsed).includes('keystoneLoot'), false)
  assert.equal(JSON.stringify(parsed).includes('favorites'), false)
})

test('Selector parser rejects malformed identities, counts, metadata and privacy-shaped payloads', () => {
  const valid = validResponse()
  const invalid = [
    null,
    { ...valid, teamId: 8 },
    { ...valid, challengeMapId: 250 },
    { ...valid, availability: { ...valid.availability, stoneCount: -1 } },
    { ...valid, availability: { ...valid.availability, stones: [{ ...valid.availability.stones[0], level: 0 }] } },
    { ...valid, summary: { ...valid.summary, totalObjectives: -1 } },
    { ...valid, characters: [{ ...valid.characters[0], characterId: 0 }] },
    { ...valid, characters: [{ ...valid.characters[0], avatarUrl: 'http://unsafe.test/avatar.jpg' }] },
    { ...valid, characters: [{ ...valid.characters[0], specs: [{ ...valid.characters[0].specs[0], specId: 0 }] }] },
    { ...valid, characters: [{ ...valid.characters[0], objectives: [{ ...objective, specIds: [] }] }] },
    { ...valid, characters: [{ ...valid.characters[0], objectives: [{ ...objective, slotName: 5 }] }] },
    { ...valid, characters: [{ ...valid.characters[0], objectives: [{ ...objective, statNames: ['x'.repeat(129)] }] }] },
    { ...valid, characters: [{ ...valid.characters[0], objectives: [{ ...objective, value: 2732, statNames: [2732] }] }] },
  ]
  for (const value of invalid) assert.equal(parseKeystoneSelectorResponse(value, 7, 399), null)
})

test('Selector dungeon options always preserve all eight canonical pool entries and current counts', () => {
  const options = selectorDungeonOptions([
    {
      characters: [
        { currentKeystone: { level: 14, challengeMapId: 399 } },
        { currentKeystone: { level: 12, challengeMapId: 399 } },
        { currentKeystone: { level: 10, challengeMapId: 250 } },
        { currentKeystone: { level: 0, challengeMapId: 588 } },
        { currentKeystone: null },
      ],
    },
  ])
  assert.equal(options.length, 8)
  assert.deepEqual(options.map(option => option.id), [588, 587, 586, 584, 585, 249, 250, 399])
  assert.equal(options.find(option => option.id === 399)?.stoneCount, 2)
  assert.equal(options.find(option => option.id === 250)?.stoneCount, 1)
  assert.equal(options.find(option => option.id === 585)?.stoneCount, 0)
})

test('Selector requests are exact and stale dungeon identities cannot become current', () => {
  assert.equal(buildKeystoneSelectorPath(7, 399),
    '/api/teams/7/keystone-loot/dungeons/399/summary')
  const first = createKeystoneSelectorRequestIdentity(7, 399, 1)
  const second = createKeystoneSelectorRequestIdentity(7, 250, 2)
  assert.equal(isKeystoneSelectorRequestCurrent(first, second), false)
  assert.equal(isKeystoneSelectorRequestCurrent(second, second), true)
})

test('Selector objective grouping preserves semantic order, maps unknown tiers to Other and separates completed items', () => {
  const grouped = groupSelectorObjectives([
    { ...objective, itemId: 1, tier: 99 },
    { ...objective, itemId: 2, tier: 5 },
    { ...objective, itemId: 3, tier: 3 },
    { ...objective, itemId: 4, tier: 2 },
    { ...objective, itemId: 5, tier: 1 },
    { ...objective, itemId: 6, tier: 4 },
    { ...objective, itemId: 7, tier: 3, voidcoreState: 'completed_with_voidcore' },
  ])
  assert.deepEqual(grouped.groups.map(group => group.label), [
    'Best in Slot', 'Must have', 'Nice to have', 'Catalyst', 'Transmog', 'Other',
  ])
  assert.deepEqual(grouped.groups.map(group => group.objectives[0].itemId), [3, 4, 5, 2, 6, 1])
  assert.deepEqual(grouped.completed.map(item => item.itemId), [7])
})

test('Selector spec filtering uses aggregate specIds without changing shared objectives', () => {
  const objectives = [
    objective,
    { ...objective, itemId: 2, specIds: [64] },
    { ...objective, itemId: 3, specIds: [62] },
  ]
  assert.deepEqual(selectorObjectivesForSpec(objectives, null).map(item => item.itemId), [12345, 2, 3])
  assert.deepEqual(selectorObjectivesForSpec(objectives, 62).map(item => item.itemId), [12345, 3])
  assert.deepEqual(selectorObjectivesForSpec(objectives, 64).map(item => item.itemId), [12345, 2])
})
