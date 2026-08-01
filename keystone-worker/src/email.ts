import type { Env, UserRow } from './types'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

async function sendEmail(env: Env, toEmail: string, subject: string, html: string, text: string): Promise<void> {
  const apiKey = env.RESEND_API_KEY?.trim()
  const from = env.EMAIL_FROM?.trim() || 'KeystoneSync <no-reply@esgarpe.dev>'

  if (!apiKey) {
    throw new Error('Servicio de email no configurado')
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'KeystoneSync/1.0',
    },
    body: JSON.stringify({
      from,
      to: [toEmail],
      subject,
      html,
      text,
    }),
  })

  if (!response.ok) {
    const rawDetail = await response.text()
    let detail = rawDetail.trim()
    if (detail) {
      try {
        const parsed = JSON.parse(detail) as { message?: string; name?: string; error?: string }
        detail = parsed.message ?? parsed.error ?? detail
      } catch {
        // Keep Resend's raw response when it is not JSON.
      }
    }

    throw new Error(`No se pudo enviar el email (${response.status}): ${detail || response.statusText}`)
  }
}

function getWebBaseUrl(env: Env): string {
  return (env.WEB_BASE_URL?.trim() || 'https://keystonesync.esgarpe.dev').replace(/\/+$/, '')
}

export async function sendVerificationEmail(env: Env, user: UserRow, token: string): Promise<void> {
  if (!user.email) throw new Error('Email invalido')

  const baseUrl = getWebBaseUrl(env)
  const link = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`
  const safeUsername = escapeHtml(user.username)
  const subject = 'Verifica tu cuenta de KeystoneSync'
  const text = [
    `Hola ${user.username},`,
    '',
    'Confirma tu cuenta de KeystoneSync abriendo este enlace:',
    link,
    '',
    'Este enlace caduca en 24 horas.',
  ].join('\n')
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
      <h2>Verifica tu cuenta de KeystoneSync</h2>
      <p>Hola <strong>${safeUsername}</strong>, confirma tu cuenta para poder iniciar sesion.</p>
      <p><a href="${link}" style="display:inline-block;background:#f59e0b;color:#111827;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:bold">Verificar cuenta</a></p>
      <p>Si el boton no funciona, copia este enlace:</p>
      <p>${link}</p>
      <p>Este enlace caduca en 24 horas.</p>
    </div>
  `

  await sendEmail(env, user.email, subject, html, text)
}

export async function sendPasswordResetEmail(env: Env, user: UserRow, token: string): Promise<void> {
  if (!user.email) throw new Error('Email invalido')

  const baseUrl = getWebBaseUrl(env)
  const link = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`
  const safeUsername = escapeHtml(user.username)
  const subject = 'Recupera tu password de KeystoneSync'
  const text = [
    `Hola ${user.username},`,
    '',
    'Puedes establecer una nueva password desde este enlace:',
    link,
    '',
    'Este enlace caduca en 60 minutos.',
  ].join('\n')
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
      <h2>Recupera tu password de KeystoneSync</h2>
      <p>Hola <strong>${safeUsername}</strong>, usa este enlace para establecer una nueva password.</p>
      <p><a href="${link}" style="display:inline-block;background:#f59e0b;color:#111827;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:bold">Cambiar password</a></p>
      <p>Si el boton no funciona, copia este enlace:</p>
      <p>${link}</p>
      <p>Este enlace caduca en 60 minutos.</p>
    </div>
  `

  await sendEmail(env, user.email, subject, html, text)
}
