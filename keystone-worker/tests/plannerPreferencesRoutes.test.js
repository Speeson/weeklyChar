import assert from 'node:assert/strict'
import test from 'node:test'
import app from '../.tmp-test/index.js'
import { createAccessToken } from '../.tmp-test/crypto.js'

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
    created_at: '2026-09-10T00:00:00.000Z',
  }
}

class PlannerD1 {
  constructor() {
    this.users = [user(1), user(2)]
    this.characters = [
      { id: 10, user_id: 1, wow_class: 'Paladin' },
      { id: 11, user_id: 1, wow_class: 'Druid' },
      { id: 12, user_id: 1, wow_class: null },
      { id: 20, user_id: 2, wow_class: 'Mage' },
    ]
    this.preferences = []
    this.clock = 0
  }

  prepare(sql) {
    return new PlannerStatement(this, sql)
  }

  async batch(statements) {
    const before = structuredClone(this.preferences)
    try {
      const results = []
      for (const statement of statements) results.push(await statement.run())
      return results
    } catch (error) {
      this.preferences = before
      throw error
    }
  }
}

class PlannerStatement {
  constructor(db, sql) {
    this.db = db
    this.sql = sql.replace(/\s+/g, ' ').trim()
    this.values = []
  }

  bind(...values) {
    this.values = values
    return this
  }

  async first() {
    if (this.sql === 'SELECT * FROM users WHERE id = ?') {
      return this.db.users.find(row => row.id === this.values[0]) ?? null
    }
    throw new Error(`Unhandled PlannerD1 first query: ${this.sql}`)
  }

  async all() {
    if (this.sql.includes('FROM character_play_preferences cpp')) {
      const userId = this.values[0]
      const ownedIds = new Set(this.db.characters.filter(row => row.user_id === userId).map(row => row.id))
      return {
        results: this.db.preferences
          .filter(row => ownedIds.has(row.character_id))
          .sort((left, right) => left.character_id - right.character_id || left.spec_id - right.spec_id),
      }
    }
    if (this.sql === 'SELECT id, wow_class FROM characters WHERE user_id = ? ORDER BY id') {
      return {
        results: this.db.characters
          .filter(row => row.user_id === this.values[0])
          .sort((left, right) => left.id - right.id)
          .map(row => ({ id: row.id, wow_class: row.wow_class })),
      }
    }
    throw new Error(`Unhandled PlannerD1 all query: ${this.sql}`)
  }

  async run() {
    if (this.sql.includes('DELETE FROM character_play_preferences')) {
      const userId = this.values[0]
      const ownedIds = new Set(this.db.characters.filter(row => row.user_id === userId).map(row => row.id))
      const before = this.db.preferences.length
      this.db.preferences = this.db.preferences.filter(row => !ownedIds.has(row.character_id))
      return { meta: { changes: before - this.db.preferences.length } }
    }
    if (this.sql.startsWith('INSERT INTO character_play_preferences')) {
      for (let offset = 0; offset < this.values.length; offset += 4) {
        const [characterId, specId, playPreference, lootSpecId] = this.values.slice(offset, offset + 4)
        if (this.db.preferences.some(row => row.character_id === characterId && row.spec_id === specId)) {
          throw new Error('UNIQUE constraint failed')
        }
        this.db.clock += 1
        this.db.preferences.push({
          character_id: characterId,
          spec_id: specId,
          play_preference: playPreference,
          loot_spec_id: lootSpecId,
          updated_at: `2026-09-10T00:00:${String(this.db.clock).padStart(2, '0')}.000Z`,
        })
      }
      return { meta: { changes: this.values.length / 4 } }
    }
    throw new Error(`Unhandled PlannerD1 run query: ${this.sql}`)
  }
}

async function fixture() {
  const env = { DB: new PlannerD1(), JWT_SECRET: 'planner-secret' }
  return { env, token: await createAccessToken(env.JWT_SECRET, 1) }
}

async function put(env, token, preferences) {
  return app.request('/api/me/planner/preferences', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ preferences }),
  }, env)
}

test('GET requires JWT auth and returns an empty owner-scoped preference set', async () => {
  const { env, token } = await fixture()
  env.DB.preferences.push({
    character_id: 20, spec_id: 62, play_preference: 'preferred', loot_spec_id: 62,
    updated_at: '2026-09-10T00:00:00.000Z',
  })
  const unauthenticated = await app.request('/api/me/planner/preferences', {}, env)
  const syncToken = await app.request('/api/me/planner/preferences', {
    headers: { Authorization: 'Bearer sync-1' },
  }, env)
  const response = await app.request('/api/me/planner/preferences', {
    headers: { Authorization: `Bearer ${token}` },
  }, env)

  assert.equal(unauthenticated.status, 401)
  assert.equal(syncToken.status, 401)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { preferences: [] })
})

test('PUT creates all four states, defaults lootSpecId and returns roles derived from spec', async () => {
  const { env, token } = await fixture()
  const response = await put(env, token, [
    { characterId: 10, specId: 65, playPreference: 'preferred' },
    { characterId: 10, specId: 66, playPreference: 'available', lootSpecId: 70 },
    { characterId: 10, specId: 70, playPreference: 'emergency' },
    { characterId: 11, specId: 105, playPreference: 'disabled' },
  ])
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(body.preferences.map(row => ({
    characterId: row.characterId,
    specId: row.specId,
    role: row.role,
    playPreference: row.playPreference,
    lootSpecId: row.lootSpecId,
  })), [
    { characterId: 10, specId: 65, role: 'healer', playPreference: 'preferred', lootSpecId: 65 },
    { characterId: 10, specId: 66, role: 'tank', playPreference: 'available', lootSpecId: 70 },
    { characterId: 10, specId: 70, role: 'dps', playPreference: 'emergency', lootSpecId: 70 },
    { characterId: 11, specId: 105, role: 'healer', playPreference: 'disabled', lootSpecId: 105 },
  ])
  assert.ok(body.preferences.every(row => typeof row.updatedAt === 'string'))
  const persisted = await app.request('/api/me/planner/preferences', {
    headers: { Authorization: `Bearer ${token}` },
  }, env)
  assert.equal(persisted.status, 200)
  assert.deepEqual(await persisted.json(), body)
})

test('PUT atomically replaces only the authenticated owner preferences', async () => {
  const { env, token } = await fixture()
  env.DB.preferences.push({
    character_id: 20, spec_id: 62, play_preference: 'preferred', loot_spec_id: 62,
    updated_at: '2026-09-10T00:00:00.000Z',
  })
  assert.equal((await put(env, token, [
    { characterId: 10, specId: 70, playPreference: 'preferred' },
    { characterId: 11, specId: 104, playPreference: 'available' },
  ])).status, 200)
  const update = await put(env, token, [
    { characterId: 11, specId: 102, playPreference: 'emergency', lootSpecId: 105 },
  ])

  assert.equal(update.status, 200)
  assert.deepEqual((await update.json()).preferences.map(row => [row.characterId, row.specId]), [[11, 102]])
  assert.ok(env.DB.preferences.some(row => row.character_id === 20 && row.spec_id === 62))
  assert.equal(env.DB.preferences.filter(row => row.character_id === 10).length, 0)
})

test('PUT rejects foreign characters, wrong class specs, wrong loot specs and missing classes', async () => {
  const { env, token } = await fixture()
  for (const preferences of [
    [{ characterId: 20, specId: 62, playPreference: 'preferred' }],
    [{ characterId: 10, specId: 62, playPreference: 'preferred' }],
    [{ characterId: 10, specId: 70, playPreference: 'preferred', lootSpecId: 62 }],
    [{ characterId: 12, specId: 70, playPreference: 'preferred' }],
  ]) {
    const response = await put(env, token, preferences)
    assert.equal(response.status, 400)
    assert.deepEqual(env.DB.preferences, [])
  }
})

test('PUT rejects duplicates, malformed payloads and invalid play states without persistence', async () => {
  const { env, token } = await fixture()
  const duplicate = await put(env, token, [
    { characterId: 10, specId: 70, playPreference: 'preferred' },
    { characterId: 10, specId: 70, playPreference: 'available' },
  ])
  const invalidState = await put(env, token, [
    { characterId: 10, specId: 70, playPreference: 'sometimes' },
  ])
  const injectedRole = await put(env, token, [
    { characterId: 10, specId: 70, role: 'tank', playPreference: 'preferred' },
  ])
  const malformed = await app.request('/api/me/planner/preferences', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{broken',
  }, env)

  assert.equal(duplicate.status, 400)
  assert.equal(invalidState.status, 400)
  assert.equal(injectedRole.status, 400)
  assert.equal(malformed.status, 400)
  assert.deepEqual(env.DB.preferences, [])
})

test('PUT requires JWT auth and supports clearing all owner preferences', async () => {
  const { env, token } = await fixture()
  assert.equal((await put(env, 'sync-1', [])).status, 401)
  assert.equal((await put(env, token, [
    { characterId: 10, specId: 70, playPreference: 'preferred' },
  ])).status, 200)
  const cleared = await put(env, token, [])
  assert.equal(cleared.status, 200)
  assert.deepEqual(await cleared.json(), { preferences: [] })
})
