'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AuthPageShell from '@/app/components/AuthPageShell'
import { completeBattleNetOnboarding, getBattleNetOnboarding } from '@/lib/battlenet'
import { clearToken, hydrateProfile, setToken } from '@/lib/auth'

function OnboardingContent() {
  const params = useSearchParams()
  const router = useRouter()
  const ticket = params.get('ticket') ?? ''
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [desktop, setDesktop] = useState(false)
  const [mode, setMode] = useState<'register' | 'link'>('register')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [complete, setComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getBattleNetOnboarding(ticket)
      .then(value => { if (active) { setDisplayName(value.displayName); setDesktop(value.desktop) } })
      .catch(caught => { if (active) setError(caught instanceof Error ? caught.message : 'La autorizacion ha caducado.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [ticket])

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError(null)
    try {
      const payload = await completeBattleNetOnboarding(
        mode,
        mode === 'link' ? { ticket, username: username.trim(), password } : { ticket, username: username.trim() },
      )
      if (desktop) { setComplete(true); return }
      if (payload.status !== 'ready' || typeof payload.accessToken !== 'string') throw new Error()
      setToken(payload.accessToken); await hydrateProfile(); router.replace('/dashboard')
    } catch (caught) {
      clearToken()
      setError(caught instanceof Error ? caught.message : 'No se pudo completar la vinculacion.')
    } finally { setLoading(false) }
  }

  if (complete) return <p className="text-sm text-green-300">Battle.net conectado correctamente. Puedes volver a KeystoneClient.</p>
  if (loading && !displayName) return <p className="text-sm text-gray-300">Cargando autorizacion...</p>
  if (!displayName) return <p role="alert" className="text-sm text-red-400">{error ?? 'La autorizacion no es valida.'}</p>

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-blue-400/25 bg-blue-500/10 p-4">
        <p className="text-xs uppercase tracking-wider text-blue-300">Battle.net</p>
        <p className="mt-1 font-bold text-white">{displayName}</p>
        <p className="mt-2 text-sm text-gray-300">Esta cuenta todavia no esta asociada a KeystoneSync.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setMode('register')} className={`rounded-lg px-3 py-2 text-sm font-bold ${mode === 'register' ? 'bg-yellow-500 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>Crear cuenta</button>
        <button type="button" onClick={() => setMode('link')} className={`rounded-lg px-3 py-2 text-sm font-bold ${mode === 'link' ? 'bg-yellow-500 text-gray-950' : 'bg-gray-800 text-gray-300'}`}>Vincular existente</button>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-xs font-bold uppercase tracking-wider text-yellow-400">Username KeystoneSync
          <input value={username} onChange={event => setUsername(event.target.value)} minLength={3} required autoComplete="username" className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#111a26] px-4 py-2.5 text-sm text-white" />
        </label>
        {mode === 'link' && <label className="block text-xs font-bold uppercase tracking-wider text-yellow-400">Password
          <input value={password} onChange={event => setPassword(event.target.value)} required type="password" autoComplete="current-password" className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#111a26] px-4 py-2.5 text-sm text-white" />
        </label>}
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <button disabled={loading || !username.trim() || (mode === 'link' && !password)} className="w-full rounded-lg bg-yellow-500 py-2.5 text-sm font-black text-gray-950 disabled:opacity-50">
          {loading ? 'Completando...' : mode === 'register' ? 'Crear cuenta KeystoneSync' : 'Vincular cuenta existente'}
        </button>
      </form>
    </div>
  )
}

export default function BattleNetOnboardingPage() {
  return <AuthPageShell eyebrow="Battle.net" title="Asociar cuenta"><Suspense><OnboardingContent /></Suspense></AuthPageShell>
}
