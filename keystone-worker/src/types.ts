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
