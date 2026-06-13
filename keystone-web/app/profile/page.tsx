'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/app/components/Navbar'
import { apiFetch, getToken } from '@/lib/auth'

type Profile = {
  id: number
  username: string
  firstName: string | null
  lastName: string | null
  email: string | null
  dateOfBirth: string | null
  emailVerified: boolean
  avatarUrl: string | null
}

function Card({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900/55 p-5 shadow-xl">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-gray-100">{title}</h2>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      {children}
    </section>
  )
}

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [resending, setResending] = useState(false)

  useEffect(() => {
    if (!getToken()) {
      router.push('/login')
      return
    }
    apiFetch('/api/me')
      .then(async res => {
        if (res.status === 401) {
          router.push('/login')
          return null
        }
        return res.ok ? res.json() : null
      })
      .then(data => {
        if (data) setProfile(data)
      })
      .finally(() => setLoading(false))
  }, [router])

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setError(null)
    setSaving(true)
    try {
      const res = await apiFetch('/api/me/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, password, confirmPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail ?? 'No se pudo cambiar la password.')
        return
      }
      setMessage(data.message ?? 'Password actualizada correctamente.')
      setCurrentPassword('')
      setPassword('')
      setConfirmPassword('')
    } catch {
      setError('No se puede conectar con la API.')
    } finally {
      setSaving(false)
    }
  }

  async function resendVerification() {
    if (!profile?.email && !profile?.username) return
    setMessage(null)
    setError(null)
    setResending(true)
    try {
      const res = await apiFetch('/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ emailOrUsername: profile.email ?? profile.username }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail ?? 'No se pudo reenviar el email.')
        return
      }
      setMessage(data.message ?? 'Si la cuenta esta pendiente, recibiras un nuevo email.')
    } catch {
      setError('No se puede conectar con la API.')
    } finally {
      setResending(false)
    }
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="flex min-h-screen items-center justify-center bg-gray-950">
          <p className="text-gray-400">Cargando...</p>
        </main>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-950 px-4 py-8 text-gray-100 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-yellow-400">Cuenta</p>
            <h1 className="mt-1 text-3xl font-black text-white">Perfil</h1>
            <p className="mt-1 text-sm text-gray-500">Datos de cuenta, estado de email y seguridad.</p>
          </div>

          {message && <p className="mb-5 rounded-xl border border-green-400/30 bg-green-400/10 p-3 text-sm text-green-300">{message}</p>}
          {error && <p className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Informacion de cuenta" description="Datos usados para identificar tu cuenta de KeystoneSync.">
              <div className="space-y-3">
                <div className="rounded-xl border border-gray-800 bg-gray-950/70 px-4 py-3">
                  <p className="text-xs text-gray-500">Username</p>
                  <p className="mt-1 font-semibold text-white">{profile?.username ?? '-'}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-gray-800 bg-gray-950/70 px-4 py-3">
                    <p className="text-xs text-gray-500">Nombre</p>
                    <p className="mt-1 font-semibold text-white">{profile?.firstName ?? '-'}</p>
                  </div>
                  <div className="rounded-xl border border-gray-800 bg-gray-950/70 px-4 py-3">
                    <p className="text-xs text-gray-500">Apellidos</p>
                    <p className="mt-1 font-semibold text-white">{profile?.lastName ?? '-'}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-gray-800 bg-gray-950/70 px-4 py-3">
                  <p className="text-xs text-gray-500">Fecha de nacimiento</p>
                  <p className="mt-1 font-semibold text-white">{profile?.dateOfBirth ?? '-'}</p>
                </div>
                <div className="rounded-xl border border-gray-800 bg-gray-950/70 px-4 py-3">
                  <p className="text-xs text-gray-500">Email</p>
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    <p className="font-semibold text-white">{profile?.email ?? 'Cuenta antigua sin email guardado'}</p>
                    {profile?.email && (
                      <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${profile.emailVerified ? 'bg-green-400/10 text-green-300' : 'bg-red-400/10 text-red-300'}`}>
                        {profile.emailVerified ? 'Verificado' : 'Pendiente'}
                      </span>
                    )}
                  </div>
                </div>
                {profile?.email && !profile.emailVerified && (
                  <button
                    onClick={resendVerification}
                    disabled={resending}
                    className="w-full rounded-lg border border-yellow-400/40 bg-yellow-400/10 py-2 text-sm font-bold text-yellow-300 transition hover:bg-yellow-400/15 disabled:opacity-50"
                  >
                    {resending ? 'Reenviando...' : 'Reenviar email de verificacion'}
                  </button>
                )}
              </div>
            </Card>

            <Card title="Seguridad" description="Cambia tu password desde aqui si conoces la actual.">
              <form onSubmit={changePassword} className="space-y-3">
                <input
                  type="password"
                  placeholder="Password actual"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  required
                  className="w-full rounded-lg border border-white/10 bg-[#111a26] px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition focus:border-yellow-500"
                />
                <input
                  type="password"
                  placeholder="Nueva password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full rounded-lg border border-white/10 bg-[#111a26] px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition focus:border-yellow-500"
                />
                <input
                  type="password"
                  placeholder="Confirmar nueva password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  className="w-full rounded-lg border border-white/10 bg-[#111a26] px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition focus:border-yellow-500"
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-lg bg-yellow-500 py-2.5 text-sm font-black text-gray-950 transition hover:bg-yellow-400 disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Cambiar password'}
                </button>
              </form>
            </Card>
          </div>
        </div>
      </main>
    </>
  )
}
