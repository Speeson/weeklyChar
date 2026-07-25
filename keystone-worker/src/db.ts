import type { CharacterRow, Env, KeystoneRow, UserRow } from './types'

export async function getUserById(env: Env, id: number): Promise<UserRow | null> {
  return env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>()
}

export async function getUserBySyncToken(env: Env, syncToken: string): Promise<UserRow | null> {
  return env.DB.prepare('SELECT * FROM users WHERE sync_token = ?').bind(syncToken).first<UserRow>()
}

export function jsonLoad(value: string | null): unknown | null {
  if (!value) return null
  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}

export function jsonDump(value: unknown): string {
  return JSON.stringify(value)
}

export async function latestRealKeystone(env: Env, characterId: number): Promise<KeystoneRow | null> {
  return env.DB.prepare(`
    SELECT * FROM keystones
    WHERE character_id = ? AND has_keystone = 1 AND keystone_level IS NOT NULL
    ORDER BY COALESCE(updated_at, 0) DESC, id DESC
    LIMIT 1
  `).bind(characterId).first<KeystoneRow>()
}

function keystoneDict(keystone: KeystoneRow | null): Record<string, unknown> | null {
  if (!keystone) return null
  return {
    level: keystone.keystone_level,
    dungeon: keystone.keystone_dungeon,
    challengeMapId: keystone.keystone_challenge_map_id,
    mapId: keystone.keystone_map_id,
    updatedAt: keystone.updated_at,
    updatedReason: keystone.updated_reason,
  }
}

export function characterResponse(character: CharacterRow, latest: KeystoneRow | null): Record<string, unknown> {
  return {
    id: character.id,
    name: character.name,
    realm: character.realm,
    region: character.region,
    wowAccount: character.wow_account,
    avatarUrl: character.avatar_url,
    rioScore: character.rio_score,
    wowClass: character.wow_class,
    ilvl: character.ilvl,
    currentKeystone: keystoneDict(latest),
    vault: jsonLoad(character.vault_json),
    preyHunts: jsonLoad(character.prey_hunts_json),
    currencies: jsonLoad(character.currencies_json),
    money: jsonLoad(character.money_json),
    mythicPlusSeason: jsonLoad(character.mythic_plus_season_json),
  }
}
