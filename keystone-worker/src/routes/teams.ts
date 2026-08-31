import { Hono } from 'hono'
import type { Context } from 'hono'
import { getCurrentUser } from '../auth'
import { newInviteCode } from '../crypto'
import {
  getUserByUsername,
  recommendationCharactersForUser,
  selectorCharactersForTeam,
  selectorStonesForTeam,
  teamDetailResponse,
  teamInvitationResponse,
  teamResponse,
} from '../db'
import { jsonError } from '../http'
import { enrichKeystoneLootObjectives, normalizeBlizzardLocale, normalizeBlizzardRegion } from '../blizzardItemMetadata'
import { buildKeystoneLootObjectivePage } from '../keystoneObjectives'
import { recommendKeystoneLootTarget } from '../keystoneRecommendations'
import { buildKeystoneLootDungeonSummary } from '../keystoneSelector'
import type { KeystoneLootDungeonSummaryDTO } from '../keystoneSelector'
import { isSupportedSeason2Dungeon } from '../season2'
import type { Env, TeamInvitationRow, TeamRow, UserRow } from '../types'

export const teamRoutes = new Hono<{ Bindings: Env }>()

type CreateTeamRequest = {
  name: string
}

type JoinTeamRequest = {
  invite_code: string
}

type CreateTeamInviteRequest = {
  username: string
}

type RecommendationMemberRow = {
  id: number
  username: string
  share_keystone_loot_with_teams: number
}

function isResponse(value: unknown): value is Response {
  return value instanceof Response
}

function addDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

function isExpired(value: string | null): boolean {
  if (!value) return true
  return new Date(value).getTime() < Date.now()
}

async function findMembership(env: Env, teamId: number, userId: number): Promise<{ id: number } | null> {
  return env.DB.prepare('SELECT id FROM team_members WHERE team_id = ? AND user_id = ?')
    .bind(teamId, userId)
    .first<{ id: number }>()
}

async function getTeam(env: Env, teamId: number): Promise<TeamRow | null> {
  return env.DB.prepare('SELECT * FROM teams WHERE id = ?').bind(teamId).first<TeamRow>()
}

async function enrichSelectorSummary(
  env: Env,
  summary: KeystoneLootDungeonSummaryDTO,
  locale: string,
): Promise<KeystoneLootDungeonSummaryDTO> {
  const byRegion = new Map<string, typeof summary.characters[number]['objectives']>()
  for (const character of summary.characters) {
    const region = normalizeBlizzardRegion(character.region)
    const objectives = byRegion.get(region) ?? []
    objectives.push(...character.objectives)
    byRegion.set(region, objectives)
  }

  for (const [region, objectives] of byRegion) {
    const enriched = await enrichKeystoneLootObjectives(env, region, objectives, { locale })
    for (let index = 0; index < objectives.length; index += 1) {
      objectives[index].itemName = enriched[index].itemName
      objectives[index].iconUrl = enriched[index].iconUrl
      objectives[index].slotName = enriched[index].slotName
      objectives[index].itemClassName = enriched[index].itemClassName
      objectives[index].itemSubClassName = enriched[index].itemSubClassName
      objectives[index].statNames = enriched[index].statNames
      objectives[index].primaryStatNames = enriched[index].primaryStatNames
      objectives[index].secondaryStatNames = enriched[index].secondaryStatNames
      objectives[index].otherStatNames = enriched[index].otherStatNames
      objectives[index].qualityType = enriched[index].qualityType
    }
  }
  return summary
}

type ObjectiveCharacterAccessRow = {
  id: number
  user_id: number
  region: string
}

function positiveInteger(value: string | undefined, field: string): number | undefined {
  if (value === undefined) return undefined
  const parsed = Number(value)
  if (value.trim() === '' || !Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${field} debe ser un entero positivo`)
  }
  return parsed
}

function teamObjectiveQuery(c: Context<{ Bindings: Env }>) {
  const rawLimit = c.req.query('limit')
  const limit = rawLimit === undefined ? 50 : positiveInteger(rawLimit, 'limit')
  if (limit === undefined || limit > 100) throw new Error('limit debe estar entre 1 y 100')
  return {
    limit,
    challengeMapId: positiveInteger(c.req.query('challengeMapId'), 'challengeMapId'),
    specId: positiveInteger(c.req.query('specId'), 'specId'),
    cursor: c.req.query('cursor'),
  }
}

teamRoutes.get('/api/teams', async c => {
  const currentUser = await getCurrentUser(c)
  if (isResponse(currentUser)) return currentUser

  const { results } = await c.env.DB.prepare(`
    SELECT t.*
    FROM team_members tm
    JOIN teams t ON t.id = tm.team_id
    WHERE tm.user_id = ?
    ORDER BY t.name
  `).bind(currentUser.id).all<TeamRow>()

  return c.json(await Promise.all(results.map(team => teamResponse(c.env, team, currentUser.id))))
})

teamRoutes.post('/api/teams', async c => {
  const currentUser = await getCurrentUser(c)
  if (isResponse(currentUser)) return currentUser

  const payload = await c.req.json<CreateTeamRequest>()
  const name = payload.name?.trim()
  if (!name) return jsonError(c, 400, 'El nombre del equipo es obligatorio')

  const insert = await c.env.DB.prepare(`
    INSERT INTO teams (name, invite_code, created_by)
    VALUES (?, ?, ?)
  `).bind(name, newInviteCode(), currentUser.id).run()

  const teamId = Number(insert.meta.last_row_id)
  await c.env.DB.prepare('INSERT INTO team_members (team_id, user_id) VALUES (?, ?)')
    .bind(teamId, currentUser.id)
    .run()

  const team = await getTeam(c.env, teamId)
  if (!team) return jsonError(c, 500, 'No se pudo crear el equipo')

  return c.json(await teamResponse(c.env, team, currentUser.id), 201)
})

teamRoutes.post('/api/teams/join', async c => {
  const currentUser = await getCurrentUser(c)
  if (isResponse(currentUser)) return currentUser

  const payload = await c.req.json<JoinTeamRequest>()
  const team = await c.env.DB.prepare('SELECT * FROM teams WHERE invite_code = ?')
    .bind(payload.invite_code)
    .first<TeamRow>()
  if (!team) return jsonError(c, 404, 'Codigo de invitacion no valido')

  if (await findMembership(c.env, team.id, currentUser.id)) {
    return jsonError(c, 400, 'Ya eres miembro de este team')
  }

  await c.env.DB.prepare('INSERT INTO team_members (team_id, user_id) VALUES (?, ?)')
    .bind(team.id, currentUser.id)
    .run()

  return c.json(await teamResponse(c.env, team, currentUser.id))
})

teamRoutes.get('/api/teams/:teamId/recommendations', async c => {
  const currentUser = await getCurrentUser(c)
  if (isResponse(currentUser)) return currentUser

  const teamId = Number(c.req.param('teamId'))
  const team = await getTeam(c.env, teamId)
  if (!team) return jsonError(c, 404, 'Equipo no encontrado')
  if (!(await findMembership(c.env, teamId, currentUser.id))) {
    return jsonError(c, 403, 'No perteneces a este team')
  }

  const rawChallengeMapId = c.req.query('challengeMapId')
  const challengeMapId = Number(rawChallengeMapId)
  if (rawChallengeMapId === undefined || rawChallengeMapId.trim() === ''
    || !Number.isSafeInteger(challengeMapId) || challengeMapId <= 0) {
    return jsonError(c, 400, 'challengeMapId debe ser un entero positivo')
  }

  const { results: members } = await c.env.DB.prepare(`
    SELECT u.id, u.username, u.share_keystone_loot_with_teams
    FROM team_members tm
    JOIN users u ON u.id = tm.user_id
    WHERE tm.team_id = ?
    ORDER BY u.username
  `).bind(teamId).all<RecommendationMemberRow>()

  const recommendations = await Promise.all(members.map(async member => {
    if (member.share_keystone_loot_with_teams === 0) {
      return {
        userId: member.id,
        username: member.username,
        status: 'sharing_disabled',
        recommended: null,
      }
    }

    const characters = await recommendationCharactersForUser(c.env, member.id)
    if (characters.length === 0) {
      return {
        userId: member.id,
        username: member.username,
        status: 'no_keystoneloot',
        recommended: null,
      }
    }

    const recommended = recommendKeystoneLootTarget(characters, challengeMapId)
    return {
      userId: member.id,
      username: member.username,
      status: recommended ? 'recommended' : 'no_targets',
      recommended,
    }
  }))

  return c.json({ teamId, challengeMapId, members: recommendations })
})

teamRoutes.get('/api/teams/:teamId/keystone-loot/dungeons/:challengeMapId/summary', async c => {
  const currentUser = await getCurrentUser(c)
  if (isResponse(currentUser)) return currentUser

  const teamId = Number(c.req.param('teamId'))
  const challengeMapId = Number(c.req.param('challengeMapId'))
  if (!Number.isSafeInteger(teamId) || teamId <= 0
    || !Number.isSafeInteger(challengeMapId) || challengeMapId <= 0) {
    return jsonError(c, 400, 'teamId y challengeMapId deben ser enteros positivos')
  }
  if (!isSupportedSeason2Dungeon(challengeMapId)) {
    return jsonError(c, 400, 'challengeMapId no pertenece al pool actual')
  }
  const requestedLocale = c.req.query('locale') ?? 'es_ES'
  const locale = normalizeBlizzardLocale(requestedLocale)
  if (locale !== requestedLocale) return jsonError(c, 400, 'locale no es valido')
  if (!(await getTeam(c.env, teamId))) return jsonError(c, 404, 'Equipo no encontrado')
  if (!(await findMembership(c.env, teamId, currentUser.id))) {
    return jsonError(c, 403, 'No perteneces a este team')
  }

  const [sources, stones] = await Promise.all([
    selectorCharactersForTeam(c.env, teamId),
    selectorStonesForTeam(c.env, teamId, challengeMapId),
  ])
  const summary = buildKeystoneLootDungeonSummary(
    teamId,
    challengeMapId,
    { stoneCount: stones.length, stones },
    sources,
  )
  return c.json(await enrichSelectorSummary(c.env, summary, locale))
})

teamRoutes.get('/api/teams/:teamId/characters/:characterId/keystone-loot/objectives', async c => {
  const currentUser = await getCurrentUser(c)
  if (isResponse(currentUser)) return currentUser

  const teamId = Number(c.req.param('teamId'))
  const characterId = Number(c.req.param('characterId'))
  if (!Number.isSafeInteger(teamId) || teamId <= 0
    || !Number.isSafeInteger(characterId) || characterId <= 0) {
    return jsonError(c, 400, 'teamId y characterId deben ser enteros positivos')
  }
  if (!(await getTeam(c.env, teamId))) return jsonError(c, 404, 'Equipo no encontrado')
  if (!(await findMembership(c.env, teamId, currentUser.id))) {
    return jsonError(c, 403, 'No perteneces a este team')
  }

  const character = await c.env.DB.prepare('SELECT id, user_id, region FROM characters WHERE id = ?')
    .bind(characterId)
    .first<ObjectiveCharacterAccessRow>()
  if (!character || !(await findMembership(c.env, teamId, character.user_id))) {
    return jsonError(c, 404, 'Personaje no encontrado en este team')
  }
  const owner = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(character.user_id)
    .first<UserRow>()
  if (!owner) return jsonError(c, 404, 'Personaje no encontrado en este team')
  if (owner.share_keystone_loot_with_teams === 0) {
    return c.json({ status: 'sharing_disabled' as const })
  }

  const snapshotRow = await c.env.DB.prepare(`
    SELECT keystone_loot_json FROM characters
    WHERE id = ? AND user_id = ?
  `).bind(character.id, owner.id).first<{ keystone_loot_json: string | null }>()
  if (!snapshotRow) return jsonError(c, 404, 'Personaje no encontrado en este team')

  try {
    const page = buildKeystoneLootObjectivePage(snapshotRow.keystone_loot_json, teamObjectiveQuery(c))
    if (page.status === 'not_installed' || page.status === 'not_ready' || page.status === 'unavailable') {
      return c.json({ status: 'no_keystoneloot' as const })
    }
    if (page.status === 'empty') return c.json({ status: 'no_targets' as const })
    if (page.status === 'unsupported') return c.json({ status: 'unsupported' as const })

    const objectives = await enrichKeystoneLootObjectives(c.env, character.region, page.objectives)
    return c.json({
      status: 'available' as const,
      updatedAt: page.snapshot?.updatedAt ?? null,
      objectives,
      nextCursor: page.nextCursor,
    })
  } catch (error) {
    return jsonError(c, 400, error instanceof Error ? error.message : 'Filtros no válidos')
  }
})

teamRoutes.get('/api/teams/:teamId', async c => {
  const currentUser = await getCurrentUser(c)
  if (isResponse(currentUser)) return currentUser

  const teamId = Number(c.req.param('teamId'))
  if (!(await findMembership(c.env, teamId, currentUser.id))) {
    return jsonError(c, 403, 'No perteneces a este team')
  }

  const team = await getTeam(c.env, teamId)
  if (!team) return jsonError(c, 404, 'Equipo no encontrado')

  return c.json(await teamDetailResponse(c.env, team, currentUser.id))
})

teamRoutes.post('/api/teams/:teamId/invites', async c => {
  const currentUser = await getCurrentUser(c)
  if (isResponse(currentUser)) return currentUser

  const teamId = Number(c.req.param('teamId'))
  if (!(await findMembership(c.env, teamId, currentUser.id))) {
    return jsonError(c, 403, 'No perteneces a este team')
  }

  const payload = await c.req.json<CreateTeamInviteRequest>()
  const username = payload.username?.trim() ?? ''
  if (username.length < 3) return jsonError(c, 400, 'Introduce un username valido')

  const invitedUser = await getUserByUsername(c.env, username)
  if (!invitedUser) return jsonError(c, 404, 'Usuario no encontrado')
  if (invitedUser.id === currentUser.id) return jsonError(c, 400, 'No puedes invitarte a ti mismo')

  if (await findMembership(c.env, teamId, invitedUser.id)) {
    return jsonError(c, 400, 'Ese usuario ya pertenece al equipo')
  }

  const pending = await c.env.DB.prepare(`
    SELECT * FROM team_invitations
    WHERE team_id = ? AND invited_user_id = ? AND status = 'pending'
  `).bind(teamId, invitedUser.id).first<TeamInvitationRow>()

  if (pending && !isExpired(pending.expires_at)) {
    return jsonError(c, 400, 'Ese usuario ya tiene una invitacion pendiente')
  }
  if (pending && isExpired(pending.expires_at)) {
    await c.env.DB.prepare(`
      UPDATE team_invitations
      SET status = 'declined',
          responded_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?
    `).bind(pending.id).run()
  }

  const insert = await c.env.DB.prepare(`
    INSERT INTO team_invitations (team_id, invited_user_id, invited_by_user_id, status, expires_at)
    VALUES (?, ?, ?, 'pending', ?)
  `).bind(teamId, invitedUser.id, currentUser.id, addDays(7)).run()

  const invitation = await c.env.DB.prepare('SELECT * FROM team_invitations WHERE id = ?')
    .bind(insert.meta.last_row_id)
    .first<TeamInvitationRow>()
  if (!invitation) return jsonError(c, 500, 'No se pudo crear la invitacion')

  return c.json(await teamInvitationResponse(c.env, invitation), 201)
})

teamRoutes.delete('/api/teams/:teamId/members/:userId', async c => {
  const currentUser = await getCurrentUser(c)
  if (isResponse(currentUser)) return currentUser

  const teamId = Number(c.req.param('teamId'))
  const userId = Number(c.req.param('userId'))
  const team = await getTeam(c.env, teamId)
  if (!team) return jsonError(c, 404, 'Equipo no encontrado')
  if (team.created_by !== currentUser.id) return jsonError(c, 403, 'Solo el creador del equipo puede eliminar miembros')
  if (userId === currentUser.id) return jsonError(c, 400, 'No puedes eliminarte a ti mismo desde esta accion')

  if (!(await findMembership(c.env, teamId, userId))) {
    return jsonError(c, 404, 'Ese usuario no pertenece al equipo')
  }

  await c.env.DB.batch([
    c.env.DB.prepare(`
      UPDATE team_invitations
      SET status = 'declined',
          responded_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE team_id = ? AND invited_user_id = ? AND status = 'pending'
    `).bind(teamId, userId),
    c.env.DB.prepare('DELETE FROM team_members WHERE team_id = ? AND user_id = ?').bind(teamId, userId),
  ])

  return c.json({ message: 'Miembro eliminado del equipo' })
})

teamRoutes.post('/api/teams/:teamId/leave', async c => {
  const currentUser = await getCurrentUser(c)
  if (isResponse(currentUser)) return currentUser

  const teamId = Number(c.req.param('teamId'))
  const team = await getTeam(c.env, teamId)
  if (!team) return jsonError(c, 404, 'Equipo no encontrado')
  if (!(await findMembership(c.env, teamId, currentUser.id))) {
    return jsonError(c, 404, 'No perteneces a este equipo')
  }

  const count = await c.env.DB.prepare('SELECT COUNT(*) AS count FROM team_members WHERE team_id = ?')
    .bind(teamId)
    .first<{ count: number }>()
  const memberCount = count?.count ?? 0

  if (team.created_by === currentUser.id && memberCount > 1) {
    return jsonError(c, 400, 'El creador no puede salir mientras haya otros miembros')
  }

  await c.env.DB.prepare('DELETE FROM team_members WHERE team_id = ? AND user_id = ?')
    .bind(teamId, currentUser.id)
    .run()

  if (memberCount === 1) {
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM team_invitations WHERE team_id = ?').bind(teamId),
      c.env.DB.prepare('DELETE FROM teams WHERE id = ?').bind(teamId),
    ])
  }

  return c.json({ message: 'Has salido del equipo' })
})

teamRoutes.get('/api/me/team-invitations', async c => {
  const currentUser = await getCurrentUser(c)
  if (isResponse(currentUser)) return currentUser

  const { results } = await c.env.DB.prepare(`
    SELECT * FROM team_invitations
    WHERE invited_user_id = ? AND status = 'pending'
    ORDER BY created_at DESC
  `).bind(currentUser.id).all<TeamInvitationRow>()

  const active: TeamInvitationRow[] = []
  for (const invitation of results) {
    if (isExpired(invitation.expires_at)) {
      await c.env.DB.prepare(`
        UPDATE team_invitations
        SET status = 'declined',
            responded_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
        WHERE id = ?
      `).bind(invitation.id).run()
    } else {
      active.push(invitation)
    }
  }

  return c.json(await Promise.all(active.map(invitation => teamInvitationResponse(c.env, invitation))))
})

teamRoutes.post('/api/team-invitations/:invitationId/accept', async c => {
  const currentUser = await getCurrentUser(c)
  if (isResponse(currentUser)) return currentUser

  const invitationId = Number(c.req.param('invitationId'))
  const invitation = await c.env.DB.prepare(`
    SELECT * FROM team_invitations
    WHERE id = ? AND invited_user_id = ?
  `).bind(invitationId, currentUser.id).first<TeamInvitationRow>()

  if (!invitation || invitation.status !== 'pending') return jsonError(c, 404, 'Invitacion no encontrada')
  if (isExpired(invitation.expires_at)) {
    await c.env.DB.prepare(`
      UPDATE team_invitations
      SET status = 'declined',
          responded_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?
    `).bind(invitation.id).run()
    return jsonError(c, 400, 'La invitacion ha caducado')
  }

  if (!(await findMembership(c.env, invitation.team_id, currentUser.id))) {
    await c.env.DB.prepare('INSERT INTO team_members (team_id, user_id) VALUES (?, ?)')
      .bind(invitation.team_id, currentUser.id)
      .run()
  }

  await c.env.DB.prepare(`
    UPDATE team_invitations
    SET status = 'accepted',
        responded_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id = ?
  `).bind(invitation.id).run()

  const team = await getTeam(c.env, invitation.team_id)
  return c.json({ message: 'Invitacion aceptada', team: team ? await teamResponse(c.env, team, currentUser.id) : null })
})

teamRoutes.post('/api/team-invitations/:invitationId/decline', async c => {
  const currentUser = await getCurrentUser(c)
  if (isResponse(currentUser)) return currentUser

  const invitationId = Number(c.req.param('invitationId'))
  const invitation = await c.env.DB.prepare(`
    SELECT * FROM team_invitations
    WHERE id = ? AND invited_user_id = ?
  `).bind(invitationId, currentUser.id).first<TeamInvitationRow>()

  if (!invitation || invitation.status !== 'pending') return jsonError(c, 404, 'Invitacion no encontrada')

  await c.env.DB.prepare(`
    UPDATE team_invitations
    SET status = 'declined',
        responded_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id = ?
  `).bind(invitation.id).run()

  return c.json({ message: 'Invitacion rechazada' })
})
