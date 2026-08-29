import assert from 'node:assert/strict'
import test from 'node:test'
import {
  enrichKeystoneLootObjectives,
  normalizeBlizzardRegion,
  resetBlizzardTokenCacheForTests,
} from '../.tmp-test/blizzardItemMetadata.js'
import { FakeD1Database } from './fakeD1.js'

const NOW = 1_800_000_000

function objective(itemId) {
  return {
    itemId, itemName: null, iconUrl: null, tier: 3, specId: 102,
    sourceType: 'dungeon', sourceId: 249, slotId: 13, voidcoreState: 'pending',
  }
}

function env(credentials = true) {
  return {
    DB: new FakeD1Database(), JWT_SECRET: 'test',
    ...(credentials ? { BLIZZARD_CLIENT_ID: 'client', BLIZZARD_CLIENT_SECRET: 'secret' } : {}),
  }
}

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

function successfulFetch(calls) {
  return async (url, init = {}) => {
    calls.push({ url: String(url), init })
    if (String(url).includes('/oauth/token')) {
      return json({ access_token: 'token', expires_in: 3600 })
    }
    const id = Number(String(url).match(/item\/(\d+)/u)?.[1])
    if (String(url).includes('/media/item/')) {
      return json({ id, assets: [{ key: 'icon', value: `https://render.worldofwarcraft.com/eu/icons/${id}.jpg` }] })
    }
    return json({ id, name: `Objeto ${id}` })
  }
}

test('region is allowlisted and unknown values fall back to eu', () => {
  assert.equal(normalizeBlizzardRegion('US'), 'us')
  assert.equal(normalizeBlizzardRegion('cn'), 'eu')
  assert.equal(normalizeBlizzardRegion('https://evil.test'), 'eu')
})

test('fresh cache hits require no Blizzard credentials or network call', async () => {
  resetBlizzardTokenCacheForTests()
  const testEnv = env(false)
  testEnv.DB.itemMetadata.push({
    region: 'eu', locale: 'es_ES', item_id: 10, name: 'En caché',
    icon_url: 'https://render.worldofwarcraft.com/eu/icons/10.jpg', status: 'ok',
    fetched_at: NOW - 10, refresh_after: NOW + 10,
  })
  let calls = 0
  const result = await enrichKeystoneLootObjectives(testEnv, 'eu', [objective(10)], {
    now: NOW, fetch: async () => { calls += 1; throw new Error('unexpected') },
  })
  assert.equal(calls, 0)
  assert.equal(result[0].itemName, 'En caché')
})

test('invalid cached media URLs are rejected rather than returned', async () => {
  resetBlizzardTokenCacheForTests()
  const testEnv = env(false)
  testEnv.DB.itemMetadata.push({
    region: 'eu', locale: 'es_ES', item_id: 10, name: 'Poisoned',
    icon_url: 'https://evil.test/icon.jpg', status: 'ok',
    fetched_at: NOW - 10, refresh_after: NOW + 10,
  })
  const result = await enrichKeystoneLootObjectives(testEnv, 'eu', [objective(10)], { now: NOW })
  assert.equal(result[0].itemName, null)
  assert.equal(result[0].iconUrl, null)
})

test('cache miss uses OAuth plus official item/media endpoints and persists positive metadata', async () => {
  resetBlizzardTokenCacheForTests()
  const testEnv = env()
  const calls = []
  const result = await enrichKeystoneLootObjectives(testEnv, 'eu', [objective(10)], {
    now: NOW, fetch: successfulFetch(calls),
  })
  assert.equal(result[0].itemName, 'Objeto 10')
  assert.match(result[0].iconUrl, /render\.worldofwarcraft\.com/u)
  assert.equal(calls.filter(call => call.url.includes('/oauth/token')).length, 1)
  assert.equal(calls.filter(call => call.url.includes('/data/wow/item/10?namespace=static-eu&locale=es_ES')).length, 1)
  assert.equal(calls.filter(call => call.url.includes('/data/wow/media/item/10?namespace=static-eu&locale=es_ES')).length, 1)
  assert.match(calls[0].init.headers.Authorization, /^Basic /u)
  assert.equal(testEnv.DB.itemMetadata[0].refresh_after, NOW + 30 * 24 * 60 * 60)
})

test('stale positive metadata survives Blizzard 5xx and is not overwritten', async () => {
  resetBlizzardTokenCacheForTests()
  const testEnv = env()
  const stale = {
    region: 'eu', locale: 'es_ES', item_id: 10, name: 'Nombre anterior', icon_url: null,
    status: 'partial', fetched_at: NOW - 100, refresh_after: NOW - 1,
  }
  testEnv.DB.itemMetadata.push(stale)
  let calls = 0
  const result = await enrichKeystoneLootObjectives(testEnv, 'eu', [objective(10)], {
    now: NOW,
    fetch: async url => {
      calls += 1
      if (String(url).includes('/oauth/token')) return json({ access_token: 'token', expires_in: 3600 })
      return json({ error: 'down' }, 503)
    },
  })
  assert.equal(calls, 2)
  assert.equal(result[0].itemName, 'Nombre anterior')
  assert.equal(testEnv.DB.itemMetadata.length, 1)
})

test('confirmed 404 is negatively cached for six hours', async () => {
  resetBlizzardTokenCacheForTests()
  const testEnv = env()
  let calls = 0
  const fetch404 = async url => {
    calls += 1
    if (String(url).includes('/oauth/token')) return json({ access_token: 'token', expires_in: 3600 })
    return json({ code: 404 }, 404)
  }
  const first = await enrichKeystoneLootObjectives(testEnv, 'eu', [objective(404)], { now: NOW, fetch: fetch404 })
  const second = await enrichKeystoneLootObjectives(testEnv, 'eu', [objective(404)], { now: NOW + 1, fetch: fetch404 })
  assert.equal(first[0].itemName, null)
  assert.equal(second[0].itemName, null)
  assert.equal(calls, 2)
  assert.equal(testEnv.DB.itemMetadata[0].status, 'not_found')
  assert.equal(testEnv.DB.itemMetadata[0].refresh_after, NOW + 6 * 60 * 60)
})

test('401 refreshes OAuth once and then succeeds', async () => {
  resetBlizzardTokenCacheForTests()
  const testEnv = env()
  let oauth = 0
  let item = 0
  const fetch401 = async url => {
    if (String(url).includes('/oauth/token')) {
      oauth += 1
      return json({ access_token: `token-${oauth}`, expires_in: 3600 })
    }
    if (String(url).includes('/media/item/')) {
      return json({ id: 10, assets: [{ key: 'icon', value: 'https://render.worldofwarcraft.com/eu/icons/10.jpg' }] })
    }
    item += 1
    if (item === 1) return json({ error: 'expired' }, 401)
    return json({ id: 10, name: 'Recuperado' })
  }
  const result = await enrichKeystoneLootObjectives(testEnv, 'eu', [objective(10)], { now: NOW, fetch: fetch401 })
  assert.equal(oauth, 2)
  assert.equal(item, 2)
  assert.equal(result[0].itemName, 'Recuperado')
})

test('429, timeout, invalid JSON, oversized JSON and item-ID mismatch fail closed', async t => {
  const cases = [
    ['429', async url => String(url).includes('/oauth/token')
      ? json({ access_token: 'token', expires_in: 3600 })
      : json({ error: 'rate' }, 429, { 'Retry-After': '60' })],
    ['timeout', async (url, init) => {
      if (String(url).includes('/oauth/token')) return json({ access_token: 'token', expires_in: 3600 })
      return new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))
    }],
    ['invalid JSON', async url => String(url).includes('/oauth/token')
      ? json({ access_token: 'token', expires_in: 3600 })
      : new Response('{bad', { status: 200 })],
    ['oversized', async url => String(url).includes('/oauth/token')
      ? json({ access_token: 'token', expires_in: 3600 })
      : json({ id: 10, name: 'x'.repeat(70 * 1024) })],
    ['ID mismatch', async url => String(url).includes('/oauth/token')
      ? json({ access_token: 'token', expires_in: 3600 })
      : json({ id: 11, name: 'Wrong' })],
  ]
  for (const [name, fetchImpl] of cases) {
    await t.test(name, async () => {
      resetBlizzardTokenCacheForTests()
      const testEnv = env()
      const result = await enrichKeystoneLootObjectives(testEnv, 'eu', [objective(10)], {
        now: NOW, fetch: fetchImpl, timeoutMs: 5,
      })
      assert.equal(result[0].itemName, null)
      assert.equal(testEnv.DB.itemMetadata.length, name === '429' ? 1 : 0)
      if (name === '429') assert.equal(testEnv.DB.itemMetadata[0].refresh_after, NOW + 60)
    })
  }
})

test('bad media URLs are discarded while the validated name is cached as partial', async () => {
  resetBlizzardTokenCacheForTests()
  const testEnv = env()
  const fetchBadMedia = async url => {
    if (String(url).includes('/oauth/token')) return json({ access_token: 'token', expires_in: 3600 })
    if (String(url).includes('/media/item/')) {
      return json({ id: 10, assets: [{ key: 'icon', value: 'https://evil.test/icon.jpg' }] })
    }
    return json({ id: 10, name: 'Nombre válido' })
  }
  const result = await enrichKeystoneLootObjectives(testEnv, 'eu', [objective(10)], { now: NOW, fetch: fetchBadMedia })
  assert.equal(result[0].itemName, 'Nombre válido')
  assert.equal(result[0].iconUrl, null)
  assert.equal(testEnv.DB.itemMetadata[0].status, 'partial')
})

test('duplicate IDs fetch once per cache key and external concurrency never exceeds four', async () => {
  resetBlizzardTokenCacheForTests()
  const testEnv = env()
  let active = 0
  let maximum = 0
  let oauthCalls = 0
  const itemCalls = new Map()
  const fetchConcurrent = async url => {
    if (String(url).includes('/oauth/token')) {
      oauthCalls += 1
      return json({ access_token: 'token', expires_in: 3600 })
    }
    const id = Number(String(url).match(/item\/(\d+)/u)?.[1])
    active += 1
    maximum = Math.max(maximum, active)
    await new Promise(resolve => setTimeout(resolve, 5))
    active -= 1
    if (String(url).includes('/media/item/')) {
      return json({ id, assets: [{ key: 'icon', value: `https://render.worldofwarcraft.com/eu/icons/${id}.jpg` }] })
    }
    itemCalls.set(id, (itemCalls.get(id) ?? 0) + 1)
    return json({ id, name: `Objeto ${id}` })
  }
  const objectives = [...Array.from({ length: 10 }, (_, index) => objective(index + 1)), objective(1)]
  await enrichKeystoneLootObjectives(testEnv, 'eu', objectives, { now: NOW, fetch: fetchConcurrent })
  assert.equal(itemCalls.size, 10)
  assert.equal(itemCalls.get(1), 1)
  assert.ok(maximum <= 4, `maximum concurrency ${maximum}`)
  assert.equal(oauthCalls, 1)
})
