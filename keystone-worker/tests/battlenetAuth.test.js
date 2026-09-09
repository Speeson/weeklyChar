import test from 'node:test'
import assert from 'node:assert/strict'
import app from '../.tmp-test/index.js'
import { createAccessToken, hashPassword, pkceChallenge, sha256Hex } from '../.tmp-test/crypto.js'

const now = () => new Date().toISOString()

class Statement {
  constructor(db, sql) { this.db = db; this.sql = sql.replace(/\s+/g, ' ').trim(); this.values = [] }
  bind(...values) { this.values = values; return this }
  async first() {
    const [a, b] = this.values
    if (this.sql === 'SELECT attempts_json FROM rate_limits WHERE key = ?') {
      const value = this.db.rateLimits.get(a)
      return value ? { attempts_json: value } : null
    }
    if (this.sql.includes("FROM oauth_flows WHERE state_hash = ? AND status = 'pending'")) {
      return this.db.flows.find(flow => flow.state_hash === a && flow.status === 'pending') ?? null
    }
    if (this.sql === 'SELECT * FROM oauth_flows WHERE handoff_secret_hash = ?') {
      return this.db.flows.find(flow => flow.handoff_secret_hash === a) ?? null
    }
    if (this.sql.includes("FROM oauth_flows WHERE id = ? AND intent = 'login_desktop'")) {
      return this.db.flows.find(flow => flow.id === a && flow.intent === 'login_desktop') ?? null
    }
    if (this.sql.includes('FROM user_identities WHERE provider = ? AND provider_subject = ?')) {
      return this.db.identities.find(identity => identity.provider === a && identity.provider_subject === b) ?? null
    }
    if (this.sql.includes('FROM user_identities WHERE user_id = ? AND provider = ?')) {
      const identity = this.db.identities.find(row => row.user_id === a && row.provider === b) ?? null
      if (!identity) return null
      if (this.sql.startsWith('SELECT provider_display_name')) {
        return { provider_display_name: identity.provider_display_name, created_at: identity.created_at }
      }
      if (this.sql.startsWith('SELECT id ')) return { id: identity.id }
      return identity
    }
    if (this.sql === 'SELECT * FROM users WHERE username = ? COLLATE NOCASE') {
      return this.db.users.find(user => user.username.toLowerCase() === String(a).toLowerCase()) ?? null
    }
    if (this.sql === 'SELECT id FROM users WHERE username = ? COLLATE NOCASE') {
      const user = this.db.users.find(row => row.username.toLowerCase() === String(a).toLowerCase())
      return user ? { id: user.id } : null
    }
    if (this.sql === 'SELECT * FROM users WHERE id = ?') return this.db.users.find(user => user.id === a) ?? null
    if (this.sql === 'SELECT * FROM users WHERE sync_token = ?') return this.db.users.find(user => user.sync_token === a) ?? null
    throw new Error(`Unhandled first: ${this.sql}`)
  }
  async run() {
    const v = this.values
    if (this.sql.startsWith('INSERT INTO rate_limits')) { this.db.rateLimits.set(v[0], v[1]); return changed() }
    if (this.sql === 'DELETE FROM oauth_flows WHERE expires_at <= ?') {
      const before = this.db.flows.length
      this.db.flows = this.db.flows.filter(flow => flow.expires_at > v[0])
      return changed(before - this.db.flows.length)
    }
    if (this.sql.startsWith('INSERT INTO oauth_flows')) {
      this.db.flows.push({
        id: v[0], intent: v[1], state_hash: v[2], pkce_verifier: v[3], initiator_user_id: v[4],
        desktop_poll_secret_hash: v[5], handoff_secret_hash: null, provider_subject: null,
        provider_display_name: null, result_user_id: null, status: 'pending', expires_at: v[6],
        handoff_expires_at: null, created_at: now(), completed_at: null,
      })
      return changed()
    }
    if (this.sql.startsWith('UPDATE oauth_flows SET')) return this.updateFlow()
    if (this.sql.startsWith('UPDATE user_identities SET')) {
      const row = this.db.identities.find(identity => identity.id === v[2])
      if (!row) return changed(0)
      row.provider_display_name = v[0]; row.last_login_at = v[1]; return changed()
    }
    if (this.sql.startsWith('INSERT INTO user_identities') && this.sql.includes('SELECT id')) {
      const user = this.db.users.find(row => row.sync_token === v[4])
      if (!user) throw new Error('missing user for identity')
      return this.insertIdentity(user.id, v[0], v[1], v[2], v[3])
    }
    if (this.sql.startsWith('INSERT INTO user_identities')) return this.insertIdentity(v[0], v[1], v[2], v[3], v[4])
    if (this.sql.startsWith('INSERT INTO users')) {
      if (this.db.users.some(user => user.username.toLowerCase() === String(v[0]).toLowerCase())) {
        throw new Error('UNIQUE constraint failed: users.username')
      }
      const user = makeUser(this.db.nextUserId++, v[0], null, { sync_token: v[1], email: null, email_verified: 0 })
      this.db.users.push(user)
      return changed(1, user.id)
    }
    if (this.sql === 'DELETE FROM user_identities WHERE user_id = ? AND provider = ?') {
      const before = this.db.identities.length
      this.db.identities = this.db.identities.filter(row => !(row.user_id === v[0] && row.provider === v[1]))
      return changed(before - this.db.identities.length)
    }
    throw new Error(`Unhandled run: ${this.sql}`)
  }
  insertIdentity(userId, provider, subject, displayName, lastLoginAt) {
    if (this.db.identities.some(row => (row.provider === provider && row.provider_subject === subject)
      || (row.user_id === userId && row.provider === provider))) {
      throw new Error('UNIQUE constraint failed: user_identities')
    }
    this.db.identities.push({ id: this.db.nextIdentityId++, user_id: userId, provider,
      provider_subject: subject, provider_display_name: displayName, created_at: now(), last_login_at: lastLoginAt })
    return changed()
  }
  updateFlow() {
    const v = this.values
    const id = this.sql.includes("WHERE id = ? AND state_hash = ?") ? v[0]
      : this.sql.includes("WHERE id = ? AND status = 'ready'") ? v[v.length - 1]
      : this.sql.includes("WHERE id = ? AND status = 'needs_onboarding'") ? v[v.length - 1]
      : v[v.length - 1]
    const flow = this.db.flows.find(row => row.id === id)
    if (!flow) return changed(0)
    if (this.sql.includes("AND status = 'ready'") && flow.status !== 'ready') return changed(0)
    if (this.sql.includes("AND status = 'needs_onboarding'") && flow.status !== 'needs_onboarding') return changed(0)
    if (this.sql.includes('state_hash = NULL, pkce_verifier = NULL')) {
      flow.status = 'failed'; flow.state_hash = null; flow.pkce_verifier = null; flow.completed_at = v[0]
    } else if (this.sql.includes('SET state_hash = NULL')) {
      if (flow.state_hash !== v[1] || flow.status !== 'pending') return changed(0)
      flow.state_hash = null; flow.pkce_verifier = null
    } else if (this.sql.includes("status = 'needs_onboarding'")) {
      Object.assign(flow, { status: 'needs_onboarding', handoff_secret_hash: v[0], handoff_expires_at: v[1],
        provider_subject: v[2], provider_display_name: v[3], completed_at: v[4] })
    } else if (this.sql.includes("status = 'ready', handoff_secret_hash = ?")) {
      Object.assign(flow, { status: 'ready', handoff_secret_hash: v[0], handoff_expires_at: v[1],
        provider_subject: v[2], provider_display_name: v[3], result_user_id: v[4], completed_at: v[5] })
    } else if (this.sql.includes("status = 'ready', provider_subject")) {
      Object.assign(flow, { status: 'ready', provider_subject: v[0], provider_display_name: v[1],
        result_user_id: v[2], completed_at: v[3] })
    } else if (this.sql.includes("status = 'ready', handoff_secret_hash = NULL")) {
      Object.assign(flow, { status: 'ready', handoff_secret_hash: null, result_user_id: v[0], completed_at: v[1] })
    } else if (this.sql.includes("status = 'consumed', handoff_secret_hash = NULL")) {
      Object.assign(flow, { status: 'consumed', handoff_secret_hash: null, result_user_id: v[0] ?? flow.result_user_id,
        completed_at: v.length === 3 ? v[1] : v[0] })
    } else if (this.sql.includes("status = 'consumed', completed_at")) {
      Object.assign(flow, { status: 'consumed', completed_at: v[0] })
    } else if (this.sql.includes("status = 'consumed', provider_subject")) {
      Object.assign(flow, { status: 'consumed', provider_subject: v[0], provider_display_name: v[1],
        result_user_id: v[2], completed_at: v[3] })
    } else throw new Error(`Unhandled flow update: ${this.sql}`)
    return changed()
  }
}

const changed = (changes = 1, last_row_id = undefined) => ({ meta: { changes, last_row_id } })

class BattleNetD1 {
  constructor() { this.users = []; this.identities = []; this.flows = []; this.rateLimits = new Map(); this.nextUserId = 1; this.nextIdentityId = 1 }
  prepare(sql) { return new Statement(this, sql) }
  async batch(statements) { const results = []; for (const statement of statements) results.push(await statement.run()); return results }
}

function makeUser(id, username, password_hash, overrides = {}) {
  return { id, username, password_hash, sync_token: `sync-${id}`, avatar_url: null, first_name: null,
    last_name: null, email: `${username}@example.test`, date_of_birth: null, email_verified: 1,
    email_verification_token_hash: null, email_verification_expires_at: null,
    password_reset_token_hash: null, password_reset_expires_at: null,
    share_keystone_loot_with_teams: 1, created_at: now(), ...overrides }
}

function env(db = new BattleNetD1()) {
  return { DB: db, JWT_SECRET: 'jwt-secret', BLIZZARD_CLIENT_ID: 'client-id',
    BLIZZARD_CLIENT_SECRET: 'worker-only-secret', BATTLENET_REDIRECT_URI: 'https://api.example.test/api/auth/battlenet/callback',
    WEB_BASE_URL: 'https://web.example.test' }
}

async function post(environment, path, body = {}, headers = {}) {
  return app.request(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }, environment)
}

async function start(environment, desktop = false) {
  const response = await post(environment, `/api/auth/battlenet/${desktop ? 'desktop/start' : 'start'}`)
  assert.equal(response.status, 200)
  return response.json()
}

function mockBattleNet(t, {
  subject = 'stable-sub', battletag = 'Speeson#1234', tokenStatus = 200, userInfoStatus = 200,
  tokenPayload = null, userInfoPayload = null,
} = {}) {
  const original = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init })
    if (String(url).endsWith('/token')) return Response.json(tokenPayload ?? (tokenStatus === 200 ? { access_token: 'temporary-bnet-token', token_type: 'bearer', scope: 'openid' } : { error: 'invalid_grant' }), { status: tokenStatus })
    return Response.json(userInfoPayload ?? (userInfoStatus === 200 ? { sub: subject, battletag } : {}), { status: userInfoStatus })
  }
  t.after(() => { globalThis.fetch = original })
  return calls
}

test('web start uses only openid, random hashed state and PKCE S256', async () => {
  const environment = env()
  const first = await start(environment)
  const second = await start(environment)
  const firstUrl = new URL(first.authorizationUrl)
  const secondUrl = new URL(second.authorizationUrl)
  assert.equal(firstUrl.origin + firstUrl.pathname, 'https://oauth.battle.net/authorize')
  assert.equal(firstUrl.searchParams.get('scope'), 'openid')
  assert.equal(firstUrl.searchParams.get('code_challenge_method'), 'S256')
  assert.equal(firstUrl.searchParams.get('code_challenge'), await pkceChallenge(environment.DB.flows[0].pkce_verifier))
  assert.notEqual(firstUrl.searchParams.get('state'), secondUrl.searchParams.get('state'))
  assert.equal(environment.DB.flows[0].state_hash, await sha256Hex(firstUrl.searchParams.get('state')))
  assert.notEqual(environment.DB.flows[0].state_hash, firstUrl.searchParams.get('state'))
  assert.equal(JSON.stringify(environment.DB).includes('wow.profile'), false)
})

test('linked web callback updates display, discards Battle.net token and issues a single-use Keystone JWT ticket', async t => {
  const db = new BattleNetD1(); db.users.push(makeUser(1, 'Existing', await hashPassword('secret1'))); db.nextUserId = 2
  db.identities.push({ id: 1, user_id: 1, provider: 'battlenet', provider_subject: 'stable-sub', provider_display_name: 'Old#1111', created_at: now(), last_login_at: null })
  const environment = env(db); const started = await start(environment); const oauth = new URL(started.authorizationUrl)
  const calls = mockBattleNet(t, { battletag: 'New#2222' })
  const callback = await app.request(`/api/auth/battlenet/callback?code=one-code&state=${encodeURIComponent(oauth.searchParams.get('state'))}`, {}, environment)
  assert.equal(callback.status, 302)
  const ticket = new URL(callback.headers.get('location')).searchParams.get('ticket')
  assert.ok(ticket); assert.equal(db.flows[0].pkce_verifier, null); assert.equal(db.flows[0].state_hash, null)
  assert.equal(db.identities[0].provider_display_name, 'New#2222')
  const tokenCall = calls[0]
  assert.equal(tokenCall.init.body.get('code_verifier').length >= 43, true)
  assert.equal(calls[1].init.headers.Authorization, 'Bearer temporary-bnet-token')
  assert.equal(JSON.stringify(db).includes('temporary-bnet-token'), false)
  assert.equal(JSON.stringify(db).includes('one-code'), false)
  const exchanged = await post(environment, '/api/auth/battlenet/exchange', { ticket })
  assert.equal(exchanged.status, 200); assert.ok((await exchanged.json()).accessToken)
  assert.equal((await post(environment, '/api/auth/battlenet/exchange', { ticket })).status, 400)
})

test('unknown identity requires explicit username and creates Battle.net-only user without profile invention', async t => {
  const environment = env(); const started = await start(environment); const oauth = new URL(started.authorizationUrl)
  mockBattleNet(t)
  const callback = await app.request(`/api/auth/battlenet/callback?code=code&state=${oauth.searchParams.get('state')}`, {}, environment)
  const ticket = new URL(callback.headers.get('location')).searchParams.get('ticket')
  assert.equal(new URL(callback.headers.get('location')).pathname, '/login/battlenet/onboarding')
  const inspect = await post(environment, '/api/auth/battlenet/onboarding/status', { ticket })
  assert.deepEqual(await inspect.json(), { status: 'needs_onboarding', displayName: 'Speeson#1234', desktop: false })
  const register = await post(environment, '/api/auth/battlenet/onboarding/register', { ticket, username: 'ChosenName' })
  assert.equal(register.status, 200); assert.ok((await register.json()).accessToken)
  assert.equal(environment.DB.users[0].password_hash, null); assert.equal(environment.DB.users[0].email, null)
  assert.equal(environment.DB.identities[0].provider_subject, 'stable-sub')
  assert.equal((await post(environment, '/api/auth/battlenet/onboarding/register', { ticket, username: 'Replay' })).status, 400)
})

test('onboarding links the same verified password account and nullable-password traditional login is rejected', async t => {
  const passwordHash = await hashPassword('Correct1'); const db = new BattleNetD1()
  db.users.push(makeUser(7, 'Existing', passwordHash)); db.users.push(makeUser(8, 'BattleOnly', null, { email: null })); db.nextUserId = 9
  const environment = env(db); const started = await start(environment); const oauth = new URL(started.authorizationUrl); mockBattleNet(t)
  const callback = await app.request(`/api/auth/battlenet/callback?code=code&state=${oauth.searchParams.get('state')}`, {}, environment)
  const ticket = new URL(callback.headers.get('location')).searchParams.get('ticket')
  assert.equal((await post(environment, '/api/auth/battlenet/onboarding/link', { ticket, username: 'existing', password: 'wrong' })).status, 401)
  assert.equal((await post(environment, '/api/auth/battlenet/onboarding/link', { ticket, username: 'missing', password: 'Correct1' })).status, 401)
  const linked = await post(environment, '/api/auth/battlenet/onboarding/link', { ticket, username: 'existing', password: 'Correct1' })
  assert.equal(linked.status, 200); assert.equal(db.identities[0].user_id, 7)
  assert.equal((await post(environment, '/api/auth/login', { username: 'BattleOnly', password: 'anything' })).status, 401)
})

test('desktop polling requires its secret, reports pending, and consumes the ready result once', async t => {
  const db = new BattleNetD1(); db.users.push(makeUser(4, 'Desktop', await hashPassword('secret'))); db.nextUserId = 5
  db.identities.push({ id: 1, user_id: 4, provider: 'battlenet', provider_subject: 'stable-sub', provider_display_name: 'Desk#1', created_at: now(), last_login_at: null })
  const environment = env(db); const started = await start(environment, true)
  assert.equal((await post(environment, '/api/auth/battlenet/desktop/exchange', { flowId: started.flowId, pollSecret: 'wrong' })).status, 401)
  assert.deepEqual(await (await post(environment, '/api/auth/battlenet/desktop/exchange', started)).json(), { status: 'pending' })
  mockBattleNet(t)
  const oauth = new URL(started.authorizationUrl)
  const callback = await app.request(`/api/auth/battlenet/callback?code=desktop-code&state=${oauth.searchParams.get('state')}`, {}, environment)
  assert.equal(callback.status, 200); assert.match(await callback.text(), /volver a KeystoneClient/)
  const ready = await post(environment, '/api/auth/battlenet/desktop/exchange', started)
  assert.equal(ready.status, 200); assert.ok((await ready.json()).accessToken)
  assert.deepEqual(await (await post(environment, '/api/auth/battlenet/desktop/exchange', started)).json(), { status: 'consumed' })
})

test('invalid, expired, denied and malformed provider callbacks fail without reusable state', async t => {
  const environment = env()
  assert.equal((await app.request('/api/auth/battlenet/callback?code=x', {}, environment)).status, 400)
  assert.equal((await app.request('/api/auth/battlenet/callback?code=x&state=unknown', {}, environment)).status, 400)
  const missingCode = await start(environment); const missingCodeState = new URL(missingCode.authorizationUrl).searchParams.get('state')
  assert.match((await app.request(`/api/auth/battlenet/callback?state=${missingCodeState}`, {}, environment)).headers.get('location'), /authorization_failed/)
  assert.equal((await app.request(`/api/auth/battlenet/callback?code=x&state=${missingCodeState}`, {}, environment)).status, 400)
  const denied = await start(environment); const deniedState = new URL(denied.authorizationUrl).searchParams.get('state')
  const deniedResponse = await app.request(`/api/auth/battlenet/callback?error=access_denied&state=${deniedState}`, {}, environment)
  assert.equal(deniedResponse.status, 302); assert.match(deniedResponse.headers.get('location'), /cancelled/)
  assert.equal((await app.request(`/api/auth/battlenet/callback?code=x&state=${deniedState}`, {}, environment)).status, 400)
  const rejectedCode = await start(environment); const rejectedCodeState = new URL(rejectedCode.authorizationUrl).searchParams.get('state'); mockBattleNet(t, { tokenStatus: 400 })
  const rejectedCodeResponse = await app.request(`/api/auth/battlenet/callback?code=bad-code&state=${rejectedCodeState}`, {}, environment)
  assert.match(rejectedCodeResponse.headers.get('location'), /provider_error/)
  assert.equal(JSON.stringify(environment.DB).includes('bad-code'), false)
  const malformed = await start(environment); const malformedState = new URL(malformed.authorizationUrl).searchParams.get('state'); mockBattleNet(t, { userInfoStatus: 200, subject: '' })
  const malformedResponse = await app.request(`/api/auth/battlenet/callback?code=x&state=${malformedState}`, {}, environment)
  assert.match(malformedResponse.headers.get('location'), /provider_error/)
  const expired = await start(environment); const expiredState = new URL(expired.authorizationUrl).searchParams.get('state')
  const expiredHash = await sha256Hex(expiredState)
  environment.DB.flows.find(flow => flow.state_hash === expiredHash).expires_at = '2000-01-01T00:00:00.000Z'
  assert.equal((await app.request(`/api/auth/battlenet/callback?code=x&state=${expiredState}`, {}, environment)).status, 400)
})

test('invalid token shape and a provider PKCE rejection fail closed and consume state', async t => {
  const environment = env()
  const invalidToken = await start(environment); const invalidState = new URL(invalidToken.authorizationUrl).searchParams.get('state')
  mockBattleNet(t, { tokenPayload: { access_token: 'token', token_type: 'mac', scope: 'openid' } })
  const invalidResponse = await app.request(`/api/auth/battlenet/callback?code=code&state=${invalidState}`, {}, environment)
  assert.match(invalidResponse.headers.get('location'), /provider_error/)
  assert.equal((await app.request(`/api/auth/battlenet/callback?code=code&state=${invalidState}`, {}, environment)).status, 400)

  const rejectedPkce = await start(environment); const pkceState = new URL(rejectedPkce.authorizationUrl).searchParams.get('state')
  mockBattleNet(t, { tokenStatus: 400 })
  const rejectedResponse = await app.request(`/api/auth/battlenet/callback?code=reused-or-bad-pkce&state=${pkceState}`, {}, environment)
  assert.match(rejectedResponse.headers.get('location'), /provider_error/)
})

test('linking is idempotent for the owner and rejects identities owned by either side', async t => {
  const db = new BattleNetD1(); db.users.push(makeUser(1, 'Owner', await hashPassword('secret'))); db.users.push(makeUser(2, 'Other', await hashPassword('secret'))); db.nextUserId = 3
  db.identities.push({ id: 1, user_id: 2, provider: 'battlenet', provider_subject: 'other-sub', provider_display_name: 'Other#1', created_at: now(), last_login_at: null })
  const environment = env(db); const headers = { Authorization: `Bearer ${await createAccessToken(environment.JWT_SECRET, 1)}` }

  const conflict = await post(environment, '/api/me/identities/battlenet/start', {}, headers); const conflictState = new URL((await conflict.json()).authorizationUrl).searchParams.get('state')
  mockBattleNet(t, { subject: 'other-sub' })
  assert.match((await app.request(`/api/auth/battlenet/callback?code=x&state=${conflictState}`, {}, environment)).headers.get('location'), /already_linked/)

  db.identities.push({ id: 2, user_id: 1, provider: 'battlenet', provider_subject: 'owner-sub', provider_display_name: 'Owner#1', created_at: now(), last_login_at: null })
  const replacement = await post(environment, '/api/me/identities/battlenet/start', {}, headers); const replacementState = new URL((await replacement.json()).authorizationUrl).searchParams.get('state')
  mockBattleNet(t, { subject: 'different-sub' })
  assert.match((await app.request(`/api/auth/battlenet/callback?code=x&state=${replacementState}`, {}, environment)).headers.get('location'), /already_linked/)

  const idempotent = await post(environment, '/api/me/identities/battlenet/start', {}, headers); const idempotentState = new URL((await idempotent.json()).authorizationUrl).searchParams.get('state')
  mockBattleNet(t, { subject: 'owner-sub', battletag: 'Owner#2' })
  const idempotentResponse = await app.request(`/api/auth/battlenet/callback?code=x&state=${idempotentState}`, {}, environment)
  assert.equal(new URL(idempotentResponse.headers.get('location')).searchParams.get('battlenet'), 'linked')
  assert.equal(db.identities.find(row => row.user_id === 1).provider_display_name, 'Owner#2')
})

test('handoff, onboarding and desktop expiry paths never issue a Keystone session', async t => {
  const environment = env(); const started = await start(environment); const oauth = new URL(started.authorizationUrl); mockBattleNet(t)
  const callback = await app.request(`/api/auth/battlenet/callback?code=x&state=${oauth.searchParams.get('state')}`, {}, environment)
  const onboardingTicket = new URL(callback.headers.get('location')).searchParams.get('ticket')
  environment.DB.flows[0].handoff_expires_at = '2000-01-01T00:00:00.000Z'
  assert.equal((await post(environment, '/api/auth/battlenet/onboarding/status', { ticket: onboardingTicket })).status, 410)
  assert.equal((await post(environment, '/api/auth/battlenet/onboarding/link', { ticket: onboardingTicket, username: 'missing', password: 'wrong' })).status, 410)

  const linkedDb = new BattleNetD1(); linkedDb.users.push(makeUser(9, 'Linked', await hashPassword('secret')))
  linkedDb.identities.push({ id: 1, user_id: 9, provider: 'battlenet', provider_subject: 'stable-sub', provider_display_name: 'Linked#1', created_at: now(), last_login_at: null })
  const linkedEnvironment = env(linkedDb); const linkedStart = await start(linkedEnvironment); const linkedState = new URL(linkedStart.authorizationUrl).searchParams.get('state'); mockBattleNet(t)
  const linkedCallback = await app.request(`/api/auth/battlenet/callback?code=x&state=${linkedState}`, {}, linkedEnvironment)
  const handoffTicket = new URL(linkedCallback.headers.get('location')).searchParams.get('ticket')
  linkedDb.flows[0].handoff_expires_at = '2000-01-01T00:00:00.000Z'
  assert.equal((await post(linkedEnvironment, '/api/auth/battlenet/exchange', { ticket: handoffTicket })).status, 410)

  const desktop = await start(environment, true)
  environment.DB.flows.find(flow => flow.id === desktop.flowId).expires_at = '2000-01-01T00:00:00.000Z'
  assert.deepEqual(await (await post(environment, '/api/auth/battlenet/desktop/exchange', desktop)).json(), { status: 'expired' })
})

test('settings exposes display only, rejects sole-login unlink, and permits password-account unlink', async () => {
  const db = new BattleNetD1(); db.users.push(makeUser(1, 'Password', await hashPassword('secret'))); db.users.push(makeUser(2, 'Only', null, { email: null })); db.nextUserId = 3
  db.identities.push({ id: 1, user_id: 1, provider: 'battlenet', provider_subject: 'private-sub-1', provider_display_name: 'Visible#1', created_at: now(), last_login_at: null })
  db.identities.push({ id: 2, user_id: 2, provider: 'battlenet', provider_subject: 'private-sub-2', provider_display_name: 'Only#2', created_at: now(), last_login_at: null })
  const environment = env(db)
  const headers1 = { Authorization: `Bearer ${await createAccessToken(environment.JWT_SECRET, 1)}` }
  const identities = await app.request('/api/me/identities', { headers: headers1 }, environment)
  const body = await identities.json(); assert.equal(body.battleNet.displayName, 'Visible#1'); assert.equal(JSON.stringify(body).includes('private-sub'), false)
  const headers2 = { Authorization: `Bearer ${await createAccessToken(environment.JWT_SECRET, 2)}` }
  assert.equal((await app.request('/api/me/identities/battlenet', { method: 'DELETE', headers: headers2 }, environment)).status, 409)
  assert.equal((await app.request('/api/me/identities/battlenet', { method: 'DELETE', headers: headers1 }, environment)).status, 200)
  assert.equal(db.identities.some(row => row.user_id === 1), false)
})
