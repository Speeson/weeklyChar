import { Hono } from 'hono'
import type { Context } from 'hono'
import { getCurrentUser, getCurrentUserFlexible } from '../auth'
import { hashPassword, verifyPassword } from '../crypto'
import { charactersForUser, jsonDump } from '../db'
import { enrichKeystoneLootObjectives } from '../blizzardItemMetadata'
import { jsonError } from '../http'
import { buildKeystoneLootObjectivePage } from '../keystoneObjectives'
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

type PreferencesUpdateRequest = {
  shareKeystoneLootWithTeams?: unknown
}

type KeystoneLootResetRequest = {
  region?: unknown
  wowAccount?: unknown
}

const KEYSTONE_LOOT_RESET_REGIONS = new Set(['eu', 'us', 'kr', 'tw'])

function isResponse(value: unknown): value is Response {
  return value instanceof Response
}

function positiveIntegerQuery(value: string | undefined, field: string): number | undefined {
  if (value === undefined) return undefined
  const parsed = Number(value)
  if (value.trim() === '' || !Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${field} debe ser un entero positivo`)
  }
  return parsed
}

function objectiveQuery(c: Context<{ Bindings: Env }>) {
  const rawLimit = c.req.query('limit')
  const limit = rawLimit === undefined ? 50 : positiveIntegerQuery(rawLimit, 'limit')
  if (limit === undefined || limit > 100) throw new Error('limit debe estar entre 1 y 100')
  const sourceType = c.req.query('sourceType')
  if (sourceType !== undefined && (sourceType.trim() === '' || sourceType.length > 64)) {
    throw new Error('sourceType no es válido')
  }
  const rawSourceId = c.req.query('sourceId')
  let sourceId: number | string | undefined
  if (rawSourceId !== undefined) {
    if (rawSourceId.trim() === '' || rawSourceId.length > 128) throw new Error('sourceId no es válido')
    const numeric = Number(rawSourceId)
    sourceId = Number.isSafeInteger(numeric) && numeric > 0 ? numeric : rawSourceId
    if (sourceType === 'dungeon' && typeof sourceId !== 'number') {
      throw new Error('sourceId de dungeon debe ser un entero positivo')
    }
    if (sourceType === undefined) throw new Error('sourceId requiere sourceType')
  }
  return {
    limit,
    sourceType,
    sourceId,
    specId: positiveIntegerQuery(c.req.query('specId'), 'specId'),
    cursor: c.req.query('cursor'),
  }
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
    shareKeystoneLootWithTeams: Boolean(currentUser.share_keystone_loot_with_teams),
  })
})

meRoutes.patch('/api/me/preferences', async c => {
  const currentUser = await getCurrentUser(c)
  if (isResponse(currentUser)) return currentUser

  const payload = await c.req.json<PreferencesUpdateRequest>().catch(() => null)
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
    || typeof payload.shareKeystoneLootWithTeams !== 'boolean') {
    return jsonError(c, 400, 'shareKeystoneLootWithTeams debe ser booleano')
  }

  const enabled = payload.shareKeystoneLootWithTeams
  await c.env.DB.prepare(`
    UPDATE users
    SET share_keystone_loot_with_teams = ?
    WHERE id = ?
  `).bind(enabled ? 1 : 0, currentUser.id).run()

  return c.json({ shareKeystoneLootWithTeams: enabled })
})

meRoutes.post('/api/me/keystone-loot/reset', async c => {
  const currentUser = await getCurrentUserFlexible(c)
  if (isResponse(currentUser)) return currentUser

  const payload = await c.req.json<KeystoneLootResetRequest>().catch(() => null)
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
    || Object.keys(payload).some(key => key !== 'region' && key !== 'wowAccount')
    || typeof payload.region !== 'string' || !KEYSTONE_LOOT_RESET_REGIONS.has(payload.region)
    || typeof payload.wowAccount !== 'string' || payload.wowAccount.trim() !== payload.wowAccount
    || payload.wowAccount.length === 0 || payload.wowAccount.length > 128) {
    return jsonError(c, 400, 'region o wowAccount no válidos')
  }

  const result = await c.env.DB.prepare(`
    UPDATE characters
    SET keystone_loot_json = NULL
    WHERE user_id = ? AND region = ? AND wow_account = ?
      AND keystone_loot_json IS NOT NULL
  `).bind(currentUser.id, payload.region, payload.wowAccount).run()

  return c.json({
    status: 'ok',
    region: payload.region,
    wowAccount: payload.wowAccount,
    clearedCharacters: result.meta.changes ?? 0,
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

meRoutes.get('/api/me/characters/:characterId/keystone-loot/objectives', async c => {
  const currentUser = await getCurrentUser(c)
  if (isResponse(currentUser)) return currentUser

  const characterId = Number(c.req.param('characterId'))
  if (!Number.isSafeInteger(characterId) || characterId <= 0) {
    return jsonError(c, 400, 'characterId debe ser un entero positivo')
  }
  const character = await c.env.DB.prepare('SELECT * FROM characters WHERE id = ? AND user_id = ?')
    .bind(characterId, currentUser.id)
    .first<CharacterRow>()
  if (!character) return jsonError(c, 404, 'Personaje no encontrado')

  try {
    const page = buildKeystoneLootObjectivePage(character.keystone_loot_json, objectiveQuery(c))
    page.objectives = await enrichKeystoneLootObjectives(c.env, character.region, page.objectives)
    return c.json(page)
  } catch (error) {
    return jsonError(c, 400, error instanceof Error ? error.message : 'Filtros no válidos')
  }
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
