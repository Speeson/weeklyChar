import { Hono } from 'hono'
import { getUserBySyncToken } from '../auth'
import { jsonDump, latestRealKeystone } from '../db'
import { jsonError } from '../http'
import { validateKeystoneLoot } from '../keystoneLoot'
import type { CharacterRow, Env } from '../types'

export const keystoneRoutes = new Hono<{ Bindings: Env }>()

type KeystoneUpdateRequest = {
  character: string
  realm: string
  region?: string
  hasKeystone?: boolean
  keystoneLevel?: number | null
  keystoneChallengeMapId?: number | null
  keystoneMapId?: number | null
  keystoneDungeon?: string | null
  updatedAt?: number | null
  updatedReason?: string | null
  wowAccount?: string | null
  avatarUrl?: string | null
  rioScore?: number | null
  wowClass?: string | null
  ilvl?: number | null
  vault?: unknown
  preyHunts?: unknown
  currencies?: unknown
  money?: unknown
  mythicPlusSeason?: unknown
  keystoneLoot?: unknown
}

function isResponse(value: unknown): value is Response {
  return value instanceof Response
}

keystoneRoutes.post('/api/keystones/update', async c => {
  const currentUser = await getUserBySyncToken(c)
  if (isResponse(currentUser)) return currentUser

  const payload = await c.req.json<KeystoneUpdateRequest>()
  const region = payload.region ?? 'eu'
  const hasKeystoneLoot = Object.prototype.hasOwnProperty.call(payload, 'keystoneLoot')
  if (!payload.character || !payload.realm) {
    return jsonError(c, 400, 'Personaje y reino son obligatorios')
  }

  if (hasKeystoneLoot) {
    const keystoneLootError = validateKeystoneLoot(payload.keystoneLoot)
    if (keystoneLootError) {
      return jsonError(c, 400, `Datos de KeystoneLoot no válidos: ${keystoneLootError}`)
    }
  }

  let character = await c.env.DB.prepare(`
    SELECT * FROM characters
    WHERE user_id = ? AND name = ? AND realm = ? AND region = ?
  `).bind(currentUser.id, payload.character, payload.realm, region).first<CharacterRow>()

  if (!character) {
    const insert = await c.env.DB.prepare(`
      INSERT INTO characters (user_id, name, realm, region)
      VALUES (?, ?, ?, ?)
    `).bind(currentUser.id, payload.character, payload.realm, region).run()
    character = await c.env.DB.prepare('SELECT * FROM characters WHERE id = ?').bind(insert.meta.last_row_id).first<CharacterRow>()
  }

  if (!character) return jsonError(c, 500, 'No se pudo crear el personaje')

  await c.env.DB.prepare(`
    UPDATE characters
    SET wow_account = COALESCE(?, wow_account),
        avatar_url = COALESCE(?, avatar_url),
        rio_score = COALESCE(?, rio_score),
        wow_class = COALESCE(?, wow_class),
        ilvl = COALESCE(?, ilvl),
        vault_json = COALESCE(?, vault_json),
        prey_hunts_json = COALESCE(?, prey_hunts_json),
        currencies_json = COALESCE(?, currencies_json),
        money_json = COALESCE(?, money_json),
        mythic_plus_season_json = COALESCE(?, mythic_plus_season_json),
        keystone_loot_json = COALESCE(?, keystone_loot_json),
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id = ?
  `).bind(
    payload.wowAccount ?? null,
    payload.avatarUrl ?? null,
    payload.rioScore ?? null,
    payload.wowClass ?? null,
    payload.ilvl ?? null,
    payload.vault === undefined ? null : jsonDump(payload.vault),
    payload.preyHunts === undefined ? null : jsonDump(payload.preyHunts),
    payload.currencies === undefined ? null : jsonDump(payload.currencies),
    payload.money === undefined ? null : jsonDump(payload.money),
    payload.mythicPlusSeason === undefined ? null : jsonDump(payload.mythicPlusSeason),
    hasKeystoneLoot ? jsonDump(payload.keystoneLoot) : null,
    character.id,
  ).run()

  const latest = await latestRealKeystone(c.env, character.id)
  const updatedAt = payload.updatedAt ?? null
  const isNewer = latest === null || latest.updated_at === null || updatedAt === null || updatedAt > latest.updated_at
  const hasRealKeystone = payload.hasKeystone === true && payload.keystoneLevel !== null && payload.keystoneLevel !== undefined

  if (isNewer && hasRealKeystone) {
    await c.env.DB.prepare(`
      INSERT INTO keystones (
        character_id, has_keystone, keystone_level, keystone_challenge_map_id,
        keystone_map_id, keystone_dungeon, updated_reason, updated_at
      ) VALUES (?, 1, ?, ?, ?, ?, ?, ?)
    `).bind(
      character.id,
      payload.keystoneLevel,
      payload.keystoneChallengeMapId ?? null,
      payload.keystoneMapId ?? null,
      payload.keystoneDungeon ?? null,
      payload.updatedReason ?? null,
      updatedAt,
    ).run()
  }

  return c.json({
    status: 'ok',
    message: 'Keystone updated',
    character: payload.character,
    realm: payload.realm,
  })
})
