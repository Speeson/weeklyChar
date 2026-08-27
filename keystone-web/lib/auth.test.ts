import assert from 'node:assert/strict'
import test from 'node:test'

import { hydrateProfile } from './auth.ts'

test('profile hydration returns null for an unauthorized session', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 401 }))

  assert.equal(await hydrateProfile(), null)
})

test('profile hydration rejects transient HTTP failures', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 503 }))

  await assert.rejects(hydrateProfile(), /503/)
})
