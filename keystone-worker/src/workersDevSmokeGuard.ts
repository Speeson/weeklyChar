import type { MiddlewareHandler } from 'hono'
import type { Env } from './types'

const SMOKE_HOST = 'keystone-sync-api.estebangperez77.workers.dev'
const SMOKE_HEADER = 'X-KeystoneSync-Smoke-Token'
const SMOKE_PATHS = new Set([
  '/api/health',
  '/api/teams/1/keystone-loot/dungeons/249/summary',
])

function tokensMatch(provided: string | undefined, expected: string | undefined): boolean {
  if (!provided || !expected) return false

  let difference = provided.length ^ expected.length
  const length = Math.max(provided.length, expected.length)
  for (let index = 0; index < length; index += 1) {
    difference |= (provided.charCodeAt(index) || 0) ^ (expected.charCodeAt(index) || 0)
  }
  return difference === 0
}

export const workersDevSmokeGuard: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  if (new URL(c.req.url).hostname.toLowerCase() !== SMOKE_HOST) {
    await next()
    return
  }

  const allowed = c.req.method === 'GET'
    && SMOKE_PATHS.has(new URL(c.req.url).pathname)
    && tokensMatch(c.req.header(SMOKE_HEADER), c.env.WORKER_SMOKE_BYPASS_TOKEN)

  if (!allowed) return c.notFound()

  await next()
}
