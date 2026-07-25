import bcrypt from 'bcryptjs'

const TOKEN_EXPIRE_SECONDS = 30 * 24 * 60 * 60

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlEncodeString(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlDecodeString(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  return atob(padded)
}

async function hmacSha256(secret: string, value: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return new Uint8Array(signature)
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export function newPlainToken(bytes = 32): string {
  const values = new Uint8Array(bytes)
  crypto.getRandomValues(values)
  return base64UrlEncode(values)
}

export function newSyncToken(): string {
  const values = new Uint8Array(32)
  crypto.getRandomValues(values)
  return [...values].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export function newInviteCode(): string {
  const values = new Uint8Array(8)
  crypto.getRandomValues(values)
  return [...values].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createAccessToken(secret: string, userId: number): Promise<string> {
  const header = base64UrlEncodeString(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = base64UrlEncodeString(JSON.stringify({
    sub: String(userId),
    exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRE_SECONDS,
  }))
  const unsigned = `${header}.${payload}`
  const signature = base64UrlEncode(await hmacSha256(secret, unsigned))
  return `${unsigned}.${signature}`
}

export async function verifyAccessToken(secret: string, token: string): Promise<number | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const unsigned = `${parts[0]}.${parts[1]}`
  const expected = base64UrlEncode(await hmacSha256(secret, unsigned))
  if (expected !== parts[2]) return null

  try {
    const payload = JSON.parse(base64UrlDecodeString(parts[1])) as { sub?: string, exp?: number }
    if (!payload.sub || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null
    const userId = Number(payload.sub)
    return Number.isInteger(userId) ? userId : null
  } catch {
    return null
  }
}
