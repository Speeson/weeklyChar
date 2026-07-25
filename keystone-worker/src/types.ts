export type Env = {
  DB: D1Database
  JWT_SECRET: string
  RESEND_API_KEY?: string
  EMAIL_FROM?: string
  WEB_BASE_URL?: string
  ALLOWED_ORIGINS?: string
}
