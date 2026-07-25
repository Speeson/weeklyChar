import type { Context, Next } from 'hono'
import type { Env } from './types'

type ErrorStatus = 400 | 401 | 403 | 404 | 429 | 500 | 502

export function jsonError(c: Context<{ Bindings: Env }>, status: ErrorStatus, detail: string) {
  return c.json({ detail }, status)
}

export async function corsMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const origin = c.req.header('Origin') ?? ''
  const configuredOrigins = (c.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
  const allowed = new Set([
    'http://localhost:3000',
    'https://keystonesync.esgarpe.dev',
    ...configuredOrigins,
  ])

  if (allowed.has(origin)) {
    c.header('Access-Control-Allow-Origin', origin)
    c.header('Vary', 'Origin')
  }

  c.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  c.header('Access-Control-Allow-Headers', 'Authorization,Content-Type')

  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204)
  }

  await next()
}
