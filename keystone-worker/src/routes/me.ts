import { Hono } from 'hono'
import { getCurrentUser, getCurrentUserFlexible } from '../auth'
import { hashPassword, verifyPassword } from '../crypto'
import { charactersForUser, jsonDump } from '../db'
import { jsonError } from '../http'
import type { CharacterRow, Env } from '../types'

export const meRoutes = new Hono<{ Bindings: Env }>()

type CharacterEnrichRequest = {
  name: string
  realm: string
  region?: string
  avatarUrl?: string | null
  rioScore?: number | null
  wowClass?: string | null
  ilvl?: number | null
  vault?: unknown
  preyHunts?: unknown
  currencies?: unknown
  money?: unknown
  mythicPlusSeason?: unknown
}

type AvatarUpdateRequest = {
  avatarUrl: string
}

type ChangePasswordRequest = {
  currentPassword: string
  password: string
  confirmPassword: string
}

function isResponse(value: unknown): value is Response {
  return value instanceof Response
}

meRoutes.get('/api/me', async c => {
  const currentUser = await getCurrentUser(c)
  if (isResponse(currentUser)) return currentUser

  return c.json({
    id: currentUser.id,
    username: currentUser.username,
    syncToken: currentUser.sync_token,
    avatarUrl: currentUser.avatar_url,
    firstName: currentUser.first_name,
    lastName: currentUser.last_name,
    email: currentUser.email,
    dateOfBirth: currentUser.date_of_birth,
    emailVerified: Boolean(currentUser.email_verified),
  })
})

meRoutes.patch('/api/me/avatar', async c => {
  const currentUser = await getCurrentUserFlexible(c)
  if (isResponse(currentUser)) return currentUser

  const payload = await c.req.json<AvatarUpdateRequest>()
  await c.env.DB.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').bind(payload.avatarUrl, currentUser.id).run()

  return c.json({ status: 'ok', avatarUrl: payload.avatarUrl })
})

meRoutes.post('/api/me/change-password', async c => {
  const currentUser = await getCurrentUser(c)
  if (isResponse(currentUser)) return currentUser

  const payload = await c.req.json<ChangePasswordRequest>()
  if (!(await verifyPassword(payload.currentPassword ?? '', currentUser.password_hash))) {
    return jsonError(c, 400, 'La password actual no es correcta')
  }
  if ((payload.password ?? '').length < 6) {
    return jsonError(c, 400, 'La nueva password debe tener al menos 6 caracteres')
  }
  if (payload.password !== payload.confirmPassword) {
    return jsonError(c, 400, 'Las passwords no coinciden')
  }

  await c.env.DB.prepare(`
    UPDATE users
    SET password_hash = ?,
        password_reset_token_hash = NULL,
        password_reset_expires_at = NULL
    WHERE id = ?
  `).bind(await hashPassword(payload.password), currentUser.id).run()

  return c.json({ message: 'Password actualizada correctamente' })
})

meRoutes.get('/api/me/characters', async c => {
  const currentUser = await getCurrentUserFlexible(c)
  if (isResponse(currentUser)) return currentUser

  return c.json(await charactersForUser(c.env, currentUser.id, { includeKeystoneLoot: true }))
})

meRoutes.post('/api/me/characters/enrich', async c => {
  const currentUser = await getCurrentUserFlexible(c)
  if (isResponse(currentUser)) return currentUser

  const payload = await c.req.json<CharacterEnrichRequest>()
  const region = payload.region ?? 'eu'
  const character = await c.env.DB.prepare(`
    SELECT * FROM characters
    WHERE user_id = ? AND name = ? AND realm = ? AND region = ?
  `).bind(currentUser.id, payload.name, payload.realm, region).first<CharacterRow>()

  if (!character) return jsonError(c, 404, 'Personaje no encontrado')

  await c.env.DB.prepare(`
    UPDATE characters
    SET avatar_url = COALESCE(?, avatar_url),
        rio_score = COALESCE(?, rio_score),
        wow_class = COALESCE(?, wow_class),
        ilvl = COALESCE(?, ilvl),
        vault_json = COALESCE(?, vault_json),
        prey_hunts_json = COALESCE(?, prey_hunts_json),
        currencies_json = COALESCE(?, currencies_json),
        money_json = COALESCE(?, money_json),
        mythic_plus_season_json = COALESCE(?, mythic_plus_season_json),
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id = ?
  `).bind(
    payload.avatarUrl ?? null,
    payload.rioScore ?? null,
    payload.wowClass ?? null,
    payload.ilvl ?? null,
    payload.vault === undefined ? null : jsonDump(payload.vault),
    payload.preyHunts === undefined ? null : jsonDump(payload.preyHunts),
    payload.currencies === undefined ? null : jsonDump(payload.currencies),
    payload.money === undefined ? null : jsonDump(payload.money),
    payload.mythicPlusSeason === undefined ? null : jsonDump(payload.mythicPlusSeason),
    character.id,
  ).run()

  return c.json({ status: 'ok' })
})
