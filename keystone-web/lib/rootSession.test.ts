import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createDashboardRedirect,
  resolveRootSession,
  type RootSessionDependencies,
} from './rootSession.ts'

function dependencies(overrides: Partial<RootSessionDependencies> = {}): RootSessionDependencies {
  return {
    getToken: () => 'stored-token',
    hydrateProfile: async () => ({ username: 'Spee' }),
    clearToken: () => {},
    ...overrides,
  }
}

test('shows the landing page without validating when no token exists', async () => {
  let hydrationCalls = 0
  const result = await resolveRootSession(dependencies({
    getToken: () => null,
    hydrateProfile: async () => {
      hydrationCalls += 1
      return { username: 'Spee' }
    },
  }))

  assert.equal(result, 'landing')
  assert.equal(hydrationCalls, 0)
})

test('redirects to the dashboard after a valid profile hydration', async () => {
  const result = await resolveRootSession(dependencies())

  assert.equal(result, 'dashboard')
})

test('clears invalid auth storage and keeps the landing page visible', async () => {
  let clearCalls = 0
  const result = await resolveRootSession(dependencies({
    hydrateProfile: async () => null,
    clearToken: () => {
      clearCalls += 1
    },
  }))

  assert.equal(result, 'landing')
  assert.equal(clearCalls, 1)
})

test('preserves auth storage after a network or transient failure', async () => {
  let clearCalls = 0
  const result = await resolveRootSession(dependencies({
    hydrateProfile: async () => {
      throw new Error('network unavailable')
    },
    clearToken: () => {
      clearCalls += 1
    },
  }))

  assert.equal(result, 'landing')
  assert.equal(clearCalls, 0)
})

test('dashboard replacement can only run once', () => {
  const destinations: string[] = []
  const redirect = createDashboardRedirect(destination => destinations.push(destination))

  redirect()
  redirect()

  assert.deepEqual(destinations, ['/dashboard'])
})
