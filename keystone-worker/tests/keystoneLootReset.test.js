import assert from 'node:assert/strict'
import test from 'node:test'
import app from '../.tmp-test/index.js'
import { createAccessToken } from '../.tmp-test/crypto.js'
import { FakeD1Database } from './fakeD1.js'

function user(id) {
  return {
    id,
    username: `user-${id}`,
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
    share_keystone_loot_with_teams: 1,
    created_at: '2026-08-31T00:00:00.000Z',
  }
}

function snapshot(characterKey) {
  return JSON.stringify({
    state: 'supported', installed: true, supported: true, apiVersion: 2,
    addonVersion: '2.14.0', characterKey, updatedAt: 1788134400,
    favorites: [{ sourceId: 249, sourceType: 'dungeon', specId: 70, itemId: 273795, tier: 3 }],
    voidcore: { checked: false, usedItems: [] },
  })
}

function character(id, userId, name, overrides = {}) {
  return {
    id,
    user_id: userId,
    name,
    realm: 'Zul\'jin',
    region: 'eu',
    avatar_url: `https://example.test/${name}.jpg`,
    wow_account: 'ACCOUNT-1',
    rio_score: 2500,
    wow_class: 'Paladin',
    ilvl: 711,
    vault_json: JSON.stringify({ weekKey: '2026-08-26' }),
    prey_hunts_json: JSON.stringify({ normal: { count: 2 } }),
    currencies_json: JSON.stringify({ heroMistcrest: { quantity: 25 } }),
    money_json: JSON.stringify({ copper: 123456 }),
    mythic_plus_season_json: JSON.stringify({ rating: 2800 }),
    keystone_loot_json: snapshot(`Zul'jin-${name}-2`),
    created_at: '2026-08-31T00:00:00.000Z',
    updated_at: '2026-08-31T00:00:00.000Z',
    ...overrides,
  }
}

function envWithScopes() {
  const env = { DB: new FakeD1Database(), JWT_SECRET: 'test-secret' }
  env.DB.users = [user(1), user(2)]
  env.DB.characters = [
    character(10, 1, 'Bakuhatsu'),
    character(11, 1, 'Makabe'),
    character(12, 1, 'OtherAccount', { wow_account: 'ACCOUNT-2' }),
    character(13, 1, 'OtherRegion', { region: 'us' }),
    character(20, 2, 'OtherUser'),
  ]
  env.DB.itemMetadata = [{ region: 'eu', locale: 'es_ES', item_id: 273795, status: 'ok' }]
  return env
}

async function reset(env, payload, token = 'sync-1') {
  return app.request('/api/me/keystone-loot/reset', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, env)
}

test('account reset is owner-scoped, data-preserving, metadata-safe and idempotent', async () => {
  const env = envWithScopes()
  const before = structuredClone(env.DB.characters)

  const first = await reset(env, { region: 'eu', wowAccount: 'ACCOUNT-1' })
  const second = await reset(env, { region: 'eu', wowAccount: 'ACCOUNT-1' })

  assert.equal(first.status, 200)
  assert.deepEqual(await first.json(), {
    status: 'ok', region: 'eu', wowAccount: 'ACCOUNT-1', clearedCharacters: 2,
  })
  assert.equal(second.status, 200)
  assert.equal((await second.json()).clearedCharacters, 0)
  assert.equal(env.DB.characters.find(row => row.id === 10).keystone_loot_json, null)
  assert.equal(env.DB.characters.find(row => row.id === 11).keystone_loot_json, null)
  assert.notEqual(env.DB.characters.find(row => row.id === 12).keystone_loot_json, null)
  assert.notEqual(env.DB.characters.find(row => row.id === 13).keystone_loot_json, null)
  assert.notEqual(env.DB.characters.find(row => row.id === 20).keystone_loot_json, null)
  for (const id of [10, 11]) {
    const current = env.DB.characters.find(row => row.id === id)
    const original = before.find(row => row.id === id)
    assert.deepEqual({ ...current, keystone_loot_json: original.keystone_loot_json }, original)
  }
  assert.deepEqual(env.DB.itemMetadata, [
    { region: 'eu', locale: 'es_ES', item_id: 273795, status: 'ok' },
  ])
})

test('account reset rejects missing authentication and invalid scope', async () => {
  const env = envWithScopes()
  const unauthenticated = await reset(env, { region: 'eu', wowAccount: 'ACCOUNT-1' }, 'invalid')
  const invalidRegion = await reset(env, { region: 'moon', wowAccount: 'ACCOUNT-1' })
  const invalidAccount = await reset(env, { region: 'eu', wowAccount: '' })
  const arbitraryUser = await reset(env, { region: 'eu', wowAccount: 'ACCOUNT-1', userId: 2 })

  assert.equal(unauthenticated.status, 401)
  assert.equal(invalidRegion.status, 400)
  assert.equal(invalidAccount.status, 400)
  assert.equal(arbitraryUser.status, 400)
  assert.equal(env.DB.characters.filter(row => row.keystone_loot_json === null).length, 0)
})

test('Makabe loses only stale KeystoneLoot and current Bakuhatsu can sync again', async () => {
  const env = envWithScopes()
  assert.equal((await reset(env, { region: 'eu', wowAccount: 'ACCOUNT-1' })).status, 200)

  const update = await app.request('/api/keystones/update', {
    method: 'POST',
    headers: { Authorization: 'Bearer sync-1', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      character: 'Bakuhatsu', realm: 'Zul\'jin', region: 'eu', wowAccount: 'ACCOUNT-1',
      ilvl: 712,
      keystoneLoot: JSON.parse(snapshot("Zul'jin-Bakuhatsu-2")),
    }),
  }, env)

  assert.equal(update.status, 200)
  assert.notEqual(env.DB.characters.find(row => row.id === 10).keystone_loot_json, null)
  const makabe = env.DB.characters.find(row => row.id === 11)
  assert.equal(makabe.keystone_loot_json, null)
  assert.equal(makabe.ilvl, 711)
  assert.deepEqual(JSON.parse(makabe.vault_json), { weekKey: '2026-08-26' })
})

test('team objectives disappear immediately after the owner account reset', async () => {
  const env = envWithScopes()
  env.DB.teams = [{ id: 1, name: 'Team', invite_code: 'code', created_by: 1 }]
  env.DB.teamMembers = [
    { id: 1, team_id: 1, user_id: 1 },
    { id: 2, team_id: 1, user_id: 2 },
  ]
  const requester = await createAccessToken(env.JWT_SECRET, 2)
  const route = '/api/teams/1/characters/10/keystone-loot/objectives'

  const before = await app.request(route, { headers: { Authorization: `Bearer ${requester}` } }, env)
  assert.equal(before.status, 200)
  assert.equal((await before.json()).status, 'available')

  assert.equal((await reset(env, { region: 'eu', wowAccount: 'ACCOUNT-1' })).status, 200)
  const after = await app.request(route, { headers: { Authorization: `Bearer ${requester}` } }, env)
  assert.equal(after.status, 200)
  assert.deepEqual(await after.json(), { status: 'no_keystoneloot' })
})
