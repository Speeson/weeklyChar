import assert from 'node:assert/strict'
import test from 'node:test'

import { createAccessToken } from '../.tmp-test/crypto.js'
import app from '../.tmp-test/index.js'
import { currentEuWeeklyResetUnix } from '../.tmp-test/weeklyReset.js'
import { FakeD1Database } from './fakeD1.js'

function makeEnv() {
  return { DB: new FakeD1Database(), JWT_SECRET: 'test-secret' }
}

function user(id, username, sharing = 1) {
  return {
    id,
    username,
    password_hash: '',
    sync_token: `sync-${id}`,
    avatar_url: null,
    first_name: null,
    last_name: null,
    email: null,
    date_of_birth: null,
    email_verified: 0,
    email_verification_token_hash: null,
    email_verification_expires_at: null,
    password_reset_token_hash: null,
    password_reset_expires_at: null,
    share_keystone_loot_with_teams: sharing,
    created_at: '2026-08-29T00:00:00.000Z',
  }
}

function favorite(itemId, tier = 3, overrides = {}) {
  return {
    sourceId: 249,
    sourceType: 'dungeon',
    specId: 102,
    itemId,
    tier,
    ...overrides,
  }
}

function supported(favorites, overrides = {}) {
  return {
    state: 'supported',
    installed: true,
    supported: true,
    apiVersion: 2,
    addonVersion: '2.13.1',
    characterKey: 'Realm-Character-1',
    updatedAt: 1787935845,
    favorites,
    voidcore: { checked: false, usedItems: [] },
    ...overrides,
  }
}

function character(id, userId, name, snapshot, overrides = {}) {
  return {
    id,
    user_id: userId,
    name,
    realm: 'Zul\'jin',
    region: 'eu',
    avatar_url: `https://example.test/${name}.jpg`,
    wow_account: null,
    rio_score: 2500,
    wow_class: 'Druid',
    ilvl: 700,
    vault_json: null,
    prey_hunts_json: null,
    currencies_json: null,
    money_json: null,
    mythic_plus_season_json: null,
    keystone_loot_json: snapshot === null ? null : JSON.stringify(snapshot),
    created_at: '2026-08-29T00:00:00.000Z',
    updated_at: '2026-08-29T00:00:00.000Z',
    ...overrides,
  }
}

function keystone(id, characterId, challengeMapId, level, updatedAt) {
  return {
    id,
    character_id: characterId,
    has_keystone: 1,
    keystone_level: level,
    keystone_challenge_map_id: challengeMapId,
    keystone_map_id: challengeMapId,
    keystone_dungeon: `Dungeon ${challengeMapId}`,
    updated_reason: 'test',
    updated_at: updatedAt,
    created_at: '2026-08-29T00:00:00.000Z',
  }
}

function configureTeam(env, users = env.DB.users) {
  env.DB.users = users
  env.DB.teams = [{
    id: 1,
    name: 'Selector Team',
    invite_code: 'selector-code',
    created_by: 1,
    created_at: '2026-08-29T00:00:00.000Z',
  }]
  env.DB.teamMembers = users.map((entry, index) => ({ id: index + 1, team_id: 1, user_id: entry.id }))
}

async function bearer(env, userId = 1) {
  return { Authorization: `Bearer ${await createAccessToken(env.JWT_SECRET, userId)}` }
}

async function summary(env, teamId = 1, challengeMapId = 249, userId = 1, locale = 'es_ES') {
  return app.request(
    `/api/teams/${teamId}/keystone-loot/dungeons/${challengeMapId}/summary?locale=${locale}`,
    { headers: await bearer(env, userId) },
    env,
  )
}

test('selector route validates authentication, IDs, supported pool and live requester membership', async () => {
  const env = makeEnv()
  const outsider = user(2, 'outsider')
  configureTeam(env, [env.DB.users[0], outsider])
  env.DB.teamMembers = [{ id: 1, team_id: 1, user_id: 1 }]

  const unauthenticated = await app.request(
    '/api/teams/1/keystone-loot/dungeons/249/summary',
    {},
    env,
  )
  assert.equal(unauthenticated.status, 401)

  for (const [teamId, challengeMapId] of [
    ['abc', 249], [0, 249], [-1, 249], [Number.MAX_SAFE_INTEGER + 1, 249],
    [1, 'abc'], [1, 0], [1, -1], [1, Number.MAX_SAFE_INTEGER + 1], [1, 251],
  ]) {
    const response = await summary(env, teamId, challengeMapId)
    assert.equal(response.status, 400, `${teamId}/${challengeMapId}`)
  }

  assert.equal((await summary(env, 999, 249)).status, 404)
  assert.equal((await summary(env, 1, 249, 2)).status, 403)
  assert.equal((await summary(env, 1, 249, 1, 'fr_FR')).status, 400)

  env.DB.teamMembers = []
  assert.equal((await summary(env)).status, 403)
})

test('selector route enforces current Team isolation and sharing without leaking placeholders', async () => {
  const env = makeEnv()
  const alpha = user(1, 'alpha')
  const bravo = user(2, 'bravo')
  const charlie = user(3, 'charlie')
  configureTeam(env, [alpha, bravo, charlie])
  env.DB.teamMembers = [
    { id: 1, team_id: 1, user_id: 1 },
    { id: 2, team_id: 1, user_id: 2 },
    { id: 3, team_id: 2, user_id: 2 },
    { id: 4, team_id: 2, user_id: 3 },
  ]
  env.DB.characters = [
    character(1, 1, 'AlphaOne', supported([favorite(10)])),
    character(2, 1, 'AlphaTwo', supported([favorite(11, 2)])),
    character(3, 2, 'Bravo', supported([favorite(12, 1)])),
    character(4, 3, 'CrossTeam', supported([favorite(13)])),
  ]

  let response = await summary(env)
  assert.equal(response.status, 200)
  let body = await response.json()
  assert.deepEqual(body.characters.map(entry => entry.characterName), ['AlphaOne', 'AlphaTwo', 'Bravo'])
  assert.equal(JSON.stringify(body).includes('CrossTeam'), false)

  bravo.share_keystone_loot_with_teams = 0
  response = await summary(env)
  body = await response.json()
  assert.deepEqual(body.characters.map(entry => entry.characterName), ['AlphaOne', 'AlphaTwo'])
  assert.equal(JSON.stringify(body).includes('bravo'), false)

  bravo.share_keystone_loot_with_teams = 1
  env.DB.teamMembers = env.DB.teamMembers.filter(entry => !(entry.team_id === 1 && entry.user_id === 2))
  response = await summary(env)
  body = await response.json()
  assert.deepEqual(body.characters.map(entry => entry.characterName), ['AlphaOne', 'AlphaTwo'])
  assert.equal(JSON.stringify(body).includes('Bravo'), false)

  env.DB.teamMembers = env.DB.teamMembers.filter(entry => !(entry.team_id === 1 && entry.user_id === 1))
  assert.equal((await summary(env)).status, 403)
})

test('selector availability returns only each current Team character latest same-week real stone', async () => {
  const env = makeEnv()
  const now = currentEuWeeklyResetUnix() + 100
  const alpha = user(1, 'alpha')
  const bravo = user(2, 'bravo', 0)
  configureTeam(env, [alpha, bravo])
  env.DB.characters = [
    character(1, 1, 'Alpha', supported([favorite(10)])),
    character(2, 2, 'Bravo', supported([favorite(11)])),
    character(3, 1, 'ChangedKey', supported([])),
    character(4, 1, 'Stale', supported([])),
  ]
  env.DB.keystones = [
    keystone(1, 1, 249, 10, now),
    keystone(2, 1, 249, 12, now + 1),
    keystone(3, 2, 249, 14, now + 2),
    keystone(4, 3, 249, 11, now),
    keystone(5, 3, 250, 13, now + 1),
    keystone(6, 4, 249, 9, currentEuWeeklyResetUnix() - 1),
    { ...keystone(7, 4, 249, 20, now), has_keystone: 0 },
    { ...keystone(8, 4, 249, null, now), keystone_level: null },
  ]

  const response = await summary(env)
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.availability.stoneCount, 2)
  assert.deepEqual(body.availability.stones, [
    { characterId: 1, characterName: 'Alpha', ownerUserId: 1, ownerUsername: 'alpha', level: 12 },
    { characterId: 2, characterName: 'Bravo', ownerUserId: 2, ownerUsername: 'bravo', level: 14 },
  ])
  assert.equal(body.characters.some(entry => entry.characterName === 'Bravo'), false)
})

test('selector enriches only selected objective IDs and preserves metadata failure fallbacks', async () => {
  const env = makeEnv()
  configureTeam(env)
  env.DB.characters = [character(1, 1, 'Metadata', supported([
    favorite(10),
    favorite(11, 2),
    favorite(12, 3, { sourceId: 250 }),
  ]))]
  env.DB.itemMetadata = [{
    region: 'eu',
    locale: 'es_ES',
    item_id: 10,
    name: 'Objeto enriquecido',
    icon_url: 'https://render.worldofwarcraft.com/eu/icons/56/object.jpg',
    status: 'ok',
    fetched_at: 1,
    refresh_after: Number.MAX_SAFE_INTEGER,
    slot_name: 'Chest',
    item_class_name: 'Armor',
    item_subclass_name: 'Cloth',
    stat_names_json: JSON.stringify(['Haste', 'Intellect']),
    stat_groups_json: JSON.stringify({ primary: ['Intellect'], secondary: ['Haste'], other: [] }),
    quality_type: 'EPIC',
  }]

  const response = await summary(env)
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(env.DB.metadataReadItemIds, [[10, 11]])
  assert.deepEqual(body.characters[0].objectives.map(objective => [
    objective.itemId, objective.itemName, objective.iconUrl,
    objective.slotName, objective.itemClassName, objective.itemSubClassName, objective.statNames,
  ]), [
    [10, 'Objeto enriquecido', 'https://render.worldofwarcraft.com/eu/icons/56/object.jpg', 'Chest', 'Armor', 'Cloth', ['Haste', 'Intellect']],
    [11, null, null, null, null, null, []],
  ])
})

test('selector returns HTTP 200 and correct availability when no actionable objectives exist', async () => {
  const env = makeEnv()
  configureTeam(env)
  const now = currentEuWeeklyResetUnix() + 100
  env.DB.characters = [character(1, 1, 'Completed', supported(
    [favorite(10)],
    { voidcore: { checked: true, usedItems: [10] } },
  ))]
  env.DB.keystones = [keystone(1, 1, 249, 10, now)]

  const response = await summary(env)
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(body.summary, {
    charactersWithObjectives: 0,
    totalObjectives: 0,
    tiers: {
      bestInSlot: 0, mustHave: 0, niceToHave: 0,
      catalyst: 0, transmog: 0, other: 0,
    },
  })
  assert.deepEqual(body.characters, [])
  assert.equal(body.availability.stoneCount, 1)
})
