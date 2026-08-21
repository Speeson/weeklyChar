import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import app from '../.tmp-test/index.js'
import { FakeD1Database } from './fakeD1.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixtureRoot = resolve(__dirname, '..', '..', 'tests', 'fixtures')

async function loadPayload(name = 'basic-sync-payload.json') {
  const content = await readFile(resolve(fixtureRoot, 'client-payload', name), 'utf8')
  return JSON.parse(content)
}

function makeEnv() {
  return {
    DB: new FakeD1Database(),
    JWT_SECRET: 'test-secret',
  }
}

function authHeaders() {
  return {
    Authorization: 'Bearer sync-token',
    'Content-Type': 'application/json',
  }
}

async function sync(env, payload) {
  return app.request('/api/keystones/update', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  }, env)
}

async function readCharacters(env) {
  const response = await app.request('/api/me/characters', {
    method: 'GET',
    headers: authHeaders(),
  }, env)
  assert.equal(response.status, 200)
  return response.json()
}

test('sync update persists character, current keystone, and contract JSON blocks', async () => {
  const env = makeEnv()
  const payload = await loadPayload()

  const response = await sync(env, payload)

  assert.equal(response.status, 200)
  assert.equal(env.DB.characters.length, 1)
  assert.equal(env.DB.keystones.length, 1)

  const [stored] = env.DB.characters
  assert.equal(stored.name, 'Auralis')
  assert.equal(stored.realm, 'Everlight')
  assert.equal(stored.region, 'eu')
  assert.equal(stored.wow_account, 'ACCOUNT-1')
  assert.equal(stored.avatar_url, 'https://example.test/avatar.jpg')
  assert.equal(stored.rio_score, 2510.25)
  assert.equal(stored.wow_class, 'Mage')
  assert.equal(stored.ilvl, 642)
  assert.deepEqual(JSON.parse(stored.vault_json), payload.vault)
  assert.deepEqual(JSON.parse(stored.prey_hunts_json), payload.preyHunts)
  assert.deepEqual(JSON.parse(stored.currencies_json), payload.currencies)
  assert.deepEqual(JSON.parse(stored.money_json), payload.money)
  assert.deepEqual(JSON.parse(stored.mythic_plus_season_json), payload.mythicPlusSeason)

  const [keystone] = env.DB.keystones
  assert.equal(keystone.character_id, stored.id)
  assert.equal(keystone.keystone_level, 10)
  assert.equal(keystone.keystone_challenge_map_id, 503)
  assert.equal(keystone.keystone_map_id, 2669)
  assert.equal(keystone.keystone_dungeon, 'Ara-Kara, City of Echoes')
  assert.equal(keystone.updated_at, 2000000000)

  const characters = await readCharacters(env)
  assert.equal(characters.length, 1)
  assert.deepEqual(characters[0].currentKeystone, {
    level: 10,
    dungeon: 'Ara-Kara, City of Echoes',
    challengeMapId: 503,
    mapId: 2669,
    updatedAt: 2000000000,
    updatedReason: 'PLAYER_LOGIN',
  })
  assert.deepEqual(characters[0].vault, payload.vault)
  assert.deepEqual(characters[0].preyHunts, payload.preyHunts)
  assert.deepEqual(characters[0].currencies, payload.currencies)
  assert.deepEqual(characters[0].money, payload.money)
  assert.deepEqual(characters[0].mythicPlusSeason, payload.mythicPlusSeason)
})

test('partial payload defaults region and does not create a keystone without real keystone data', async () => {
  const env = makeEnv()
  const response = await sync(env, {
    character: 'Noystone',
    realm: 'Everlight',
    hasKeystone: false,
    updatedAt: 2000000300,
    updatedReason: 'NO_KEYSTONE',
  })

  assert.equal(response.status, 200)
  assert.equal(env.DB.characters.length, 1)
  assert.equal(env.DB.characters[0].region, 'eu')
  assert.equal(env.DB.keystones.length, 0)

  const characters = await readCharacters(env)
  assert.equal(characters[0].name, 'Noystone')
  assert.equal(characters[0].currentKeystone, null)
  assert.equal(characters[0].vault, null)
  assert.equal(characters[0].mythicPlusSeason, null)
})

test('stale keystone updates do not replace newer current keystone rows', async () => {
  const env = makeEnv()
  const payload = await loadPayload()

  assert.equal((await sync(env, payload)).status, 200)
  assert.equal((await sync(env, {
    ...payload,
    keystoneLevel: 2,
    updatedAt: 1999999900,
    updatedReason: 'STALE_FIXTURE',
  })).status, 200)
  assert.equal(env.DB.keystones.length, 1)

  let characters = await readCharacters(env)
  assert.equal(characters[0].currentKeystone.level, 10)
  assert.equal(characters[0].currentKeystone.updatedAt, 2000000000)

  assert.equal((await sync(env, {
    ...payload,
    keystoneLevel: 12,
    updatedAt: 2000000100,
    updatedReason: 'NEWER_FIXTURE',
  })).status, 200)
  assert.equal(env.DB.keystones.length, 2)

  characters = await readCharacters(env)
  assert.equal(characters[0].currentKeystone.level, 12)
  assert.equal(characters[0].currentKeystone.updatedAt, 2000000100)
  assert.equal(characters[0].currentKeystone.updatedReason, 'NEWER_FIXTURE')
})

test('omitted JSON blocks preserve existing persisted values', async () => {
  const env = makeEnv()
  const payload = await loadPayload()
  await sync(env, payload)

  const response = await sync(env, {
    character: payload.character,
    realm: payload.realm,
    region: payload.region,
    hasKeystone: false,
    ilvl: 645,
    updatedAt: 2000000200,
  })

  assert.equal(response.status, 200)
  assert.equal(env.DB.characters[0].ilvl, 645)
  assert.deepEqual(JSON.parse(env.DB.characters[0].vault_json), payload.vault)
  assert.deepEqual(JSON.parse(env.DB.characters[0].mythic_plus_season_json), payload.mythicPlusSeason)
})

test('explicit null and empty JSON blocks persist according to current Worker behavior', async () => {
  const env = makeEnv()
  const response = await sync(env, {
    character: 'Nulla',
    realm: 'Everlight',
    region: 'eu',
    hasKeystone: false,
    vault: null,
    preyHunts: {},
    currencies: [],
    money: {},
    mythicPlusSeason: null,
    updatedAt: 2000000400,
  })

  assert.equal(response.status, 200)

  const [stored] = env.DB.characters
  assert.equal(stored.vault_json, 'null')
  assert.equal(stored.prey_hunts_json, '{}')
  assert.equal(stored.currencies_json, '[]')
  assert.equal(stored.money_json, '{}')
  assert.equal(stored.mythic_plus_season_json, 'null')

  const characters = await readCharacters(env)
  assert.equal(characters[0].vault, null)
  assert.deepEqual(characters[0].preyHunts, {})
  assert.deepEqual(characters[0].currencies, [])
  assert.deepEqual(characters[0].money, {})
  assert.equal(characters[0].mythicPlusSeason, null)
})
