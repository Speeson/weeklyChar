import { sha256Hex } from './crypto'
import type { Env } from './types'

const IP_LIMIT = 5
const IP_WINDOW_SECONDS = 900
const IDENTITY_LIMIT = 3
const IDENTITY_WINDOW_SECONDS = 3600
const COOLDOWN_SECONDS = 120

type EmailAction = 'forgot_password' | 'resend_verification'

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

async function rateLimitKey(scope: string, value: string): Promise<string> {
  return `${scope}:${await sha256Hex(value)}`
}

async function checkRateLimit(env: Env, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const now = nowSeconds()
  const row = await env.DB.prepare('SELECT attempts_json FROM rate_limits WHERE key = ?').bind(key).first<{ attempts_json: string }>()
  const attempts = row ? JSON.parse(row.attempts_json) as number[] : []
  const activeAttempts = attempts.filter(attempt => now - attempt < windowSeconds)

  if (activeAttempts.length >= limit) return false

  activeAttempts.push(now)
  await env.DB.prepare(`
    INSERT INTO rate_limits (key, attempts_json, updated_at)
    VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    ON CONFLICT(key) DO UPDATE SET
      attempts_json = excluded.attempts_json,
      updated_at = excluded.updated_at
  `).bind(key, JSON.stringify(activeAttempts)).run()

  return true
}

export async function checkEmailRateLimits(
  env: Env,
  action: EmailAction,
  clientIp: string,
  identity: string,
): Promise<Response | null> {
  const normalizedIdentity = identity.trim().toLowerCase()
  const checks: Array<[string, number, number]> = [
    [await rateLimitKey(`${action}:ip`, clientIp), IP_LIMIT, IP_WINDOW_SECONDS],
    [await rateLimitKey(`${action}:identity`, normalizedIdentity), IDENTITY_LIMIT, IDENTITY_WINDOW_SECONDS],
    [await rateLimitKey(`${action}:cooldown`, normalizedIdentity), 1, COOLDOWN_SECONDS],
  ]

  for (const [key, limit, windowSeconds] of checks) {
    const ok = await checkRateLimit(env, key, limit, windowSeconds)
    if (!ok) {
      return Response.json(
        { detail: 'Demasiados intentos. Espera unos minutos antes de volver a probar.' },
        { status: 429 },
      )
    }
  }

  return null
}
