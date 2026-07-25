export type Env = {
  DB: D1Database
  JWT_SECRET: string
  RESEND_API_KEY?: string
  EMAIL_FROM?: string
  WEB_BASE_URL?: string
  ALLOWED_ORIGINS?: string
}

export type UserRow = {
  id: number
  username: string
  password_hash: string
  sync_token: string
  avatar_url: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  date_of_birth: string | null
  email_verified: number
  email_verification_token_hash: string | null
  email_verification_expires_at: string | null
  password_reset_token_hash: string | null
  password_reset_expires_at: string | null
  created_at: string
}

export type CharacterRow = {
  id: number
  user_id: number
  name: string
  realm: string
  region: string
  avatar_url: string | null
  wow_account: string | null
  rio_score: number | null
  wow_class: string | null
  ilvl: number | null
  vault_json: string | null
  prey_hunts_json: string | null
  currencies_json: string | null
  money_json: string | null
  mythic_plus_season_json: string | null
  created_at: string
  updated_at: string
}

export type KeystoneRow = {
  id: number
  character_id: number
  has_keystone: number
  keystone_level: number | null
  keystone_challenge_map_id: number | null
  keystone_map_id: number | null
  keystone_dungeon: string | null
  updated_reason: string | null
  updated_at: number | null
  created_at: string
}
