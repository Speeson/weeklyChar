import { API_URL, apiFetch } from './auth'

export type BattleNetIdentity = {
  linked: boolean
  displayName: string | null
  linkedAt: string | null
}

async function jsonOrError(response: Response, fallback: string): Promise<Record<string, unknown>> {
  let payload: Record<string, unknown> = {}
  try {
    payload = await response.json() as Record<string, unknown>
  } catch {
    // Provider and proxy failures must stay user-safe.
  }
  if (!response.ok) throw new Error(typeof payload.detail === 'string' ? payload.detail : fallback)
  return payload
}

function requireBattleNetAuthorizationUrl(value: unknown, fallback: string): string {
  if (typeof value !== 'string') throw new Error(fallback)
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.hostname !== 'oauth.battle.net' || url.pathname !== '/authorize'
      || url.username || url.password) throw new Error(fallback)
    return url.toString()
  } catch {
    throw new Error(fallback)
  }
}

export async function startBattleNetLogin(): Promise<string> {
  const response = await fetch(`${API_URL}/api/auth/battlenet/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
    referrerPolicy: 'no-referrer',
  })
  const payload = await jsonOrError(response, 'Battle.net no esta disponible temporalmente.')
  return requireBattleNetAuthorizationUrl(payload.authorizationUrl, 'Battle.net no esta disponible temporalmente.')
}

export async function exchangeBattleNetTicket(ticket: string) {
  const response = await fetch(`${API_URL}/api/auth/battlenet/exchange`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticket }), referrerPolicy: 'no-referrer',
  })
  return jsonOrError(response, 'No se pudo completar el acceso con Battle.net.')
}

export async function getBattleNetOnboarding(ticket: string) {
  const response = await fetch(`${API_URL}/api/auth/battlenet/onboarding/status`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticket }), referrerPolicy: 'no-referrer',
  })
  const payload = await jsonOrError(response, 'La autorizacion ha caducado.')
  if (payload.status !== 'needs_onboarding' || typeof payload.displayName !== 'string' || typeof payload.desktop !== 'boolean') {
    throw new Error('La autorizacion no es valida.')
  }
  return { displayName: payload.displayName, desktop: payload.desktop }
}

export async function completeBattleNetOnboarding(
  action: 'register' | 'link',
  body: { ticket: string, username: string, password?: string },
) {
  const response = await fetch(`${API_URL}/api/auth/battlenet/onboarding/${action}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), referrerPolicy: 'no-referrer',
  })
  return jsonOrError(response, 'No se pudo completar la vinculacion.')
}

export async function getBattleNetIdentity(): Promise<BattleNetIdentity> {
  const payload = await jsonOrError(await apiFetch('/api/me/identities'), 'No se pudo cargar Battle.net.')
  const identity = payload.battleNet as Partial<BattleNetIdentity> | undefined
  if (!identity || typeof identity.linked !== 'boolean') throw new Error('Respuesta de identidad no valida.')
  return {
    linked: identity.linked,
    displayName: typeof identity.displayName === 'string' ? identity.displayName : null,
    linkedAt: typeof identity.linkedAt === 'string' ? identity.linkedAt : null,
  }
}

export async function startBattleNetLink(): Promise<string> {
  const payload = await jsonOrError(
    await apiFetch('/api/me/identities/battlenet/start', { method: 'POST', body: '{}' }),
    'No se pudo iniciar la vinculacion con Battle.net.',
  )
  return requireBattleNetAuthorizationUrl(payload.authorizationUrl, 'Respuesta de Battle.net no valida.')
}

export async function unlinkBattleNet(): Promise<void> {
  await jsonOrError(
    await apiFetch('/api/me/identities/battlenet', { method: 'DELETE' }),
    'No se pudo desvincular Battle.net.',
  )
}
