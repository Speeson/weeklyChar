import test from 'node:test'
import assert from 'node:assert/strict'
import { getBattleNetOnboarding, startBattleNetLogin } from './battlenet.ts'

test('Battle.net start accepts only the official HTTPS authorization origin', async t => {
  const original = globalThis.fetch
  t.after(() => { globalThis.fetch = original })
  globalThis.fetch = async () => Response.json({ authorizationUrl: 'https://oauth.battle.net/authorize?scope=openid' })
  assert.equal(await startBattleNetLogin(), 'https://oauth.battle.net/authorize?scope=openid')
  globalThis.fetch = async () => Response.json({ authorizationUrl: 'https://evil.example/steal' })
  await assert.rejects(startBattleNetLogin(), /temporalmente/)
  globalThis.fetch = async () => Response.json({ authorizationUrl: 'https://oauth.battle.net.evil.example/authorize' })
  await assert.rejects(startBattleNetLogin(), /temporalmente/)
  globalThis.fetch = async () => Response.json({ authorizationUrl: 'https://oauth.battle.net/token' })
  await assert.rejects(startBattleNetLogin(), /temporalmente/)
})

test('onboarding projection exposes display state but no provider subject or secrets', async t => {
  const original = globalThis.fetch
  t.after(() => { globalThis.fetch = original })
  globalThis.fetch = async () => Response.json({
    status: 'needs_onboarding', displayName: 'Speeson#1234', desktop: false,
    provider_subject: 'must-not-project', access_token: 'must-not-project',
  })
  assert.deepEqual(await getBattleNetOnboarding('opaque'), { displayName: 'Speeson#1234', desktop: false })
})
