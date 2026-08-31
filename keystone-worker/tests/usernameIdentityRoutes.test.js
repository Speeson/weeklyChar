import test from 'node:test'
import assert from 'node:assert/strict'
import app from '../.tmp-test/index.js'
import { createAccessToken, hashPassword } from '../.tmp-test/crypto.js'
import { FakeD1Database } from './fakeD1.js'


function user(id, username, passwordHash, overrides = {}) {
  return {
    id,
    username,
    password_hash: passwordHash,
    sync_token: `sync-${id}`,
    avatar_url: null,
    first_name: 'Test',
    last_name: 'User',
    email: `${username.toLowerCase()}@example.test`,
    date_of_birth: '1990-01-01',
    email_verified: 1,
    email_verification_token_hash: null,
    email_verification_expires_at: null,
    password_reset_token_hash: null,
    password_reset_expires_at: null,
    share_keystone_loot_with_teams: 1,
    created_at: '2026-08-31T00:00:00.000Z',
    ...overrides,
  }
}

async function makeEnv(users) {
  const DB = new FakeD1Database()
  DB.users = users
  return { DB, JWT_SECRET: 'username-test-secret' }
}

async function jsonPost(env, path, body, userId = null) {
  const headers = { 'Content-Type': 'application/json' }
  if (userId !== null) {
    headers.Authorization = `Bearer ${await createAccessToken(env.JWT_SECRET, userId)}`
  }
  return app.request(path, { method: 'POST', headers, body: JSON.stringify(body) }, env)
}

test('registration rejects every case-only duplicate and preserves the existing row', async () => {
  const passwordHash = await hashPassword('secret1')
  for (const username of ['spee', 'SPEE']) {
    const env = await makeEnv([user(1, 'Spee', passwordHash)])
    const response = await jsonPost(env, '/api/auth/register', {
      firstName: 'Case',
      lastName: 'Duplicate',
      email: `${username}@new.example`,
      username,
      password: 'secret2',
      confirmPassword: 'secret2',
      dateOfBirth: '1990-01-01',
    })

    assert.equal(response.status, 400)
    assert.equal((await response.json()).detail, 'Nombre de usuario ya en uso')
    assert.equal(env.DB.users.length, 1)
    assert.equal(env.DB.users[0].username, 'Spee')
  }
})

test('registration maps a database uniqueness race to the duplicate username response', async () => {
  const env = await makeEnv([])
  env.DB.forceUsernameInsertConflict = true

  const response = await jsonPost(env, '/api/auth/register', {
    firstName: 'Case',
    lastName: 'Race',
    email: 'race@example.test',
    username: 'Spee',
    password: 'secret2',
    confirmPassword: 'secret2',
    dateOfBirth: '1990-01-01',
  })

  assert.equal(response.status, 400)
  assert.equal((await response.json()).detail, 'Nombre de usuario ya en uso')
  assert.equal(env.DB.users.length, 0)
})

test('login trims and resolves case variants while password matching stays case-sensitive', async () => {
  const passwordHash = await hashPassword('CorrectCase1')
  const env = await makeEnv([user(1, 'Spee', passwordHash)])

  for (const username of ['spee', 'SPEE', '  sPeE  ']) {
    const response = await jsonPost(env, '/api/auth/login', { username, password: 'CorrectCase1' })
    assert.equal(response.status, 200, username)
  }

  const wrongPassword = await jsonPost(env, '/api/auth/login', {
    username: 'spee',
    password: 'correctcase1',
  })
  assert.equal(wrongPassword.status, 401)
})

async function teamEnv(ownerName = 'Owner', targetName = 'Spee') {
  const passwordHash = await hashPassword('secret1')
  const env = await makeEnv([
    user(1, ownerName, passwordHash),
    user(2, targetName, passwordHash),
  ])
  env.DB.teams = [{
    id: 7,
    name: 'Case Team',
    invite_code: 'case-code',
    created_by: 1,
    created_at: '2026-08-31T00:00:00.000Z',
  }]
  env.DB.teamMembers = [{ id: 1, team_id: 7, user_id: 1 }]
  return env
}

test('Team invite resolves case-insensitively and returns stored display casing', async () => {
  const env = await teamEnv()

  const response = await jsonPost(env, '/api/teams/7/invites', { username: '  sPeE  ' }, 1)

  assert.equal(response.status, 201)
  const invitation = await response.json()
  assert.equal(invitation.invitedUsername, 'Spee')
  assert.equal(env.DB.teamInvitations[0].invited_user_id, 2)
})

test('case variants cannot bypass pending-invite duplicate protection', async () => {
  const env = await teamEnv()
  assert.equal((await jsonPost(env, '/api/teams/7/invites', { username: 'Spee' }, 1)).status, 201)

  const duplicate = await jsonPost(env, '/api/teams/7/invites', { username: 'SPEE' }, 1)

  assert.equal(duplicate.status, 400)
  assert.equal((await duplicate.json()).detail, 'Ese usuario ya tiene una invitacion pendiente')
  assert.equal(env.DB.teamInvitations.length, 1)
})

test('case variants cannot bypass self-invite protection', async () => {
  const passwordHash = await hashPassword('secret1')
  const env = await makeEnv([user(1, 'Spee', passwordHash)])
  env.DB.teams = [{ id: 7, name: 'Case Team', invite_code: 'case-code', created_by: 1 }]
  env.DB.teamMembers = [{ id: 1, team_id: 7, user_id: 1 }]

  const response = await jsonPost(env, '/api/teams/7/invites', { username: 'sPeE' }, 1)

  assert.equal(response.status, 400)
  assert.equal((await response.json()).detail, 'No puedes invitarte a ti mismo')
})

test('case variants cannot bypass existing-member protection', async () => {
  const env = await teamEnv()
  env.DB.teamMembers.push({ id: 2, team_id: 7, user_id: 2 })

  const response = await jsonPost(env, '/api/teams/7/invites', { username: 'SPEE' }, 1)

  assert.equal(response.status, 400)
  assert.equal((await response.json()).detail, 'Ese usuario ya pertenece al equipo')
})

test('resend verification resolves case variants, preserves display casing, and shares rate-limit identity', async t => {
  const passwordHash = await hashPassword('secret1')
  const env = await makeEnv([user(1, 'Spee', passwordHash, {
    email: 'spee@example.test',
    email_verified: 0,
  })])
  env.RESEND_API_KEY = 'test-resend-key'
  const originalFetch = globalThis.fetch
  let emailBody = null
  globalThis.fetch = async (_url, init) => {
    emailBody = JSON.parse(init.body)
    return new Response('', { status: 200 })
  }
  t.after(() => { globalThis.fetch = originalFetch })

  const first = await jsonPost(env, '/api/auth/resend-verification', { emailOrUsername: '  spee  ' })
  assert.equal(first.status, 200)
  assert.match(emailBody.text, /^Hola Spee,/)
  assert.ok(env.DB.users[0].email_verification_token_hash)

  const second = await jsonPost(env, '/api/auth/resend-verification', { emailOrUsername: 'SPEE' })
  assert.equal(second.status, 429)
})
