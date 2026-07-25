import type { Env, UserRow } from './types'

export async function getUserById(env: Env, id: number): Promise<UserRow | null> {
  return env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>()
}

export async function getUserBySyncToken(env: Env, syncToken: string): Promise<UserRow | null> {
  return env.DB.prepare('SELECT * FROM users WHERE sync_token = ?').bind(syncToken).first<UserRow>()
}
