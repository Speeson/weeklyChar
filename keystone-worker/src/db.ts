import type { CharacterRow, Env, KeystoneRow, TeamInvitationRow, TeamRow, UserRow } from './types'
import { currentEuWeeklyResetUnix } from './weeklyReset'

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

export async function charactersForUser(env: Env, userId: number): Promise<Array<Record<string, unknown>>> {
  const { results } = await env.DB.prepare(`
    SELECT * FROM characters
    WHERE user_id = ?
    ORDER BY name
  `).bind(userId).all<CharacterRow>()

  return Promise.all(results.map(async character => {
    return characterResponse(character, await latestRealKeystone(env, character.id))
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
