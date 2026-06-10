'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { API_URL, setToken, setUsername as saveUsername } from '@/lib/auth'

const features = [
  ['Piedra actual', 'Nivel, mazmorra y abreviatura sincronizados por personaje.'],
  ['Great Vault', 'Progreso semanal de raid, dungeons y world activities.'],
  ['Currencies', 'Dawncrests, keys, manaflux y recursos semanales importantes.'],
  ['Mythic+ season', 'Mejores mazmorras, nivel timeado, medalla y rating estimado.'],
  ['Equipos', 'Comparte personajes con tu grupo mediante código de invitación.'],
  ['Raider.IO', 'Avatar, clase, score y datos complementarios desde Raider.IO.'],
]

const steps = [
  ['01', 'Instala KeystoneClient', 'El cliente de Windows lee los datos del addon y sincroniza con tu cuenta.'],
  ['02', 'Instala el addon', 'Desde el cliente puedes instalar o actualizar KeystoneSync en tu carpeta de WoW.'],
  ['03', 'Entra con tus personajes', 'Al logear/logout, el addon guarda la información semanal en SavedVariables.'],
  ['04', 'Consulta el dashboard', 'La web muestra resumen, equipos, vault, currencies y llaves en tiempo real.'],
]

const previewRows = [
  ['Speen', 'MT +12', '14 13 12', '2/8', 'Hero 395'],
  ['Spee', 'SR +13', '14 12 —', '4/8', 'Myth 186'],
  ['Speeral', 'AA +14', '14 14 13', '8/8', 'Keys 11'],
]

export default function LandingPage() {
  const router = useRouter()
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function openAuth(mode: 'login' | 'register') {
    setAuthMode(mode)
    setAuthOpen(true)
    setError(null)
  }

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.detail ?? 'Error desconocido')
        return
      }

      if (authMode === 'register') {
        const loginRes = await fetch(`${API_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        })
        const loginData = await loginRes.json()
        setToken(loginData.accessToken)
      } else {
        setToken(data.accessToken)
      }
      saveUsername(username)
      router.push('/characters')
    } catch {
      setError('No se puede conectar con la API.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#070d14] text-gray-100">
      <section className="relative min-h-screen">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-35"
          style={{ backgroundImage: "url('/client-bg.jpg')" }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(245,158,11,0.24),transparent_34%),linear-gradient(180deg,rgba(7,13,20,0.76),#070d14_88%)]" />
        <div className="absolute left-1/2 top-24 h-64 w-64 -translate-x-1/2 rounded-full bg-yellow-500/10 blur-3xl" />

        <header className="relative z-10 border-b border-white/10 bg-[#0f1923]/80 px-5 py-4 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-5">
            <Link href="/" className="text-xl font-black tracking-tight text-yellow-400">
              KeystoneSync
            </Link>
            <nav className="hidden items-center gap-7 text-sm text-gray-300 md:flex">
              <a href="#features" className="transition hover:text-white">Características</a>
              <a href="#how" className="transition hover:text-white">Cómo funciona</a>
              <a href="#download" className="transition hover:text-white">Descargar</a>
              <Link href="/teams" className="transition hover:text-white">Equipos</Link>
            </nav>
            <div className="relative flex items-center gap-3">
              <a
                href="https://github.com/Speeson/weeklyChar/releases/latest/download/KeystoneClientSetup.exe"
                className="hidden rounded-lg border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-sm font-bold text-yellow-300 transition hover:border-yellow-400/60 hover:bg-yellow-400/15 hover:text-yellow-200 sm:inline-flex"
              >
                Descargar
              </a>
              <button onClick={() => openAuth('login')} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-200 transition hover:border-yellow-400/50 hover:text-white">
                Iniciar sesión
              </button>
              <button onClick={() => openAuth('register')} className="rounded-lg bg-yellow-500 px-4 py-2 text-sm font-bold text-gray-950 shadow-lg shadow-yellow-500/20 transition hover:bg-yellow-400">
                Registrarse
              </button>

              {authOpen && (
                <div className="absolute right-0 top-14 w-[min(92vw,360px)] overflow-hidden rounded-2xl border border-white/10 bg-[#0b121b]/98 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl">
                  <div className="mb-4 flex overflow-hidden rounded-xl border border-white/10">
                    <button
                      onClick={() => { setAuthMode('login'); setError(null) }}
                      className={`flex-1 py-2 text-sm font-bold transition ${authMode === 'login' ? 'bg-yellow-500 text-gray-950' : 'bg-[#111a26] text-gray-400 hover:text-white'}`}
                    >
                      Iniciar sesión
                    </button>
                    <button
                      onClick={() => { setAuthMode('register'); setError(null) }}
                      className={`flex-1 py-2 text-sm font-bold transition ${authMode === 'register' ? 'bg-yellow-500 text-gray-950' : 'bg-[#111a26] text-gray-400 hover:text-white'}`}
                    >
                      Registrarse
                    </button>
                  </div>

                  <form onSubmit={handleAuthSubmit} className="space-y-3">
                    <input
                      type="text"
                      placeholder="Nombre de usuario"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      required
                      className="w-full rounded-lg border border-white/10 bg-[#111a26] px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition focus:border-yellow-500"
                    />
                    <input
                      type="password"
                      placeholder="Contraseña"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      className="w-full rounded-lg border border-white/10 bg-[#111a26] px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition focus:border-yellow-500"
                    />
                    {error && <p className="text-sm text-red-400">{error}</p>}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-lg bg-yellow-500 py-2.5 text-sm font-black text-gray-950 transition hover:bg-yellow-400 disabled:opacity-50"
                    >
                      {loading ? 'Cargando...' : authMode === 'login' ? 'Entrar' : 'Crear cuenta'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="relative z-10 mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl items-center gap-12 px-5 py-16 lg:grid-cols-[1fr_0.86fr]">
          <div>
            <div className="mb-5 inline-flex rounded-full border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-yellow-300">
              Addon WoW + cliente Windows + dashboard web
            </div>
            <h1 className="max-w-4xl text-5xl font-black leading-[0.95] tracking-tight text-white md:text-7xl">
              Control semanal de todos tus alters sin abrir mil hojas.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-300">
              KeystoneSync recopila llaves, Great Vault, currencies, progreso Mythic+ y datos de Raider.IO para mostrarlo todo en una vista clara para ti y tu equipo.
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <a
                href="https://github.com/Speeson/weeklyChar/releases/latest/download/KeystoneClientSetup.exe"
                className="rounded-xl bg-yellow-500 px-6 py-3 text-sm font-black text-gray-950 shadow-2xl shadow-yellow-500/20 transition hover:-translate-y-0.5 hover:bg-yellow-400"
              >
                Descargar para Windows
              </a>
              <button onClick={() => openAuth('login')} className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-bold text-white backdrop-blur transition hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/10">
                Ir al dashboard
              </button>
            </div>
            <p className="mt-4 text-xs text-gray-500">Requiere World of Warcraft Retail. El instalador incluirá KeystoneClient y el addon KeystoneSync.</p>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 rounded-[2rem] bg-yellow-500/10 blur-3xl" />
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#111a26]/88 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/10 bg-[#0f1923] px-5 py-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-yellow-400">Resumen semanal</p>
                  <p className="text-sm text-gray-400">Zul'jin roster</p>
                </div>
                <div className="h-3 w-3 rounded-full bg-green-400 shadow-lg shadow-green-400/40" />
              </div>
              <div className="p-5">
                <div className="grid grid-cols-5 gap-2 border-b border-white/10 pb-3 text-[11px] font-bold uppercase tracking-wide text-gray-500">
                  <span>Character</span>
                  <span>Key</span>
                  <span>Dungeons</span>
                  <span>Vault</span>
                  <span>Currency</span>
                </div>
                {previewRows.map((row, index) => (
                  <div key={row[0]} className={`grid grid-cols-5 gap-2 py-4 text-sm ${index !== previewRows.length - 1 ? 'border-b border-white/5' : ''}`}>
                    <span className="font-bold text-cyan-300">{row[0]}</span>
                    <span className="font-bold text-white">{row[1]}</span>
                    <span className="text-green-400">{row[2]}</span>
                    <span className="text-yellow-300">{row[3]}</span>
                    <span className="text-purple-300">{row[4]}</span>
                  </div>
                ))}
                <div className="mt-5 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4">
                  <p className="text-sm font-bold text-yellow-300">Sincronización automática</p>
                  <p className="mt-1 text-xs leading-5 text-gray-300">
                    El cliente detecta cambios en SavedVariables y actualiza API, cliente y web sin intervención manual.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="border-y border-white/10 bg-[#0b121b] px-5 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-yellow-400">Cómo funciona</p>
              <h2 className="mt-3 text-3xl font-black text-white md:text-5xl">De WoW al dashboard en cuatro pasos.</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-gray-400">
              El addon solo recopila datos del personaje. El cliente los lee, los enriquece cuando hace falta y los sincroniza con la API.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            {steps.map(step => (
              <div key={step[0]} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:-translate-y-1 hover:border-yellow-400/40 hover:bg-yellow-400/[0.04]">
                <span className="text-sm font-black text-yellow-400">{step[0]}</span>
                <h3 className="mt-5 text-lg font-bold text-white">{step[1]}</h3>
                <p className="mt-3 text-sm leading-6 text-gray-400">{step[2]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="px-5 py-20">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-yellow-400">Características</p>
          <h2 className="mt-3 max-w-3xl text-3xl font-black text-white md:text-5xl">Todo lo importante de la semana en una sola pantalla.</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {features.map(feature => (
              <div key={feature[0]} className="rounded-2xl border border-white/10 bg-[#111a26] p-6 shadow-xl shadow-black/20">
                <h3 className="text-lg font-bold text-white">{feature[0]}</h3>
                <p className="mt-3 text-sm leading-6 text-gray-400">{feature[1]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="download" className="px-5 pb-24">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-3xl border border-yellow-400/20 bg-gradient-to-r from-yellow-500/15 via-[#111a26] to-cyan-500/10 p-8 md:p-10">
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-yellow-400">Descarga</p>
              <h2 className="mt-3 text-3xl font-black text-white">KeystoneClient para Windows</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300">
                El cliente instala o actualiza el addon, detecta tu carpeta de WoW, sincroniza automáticamente y te avisa cuando haya nuevas versiones.
              </p>
            </div>
            <a
              href="https://github.com/Speeson/weeklyChar/releases/latest/download/KeystoneClientSetup.exe"
              className="shrink-0 rounded-xl bg-yellow-500 px-7 py-4 text-sm font-black text-gray-950 shadow-2xl shadow-yellow-500/20 transition hover:bg-yellow-400"
            >
              Descargar instalador
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-5 py-8 text-sm text-gray-500">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 md:flex-row">
          <span>KeystoneSync</span>
          <div className="flex gap-5">
            <Link href="/login?mode=login" className="hover:text-white">Login</Link>
            <Link href="/characters" className="hover:text-white">Dashboard</Link>
            <a href="https://github.com/Speeson/weeklyChar" className="hover:text-white">GitHub</a>
          </div>
        </div>
      </footer>
    </main>
  )
}
