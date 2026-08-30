import assert from 'node:assert/strict'
import test from 'node:test'
import app from '../.tmp-test/index.js'
import { createAccessToken } from '../.tmp-test/crypto.js'
import { FakeD1Database } from './fakeD1.js'

function user(id, sharing = 1) {
  return {
    id, username: `user-${id}`, password_hash: '', sync_token: `sync-${id}`,
    avatar_url: null, first_name: null, last_name: null, email: null, date_of_birth: null,
    email_verified: 1, email_verification_token_hash: null, email_verification_expires_at: null,
    password_reset_token_hash: null, password_reset_expires_at: null,
    share_keystone_loot_with_teams: sharing, created_at: '2026-08-29T00:00:00.000Z',
  }
}

function snapshot(state = 'supported') {
  if (state !== 'supported') {
    const flags = state === 'not_installed'
      ? { installed: false, supported: false }
      : { installed: true, supported: false }
    return { state, ...flags, apiVersion: state === 'unsupported_api' ? 9 : undefined, favorites: [] }
  }
  return {
    state: 'supported', installed: true, supported: true, apiVersion: 2,
    addonVersion: '2.13.1', characterKey: 'private-key', updatedAt: 1787935845,
    favorites: [{
      sourceId: 249, sourceType: 'dungeon', specId: 102, itemId: 12345,
      tier: 3, slotId: 13, bonusIds: [1], gems: [2], enchant: 3, secret: 'hidden',
    }],
    voidcore: { checked: true, usedItems: [] },
  }
}

function character(id, owner, value = snapshot()) {
  return {
    id, user_id: owner, name: `Character-${id}`, realm: 'Zul\'jin', region: 'eu',
    avatar_url: null, wow_account: null, rio_score: 2500, wow_class: 'Druid', ilvl: 700,
    vault_json: null, prey_hunts_json: null, currencies_json: null, money_json: null,
    mythic_plus_season_json: null,
    keystone_loot_json: typeof value === 'string' ? value : JSON.stringify(value),
    created_at: '2026-08-29T00:00:00.000Z', updated_at: '2026-08-29T00:00:00.000Z',
  }
}

function makeEnv() {
  const DB = new FakeD1Database()
  DB.users = [user(1), user(2), user(3)]
  DB.teams = [
    { id: 1, name: 'One', invite_code: 'one', created_by: 1, created_at: '' },
    { id: 2, name: 'Two', invite_code: 'two', created_by: 2, created_at: '' },
  ]
  DB.teamMembers = [
    { id: 1, team_id: 1, user_id: 1 }, { id: 2, team_id: 1, user_id: 2 },
    { id: 3, team_id: 2, user_id: 2 }, { id: 4, team_id: 2, user_id: 3 },
  ]
  DB.characters = [character(10, 1), character(20, 2), character(30, 3)]
  return { DB, JWT_SECRET: 'test-secret' }
}

function metadataRow() {
  return {
    region: 'eu', locale: 'es_ES', item_id: 12345,
    name: 'Vestidura segura', icon_url: 'https://render.worldofwarcraft.com/eu/icons/56/object.jpg',
    slot_name: 'Chest', item_class_name: 'Armor', item_subclass_name: 'Cloth',
    stat_names_json: JSON.stringify(['Haste', 'Intellect']), status: 'ok',
    stat_groups_json: JSON.stringify({ primary: ['Intellect'], secondary: ['Haste'], other: [] }),
    quality_type: 'EPIC',
    fetched_at: 1, refresh_after: Number.MAX_SAFE_INTEGER,
  }
}

async function headers(env, userId) {
  return { Authorization: `Bearer ${await createAccessToken(env.JWT_SECRET, userId)}` }
}

test('owner objectives require JWT ownership and ignore the sharing toggle', async () => {
  const env = makeEnv()
  env.DB.itemMetadata = [metadataRow()]
  env.DB.users[0].share_keystone_loot_with_teams = 0
  const own = await app.request('/api/me/characters/10/keystone-loot/objectives', {
    headers: await headers(env, 1),
  }, env)
  assert.equal(own.status, 200)
  const ownBody = await own.json()
  assert.equal(ownBody.status, 'available')
  assert.deepEqual({
    slotName: ownBody.objectives[0].slotName,
    itemClassName: ownBody.objectives[0].itemClassName,
    itemSubClassName: ownBody.objectives[0].itemSubClassName,
    statNames: ownBody.objectives[0].statNames,
    primaryStatNames: ownBody.objectives[0].primaryStatNames,
    secondaryStatNames: ownBody.objectives[0].secondaryStatNames,
    otherStatNames: ownBody.objectives[0].otherStatNames,
    qualityType: ownBody.objectives[0].qualityType,
    itemLevel: ownBody.objectives[0].itemLevel,
    variantKey: ownBody.objectives[0].variantKey,
  }, {
    slotName: 'Chest', itemClassName: 'Armor', itemSubClassName: 'Cloth',
    statNames: ['Haste', 'Intellect'],
    primaryStatNames: ['Intellect'], secondaryStatNames: ['Haste'], otherStatNames: [],
    qualityType: 'EPIC',
    itemLevel: null, variantKey: 'bonus:1',
  })

  const syncToken = await app.request('/api/me/characters/10/keystone-loot/objectives', {
    headers: { Authorization: 'Bearer sync-1' },
  }, env)
  assert.equal(syncToken.status, 401)
  const other = await app.request('/api/me/characters/20/keystone-loot/objectives', {
    headers: await headers(env, 1),
  }, env)
  assert.equal(other.status, 404)
})

test('same-team access is live and scoped to the requested team', async () => {
  const env = makeEnv()
  const unauthenticated = await app.request('/api/teams/1/characters/20/keystone-loot/objectives', {}, env)
  assert.equal(unauthenticated.status, 401)

  const allowed = await app.request('/api/teams/1/characters/20/keystone-loot/objectives', {
    headers: await headers(env, 1),
  }, env)
  assert.equal(allowed.status, 200)
  assert.equal((await allowed.json()).status, 'available')

  const crossTeam = await app.request('/api/teams/1/characters/30/keystone-loot/objectives', {
    headers: await headers(env, 1),
  }, env)
  assert.equal(crossTeam.status, 404)

  const requesterOutside = await app.request('/api/teams/1/characters/20/keystone-loot/objectives', {
    headers: await headers(env, 3),
  }, env)
  assert.equal(requesterOutside.status, 403)

  const unknown = await app.request('/api/teams/1/characters/999/keystone-loot/objectives', {
    headers: await headers(env, 1),
  }, env)
  assert.equal(unknown.status, 404)

  env.DB.teamMembers = env.DB.teamMembers.filter(row => !(row.team_id === 1 && row.user_id === 2))
  const targetRemoved = await app.request('/api/teams/1/characters/20/keystone-loot/objectives', {
    headers: await headers(env, 1),
  }, env)
  assert.equal(targetRemoved.status, 404)

  env.DB.teamMembers = env.DB.teamMembers.filter(row => !(row.team_id === 1 && row.user_id === 1))
  const requesterRemoved = await app.request('/api/teams/1/characters/20/keystone-loot/objectives', {
    headers: await headers(env, 1),
  }, env)
  assert.equal(requesterRemoved.status, 403)
})

test('sharing-disabled response is privacy-safe and does not parse objective data', async () => {
  const env = makeEnv()
  env.DB.users[1].share_keystone_loot_with_teams = 0
  env.DB.characters[1].keystone_loot_json = '{malformed-secret-data'
  const response = await app.request('/api/teams/1/characters/20/keystone-loot/objectives', {
    headers: await headers(env, 1),
  }, env)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'sharing_disabled' })
  assert.deepEqual(env.DB.snapshotReadCharacterIds, [])
})

test('objective routes reject invalid limits, cursors and ambiguous source filters', async () => {
  const env = makeEnv()
  for (const path of [
    '/api/me/characters/10/keystone-loot/objectives?limit=101',
    '/api/me/characters/10/keystone-loot/objectives?sourceId=249',
    '/api/me/characters/10/keystone-loot/objectives?cursor=not-a-cursor',
    '/api/teams/1/characters/20/keystone-loot/objectives?challengeMapId=raid',
    '/api/teams/1/characters/20/keystone-loot/objectives?specId=0',
  ]) {
    const response = await app.request(path, { headers: await headers(env, 1) }, env)
    assert.equal(response.status, 400, path)
  }
})

test('authorized teammate receives only the allowlisted objective DTO', async () => {
  const env = makeEnv()
  env.DB.itemMetadata = [metadataRow()]
  const response = await app.request('/api/teams/1/characters/20/keystone-loot/objectives?challengeMapId=249&specId=102', {
    headers: await headers(env, 1),
  }, env)
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.deepEqual(body.objectives[0], {
    itemId: 12345, itemName: 'Vestidura segura',
    iconUrl: 'https://render.worldofwarcraft.com/eu/icons/56/object.jpg', tier: 3, specId: 102,
    sourceType: 'dungeon', sourceId: 249, slotId: 13,
    slotName: 'Chest', itemClassName: 'Armor', itemSubClassName: 'Cloth',
    statNames: ['Haste', 'Intellect'],
    primaryStatNames: ['Intellect'], secondaryStatNames: ['Haste'], otherStatNames: [],
    qualityType: 'EPIC',
    itemLevel: null, variantKey: 'bonus:1',
    voidcoreState: 'pending',
  })
  const serialized = JSON.stringify(body)
  for (const forbidden of ['keystoneLoot', 'favorites', 'characterKey', 'usedItems', 'bonusIds', 'gems', 'enchant', 'secret']) {
    assert.equal(serialized.includes(forbidden), false, forbidden)
  }
})

test('team statuses coarsen unavailable snapshots and preserve unsupported/no-target states', async () => {
  for (const [value, expected] of [
    [snapshot('not_installed'), 'no_keystoneloot'],
    [snapshot('installed_not_ready'), 'no_keystoneloot'],
    [snapshot('unsupported_api'), 'unsupported'],
    ['{bad', 'no_keystoneloot'],
    [{ ...snapshot(), favorites: [] }, 'no_targets'],
  ]) {
    const env = makeEnv()
    env.DB.characters[1] = character(20, 2, value)
    const response = await app.request('/api/teams/1/characters/20/keystone-loot/objectives', {
      headers: await headers(env, 1),
    }, env)
    assert.equal((await response.json()).status, expected)
  }
})

test('a 2,000-favorite route request reads metadata only for the current 50-item page', async () => {
  const env = makeEnv()
  const large = snapshot()
  large.favorites = Array.from({ length: 2000 }, (_, index) => ({
    sourceId: 249, sourceType: 'dungeon', specId: 102,
    itemId: index + 1, tier: 3, slotId: 13,
  }))
  env.DB.characters[1] = character(20, 2, large)
  const response = await app.request('/api/teams/1/characters/20/keystone-loot/objectives', {
    headers: await headers(env, 1),
  }, env)
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.objectives.length, 50)
  assert.equal(env.DB.metadataReadItemIds.length, 1)
  assert.equal(env.DB.metadataReadItemIds[0].length, 50)
})
