import type { CharacterRow, Env, KeystoneRow, TeamInvitationRow, TeamRow, UserRow } from './types'
import { parseSupportedKeystoneLoot } from './keystoneLoot'
import type { RecommendationCharacter } from './keystoneRecommendations'
import type {
  KeystoneLootSelectorCharacterSource,
  KeystoneLootSelectorStoneDTO,
} from './keystoneSelector'
import { currentEuWeeklyResetUnix } from './weeklyReset'

export function normalizeUsernameInput(username: string): string {
  return username.trim()
}

export async function getUserByUsername(env: Env, username: string): Promise<UserRow | null> {
  return env.DB.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE')
    .bind(normalizeUsernameInput(username))
    .first<UserRow>()
}

export async function usernameExists(env: Env, username: string): Promise<boolean> {
  const row = await env.DB.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE')
    .bind(normalizeUsernameInput(username))
    .first<{ id: number }>()
  return row !== null
}

export function isUsernameUniquenessError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return /unique constraint failed/i.test(error.message)
    && /(users\.username|users_username_nocase_unique)/i.test(error.message)
}

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
  const resetUnix = currentEuWeeklyResetUnix()
  return env.DB.prepare(`
    SELECT * FROM keystones
    WHERE character_id = ?
      AND has_keystone = 1
      AND keystone_level IS NOT NULL
      AND updated_at >= ?
    ORDER BY COALESCE(updated_at, 0) DESC, id DESC
    LIMIT 1
  `).bind(characterId, resetUnix).first<KeystoneRow>()
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

export type CharacterResponseOptions = {
  includeKeystoneLoot?: boolean
}

export function characterResponse(
  character: CharacterRow,
  latest: KeystoneRow | null,
  options: CharacterResponseOptions = {},
): Record<string, unknown> {
  const response: Record<string, unknown> = {
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
  if (options.includeKeystoneLoot === true) {
    response.keystoneLoot = jsonLoad(character.keystone_loot_json)
  }
  return response
}

export async function teamResponse(env: Env, team: TeamRow, currentUserId: number): Promise<Record<string, unknown>> {
  const count = await env.DB.prepare('SELECT COUNT(*) AS count FROM team_members WHERE team_id = ?')
    .bind(team.id)
    .first<{ count: number }>()

  return {
    id: team.id,
    name: team.name,
    inviteCode: team.invite_code,
    isOwner: team.created_by === currentUserId,
    ownerId: team.created_by,
    currentUserId,
    memberCount: count?.count ?? 0,
  }
}

export async function charactersForUser(
  env: Env,
  userId: number,
  options: CharacterResponseOptions = {},
): Promise<Array<Record<string, unknown>>> {
  const { results } = await env.DB.prepare(`
    SELECT * FROM characters
    WHERE user_id = ?
    ORDER BY name
  `).bind(userId).all<CharacterRow>()

  return Promise.all(results.map(async character => {
    return characterResponse(character, await latestRealKeystone(env, character.id), options)
  }))
}

export async function recommendationCharactersForUser(
  env: Env,
  userId: number,
): Promise<RecommendationCharacter[]> {
  const { results } = await env.DB.prepare(`
    SELECT * FROM characters
    WHERE user_id = ?
    ORDER BY name
  `).bind(userId).all<CharacterRow>()

  const characters: RecommendationCharacter[] = []
  for (const character of results) {
    const snapshot = parseSupportedKeystoneLoot(jsonLoad(character.keystone_loot_json))
    if (!snapshot) continue
    characters.push({
      id: character.id,
      name: character.name,
      realm: character.realm,
      region: character.region,
      wowClass: character.wow_class,
      avatarUrl: character.avatar_url,
      ilvl: character.ilvl,
      rioScore: character.rio_score,
      keystoneLoot: snapshot,
    })
  }
  return characters
}

type SelectorCharacterRow = {
  user_id: number
  username: string
  character_id: number
  character_name: string
  realm: string
  region: string
  wow_class: string | null
  avatar_url: string | null
  ilvl: number | null
  rio_score: number | null
  keystone_loot_json: string | null
}

export async function selectorCharactersForTeam(
  env: Env,
  teamId: number,
): Promise<KeystoneLootSelectorCharacterSource[]> {
  const { results } = await env.DB.prepare(`
    SELECT
      u.id AS user_id,
      u.username,
      c.id AS character_id,
      c.name AS character_name,
      c.realm,
      c.region,
      c.wow_class,
      c.avatar_url,
      c.ilvl,
      c.rio_score,
      c.keystone_loot_json
    FROM team_members tm
    JOIN users u ON u.id = tm.user_id
    JOIN characters c ON c.user_id = u.id
    WHERE tm.team_id = ?
      AND u.share_keystone_loot_with_teams <> 0
    ORDER BY u.username, c.name, c.realm, c.id
  `).bind(teamId).all<SelectorCharacterRow>()

  return results.map(row => ({
    userId: row.user_id,
    username: row.username,
    characterId: row.character_id,
    characterName: row.character_name,
    realm: row.realm,
    region: row.region,
    wowClass: row.wow_class,
    avatarUrl: row.avatar_url,
    ilvl: row.ilvl,
    rioScore: row.rio_score,
    keystoneLoot: jsonLoad(row.keystone_loot_json),
  }))
}

type SelectorStoneRow = {
  character_id: number
  character_name: string
  owner_user_id: number
  owner_username: string
  keystone_level: number
}

export async function selectorStonesForTeam(
  env: Env,
  teamId: number,
  challengeMapId: number,
): Promise<KeystoneLootSelectorStoneDTO[]> {
  const resetUnix = currentEuWeeklyResetUnix()
  const { results } = await env.DB.prepare(`
    WITH ranked_keystones AS (
      SELECT
        k.*,
        ROW_NUMBER() OVER (
          PARTITION BY k.character_id
          ORDER BY COALESCE(k.updated_at, 0) DESC, k.id DESC
        ) AS keystone_rank
      FROM keystones k
      WHERE k.has_keystone = 1
        AND k.keystone_level IS NOT NULL
        AND k.updated_at >= ?
    )
    SELECT
      c.id AS character_id,
      c.name AS character_name,
      u.id AS owner_user_id,
      u.username AS owner_username,
      rk.keystone_level
    FROM team_members tm
    JOIN users u ON u.id = tm.user_id
    JOIN characters c ON c.user_id = u.id
    JOIN ranked_keystones rk ON rk.character_id = c.id AND rk.keystone_rank = 1
    WHERE tm.team_id = ?
      AND rk.keystone_challenge_map_id = ?
    ORDER BY u.username, c.name, c.id
  `).bind(resetUnix, teamId, challengeMapId).all<SelectorStoneRow>()

  return results.map(row => ({
    characterId: row.character_id,
    characterName: row.character_name,
    ownerUserId: row.owner_user_id,
    ownerUsername: row.owner_username,
    level: row.keystone_level,
  }))
}

export async function teamDetailResponse(env: Env, team: TeamRow, currentUserId: number): Promise<Record<string, unknown>> {
  const { results } = await env.DB.prepare(`
    SELECT u.id, u.username
    FROM team_members tm
    JOIN users u ON u.id = tm.user_id
    WHERE tm.team_id = ?
    ORDER BY u.username
  `).bind(team.id).all<{ id: number, username: string }>()

  const members = await Promise.all(results.map(async member => ({
    userId: member.id,
    username: member.username,
    characters: await charactersForUser(env, member.id),
  })))

  return {
    id: team.id,
    name: team.name,
    inviteCode: team.invite_code,
    isOwner: team.created_by === currentUserId,
    ownerId: team.created_by,
    currentUserId,
    members,
  }
}

export async function teamInvitationResponse(env: Env, invitation: TeamInvitationRow): Promise<Record<string, unknown>> {
  const team = await env.DB.prepare('SELECT name FROM teams WHERE id = ?').bind(invitation.team_id).first<{ name: string }>()
  const invitedUser = await env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(invitation.invited_user_id).first<{ username: string }>()
  const invitedBy = await env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(invitation.invited_by_user_id).first<{ username: string }>()

  return {
    id: invitation.id,
    teamId: invitation.team_id,
    teamName: team?.name ?? null,
    invitedUsername: invitedUser?.username ?? null,
    invitedBy: invitedBy?.username ?? null,
    status: invitation.status,
    createdAt: invitation.created_at,
    expiresAt: invitation.expires_at,
  }
}
