import type { Context, Next } from 'hono'
import type { Env } from './types'

type ErrorStatus = 400 | 401 | 403 | 404 | 429 | 500 | 502

export function jsonError(c: Context<{ Bindings: Env }>, status: ErrorStatus, detail: string) {
  return c.json({ detail }, status)
}

export async function corsMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const origin = c.req.header('Origin') ?? ''
  const allowed = (c.env.ALLOWED_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)

  if (allowed.includes(origin)) {
    c.header('Access-Control-Allow-Origin', origin)
  }

  c.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  c.header('Access-Control-Allow-Headers', 'Authorization,Content-Type')

  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204)
  }

  await next()
}
