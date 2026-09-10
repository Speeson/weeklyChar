import assert from 'node:assert/strict'
import test from 'node:test'

import { createAccessToken } from '../.tmp-test/crypto.js'
import app from '../.tmp-test/index.js'
import {
  PLANNER_LIMITS,
  PlannerDataLimitError,
  assertPlannerDataLimit,
} from '../.tmp-test/keystonePlannerApi.js'
import { currentEuWeeklyResetUnix } from '../.tmp-test/weeklyReset.js'
import { FakeD1Database } from './fakeD1.js'

const options = {
  optimizeComposition: true,
  bloodlust: true,
  battleRez: true,
  classBuffs: true,
  damageSynergy: true,
}

function user(id, sharing = 1) {
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
    share_keystone_loot_with_teams: sharing,
    created_at: '2026-09-10T00:00:00.000Z',
  }
}

function favorite(itemId, tier = 3, overrides = {}) {
  return {
    sourceId: 249,
    sourceType: 'dungeon',
    specId: 71,
    itemId,
    tier,
    slotId: 13,
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

function character(id, userId, wowClass, snapshot = supported([]), overrides = {}) {
  return {
    id,
    user_id: userId,
    name: `Character-${id}`,
    realm: 'Zul\'jin',
    region: 'eu',
    avatar_url: null,
    wow_account: null,
    rio_score: null,
    wow_class: wowClass,
    ilvl: null,
    vault_json: null,
    prey_hunts_json: null,
    currencies_json: null,
    money_json: null,
    mythic_plus_season_json: null,
    equipment_json: null,
    talents_json: null,
    omnium_folio_json: null,
    keystone_loot_json: typeof snapshot === 'string' ? snapshot : JSON.stringify(snapshot),
    created_at: '2026-09-10T00:00:00.000Z',
    updated_at: '2026-09-10T00:00:00.000Z',
    ...overrides,
  }
}

function preference(characterId, specId, overrides = {}) {
  return {
    character_id: characterId,
    spec_id: specId,
    play_preference: 'available',
    loot_spec_id: specId,
    updated_at: '2026-09-10T00:00:00.000Z',
    ...overrides,
  }
}

function keystone(id, characterId, challengeMapId = 249, level = 10, overrides = {}) {
  return {
    id,
    character_id: characterId,
    has_keystone: 1,
    keystone_level: level,
    keystone_challenge_map_id: challengeMapId,
    keystone_map_id: challengeMapId,
    keystone_dungeon: `Dungeon ${challengeMapId}`,
    updated_reason: 'test',
    updated_at: currentEuWeeklyResetUnix() + id,
    created_at: '2026-09-10T00:00:00.000Z',
    ...overrides,
  }
}

function fixture() {
  const db = new FakeD1Database()
  db.users = [1, 2, 3, 4, 5, 6].map(id => user(id))
  db.teams = [{
    id: 1,
    name: 'Planner Team',
    invite_code: 'planner-code',
    created_by: 1,
    created_at: '2026-09-10T00:00:00.000Z',
  }]
  db.teamMembers = [1, 2, 3, 4, 5].map((userId, index) => ({
    id: index + 1, team_id: 1, user_id: userId,
  }))
  db.characters = [
    character(10, 1, 'Warrior', supported([favorite(100, 3)])),
    character(20, 2, 'Monk'),
    character(30, 3, 'Mage'),
    character(40, 4, 'Rogue'),
    character(50, 5, 'Priest'),
    character(60, 6, 'Druid', supported([favorite(600, 3, { specId: 102 })])),
  ]
  db.plannerPreferences = [
    preference(10, 73, { loot_spec_id: 71 }),
    preference(20, 270),
    preference(30, 62),
    preference(40, 260),
    preference(50, 258),
    preference(60, 102),
  ]
  db.keystones = [keystone(1, 10)]
  return { DB: db, JWT_SECRET: 'planner-api-secret' }
}

function body(overrides = {}) {
  return {
    participantUserIds: [1, 2, 3, 4, 5],
    targetLevel: 10,
    challengeMapId: null,
    options,
    locks: [],
    ...overrides,
  }
}

async function bearer(env, userId = 1) {
  return { Authorization: `Bearer ${await createAccessToken(env.JWT_SECRET, userId)}` }
}

async function plan(env, payload = body(), userId = 1, teamId = 1) {
  return app.request(`/api/teams/${teamId}/keystone-planner`, {
    method: 'POST',
    headers: { ...await bearer(env, userId), 'Content-Type': 'application/json' },
    body: typeof payload === 'string' ? payload : JSON.stringify(payload),
  }, env)
}

test('Planner endpoint enforces JWT, Team existence and live requester/participant membership', async () => {
  const env = fixture()
  assert.equal((await app.request('/api/teams/1/keystone-planner', {
    method: 'POST', body: JSON.stringify(body()),
  }, env)).status, 401)
  assert.equal((await app.request('/api/teams/1/keystone-planner', {
    method: 'POST', headers: { Authorization: 'Bearer sync-1' }, body: JSON.stringify(body()),
  }, env)).status, 401)
  assert.equal((await plan(env, body(), 1, 999)).status, 404)
  assert.equal((await plan(env, body(), 6)).status, 403)
  assert.equal((await plan(env, body({ participantUserIds: [1, 6] }))).status, 400)
  env.DB.teamMembers = env.DB.teamMembers.filter(row => row.user_id !== 1)
  assert.equal((await plan(env)).status, 403)
})

test('Planner request validation rejects counts, duplicates, targets, options and unknown fields', async () => {
  const invalidPayloads = [
    body({ participantUserIds: [1] }),
    body({ participantUserIds: [1, 2, 3, 4, 5, 6] }),
    body({ participantUserIds: [1, 1] }),
    body({ participantUserIds: [1, 0] }),
    body({ targetLevel: 0 }),
    body({ targetLevel: 21 }),
    body({ options: { ...options, bloodlust: 'true' } }),
    body({ options: { ...options, extra: false } }),
    body({ extra: true }),
    body({ challengeMapId: 251 }),
  ]
  for (const payload of invalidPayloads) {
    const response = await plan(fixture(), payload)
    assert.equal(response.status, 400, JSON.stringify(payload))
  }
  assert.equal((await plan(fixture(), '{broken')).status, 400)
  assert.equal((await plan(fixture(), body({ participantUserIds: [1, 2], locks: Array.from(
    { length: 16 }, () => ({ type: 'role', userId: 1, role: 'tank' }),
  ) }))).status, 400)

  const optionalFields = body()
  delete optionalFields.challengeMapId
  delete optionalFields.locks
  assert.equal((await plan(fixture(), optionalFields)).status, 200)
  assert.equal((await plan(fixture(), body({
    participantUserIds: [1, 2],
    locks: Array.from({ length: 15 }, () => ({ type: 'role', userId: 1, role: 'tank' })),
  }))).status, 200)
})

test('Planner lock validation is exact and lock users must be selected', async () => {
  const invalidLocks = [
    [{ type: 'role', userId: 1, role: 'support' }],
    [{ type: 'character', userId: 1, characterId: 0 }],
    [{ type: 'assignment', userId: 1, characterId: 10 }],
    [{ type: 'role', userId: 1, role: 'tank', extra: true }],
    [{ type: 'role', userId: 3, role: 'dps' }],
  ]
  for (const locks of invalidLocks) {
    const response = await plan(fixture(), body({ participantUserIds: [1, 2], locks }))
    assert.equal(response.status, 400, JSON.stringify(locks))
  }
})

test('adapter loads configured played/loot specs and produces a real exact 1/1/3 response', async () => {
  const env = fixture()
  const response = await plan(env)
  const result = await response.json()

  assert.equal(response.status, 200)
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.recommendations[0].assignments.map(entry => entry.role).sort(), [
    'dps', 'dps', 'dps', 'healer', 'tank',
  ])
  const owner = result.recommendations[0].assignments.find(entry => entry.userId === 1)
  assert.equal(owner.specId, 73)
  assert.equal(owner.lootSpecId, 71)
  assert.equal(owner.objectives[0].itemId, 100)
  assert.equal(result.recommendations[0].lootSummary.weightedScore, 100)
  assert.deepEqual(env.DB.plannerQueryKinds, ['participants', 'stones', 'characters_preferences'])
})

test('sharing disabled keeps candidates but suppresses snapshot parsing and raw data', async () => {
  const env = fixture()
  env.DB.users.find(entry => entry.id === 3).share_keystone_loot_with_teams = 0
  env.DB.characters.find(entry => entry.id === 30).keystone_loot_json = '{private-broken-snapshot'
  const response = await plan(env)
  const result = await response.json()
  const mage = result.recommendations[0].assignments.find(entry => entry.userId === 3)

  assert.equal(response.status, 200)
  assert.deepEqual(mage.objectives, [])
  assert.ok(mage.capabilities.length > 0)
  assert.equal(env.DB.plannerSharedSnapshotCharacterIds.includes(30), false)
  const serialized = JSON.stringify(result)
  assert.equal(serialized.includes('private-broken-snapshot'), false)
  assert.equal(serialized.includes('keystone_loot_json'), false)
})

test('objective adapter keeps only exact dungeon/loot spec, pending and exact-variant targets', async () => {
  const env = fixture()
  env.DB.characters.find(entry => entry.id === 10).keystone_loot_json = JSON.stringify(supported([
    favorite(1, 1, { variantKey: 'base' }),
    favorite(1, 3, { variantKey: 'base' }),
    favorite(1, 2, { variantKey: 'bonus:1', bonusIds: [1] }),
    favorite(2, 3, { sourceType: 'raid' }),
    favorite(3, 3, { sourceType: 'catalyst', sourceId: 'catalyst' }),
    favorite(4, 3, { sourceId: 250 }),
    favorite(5, 3, { specId: 72 }),
    favorite(6, 3),
  ], { voidcore: { checked: true, usedItems: [6] } }))

  const result = await (await plan(env)).json()
  const objectives = result.recommendations[0].assignments.find(entry => entry.userId === 1).objectives
  assert.deepEqual(objectives.map(entry => [entry.itemId, entry.tier, entry.variantKey]), [
    [1, 3, 'base'], [1, 2, 'bonus:1'],
  ])
  assert.equal(result.recommendations[0].lootSummary.weightedScore, 160)
})

test('current-stone query uses latest same-week participant stones and applies dungeon filtering', async () => {
  const env = fixture()
  env.DB.keystones = [
    keystone(1, 10, 249, 9),
    keystone(2, 10, 250, 12),
    keystone(3, 20, 399, 11),
    keystone(4, 60, 249, 20),
    keystone(5, 30, 249, 15, { updated_at: currentEuWeeklyResetUnix() - 1 }),
    keystone(6, 40, 251, 16),
  ]
  let result = await (await plan(env)).json()
  assert.equal(result.availability.eligibleStoneCount, 2)
  assert.deepEqual(result.recommendations.map(entry => entry.stone.challengeMapId).sort(), [250, 399])
  assert.equal(JSON.stringify(result).includes('Character-60'), false)

  result = await (await plan(env, body({ challengeMapId: 399 }))).json()
  assert.equal(result.availability.eligibleStoneCount, 1)
  assert.ok(result.recommendations.every(entry => entry.stone.challengeMapId === 399))
})

test('zero stones and a selected dungeon without stones are HTTP 200 domain states', async () => {
  const env = fixture()
  env.DB.keystones = []
  let response = await plan(env)
  let result = await response.json()
  assert.equal(response.status, 200)
  assert.equal(result.status, 'no_valid_composition')
  assert.equal(result.availability.eligibleStoneCount, 0)
  assert.deepEqual(result.recommendations, [])
  assert.deepEqual(env.DB.plannerQueryKinds, ['participants', 'stones'])

  const filtered = fixture()
  response = await plan(filtered, body({ challengeMapId: 250 }))
  result = await response.json()
  assert.equal(response.status, 200)
  assert.equal(result.availability.eligibleStoneCount, 0)
})

test('unconfigured, incomplete and impossible parties remain HTTP 200 domain results', async () => {
  const unconfigured = fixture()
  unconfigured.DB.plannerPreferences = unconfigured.DB.plannerPreferences.filter(row => row.character_id !== 20)
  let response = await plan(unconfigured, body({ participantUserIds: [1, 2] }))
  let result = await response.json()
  assert.equal(response.status, 200)
  assert.equal(result.status, 'unconfigured_participants')
  assert.deepEqual(result.diagnostics.unconfiguredUserIds, [2])

  const incomplete = fixture()
  response = await plan(incomplete, body({ participantUserIds: [1, 2] }))
  result = await response.json()
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.recommendations[0].vacancies.map(entry => entry.role), ['dps', 'dps', 'dps'])

  const impossible = fixture()
  impossible.DB.characters.find(entry => entry.id === 20).wow_class = 'Paladin'
  impossible.DB.plannerPreferences = impossible.DB.plannerPreferences.map(row => row.character_id === 20
    ? preference(20, 66)
    : row)
  response = await plan(impossible, body({ participantUserIds: [1, 2] }))
  result = await response.json()
  assert.equal(response.status, 200)
  assert.equal(result.status, 'no_valid_composition')
})

test('semantic lock contradictions preserve solver diagnostics and map to HTTP 400', async () => {
  const response = await plan(fixture(), body({
    participantUserIds: [1, 2],
    locks: [
      { type: 'character', userId: 1, characterId: 10 },
      { type: 'assignment', userId: 1, characterId: 999, specId: 73 },
    ],
  }))
  const result = await response.json()
  assert.equal(response.status, 400)
  assert.equal(result.status, 'invalid_input')
  assert.deepEqual(result.diagnostics.lockIssues, ['LOCKS_HAVE_NO_CANDIDATE:1'])
})

test('public output enriches items and central capability metadata without exposing internals', async () => {
  const env = fixture()
  env.DB.itemMetadata = [{
    region: 'eu',
    locale: 'es_ES',
    item_id: 100,
    name: 'Botín del Planner',
    icon_url: 'https://render.worldofwarcraft.com/eu/icons/56/planner.jpg',
    slot_name: null,
    item_class_name: null,
    item_subclass_name: null,
    stat_names_json: '[]',
    stat_groups_json: JSON.stringify({ primary: [], secondary: [], other: [] }),
    quality_type: 'EPIC',
    status: 'ok',
    fetched_at: 1,
    refresh_after: Number.MAX_SAFE_INTEGER,
  }]
  const result = await (await plan(env)).json()
  const owner = result.recommendations[0].assignments.find(entry => entry.userId === 1)
  assert.deepEqual(owner.objectives[0], {
    itemId: 100,
    itemName: 'Botín del Planner',
    iconUrl: 'https://render.worldofwarcraft.com/eu/icons/56/planner.jpg',
    tier: 3,
    variantKey: 'base',
    voidcoreState: 'voidcore_not_checked',
  })
  const mage = result.recommendations[0].assignments.find(entry => entry.userId === 3)
  assert.ok(mage.capabilities.some(capability => capability.capabilityId === 'BLOODLUST'
    && capability.name === 'Bloodlust' && capability.iconSpellId === 2825
    && capability.stacking === 'unique'))
  assert.deepEqual(env.DB.metadataReadItemIds, [[100]])

  env.DB.itemMetadata = []
  const fallback = await (await plan(env)).json()
  assert.equal(fallback.recommendations[0].assignments.find(
    entry => entry.userId === 1,
  ).objectives[0].itemName, null)
})

test('metadata enrichment deduplicates Top 3 items and chunks large batches instead of N+1 reads', async () => {
  const env = fixture()
  env.DB.characters.find(entry => entry.id === 10).keystone_loot_json = JSON.stringify(supported(
    Array.from({ length: 101 }, (_, index) => favorite(index + 1, 1)),
  ))
  const response = await plan(env)
  assert.equal(response.status, 200)
  assert.deepEqual(env.DB.metadataReadItemIds.map(itemIds => itemIds.length), [100, 1])
})

test('Devourer remains Demon Hunter and null affinity remains solver-owned', async () => {
  const env = fixture()
  env.DB.characters.find(entry => entry.id === 40).wow_class = 'Demon Hunter'
  env.DB.plannerPreferences = env.DB.plannerPreferences.map(row => row.character_id === 40
    ? preference(40, 1480)
    : row)
  const result = await (await plan(env)).json()
  const devourer = result.recommendations[0].assignments.find(entry => entry.userId === 4)
  assert.equal(devourer.wowClass, 'Demon Hunter')
  assert.equal(devourer.specId, 1480)
})

test('endpoint returns deterministic Top 3 with holder binding, level and utilities intact', async () => {
  const env = fixture()
  env.DB.keystones.push(keystone(2, 20, 250, 11), keystone(3, 30, 399, 12), keystone(4, 40, 584, 13))
  const firstResponse = await (await plan(env, body({ targetLevel: 11 }))).json()
  const secondResponse = await (await plan(env, body({ targetLevel: 11 }))).json()
  assert.equal(firstResponse.recommendations.length, 3)
  assert.deepEqual(firstResponse.recommendations.map(entry => entry.stone.level), [10, 11, 12])
  assert.ok(firstResponse.recommendations.every(entry => entry.assignments.some(
    assignment => assignment.userId === entry.stone.ownerUserId
      && assignment.characterId === entry.stone.characterId,
  )))
  assert.deepEqual(secondResponse, firstResponse)
})

test('composition options reach utility ranking and optimizeComposition can disable it', async () => {
  const env = fixture()
  env.DB.characters.find(entry => entry.id === 30).wow_class = 'Hunter'
  env.DB.plannerPreferences = env.DB.plannerPreferences.map(row => row.character_id === 30
    ? preference(30, 253)
    : row)
  env.DB.characters.push(character(31, 3, 'Shaman'))
  env.DB.plannerPreferences.push(preference(31, 262))

  let result = await (await plan(env)).json()
  assert.equal(result.recommendations[0].assignments.find(entry => entry.userId === 3).specId, 262)
  assert.equal(result.recommendations[0].compositionSummary.bloodlust, 'guaranteed')

  result = await (await plan(env, body({ options: { ...options, optimizeComposition: false } }))).json()
  assert.equal(result.recommendations[0].assignments.find(entry => entry.userId === 3).specId, 253)
  assert.equal(result.recommendations[0].compositionSummary.bloodlust, 'conditional')
})

test('a viable current stone remains recommended when weighted loot is zero', async () => {
  const env = fixture()
  env.DB.characters.find(entry => entry.id === 10).keystone_loot_json = JSON.stringify(supported([]))
  const response = await plan(env)
  const result = await response.json()
  assert.equal(response.status, 200)
  assert.equal(result.status, 'ok')
  assert.equal(result.recommendations[0].lootSummary.weightedScore, 0)
})

test('defensive limits accept exact boundaries and reject overflow without truncation', async () => {
  for (const limit of ['participants', 'locks', 'candidates', 'stones', 'objectives']) {
    assert.doesNotThrow(() => assertPlannerDataLimit(limit, PLANNER_LIMITS[limit]))
    assert.throws(
      () => assertPlannerDataLimit(limit, PLANNER_LIMITS[limit] + 1),
      error => error instanceof PlannerDataLimitError && error.limit === limit,
    )
  }

  const env = fixture()
  for (let index = 0; index < PLANNER_LIMITS.candidates; index += 1) {
    const characterId = 1000 + index
    env.DB.characters.push(character(characterId, 1, 'Warrior'))
    env.DB.plannerPreferences.push(preference(characterId, 71))
  }
  const response = await plan(env)
  assert.equal(response.status, 422)
  assert.deepEqual(await response.json(), {
    detail: 'Los datos seleccionados superan los límites del Planner.',
  })
})
