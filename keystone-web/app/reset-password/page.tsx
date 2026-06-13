'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { API_URL } from '@/lib/auth'
import AuthPageShell from '@/app/components/AuthPageShell'

export default function ResetPasswordPage() {
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') ?? '')
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setError(null)
    setLoading(true)

    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail ?? 'No se pudo actualizar la password.')
        return
      }
      setMessage(data.message ?? 'Password actualizada correctamente.')
      setPassword('')
      setConfirmPassword('')
    } catch {
      setError('No se puede conectar con la API.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageShell
      eyebrow="Seguridad"
      title="Nueva password"
      description="Establece una nueva password para tu cuenta."
    >
        {!token && <p className="mt-5 text-sm text-red-400">Link de recuperacion invalido.</p>}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            type="password"
            placeholder="Nueva password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            disabled={!token}
            className="w-full rounded-lg border border-white/10 bg-[#111a26] px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition focus:border-yellow-500 disabled:opacity-50"
          />
          <input
            type="password"
            placeholder="Confirmar nueva password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
            disabled={!token}
            className="w-full rounded-lg border border-white/10 bg-[#111a26] px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition focus:border-yellow-500 disabled:opacity-50"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          {message && <p className="rounded-lg border border-green-400/30 bg-green-400/10 p-3 text-sm text-green-300">{message}</p>}
          <button
            type="submit"
            disabled={loading || !token}
            className="w-full rounded-lg bg-yellow-500 py-2.5 text-sm font-black text-gray-950 transition hover:bg-yellow-400 disabled:opacity-50"
          >
            {loading ? 'Guardando...' : 'Actualizar password'}
          </button>
        </form>

        <Link href="/login" className="mt-5 inline-flex text-sm font-semibold text-yellow-400 hover:text-yellow-300">
          Volver al login
        </Link>
    </AuthPageShell>
  )
}
