import assert from 'node:assert/strict'
import test from 'node:test'
import app from '../.tmp-test/index.js'
import { createAccessToken } from '../.tmp-test/crypto.js'
import { FakeD1Database } from './fakeD1.js'

function makeEnv() {
  return {
    DB: new FakeD1Database(),
    JWT_SECRET: 'test-secret',
  }
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
    email_verified: 1,
    email_verification_token_hash: null,
    email_verification_expires_at: null,
    password_reset_token_hash: null,
    password_reset_expires_at: null,
    share_keystone_loot_with_teams: sharing,
    created_at: '2026-08-28T00:00:00.000Z',
  }
}

function favorite(itemId, tier, overrides = {}) {
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
    created_at: '2026-08-28T00:00:00.000Z',
    updated_at: '2026-08-28T00:00:00.000Z',
    ...overrides,
  }
}

async function bearer(env, userId = 1) {
  return { Authorization: `Bearer ${await createAccessToken(env.JWT_SECRET, userId)}` }
}

async function recommendations(env, teamId = 1, challengeMapId = 249, userId = 1) {
  const query = challengeMapId === null ? '' : `?challengeMapId=${challengeMapId}`
  return app.request(`/api/teams/${teamId}/recommendations${query}`, {
    headers: await bearer(env, userId),
  }, env)
}

function configureTeam(env, users = env.DB.users) {
  env.DB.users = users
  env.DB.teams = [{
    id: 1,
    name: 'Recommendation Team',
    invite_code: 'recommend-code',
    created_by: 1,
    created_at: '2026-08-28T00:00:00.000Z',
  }]
  env.DB.teamMembers = users.map((entry, index) => ({ id: index + 1, team_id: 1, user_id: entry.id }))
}

function assertForbiddenKeys(value) {
  const forbidden = new Set([
    'favorites', 'itemId', 'itemIds', 'usedItems', 'bonusIds', 'gems', 'enchant', 'keystoneLoot',
  ])
  if (Array.isArray(value)) {
    for (const item of value) assertForbiddenKeys(item)
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, nested] of Object.entries(value)) {
    assert.equal(forbidden.has(key), false, `forbidden response key: ${key}`)
    assertForbiddenKeys(nested)
  }
}

test('new Fake D1 users default to sharing KeystoneLoot with teams', () => {
  const env = makeEnv()
  assert.equal(env.DB.users[0].share_keystone_loot_with_teams, 1)
})

test('GET /api/me exposes the sharing preference as a boolean', async () => {
  const env = makeEnv()
  const response = await app.request('/api/me', { headers: await bearer(env) }, env)

  assert.equal(response.status, 200)
  assert.equal((await response.json()).shareKeystoneLootWithTeams, true)
})

test('PATCH /api/me/preferences toggles only the authenticated user', async () => {
  const env = makeEnv()
  env.DB.users.push(user(2, 'other-user'))

  for (const expected of [false, true]) {
    const response = await app.request('/api/me/preferences', {
      method: 'PATCH',
      headers: { ...(await bearer(env)), 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareKeystoneLootWithTeams: expected, userId: 2 }),
    }, env)

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { shareKeystoneLootWithTeams: expected })
    assert.equal(env.DB.users[0].share_keystone_loot_with_teams, expected ? 1 : 0)
    assert.equal(env.DB.users[1].share_keystone_loot_with_teams, 1)
  }
})

test('PATCH /api/me/preferences rejects malformed and non-boolean input', async () => {
  const invalidBodies = [
    JSON.stringify({}),
    JSON.stringify({ shareKeystoneLootWithTeams: 0 }),
    JSON.stringify({ shareKeystoneLootWithTeams: 'false' }),
    'null',
    '{',
  ]

  for (const body of invalidBodies) {
    const env = makeEnv()
    const response = await app.request('/api/me/preferences', {
      method: 'PATCH',
      headers: { ...(await bearer(env)), 'Content-Type': 'application/json' },
      body,
    }, env)

    assert.equal(response.status, 400)
    assert.equal(env.DB.users[0].share_keystone_loot_with_teams, 1)
  }
})

test('sync tokens cannot change the team-sharing preference', async () => {
  const env = makeEnv()
  const response = await app.request('/api/me/preferences', {
    method: 'PATCH',
    headers: { Authorization: 'Bearer sync-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ shareKeystoneLootWithTeams: false }),
  }, env)

  assert.equal(response.status, 401)
  assert.equal(env.DB.users[0].share_keystone_loot_with_teams, 1)
})

test('recommendation endpoint requires authentication and live team membership', async () => {
  const env = makeEnv()
  const second = user(2, 'outsider')
  configureTeam(env, [env.DB.users[0], second])
  env.DB.teamMembers = [{ id: 1, team_id: 1, user_id: 1 }]

  const unauthenticated = await app.request('/api/teams/1/recommendations?challengeMapId=249', {}, env)
  assert.equal(unauthenticated.status, 401)

  const nonMember = await recommendations(env, 1, 249, 2)
  assert.equal(nonMember.status, 403)

  env.DB.teamMembers = []
  const revoked = await recommendations(env, 1, 249, 1)
  assert.equal(revoked.status, 403)

  const missingTeam = await recommendations(env, 999, 249, 1)
  assert.equal(missingTeam.status, 404)
})

test('recommendation endpoint rejects missing or invalid challengeMapId', async () => {
  const env = makeEnv()
  configureTeam(env)

  for (const value of [null, 0, -1, 1.5, 'abc', Number.MAX_SAFE_INTEGER + 1]) {
    const response = await recommendations(env, 1, value)
    assert.equal(response.status, 400, `challengeMapId=${value}`)
  }
})

test('recommendations return exactly one privacy-safe status per current member', async () => {
  const env = makeEnv()
  const users = [
    user(1, 'alpha'),
    user(2, 'bravo', 0),
    user(3, 'charlie'),
    user(4, 'delta'),
    user(5, 'echo'),
  ]
  configureTeam(env, users)
  env.DB.characters = [
    character(1, 1, 'Makabe', supported([
      favorite(101, 3, { specId: 102 }),
      favorite(102, 2, { specId: 103 }),
      favorite(103, 1, { specId: 103 }),
    ], { voidcore: { checked: true, usedItems: [101] } }), { ilvl: 712, rio_score: 2840.5 }),
    character(2, 1, 'OtherDruid', supported([
      favorite(201, 3, { specId: 102 }),
      favorite(202, 1, { specId: 102 }),
    ]), { ilvl: 710, rio_score: 2800 }),
    character(3, 2, 'Private', '{not-json'),
    character(4, 3, 'Unsupported', {
      state: 'installed_not_ready', installed: true, supported: false, favorites: [],
    }),
    character(6, 3, 'NotInstalled', {
      state: 'not_installed', installed: false, supported: false, favorites: [],
    }),
    character(5, 4, 'NoTargets', supported([
      favorite(301, 3, { sourceId: 250 }),
      favorite(302, 99),
    ])),
    character(7, 5, 'EchoRogue', supported([
      favorite(401, 2, { specId: 260 }),
      favorite(402, 5, { specId: 260 }),
    ]), { wow_class: 'Rogue', ilvl: 705, rio_score: 2700 }),
  ]

  const response = await recommendations(env)

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.teamId, 1)
  assert.equal(body.challengeMapId, 249)
  assert.equal(body.members.length, 5)
  assert.deepEqual(body.members.map(member => [member.username, member.status]), [
    ['alpha', 'recommended'],
    ['bravo', 'sharing_disabled'],
    ['charlie', 'no_keystoneloot'],
    ['delta', 'no_targets'],
    ['echo', 'recommended'],
  ])
  assert.deepEqual(body.members[0].recommended, {
    characterId: 2,
    character: 'OtherDruid',
    realm: 'Zul\'jin',
    region: 'eu',
    wowClass: 'Druid',
    avatarUrl: 'https://example.test/OtherDruid.jpg',
    ilvl: 710,
    rioScore: 2800,
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
  })
  assert.deepEqual(body.members[1], {
    userId: 2,
    username: 'bravo',
    status: 'sharing_disabled',
    recommended: null,
  })
  assert.equal(env.DB.characterQueryUserIds.includes(2), false)
  assertForbiddenKeys(body)
})

test('all authoritative Voidcore-completed targets produce no_targets', async () => {
  const env = makeEnv()
  configureTeam(env)
  env.DB.characters = [character(1, 1, 'Completed', supported(
    [favorite(101, 3)],
    { voidcore: { checked: true, usedItems: [101] } },
  ))]

  const response = await recommendations(env)
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.members[0].status, 'no_targets')
  assert.equal(body.members[0].recommended, null)
})

test('disabling team sharing does not remove owner raw access or expose it in team detail', async () => {
  const env = makeEnv()
  env.DB.users[0].share_keystone_loot_with_teams = 0
  configureTeam(env)
  const raw = supported([favorite(101, 3)])
  env.DB.characters = [character(1, 1, 'Owner', raw)]

  const ownerResponse = await app.request('/api/me/characters', {
    headers: { Authorization: 'Bearer sync-token' },
  }, env)
  assert.equal(ownerResponse.status, 200)
  assert.deepEqual((await ownerResponse.json())[0].keystoneLoot, raw)

  const teamResponse = await app.request('/api/teams/1', { headers: await bearer(env) }, env)
  assert.equal(teamResponse.status, 200)
  const team = await teamResponse.json()
  assert.equal('keystoneLoot' in team.members[0].characters[0], false)

  const recommendationResponse = await recommendations(env)
  const recommendation = await recommendationResponse.json()
  assert.equal(recommendation.members[0].status, 'sharing_disabled')
  assertForbiddenKeys(recommendation)
})
