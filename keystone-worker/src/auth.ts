import type { Context } from 'hono'
import { verifyAccessToken } from './crypto'
import { getUserById, getUserBySyncToken as findUserBySyncToken } from './db'
import { jsonError } from './http'
import type { Env, UserRow } from './types'

export function getBearerToken(c: Context<{ Bindings: Env }>): string | null {
  const header = c.req.header('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  return header.slice('Bearer '.length).trim()
}

export async function getCurrentUser(c: Context<{ Bindings: Env }>): Promise<UserRow | Response> {
  const token = getBearerToken(c)
  if (!token) return jsonError(c, 401, 'Token invalido')

  const userId = await verifyAccessToken(c.env.JWT_SECRET, token)
  if (!userId) return jsonError(c, 401, 'Token invalido')

  const user = await getUserById(c.env, userId)
  if (!user) return jsonError(c, 401, 'Usuario no encontrado')

  return user
}

export async function getCurrentUserFlexible(c: Context<{ Bindings: Env }>): Promise<UserRow | Response> {
  const token = getBearerToken(c)
  if (!token) return jsonError(c, 401, 'Token invalido')

  const userId = await verifyAccessToken(c.env.JWT_SECRET, token)
  if (userId) {
    const user = await getUserById(c.env, userId)
    if (user) return user
  }

  const syncUser = await findUserBySyncToken(c.env, token)
  if (syncUser) return syncUser

  return jsonError(c, 401, 'Token invalido')
}

export async function getUserBySyncToken(c: Context<{ Bindings: Env }>): Promise<UserRow | Response> {
  const token = getBearerToken(c)
  if (!token) return jsonError(c, 401, 'Sync token invalido')

  const user = await findUserBySyncToken(c.env, token)
  if (!user) return jsonError(c, 401, 'Sync token invalido')

  return user
}
