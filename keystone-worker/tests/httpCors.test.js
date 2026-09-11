import assert from 'node:assert/strict'
import test from 'node:test'

import app from '../.tmp-test/index.js'

test('localhost preflight permits PUT for Planner preference saves', async () => {
  const response = await app.request(
    'https://api-keystonesync.esgarpe.dev/api/me/planner/preferences',
    {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'PUT',
      },
    },
    {},
  )

  assert.equal(response.status, 204)
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'http://localhost:3000')
  assert.match(response.headers.get('Access-Control-Allow-Methods') ?? '', /(?:^|,)PUT(?:,|$)/)
})
