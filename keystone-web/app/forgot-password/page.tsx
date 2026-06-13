'use client'

import Link from 'next/link'
import { useState } from 'react'
import { API_URL } from '@/lib/auth'
import AuthPageShell from '@/app/components/AuthPageShell'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setError(null)
    setLoading(true)

    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail ?? 'No se pudo solicitar la recuperacion.')
        return
      }
      setMessage(data.message ?? 'Si el email existe, recibiras un enlace.')
    } catch {
      setError('No se puede conectar con la API.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageShell
      eyebrow="Seguridad"
      title="Recuperar password"
      description="Introduce tu email y te enviaremos un enlace para crear una nueva password."
    >
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-white/10 bg-[#111a26] px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition focus:border-yellow-500"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          {message && <p className="rounded-lg border border-green-400/30 bg-green-400/10 p-3 text-sm text-green-300">{message}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-yellow-500 py-2.5 text-sm font-black text-gray-950 transition hover:bg-yellow-400 disabled:opacity-50"
          >
            {loading ? 'Enviando...' : 'Enviar enlace'}
          </button>
        </form>

        <Link href="/login" className="mt-5 inline-flex text-sm font-semibold text-yellow-400 hover:text-yellow-300">
          Volver al login
        </Link>
    </AuthPageShell>
  )
}
