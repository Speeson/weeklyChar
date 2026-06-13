'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { API_URL, hydrateProfile, setToken, setUsername as saveUsername } from '@/lib/auth'

type AuthMode = 'login' | 'register'

type Props = {
  mode: AuthMode
  className?: string
}

export default function AuthForm({ mode, className = '' }: Props) {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const canResendVerification = mode === 'login' && !!error?.toLowerCase().includes('email no verificado') && !!username

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    const body = mode === 'login'
      ? { username, password }
      : { firstName, lastName, email, username, password, confirmPassword, dateOfBirth }

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.detail ?? 'Error desconocido')
        return
      }

      if (mode === 'register') {
        setSuccess(data.message ?? 'Cuenta creada. Revisa tu email para verificarla.')
        setPassword('')
        setConfirmPassword('')
        return
      }

      setToken(data.accessToken)
      saveUsername(username)
      await hydrateProfile()
      router.push('/characters')
    } catch {
      setError('No se puede conectar con la API.')
    } finally {
      setLoading(false)
    }
  }

  async function resendVerification() {
    setResending(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`${API_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrUsername: username }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail ?? 'No se pudo reenviar el email.')
        return
      }
      setSuccess(data.message ?? 'Si la cuenta esta pendiente, recibiras un nuevo email.')
    } catch {
      setError('No se puede conectar con la API.')
    } finally {
      setResending(false)
    }
  }

  const inputClass = 'w-full rounded-lg border border-white/10 bg-[#111a26] px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition focus:border-yellow-500'

  return (
    <form onSubmit={handleSubmit} className={`space-y-3 ${className}`}>
      {mode === 'register' && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              placeholder="Nombre"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              required
              className={inputClass}
            />
            <input
              type="text"
              placeholder="Apellidos"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className={inputClass}
          />
          <input
            type="date"
            value={dateOfBirth}
            onChange={e => setDateOfBirth(e.target.value)}
            required
            className={`${inputClass} text-gray-300`}
          />
        </>
      )}

      <input
        type="text"
        placeholder="Nombre de usuario"
        value={username}
        onChange={e => setUsername(e.target.value)}
        required
        className={inputClass}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
        className={inputClass}
      />
      {mode === 'register' && (
        <input
          type="password"
          placeholder="Confirmar password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          required
          className={inputClass}
        />
      )}

      {mode === 'login' && (
        <div className="text-right">
          <Link href="/forgot-password" className="text-xs font-semibold text-yellow-400 hover:text-yellow-300">
            Has olvidado tu password?
          </Link>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
      {canResendVerification && (
        <button
          type="button"
          onClick={resendVerification}
          disabled={resending}
          className="w-full rounded-lg border border-yellow-400/40 bg-yellow-400/10 py-2 text-xs font-bold text-yellow-300 transition hover:bg-yellow-400/15 disabled:opacity-50"
        >
          {resending ? 'Reenviando...' : 'Reenviar email de verificacion'}
        </button>
      )}
      {success && <p className="rounded-lg border border-green-400/30 bg-green-400/10 p-3 text-sm text-green-300">{success}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-yellow-500 py-2.5 text-sm font-black text-gray-950 transition hover:bg-yellow-400 disabled:opacity-50"
      >
        {loading ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
      </button>
    </form>
  )
}
