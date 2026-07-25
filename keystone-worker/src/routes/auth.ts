import { Hono } from 'hono'
import type { Context } from 'hono'
import { createAccessToken, hashPassword, newPlainToken, newSyncToken, sha256Hex, verifyPassword } from '../crypto'
import { sendPasswordResetEmail, sendVerificationEmail } from '../email'
import { jsonError } from '../http'
import { checkEmailRateLimits } from '../rateLimit'
import type { Env, UserRow } from '../types'

const EMAIL_TOKEN_EXPIRE_HOURS = 24
const PASSWORD_RESET_EXPIRE_MINUTES = 60

export const authRoutes = new Hono<{ Bindings: Env }>()

type RegisterRequest = {
  firstName: string
  lastName: string
  email: string
  username: string
  password: string
  confirmPassword: string
  dateOfBirth: string
}

type LoginRequest = {
  username: string
  password: string
}

type VerifyEmailRequest = {
  token: string
}

type ForgotPasswordRequest = {
  email: string
}

type ResetPasswordRequest = {
  token: string
  password: string
  confirmPassword: string
}

type ResendVerificationRequest = {
  emailOrUsername: string
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function isValidEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
}

function addHours(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

function addMinutes(minutes: number): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString()
}

function isExpired(value: string | null): boolean {
  if (!value) return true
  return new Date(value).getTime() < Date.now()
}

function getClientIp(c: Context<{ Bindings: Env }>): string {
  const forwarded = c.req.header('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return c.req.header('cf-connecting-ip') ?? 'unknown'
}

async function findUserByEmailOrUsername(env: Env, value: string): Promise<UserRow | null> {
  const normalized = normalizeEmail(value)
  const byEmail = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(normalized).first<UserRow>()
  if (byEmail) return byEmail
  return env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(value.trim()).first<UserRow>()
}

authRoutes.post('/api/auth/register', async c => {
  const payload = await c.req.json<RegisterRequest>()
  const username = payload.username?.trim() ?? ''
  const firstName = payload.firstName?.trim() ?? ''
  const lastName = payload.lastName?.trim() ?? ''
  const email = normalizeEmail(payload.email ?? '')
  const dateOfBirth = payload.dateOfBirth ?? ''

  if (username.length < 3) return jsonError(c, 400, 'El nombre de usuario debe tener al menos 3 caracteres')
  if (!firstName || !lastName) return jsonError(c, 400, 'Nombre y apellidos son obligatorios')
  if (!isValidEmail(email)) return jsonError(c, 400, 'Email invalido')
  if ((payload.password ?? '').length < 6) return jsonError(c, 400, 'La password debe tener al menos 6 caracteres')
  if (payload.password !== payload.confirmPassword) return jsonError(c, 400, 'Las passwords no coinciden')
  if (!dateOfBirth || new Date(dateOfBirth).getTime() >= Date.now()) return jsonError(c, 400, 'Fecha de nacimiento invalida')

  const existingUsername = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first()
  if (existingUsername) return jsonError(c, 400, 'Nombre de usuario ya en uso')

  const existingEmail = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
  if (existingEmail) return jsonError(c, 400, 'Email ya en uso')

  const token = newPlainToken()
  const tokenHash = await sha256Hex(token)
  const passwordHash = await hashPassword(payload.password)
  const syncToken = newSyncToken()

  const insert = await c.env.DB.prepare(`
    INSERT INTO users (
      username, password_hash, sync_token, first_name, last_name, email, date_of_birth,
      email_verified, email_verification_token_hash, email_verification_expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).bind(
    username,
    passwordHash,
    syncToken,
    firstName,
    lastName,
    email,
    dateOfBirth,
    tokenHash,
    addHours(EMAIL_TOKEN_EXPIRE_HOURS),
  ).run()

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(insert.meta.last_row_id).first<UserRow>()
  if (!user) return jsonError(c, 500, 'No se pudo crear el usuario')

  try {
    await sendVerificationEmail(c.env, user, token)
  } catch (error) {
    await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id).run()
    return jsonError(c, error instanceof Error && error.message === 'Servicio de email no configurado' ? 500 : 502, error instanceof Error ? error.message : 'No se pudo enviar el email')
  }

  return c.json({
    id: user.id,
    username: user.username,
    email: user.email,
    emailVerified: Boolean(user.email_verified),
    message: 'Cuenta creada. Revisa tu email para verificarla.',
  }, 201)
})

authRoutes.post('/api/auth/login', async c => {
  const payload = await c.req.json<LoginRequest>()
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(payload.username).first<UserRow>()

  if (!user || !(await verifyPassword(payload.password ?? '', user.password_hash))) {
    return jsonError(c, 401, 'Credenciales incorrectas')
  }
  if (user.email && !user.email_verified) {
    return jsonError(c, 403, 'Email no verificado. Revisa tu correo antes de iniciar sesion.')
  }

  return c.json({ accessToken: await createAccessToken(c.env.JWT_SECRET, user.id), tokenType: 'bearer' })
})

authRoutes.post('/api/auth/verify-email', async c => {
  const payload = await c.req.json<VerifyEmailRequest>()
  const tokenHash = await sha256Hex((payload.token ?? '').trim())
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email_verification_token_hash = ?').bind(tokenHash).first<UserRow>()

  if (!user || isExpired(user.email_verification_expires_at)) {
    return jsonError(c, 400, 'Link de verificacion invalido o caducado')
  }

  await c.env.DB.prepare(`
    UPDATE users
    SET email_verified = 1,
        email_verification_token_hash = NULL,
        email_verification_expires_at = NULL
    WHERE id = ?
  `).bind(user.id).run()

  return c.json({ message: 'Email verificado correctamente' })
})

authRoutes.post('/api/auth/resend-verification', async c => {
  const payload = await c.req.json<ResendVerificationRequest>()
  const value = (payload.emailOrUsername ?? '').trim()
  const limited = await checkEmailRateLimits(c.env, 'resend_verification', getClientIp(c), value)
  if (limited) return limited

  const user = await findUserByEmailOrUsername(c.env, value)
  if (user?.email && !user.email_verified) {
    const token = newPlainToken()
    await c.env.DB.prepare(`
      UPDATE users
      SET email_verification_token_hash = ?,
          email_verification_expires_at = ?
      WHERE id = ?
    `).bind(await sha256Hex(token), addHours(EMAIL_TOKEN_EXPIRE_HOURS), user.id).run()

    const updatedUser = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first<UserRow>()
    if (updatedUser) {
      try {
        await sendVerificationEmail(c.env, updatedUser, token)
      } catch (error) {
        return jsonError(c, error instanceof Error && error.message === 'Servicio de email no configurado' ? 500 : 502, error instanceof Error ? error.message : 'No se pudo enviar el email')
      }
    }
  }

  return c.json({ message: 'Si la cuenta existe y esta pendiente, recibiras un nuevo email de verificacion.' })
})

authRoutes.post('/api/auth/forgot-password', async c => {
  const payload = await c.req.json<ForgotPasswordRequest>()
  const email = normalizeEmail(payload.email ?? '')
  const limited = await checkEmailRateLimits(c.env, 'forgot_password', getClientIp(c), email)
  if (limited) return limited

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>()
  if (user) {
    const token = newPlainToken()
    await c.env.DB.prepare(`
      UPDATE users
      SET password_reset_token_hash = ?,
          password_reset_expires_at = ?
      WHERE id = ?
    `).bind(await sha256Hex(token), addMinutes(PASSWORD_RESET_EXPIRE_MINUTES), user.id).run()

    const updatedUser = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first<UserRow>()
    if (updatedUser) {
      try {
        await sendPasswordResetEmail(c.env, updatedUser, token)
      } catch (error) {
        return jsonError(c, error instanceof Error && error.message === 'Servicio de email no configurado' ? 500 : 502, error instanceof Error ? error.message : 'No se pudo enviar el email')
      }
    }
  }

  return c.json({ message: 'Si el email existe, recibiras un enlace para recuperar la password.' })
})

authRoutes.post('/api/auth/reset-password', async c => {
  const payload = await c.req.json<ResetPasswordRequest>()
  if ((payload.password ?? '').length < 6) return jsonError(c, 400, 'La password debe tener al menos 6 caracteres')
  if (payload.password !== payload.confirmPassword) return jsonError(c, 400, 'Las passwords no coinciden')

  const tokenHash = await sha256Hex((payload.token ?? '').trim())
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE password_reset_token_hash = ?').bind(tokenHash).first<UserRow>()

  if (!user || isExpired(user.password_reset_expires_at)) {
    return jsonError(c, 400, 'Link de recuperacion invalido o caducado')
  }

  await c.env.DB.prepare(`
    UPDATE users
    SET password_hash = ?,
        password_reset_token_hash = NULL,
        password_reset_expires_at = NULL
    WHERE id = ?
  `).bind(await hashPassword(payload.password), user.id).run()

  return c.json({ message: 'Password actualizada correctamente' })
})
