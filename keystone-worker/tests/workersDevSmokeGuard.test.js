import assert from 'node:assert/strict'
import test from 'node:test'

import app from '../.tmp-test/index.js'
import { FakeD1Database } from './fakeD1.js'

const CUSTOM_ORIGIN = 'https://api-keystonesync.esgarpe.dev'
const SMOKE_ORIGIN = 'https://keystone-sync-api.estebangperez77.workers.dev'
const SMOKE_TOKEN = 'test-only-smoke-token'
const SELECTOR_PATH = '/api/teams/1/keystone-loot/dungeons/249/summary'

function makeEnv(includeSmokeSecret = true) {
  return {
    DB: new FakeD1Database(),
    JWT_SECRET: 'test-jwt-secret',
    ...(includeSmokeSecret ? { WORKER_SMOKE_BYPASS_TOKEN: SMOKE_TOKEN } : {}),
  }
}

function smokeHeaders(token = SMOKE_TOKEN) {
  return { 'X-KeystoneSync-Smoke-Token': token }
}

test('custom domain preserves normal behavior without a smoke token', async () => {
  const env = makeEnv()
  const response = await app.request(`${CUSTOM_ORIGIN}/api/health`, {}, env)
  const authenticatedRoute = await app.request(`${CUSTOM_ORIGIN}/api/me`, {}, env)

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'ok', service: 'keystone-worker' })
  assert.equal(authenticatedRoute.status, 401)
})

test('workers.dev blocks requests when the Worker secret is unavailable', async () => {
  const response = await app.request(
    `${SMOKE_ORIGIN}/api/health`,
    { headers: smokeHeaders() },
    makeEnv(false),
  )

  assert.equal(response.status, 404)
})

test('workers.dev blocks a missing or incorrect smoke token', async () => {
  for (const headers of [{}, smokeHeaders('incorrect')]) {
    const response = await app.request(`${SMOKE_ORIGIN}/api/health`, { headers }, makeEnv())
    assert.equal(response.status, 404)
  }
})

test('workers.dev blocks every non-smoke path even with the correct token', async () => {
  for (const path of ['/api/me', '/api/teams', `${SELECTOR_PATH}/extra`]) {
    const response = await app.request(
      `${SMOKE_ORIGIN}${path}`,
      { headers: smokeHeaders() },
      makeEnv(),
    )
    assert.equal(response.status, 404)
  }
})

test('workers.dev blocks non-GET methods even on an allowed path', async () => {
  const response = await app.request(
    `${SMOKE_ORIGIN}/api/health`,
    { method: 'POST', headers: smokeHeaders() },
    makeEnv(),
  )

  assert.equal(response.status, 404)
})

test('workers.dev permits authenticated smoke access to normal health behavior', async () => {
  const response = await app.request(
    `${SMOKE_ORIGIN}/api/health`,
    { headers: smokeHeaders() },
    makeEnv(),
  )

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'ok', service: 'keystone-worker' })
})

test('workers.dev Selector smoke still requires normal KeystoneSync authentication', async () => {
  const response = await app.request(
    `${SMOKE_ORIGIN}${SELECTOR_PATH}`,
    { headers: smokeHeaders() },
    makeEnv(),
  )

  assert.equal(response.status, 401)
  assert.equal(typeof (await response.json()).detail, 'string')
})
