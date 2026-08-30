import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import app from '../.tmp-test/index.js'
import { createAccessToken } from '../.tmp-test/crypto.js'
import { FakeD1Database } from './fakeD1.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixtureRoot = resolve(__dirname, '..', '..', 'tests', 'fixtures')

async function loadPayload(name = 'basic-sync-payload.json') {
  const content = await readFile(resolve(fixtureRoot, 'client-payload', name), 'utf8')
  return JSON.parse(content)
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
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

async function readTeam(env, teamId) {
  const token = await createAccessToken(env.JWT_SECRET, 1)
  return app.request(`/api/teams/${teamId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  }, env)
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

test('Season 2 currencies and Trovehunter state round-trip through currencies JSON', async () => {
  const env = makeEnv()
  const currencies = {
    adventurerMistcrest: { id: 3442, quantity: 40 },
    veteranMistcrest: { id: 3443, quantity: 35 },
    championMistcrest: { id: 3444, quantity: 30 },
    heroMistcrest: { id: 3445, quantity: 25 },
    mythMistcrest: { id: 3446, quantity: 20 },
    venomblightManaflux: { id: 3465, quantity: 1 },
    tidalSparkDust: { id: 3509, quantity: 4, maxQuantity: 4 },
    cofferKeyShards: { id: 3310, quantity: 55 },
    restoredCofferKey: { id: 3028, quantity: 2 },
    nebulousVoidcore: { id: 3513, quantity: 1 },
    sparksOfTides: {
      itemID: 274476,
      currencyID: 3509,
      itemQuantity: 2,
      dustQuantity: 4,
      dustMaxQuantity: 4,
      dustTotalEarned: 4,
      dustTrackedQuantity: 4,
    },
    trovehuntersBounty: {
      itemID: 274374,
      bagCount: 0,
      hasBuff: true,
      questCompleted: true,
      iconFileID: 134269,
      iconPath: 'Interface\\Icons\\icon_treasuremap',
      weekKey: '2026-08-26',
    },
  }

  const response = await sync(env, {
    character: 'Cyra',
    realm: 'Dawnwatch',
    region: 'eu',
    hasKeystone: false,
    currencies,
    updatedAt: 2000000200,
  })

  assert.equal(response.status, 200)
  assert.deepEqual(JSON.parse(env.DB.characters[0].currencies_json), currencies)
  const characters = await readCharacters(env)
  assert.deepEqual(characters[0].currencies, currencies)
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

test('KeystoneLoot rejects explicit null without creating partial character data', async () => {
  const env = makeEnv()
  const response = await sync(env, {
    character: 'Nullwish',
    realm: 'Everlight',
    keystoneLoot: null,
  })

  assert.equal(response.status, 400)
  assert.match((await response.json()).detail, /KeystoneLoot/)
  assert.equal(env.DB.characters.length, 0)
})

test('KeystoneLoot rejects inconsistent state flags', async () => {
  const env = makeEnv()
  const payload = await loadPayload('keystoneloot-sync-payload.json')
  payload.keystoneLoot = {
    state: 'not_installed',
    installed: true,
    supported: true,
    favorites: [],
  }

  const response = await sync(env, payload)

  assert.equal(response.status, 400)
  assert.match((await response.json()).detail, /state|installed|supported/)
  assert.equal(env.DB.characters.length, 0)
})

test('KeystoneLoot rejects invalid favorite identity and tier values', async () => {
  const base = await loadPayload('keystoneloot-sync-payload.json')
  const invalidCases = [
    ['itemId', 0],
    ['itemId', 251119.5],
    ['specId', 0],
    ['specId', '255'],
    ['tier', 0],
    ['tier', 3.5],
    ['sourceId', false],
    ['sourceId', ''],
  ]

  for (const [field, value] of invalidCases) {
    const env = makeEnv()
    const payload = clone(base)
    payload.keystoneLoot.favorites[0][field] = value

    const response = await sync(env, payload)

    assert.equal(response.status, 400, `${field}=${JSON.stringify(value)} must fail`)
    assert.equal(env.DB.characters.length, 0)
  }
})

test('KeystoneLoot rejects invalid optional favorite and Voidcore fields', async () => {
  const base = await loadPayload('keystoneloot-sync-payload.json')
  const mutateCases = [
    payload => { payload.keystoneLoot.favorites[0].sourceType = 558 },
    payload => { payload.keystoneLoot.favorites[0].slotId = 10.5 },
    payload => { payload.keystoneLoot.favorites[0].icon = '7259236' },
    payload => { payload.keystoneLoot.favorites[0].enchant = 7334.5 },
    payload => { payload.keystoneLoot.favorites[0].bonusIds = [6652, '1498'] },
    payload => { payload.keystoneLoot.favorites[0].gems = [0.5] },
    payload => { payload.keystoneLoot.favorites[0].itemLevel = 0 },
    payload => { payload.keystoneLoot.favorites[0].itemLevel = 402.5 },
    payload => { payload.keystoneLoot.favorites[0].qualityType = 'MYTHIC' },
    payload => { payload.keystoneLoot.favorites[0].variantKey = 'bonus:wrong' },
    payload => { payload.keystoneLoot.voidcore.checked = 'true' },
    payload => { payload.keystoneLoot.voidcore.usedItems = [249343, 0] },
  ]

  for (const mutate of mutateCases) {
    const env = makeEnv()
    const payload = clone(base)
    mutate(payload)

    const response = await sync(env, payload)

    assert.equal(response.status, 400)
    assert.equal(env.DB.characters.length, 0)
  }
})

test('KeystoneLoot accepts exact variant metadata and legacy favorites', async () => {
  const base = await loadPayload('keystoneloot-sync-payload.json')
  const env = makeEnv()
  base.keystoneLoot.favorites.push({
    ...base.keystoneLoot.favorites[0],
    bonusIds: [6652, 1498],
    variantKey: 'bonus:1498,6652',
    itemLevel: 402,
    qualityType: 'EPIC',
  })

  const response = await sync(env, base)

  assert.equal(response.status, 200)
  const stored = JSON.parse(env.DB.characters[0].keystone_loot_json)
  assert.equal(stored.favorites[0].itemLevel, undefined)
  assert.equal(stored.favorites.at(-1).itemLevel, 402)
  assert.equal(stored.favorites.at(-1).qualityType, 'EPIC')
})

test('KeystoneLoot enforces array limits without hardcoding a maximum tier', async () => {
  const base = await loadPayload('keystoneloot-sync-payload.json')
  const minimalFavorite = { sourceId: 558, specId: 255, itemId: 251119, tier: 99 }
  const mutateCases = [
    payload => { payload.keystoneLoot.favorites = Array.from({ length: 2001 }, () => minimalFavorite) },
    payload => { payload.keystoneLoot.voidcore.usedItems = Array.from({ length: 2001 }, (_, index) => index + 1) },
    payload => { payload.keystoneLoot.favorites[0].bonusIds = Array.from({ length: 65 }, (_, index) => index) },
    payload => { payload.keystoneLoot.favorites[0].gems = Array.from({ length: 65 }, (_, index) => index) },
  ]

  for (const mutate of mutateCases) {
    const env = makeEnv()
    const payload = clone(base)
    mutate(payload)

    const response = await sync(env, payload)

    assert.equal(response.status, 400)
    assert.equal(env.DB.characters.length, 0)
  }

  const accepted = clone(base)
  accepted.keystoneLoot.favorites[0].tier = 99
  assert.equal((await sync(makeEnv(), accepted)).status, 200)
})

test('KeystoneLoot rejects serialized blocks larger than 256 KiB', async () => {
  const env = makeEnv()
  const payload = await loadPayload('keystoneloot-sync-payload.json')
  payload.keystoneLoot.futureDiagnostic = 'x'.repeat(256 * 1024)

  const response = await sync(env, payload)

  assert.equal(response.status, 400)
  assert.match((await response.json()).detail, /tama|256|grande/i)
  assert.equal(env.DB.characters.length, 0)
})

test('KeystoneLoot sync keeps the existing sync-token authentication boundary', async () => {
  const env = makeEnv()
  const payload = await loadPayload('keystoneloot-sync-payload.json')
  const response = await app.request('/api/keystones/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, env)

  assert.equal(response.status, 401)
  assert.equal(env.DB.characters.length, 0)
})

test('KeystoneLoot persists the first valid snapshot as JSON', async () => {
  const env = makeEnv()
  const payload = await loadPayload('keystoneloot-sync-payload.json')

  const response = await sync(env, payload)

  assert.equal(response.status, 200)
  assert.deepEqual(JSON.parse(env.DB.characters[0].keystone_loot_json), payload.keystoneLoot)
})

test('KeystoneLoot empty favorites authoritatively replace a non-empty wishlist', async () => {
  const env = makeEnv()
  const payload = await loadPayload('keystoneloot-sync-payload.json')
  assert.equal((await sync(env, payload)).status, 200)

  const emptyPayload = clone(payload)
  emptyPayload.keystoneLoot.favorites = []
  emptyPayload.keystoneLoot.voidcore = { checked: false, usedItems: [] }
  emptyPayload.keystoneLoot.updatedAt += 1

  assert.equal((await sync(env, emptyPayload)).status, 200)
  assert.deepEqual(JSON.parse(env.DB.characters[0].keystone_loot_json), emptyPayload.keystoneLoot)
})

test('KeystoneLoot unavailable state authoritatively replaces supported data', async () => {
  const env = makeEnv()
  const payload = await loadPayload('keystoneloot-sync-payload.json')
  assert.equal((await sync(env, payload)).status, 200)

  const unavailable = {
    state: 'not_installed',
    installed: false,
    supported: false,
    favorites: [],
  }
  const response = await sync(env, {
    character: payload.character,
    realm: payload.realm,
    region: payload.region,
    keystoneLoot: unavailable,
  })

  assert.equal(response.status, 200)
  assert.deepEqual(JSON.parse(env.DB.characters[0].keystone_loot_json), unavailable)
})

test('omitted KeystoneLoot preserves the existing server snapshot', async () => {
  const env = makeEnv()
  const payload = await loadPayload('keystoneloot-sync-payload.json')
  assert.equal((await sync(env, payload)).status, 200)
  const stored = env.DB.characters[0].keystone_loot_json
  assert.equal(typeof stored, 'string')

  const response = await sync(env, {
    character: payload.character,
    realm: payload.realm,
    region: payload.region,
    ilvl: 701,
  })

  assert.equal(response.status, 200)
  assert.equal(env.DB.characters[0].keystone_loot_json, stored)
  assert.equal(env.DB.characters[0].ilvl, 701)
})

test('invalid KeystoneLoot cannot erase a previously stored snapshot', async () => {
  const env = makeEnv()
  const payload = await loadPayload('keystoneloot-sync-payload.json')
  assert.equal((await sync(env, payload)).status, 200)
  const stored = env.DB.characters[0].keystone_loot_json
  assert.equal(typeof stored, 'string')

  const response = await sync(env, {
    character: payload.character,
    realm: payload.realm,
    region: payload.region,
    keystoneLoot: null,
  })

  assert.equal(response.status, 400)
  assert.equal(env.DB.characters[0].keystone_loot_json, stored)
})

test('owner character reads return the persisted KeystoneLoot snapshot', async () => {
  const env = makeEnv()
  const payload = await loadPayload('keystoneloot-sync-payload.json')
  assert.equal((await sync(env, payload)).status, 200)

  const characters = await readCharacters(env)

  assert.deepEqual(characters[0].keystoneLoot, payload.keystoneLoot)
})

test('owner character reads return null for missing or invalid KeystoneLoot SQL JSON', async () => {
  const env = makeEnv()
  const payload = await loadPayload()
  assert.equal((await sync(env, payload)).status, 200)

  let characters = await readCharacters(env)
  assert.equal(characters[0].keystoneLoot, null)

  env.DB.characters[0].keystone_loot_json = '{invalid-json'
  characters = await readCharacters(env)
  assert.equal(characters[0].keystoneLoot, null)
})

test('team detail character responses do not expose raw KeystoneLoot data', async () => {
  const env = makeEnv()
  const payload = await loadPayload('keystoneloot-sync-payload.json')
  assert.equal((await sync(env, payload)).status, 200)
  env.DB.teams = [{
    id: 1,
    name: 'Private Wishlist Team',
    invite_code: 'private-code',
    created_by: 1,
    created_at: '2026-08-28T00:00:00.000Z',
  }]
  env.DB.teamMembers = [{ id: 1, team_id: 1, user_id: 1 }]

  const response = await readTeam(env, 1)

  assert.equal(response.status, 200)
  const team = await response.json()
  assert.equal(team.members.length, 1)
  assert.equal(team.members[0].characters.length, 1)
  assert.equal('keystoneLoot' in team.members[0].characters[0], false)
})

test('character enrich does not provide a KeystoneLoot write surface', async () => {
  const env = makeEnv()
  const payload = await loadPayload('keystoneloot-sync-payload.json')
  assert.equal((await sync(env, payload)).status, 200)
  const stored = env.DB.characters[0].keystone_loot_json

  const response = await app.request('/api/me/characters/enrich', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      name: payload.character,
      realm: payload.realm,
      region: payload.region,
      ilvl: 702,
      keystoneLoot: {
        state: 'not_installed',
        installed: false,
        supported: false,
        favorites: [],
      },
    }),
  }, env)

  assert.equal(response.status, 200)
  assert.equal(env.DB.characters[0].ilvl, 702)
  assert.equal(env.DB.characters[0].keystone_loot_json, stored)
})
