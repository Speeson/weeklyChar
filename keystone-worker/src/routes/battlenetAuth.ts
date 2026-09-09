import { Hono } from 'hono'
import type { Context } from 'hono'
import { getCurrentUser } from '../auth'
import { createAccessToken, newPlainToken, newSyncToken, pkceChallenge, sha256Hex, verifyPassword } from '../crypto'
import { getUserByUsername, isUsernameUniquenessError, normalizeUsernameInput, usernameExists } from '../db'
import { jsonError } from '../http'
import { checkActionRateLimit } from '../rateLimit'
import type { Env, OAuthFlowRow, UserIdentityRow, UserRow } from '../types'

const PROVIDER = 'battlenet'
const OAUTH_TTL_MS = 10 * 60 * 1000
const HANDOFF_TTL_MS = 60 * 1000
const AUTHORIZATION_ENDPOINT = 'https://oauth.battle.net/authorize'
const TOKEN_ENDPOINT = 'https://oauth.battle.net/token'
const USERINFO_ENDPOINT = 'https://oauth.battle.net/userinfo'

type OAuthIntent = OAuthFlowRow['intent']

type TokenResponse = {
  access_token?: unknown
  token_type?: unknown
  scope?: unknown
}

type UserInfoResponse = {
  sub?: unknown
  battletag?: unknown
}

export const battlenetAuthRoutes = new Hono<{ Bindings: Env }>()

battlenetAuthRoutes.use('/api/auth/battlenet/*', async (c, next) => {
  c.header('Cache-Control', 'no-store')
  c.header('Referrer-Policy', 'no-referrer')
  await next()
})
battlenetAuthRoutes.use('/api/me/identities/*', async (c, next) => {
  c.header('Cache-Control', 'no-store')
  c.header('Referrer-Policy', 'no-referrer')
  await next()
})

function clientIp(c: Context<{ Bindings: Env }>): string {
  const forwarded = c.req.header('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return c.req.header('cf-connecting-ip') ?? 'unknown'
}

function isoAfter(milliseconds: number): string {
  return new Date(Date.now() + milliseconds).toISOString()
}

function isExpired(value: string | null): boolean {
  return !value || new Date(value).getTime() <= Date.now()
}

function webBaseUrl(env: Env): string {
  const raw = (env.WEB_BASE_URL ?? 'https://keystonesync.esgarpe.dev').trim().replace(/\/$/, '')
  const parsed = new URL(raw)
  if (parsed.username || parsed.password || (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost')) {
    throw new Error('WEB_BASE_URL is invalid')
  }
  return parsed.origin
}

function oauthConfiguration(env: Env): { clientId: string, clientSecret: string, redirectUri: string } | null {
  const clientId = env.BLIZZARD_CLIENT_ID?.trim()
  const clientSecret = env.BLIZZARD_CLIENT_SECRET?.trim()
  const redirectUri = env.BATTLENET_REDIRECT_URI?.trim()
  if (!clientId || !clientSecret || !redirectUri) return null
  try {
    const parsed = new URL(redirectUri)
    if (parsed.username || parsed.password || (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost')) return null
    return { clientId, clientSecret, redirectUri: parsed.toString() }
  } catch {
    return null
  }
}

async function cleanupExpiredFlows(env: Env): Promise<void> {
  await env.DB.prepare('DELETE FROM oauth_flows WHERE expires_at <= ?').bind(new Date().toISOString()).run()
}

function authorizationUrl(config: { clientId: string, redirectUri: string }, state: string, challenge: string): string {
  const url = new URL(AUTHORIZATION_ENDPOINT)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('redirect_uri', config.redirectUri)
  url.searchParams.set('scope', 'openid')
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}

async function createFlow(env: Env, intent: OAuthIntent, initiatorUserId: number | null = null) {
  const config = oauthConfiguration(env)
  if (!config) return null

  await cleanupExpiredFlows(env)
  const id = newPlainToken()
  const state = newPlainToken()
  const verifier = newPlainToken(64)
  const pollSecret = intent === 'login_desktop' ? newPlainToken() : null
  const expiresAt = isoAfter(OAUTH_TTL_MS)

  await env.DB.prepare(`
    INSERT INTO oauth_flows (
      id, intent, state_hash, pkce_verifier, initiator_user_id,
      desktop_poll_secret_hash, status, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
  `).bind(
    id,
    intent,
    await sha256Hex(state),
    verifier,
    initiatorUserId,
    pollSecret ? await sha256Hex(pollSecret) : null,
    expiresAt,
  ).run()

  return {
    id,
    pollSecret,
    expiresAt,
    authorizationUrl: authorizationUrl(config, state, await pkceChallenge(verifier)),
  }
}

async function requireRateLimit(c: Context<{ Bindings: Env }>, action: string, limit: number): Promise<Response | null> {
  const allowed = await checkActionRateLimit(c.env, `battlenet:${action}`, clientIp(c), limit, 15 * 60)
  return allowed ? null : jsonError(c, 429, 'Demasiados intentos. Espera unos minutos antes de volver a probar.')
}

battlenetAuthRoutes.post('/api/auth/battlenet/start', async c => {
  const limited = await requireRateLimit(c, 'web_start', 20)
  if (limited) return limited
  const flow = await createFlow(c.env, 'login_web')
  if (!flow) return jsonError(c, 503, 'Battle.net no esta disponible temporalmente')
  return c.json({ authorizationUrl: flow.authorizationUrl, expiresAt: flow.expiresAt })
})

battlenetAuthRoutes.post('/api/auth/battlenet/desktop/start', async c => {
  const limited = await requireRateLimit(c, 'desktop_start', 20)
  if (limited) return limited
  const flow = await createFlow(c.env, 'login_desktop')
  if (!flow?.pollSecret) return jsonError(c, 503, 'Battle.net no esta disponible temporalmente')
  return c.json({
    flowId: flow.id,
    pollSecret: flow.pollSecret,
    authorizationUrl: flow.authorizationUrl,
    expiresAt: flow.expiresAt,
  })
})

battlenetAuthRoutes.post('/api/me/identities/battlenet/start', async c => {
  const currentUser = await getCurrentUser(c)
  if (currentUser instanceof Response) return currentUser
  const limited = await requireRateLimit(c, 'link_start', 10)
  if (limited) return limited
  const flow = await createFlow(c.env, 'link_account', currentUser.id)
  if (!flow) return jsonError(c, 503, 'Battle.net no esta disponible temporalmente')
  return c.json({ authorizationUrl: flow.authorizationUrl, expiresAt: flow.expiresAt })
})

function basicAuthorization(clientId: string, clientSecret: string): string {
  const bytes = new TextEncoder().encode(`${clientId}:${clientSecret}`)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return `Basic ${btoa(binary)}`
}

async function exchangeBattleNetCode(
  config: { clientId: string, clientSecret: string, redirectUri: string },
  code: string,
  verifier: string,
): Promise<{ subject: string, displayName: string }> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    code_verifier: verifier,
  })
  const tokenResponse = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: basicAuthorization(config.clientId, config.clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
    signal: AbortSignal.timeout(10_000),
  })
  if (!tokenResponse.ok) throw new Error('token_exchange_failed')
  const tokenPayload = await readJsonObject<TokenResponse>(tokenResponse, 16 * 1024)
  const accessToken = tokenPayload.access_token
  if (typeof accessToken !== 'string' || !accessToken || accessToken.length > 4096) {
    throw new Error('invalid_token_response')
  }
  if (typeof tokenPayload.token_type !== 'string' || tokenPayload.token_type.toLowerCase() !== 'bearer') {
    throw new Error('invalid_token_type')
  }
  if (typeof tokenPayload.scope === 'string') {
    const scopes = tokenPayload.scope.split(/\s+/).filter(Boolean)
    if (!scopes.includes('openid')) throw new Error('invalid_token_scope')
  }

  const userInfoResponse = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!userInfoResponse.ok) throw new Error('userinfo_failed')
  const userInfo = await readJsonObject<UserInfoResponse>(userInfoResponse, 16 * 1024)
  if (typeof userInfo.sub !== 'string' || !userInfo.sub.trim() || userInfo.sub.length > 255) {
    throw new Error('invalid_userinfo_subject')
  }
  if (typeof userInfo.battletag !== 'string' || !userInfo.battletag.trim() || userInfo.battletag.length > 100) {
    throw new Error('invalid_userinfo_battletag')
  }
  return { subject: userInfo.sub, displayName: userInfo.battletag }
}

async function readJsonObject<T extends object>(response: Response, maxBytes: number): Promise<T> {
  const declaredLength = Number(response.headers.get('content-length') ?? '0')
  if (declaredLength > maxBytes) throw new Error('provider_response_too_large')
  const text = await response.text()
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error('provider_response_too_large')
  const value: unknown = JSON.parse(text)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_provider_response')
  return value as T
}

function oauthErrorRedirect(env: Env, flow: OAuthFlowRow, category: string): Response {
  if (flow.intent === 'login_desktop') return oauthResultPage(false)
  const path = flow.intent === 'link_account' ? '/settings' : '/login/battlenet/callback'
  const url = new URL(path, webBaseUrl(env))
  url.searchParams.set('error', category)
  return Response.redirect(url.toString(), 302)
}

function oauthResultPage(success: boolean): Response {
  const title = success ? 'Battle.net conectado correctamente.' : 'No se pudo conectar Battle.net.'
  const detail = success ? 'Puedes volver a KeystoneClient.' : 'Vuelve a KeystoneClient e intentalo de nuevo.'
  return new Response(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>KeystoneSync</title><body><main><h1>${title}</h1><p>${detail}</p></main></body></html>`, {
    status: success ? 200 : 400,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  })
}

async function failFlow(env: Env, flowId: string): Promise<void> {
  await env.DB.prepare(`
    UPDATE oauth_flows SET status = 'failed', state_hash = NULL, pkce_verifier = NULL,
      completed_at = ? WHERE id = ? AND status = 'pending'
  `).bind(new Date().toISOString(), flowId).run()
}

battlenetAuthRoutes.get('/api/auth/battlenet/callback', async c => {
  const limited = await requireRateLimit(c, 'callback', 60)
  if (limited) return limited
  const state = c.req.query('state') ?? ''
  if (!state) return jsonError(c, 400, 'Autorizacion Battle.net invalida')

  const stateHash = await sha256Hex(state)
  const flow = await c.env.DB.prepare(`
    SELECT * FROM oauth_flows WHERE state_hash = ? AND status = 'pending'
  `).bind(stateHash).first<OAuthFlowRow>()
  if (!flow || isExpired(flow.expires_at)) {
    if (flow) await failFlow(c.env, flow.id)
    return jsonError(c, 400, 'Autorizacion Battle.net invalida o caducada')
  }

  const oauthError = c.req.query('error')
  const code = c.req.query('code') ?? ''
  const verifier = flow.pkce_verifier
  if (oauthError || !code || !verifier) {
    await failFlow(c.env, flow.id)
    return oauthErrorRedirect(c.env, flow, oauthError === 'access_denied' ? 'cancelled' : 'authorization_failed')
  }

  const consumed = await c.env.DB.prepare(`
    UPDATE oauth_flows SET state_hash = NULL, pkce_verifier = NULL
    WHERE id = ? AND state_hash = ? AND status = 'pending'
  `).bind(flow.id, stateHash).run()
  if (consumed.meta.changes !== 1) return jsonError(c, 400, 'Autorizacion Battle.net ya utilizada')

  const config = oauthConfiguration(c.env)
  if (!config) {
    await failFlow(c.env, flow.id)
    return oauthErrorRedirect(c.env, flow, 'unavailable')
  }

  let identity: { subject: string, displayName: string }
  try {
    identity = await exchangeBattleNetCode(config, code, verifier)
  } catch {
    await failFlow(c.env, flow.id)
    return oauthErrorRedirect(c.env, flow, 'provider_error')
  }

  const existing = await c.env.DB.prepare(`
    SELECT * FROM user_identities WHERE provider = ? AND provider_subject = ?
  `).bind(PROVIDER, identity.subject).first<UserIdentityRow>()

  if (flow.intent === 'link_account') {
    if (!flow.initiator_user_id) {
      await failFlow(c.env, flow.id)
      return oauthErrorRedirect(c.env, flow, 'authorization_failed')
    }
    const currentIdentity = await c.env.DB.prepare(`
      SELECT * FROM user_identities WHERE user_id = ? AND provider = ?
    `).bind(flow.initiator_user_id, PROVIDER).first<UserIdentityRow>()
    if ((existing && existing.user_id !== flow.initiator_user_id)
      || (currentIdentity && currentIdentity.provider_subject !== identity.subject)) {
      await failFlow(c.env, flow.id)
      return oauthErrorRedirect(c.env, flow, 'already_linked')
    }
    const now = new Date().toISOString()
    if (existing) {
      await c.env.DB.prepare(`
        UPDATE user_identities SET provider_display_name = ?, last_login_at = ? WHERE id = ?
      `).bind(identity.displayName, now, existing.id).run()
    } else {
      await c.env.DB.prepare(`
        INSERT INTO user_identities (user_id, provider, provider_subject, provider_display_name, last_login_at)
        VALUES (?, ?, ?, ?, ?)
      `).bind(flow.initiator_user_id, PROVIDER, identity.subject, identity.displayName, now).run()
    }
    await c.env.DB.prepare(`
      UPDATE oauth_flows SET status = 'consumed', provider_subject = ?, provider_display_name = ?,
        result_user_id = ?, completed_at = ? WHERE id = ?
    `).bind(identity.subject, identity.displayName, flow.initiator_user_id, now, flow.id).run()
    const target = new URL('/settings', webBaseUrl(c.env))
    target.searchParams.set('battlenet', 'linked')
    return c.redirect(target.toString())
  }

  if (existing) {
    const now = new Date().toISOString()
    await c.env.DB.prepare(`
      UPDATE user_identities SET provider_display_name = ?, last_login_at = ? WHERE id = ?
    `).bind(identity.displayName, now, existing.id).run()
    if (flow.intent === 'login_desktop') {
      await c.env.DB.prepare(`
        UPDATE oauth_flows SET status = 'ready', provider_subject = ?, provider_display_name = ?,
          result_user_id = ?, completed_at = ? WHERE id = ?
      `).bind(identity.subject, identity.displayName, existing.user_id, now, flow.id).run()
      return oauthResultPage(true)
    }
    const ticket = newPlainToken()
    await c.env.DB.prepare(`
      UPDATE oauth_flows SET status = 'ready', handoff_secret_hash = ?, handoff_expires_at = ?,
        provider_subject = ?, provider_display_name = ?, result_user_id = ?, completed_at = ? WHERE id = ?
    `).bind(await sha256Hex(ticket), isoAfter(HANDOFF_TTL_MS), identity.subject, identity.displayName, existing.user_id, now, flow.id).run()
    const target = new URL('/login/battlenet/callback', webBaseUrl(c.env))
    target.searchParams.set('ticket', ticket)
    return c.redirect(target.toString())
  }

  const onboardingTicket = newPlainToken()
  await c.env.DB.prepare(`
    UPDATE oauth_flows SET status = 'needs_onboarding', handoff_secret_hash = ?, handoff_expires_at = ?,
      provider_subject = ?, provider_display_name = ?, completed_at = ? WHERE id = ?
  `).bind(
    await sha256Hex(onboardingTicket),
    flow.intent === 'login_desktop' ? flow.expires_at : isoAfter(HANDOFF_TTL_MS),
    identity.subject,
    identity.displayName,
    new Date().toISOString(),
    flow.id,
  ).run()
  const target = new URL('/login/battlenet/onboarding', webBaseUrl(c.env))
  target.searchParams.set('ticket', onboardingTicket)
  if (flow.intent === 'login_desktop') target.searchParams.set('desktop', '1')
  return c.redirect(target.toString())
})

async function flowByHandoff(env: Env, ticket: string): Promise<OAuthFlowRow | null> {
  if (!ticket) return null
  return env.DB.prepare('SELECT * FROM oauth_flows WHERE handoff_secret_hash = ?')
    .bind(await sha256Hex(ticket)).first<OAuthFlowRow>()
}

battlenetAuthRoutes.post('/api/auth/battlenet/exchange', async c => {
  const limited = await requireRateLimit(c, 'exchange', 30)
  if (limited) return limited
  const payload = await c.req.json<{ ticket?: string }>()
  const flow = await flowByHandoff(c.env, payload.ticket ?? '')
  if (!flow || flow.intent !== 'login_web') return jsonError(c, 400, 'Ticket invalido')
  if (isExpired(flow.handoff_expires_at) || isExpired(flow.expires_at)) return jsonError(c, 410, 'Ticket caducado')
  if (flow.status === 'needs_onboarding') {
    return c.json({ status: 'needs_onboarding', displayName: flow.provider_display_name })
  }
  if (flow.status !== 'ready' || !flow.result_user_id) return jsonError(c, 400, 'Ticket ya utilizado')
  const result = await c.env.DB.prepare(`
    UPDATE oauth_flows SET status = 'consumed', handoff_secret_hash = NULL, completed_at = ?
    WHERE id = ? AND status = 'ready'
  `).bind(new Date().toISOString(), flow.id).run()
  if (result.meta.changes !== 1) return jsonError(c, 400, 'Ticket ya utilizado')
  return c.json({
    status: 'ready',
    accessToken: await createAccessToken(c.env.JWT_SECRET, flow.result_user_id),
    tokenType: 'bearer',
  })
})

battlenetAuthRoutes.post('/api/auth/battlenet/onboarding/status', async c => {
  const limited = await requireRateLimit(c, 'onboarding_status', 60)
  if (limited) return limited
  const payload = await c.req.json<{ ticket?: string }>()
  const flow = await requireOnboardingFlow(c, payload.ticket ?? '')
  if (flow instanceof Response) return flow
  return c.json({
    status: 'needs_onboarding',
    displayName: flow.provider_display_name,
    desktop: flow.intent === 'login_desktop',
  })
})

async function requireOnboardingFlow(c: Context<{ Bindings: Env }>, ticket: string): Promise<OAuthFlowRow | Response> {
  const flow = await flowByHandoff(c.env, ticket)
  if (!flow || flow.status !== 'needs_onboarding' || !flow.provider_subject || !flow.provider_display_name) {
    return jsonError(c, 400, 'Onboarding invalido o ya utilizado')
  }
  if (isExpired(flow.handoff_expires_at) || isExpired(flow.expires_at)) {
    return jsonError(c, 410, 'Onboarding caducado')
  }
  return flow
}

async function finishOnboarding(c: Context<{ Bindings: Env }>, flow: OAuthFlowRow, user: UserRow) {
  if (flow.intent === 'login_desktop') {
    const result = await c.env.DB.prepare(`
      UPDATE oauth_flows SET status = 'ready', handoff_secret_hash = NULL,
        result_user_id = ?, completed_at = ? WHERE id = ? AND status = 'needs_onboarding'
    `).bind(user.id, new Date().toISOString(), flow.id).run()
    if (result.meta.changes !== 1) return jsonError(c, 400, 'Onboarding ya utilizado')
    return c.json({ status: 'ready' })
  }
  const result = await c.env.DB.prepare(`
    UPDATE oauth_flows SET status = 'consumed', handoff_secret_hash = NULL,
      result_user_id = ?, completed_at = ? WHERE id = ? AND status = 'needs_onboarding'
  `).bind(user.id, new Date().toISOString(), flow.id).run()
  if (result.meta.changes !== 1) return jsonError(c, 400, 'Onboarding ya utilizado')
  return c.json({
    status: 'ready',
    accessToken: await createAccessToken(c.env.JWT_SECRET, user.id),
    tokenType: 'bearer',
  })
}

battlenetAuthRoutes.post('/api/auth/battlenet/onboarding/register', async c => {
  const limited = await requireRateLimit(c, 'onboarding_register', 10)
  if (limited) return limited
  const payload = await c.req.json<{ ticket?: string, username?: string }>()
  const flow = await requireOnboardingFlow(c, payload.ticket ?? '')
  if (flow instanceof Response) return flow
  const username = normalizeUsernameInput(payload.username ?? '')
  if (username.length < 3 || username.length > 64) {
    return jsonError(c, 400, 'El nombre de usuario debe tener entre 3 y 64 caracteres')
  }
  if (await usernameExists(c.env, username)) return jsonError(c, 400, 'Nombre de usuario ya en uso')

  const syncToken = newSyncToken()
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO users (username, password_hash, sync_token) VALUES (?, NULL, ?)
      `).bind(username, syncToken),
      c.env.DB.prepare(`
        INSERT INTO user_identities (user_id, provider, provider_subject, provider_display_name, last_login_at)
        SELECT id, ?, ?, ?, ? FROM users WHERE sync_token = ?
      `).bind(PROVIDER, flow.provider_subject, flow.provider_display_name, new Date().toISOString(), syncToken),
    ])
  } catch (error) {
    if (isUsernameUniquenessError(error)) return jsonError(c, 400, 'Nombre de usuario ya en uso')
    return jsonError(c, 409, 'La cuenta Battle.net ya esta vinculada')
  }
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE sync_token = ?').bind(syncToken).first<UserRow>()
  if (!user) return jsonError(c, 500, 'No se pudo crear el usuario')
  return finishOnboarding(c, flow, user)
})

battlenetAuthRoutes.post('/api/auth/battlenet/onboarding/link', async c => {
  const limited = await requireRateLimit(c, 'onboarding_link', 8)
  if (limited) return limited
  const payload = await c.req.json<{ ticket?: string, username?: string, password?: string }>()
  const flow = await requireOnboardingFlow(c, payload.ticket ?? '')
  if (flow instanceof Response) return flow
  const user = await getUserByUsername(c.env, payload.username ?? '')
  if (!user || !(await verifyPassword(payload.password ?? '', user.password_hash))) {
    return jsonError(c, 401, 'Credenciales incorrectas')
  }
  if (user.email && !user.email_verified) return jsonError(c, 403, 'Email no verificado. Revisa tu correo antes de iniciar sesion.')
  const existing = await c.env.DB.prepare(`
    SELECT id FROM user_identities WHERE user_id = ? AND provider = ?
  `).bind(user.id, PROVIDER).first<{ id: number }>()
  if (existing) return jsonError(c, 409, 'Esta cuenta KeystoneSync ya tiene Battle.net vinculado')
  try {
    await c.env.DB.prepare(`
      INSERT INTO user_identities (user_id, provider, provider_subject, provider_display_name, last_login_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(user.id, PROVIDER, flow.provider_subject, flow.provider_display_name, new Date().toISOString()).run()
  } catch {
    return jsonError(c, 409, 'La cuenta Battle.net ya esta vinculada')
  }
  return finishOnboarding(c, flow, user)
})

battlenetAuthRoutes.post('/api/auth/battlenet/desktop/exchange', async c => {
  const limited = await requireRateLimit(c, 'desktop_exchange', 120)
  if (limited) return limited
  const payload = await c.req.json<{ flowId?: string, pollSecret?: string }>()
  if (!payload.flowId || !payload.pollSecret) return jsonError(c, 400, 'Flow desktop invalido')
  const flow = await c.env.DB.prepare(`
    SELECT * FROM oauth_flows WHERE id = ? AND intent = 'login_desktop'
  `).bind(payload.flowId).first<OAuthFlowRow>()
  if (!flow || !flow.desktop_poll_secret_hash
    || await sha256Hex(payload.pollSecret) !== flow.desktop_poll_secret_hash) {
    return jsonError(c, 401, 'Flow desktop invalido')
  }
  if (isExpired(flow.expires_at)) return c.json({ status: 'expired' })
  if (flow.status === 'pending' || flow.status === 'needs_onboarding') return c.json({ status: flow.status })
  if (flow.status !== 'ready' || !flow.result_user_id) return c.json({ status: 'consumed' })
  const result = await c.env.DB.prepare(`
    UPDATE oauth_flows SET status = 'consumed', completed_at = ?
    WHERE id = ? AND status = 'ready'
  `).bind(new Date().toISOString(), flow.id).run()
  if (result.meta.changes !== 1) return c.json({ status: 'consumed' })
  return c.json({
    status: 'ready',
    accessToken: await createAccessToken(c.env.JWT_SECRET, flow.result_user_id),
    tokenType: 'bearer',
  })
})

battlenetAuthRoutes.get('/api/me/identities', async c => {
  c.header('Cache-Control', 'no-store')
  c.header('Referrer-Policy', 'no-referrer')
  const currentUser = await getCurrentUser(c)
  if (currentUser instanceof Response) return currentUser
  const identity = await c.env.DB.prepare(`
    SELECT provider_display_name, created_at FROM user_identities WHERE user_id = ? AND provider = ?
  `).bind(currentUser.id, PROVIDER).first<{ provider_display_name: string, created_at: string }>()
  return c.json({
    battleNet: identity
      ? { linked: true, displayName: identity.provider_display_name, linkedAt: identity.created_at }
      : { linked: false, displayName: null, linkedAt: null },
  })
})

battlenetAuthRoutes.delete('/api/me/identities/battlenet', async c => {
  const currentUser = await getCurrentUser(c)
  if (currentUser instanceof Response) return currentUser
  if (!currentUser.password_hash) {
    return jsonError(c, 409, 'No puedes desvincular Battle.net porque actualmente es tu unico metodo de acceso.')
  }
  await c.env.DB.prepare('DELETE FROM user_identities WHERE user_id = ? AND provider = ?')
    .bind(currentUser.id, PROVIDER).run()
  return c.json({ battleNet: { linked: false, displayName: null, linkedAt: null } })
})
