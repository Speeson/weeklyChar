'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { CLIENT_DOWNLOAD_URL } from '@/lib/downloads'
import AuthForm from '@/app/components/AuthForm'

const features = [
  ['Piedra actual', 'Nivel, mazmorra y abreviatura sincronizados por personaje.'],
  ['Great Vault', 'Progreso semanal de raid, dungeons y world activities.'],
  ['Currencies', 'Dawncrests, keys, manaflux y recursos semanales importantes.'],
  ['Mythic+ season', 'Mejores mazmorras, nivel timeado, medalla y rating estimado.'],
  ['Equipos', 'Comparte personajes con tu grupo mediante codigo de invitacion.'],
  ['Raider.IO', 'Avatar, clase, score y datos complementarios desde Raider.IO.'],
]

const steps = [
  ['01', 'Instala KeystoneClient', 'El cliente de Windows lee los datos del addon y sincroniza con tu cuenta.'],
  ['02', 'Instala el addon', 'Desde el cliente puedes instalar o actualizar KeystoneSync en tu carpeta de WoW.'],
  ['03', 'Entra con tus personajes', 'Al logear/logout, el addon guarda la informacion semanal en SavedVariables.'],
  ['04', 'Consulta el dashboard', 'La web muestra resumen, equipos, vault, currencies y llaves en tiempo real.'],
]

const previewCharacters = [
  { name: 'Aether', className: 'text-pink-400/70', realm: "Zul'jin", ilvl: '288', rating: '3401', key: 'MT +16' },
  { name: 'Korra', className: 'text-cyan-300/70', realm: "Zul'jin", ilvl: '286', rating: '3214', key: 'WS +14' },
  { name: 'Nyra', className: 'text-emerald-300/70', realm: "Zul'jin", ilvl: '287', rating: '3108', key: 'SR +15' },
  { name: 'Ravik', className: 'text-lime-300/70', realm: "Zul'jin", ilvl: '283', rating: '3072', key: 'SEAT +13' },
]

const dungeonPreviewRows = [
  ['Algeth\'ar Academy', ['16', '14', '13', '13'], ['427', '397', '382', '382']],
  ['Magisters\' Terrace', ['15', '14', '14', '14'], ['412', '399', '397', '397']],
  ['Nexus-Point Xenas', ['15', '14', '15', '12'], ['412', '397', '414', '369']],
  ['Skyreach', ['16', '14', '13', '13'], ['427', '399', '382', '384']],
]

const vaultPreviewRows = [
  ['Raids', ['- - - (0/6)', '- - - (0/6)', '- - - (0/6)', '- - - (0/6)']],
  ['Dungeons', ['- - - (0/8)', '- - - (0/8)', '- - - (0/8)', '- - - (0/8)']],
  ['World', ['- - - (0/8)', '8 1 - (4/8)', '- - - (0/8)', '- - - (0/8)']],
]

const preyPreviewRows = [
  ['Normal', ['-', '-', '-', '-']],
  ['Hard', ['-', '-', '-', '-']],
]

const currencyPreviewRows = [
  ['Hero Dawncrest', 'text-purple-300', ['90', '10', '98', '5']],
  ['Myth Dawncrest', 'text-orange-300', ['92', '58', '47', '33']],
  ['Dawnlight Manaflux', 'text-orange-300', ['8', '6', '4', '5']],
  ['Coffer Key Shards', 'text-sky-300', ['188', '714', '16', '530']],
]

export default function LandingPage() {
  const authRef = useRef<HTMLDivElement | null>(null)
  const [authAnchor, setAuthAnchor] = useState<'login' | 'register' | null>(null)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')

  function openAuth(mode: 'login' | 'register') {
    setAuthMode(mode)
    setAuthAnchor(current => current === mode ? null : mode)
  }

  useEffect(() => {
    if (!authAnchor) return

    function handleClickOutside(event: MouseEvent) {
      if (!authRef.current || authRef.current.contains(event.target as Node)) return
      setAuthAnchor(null)
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [authAnchor])

  const authPanel = authAnchor ? (
    <div className="absolute right-0 top-12 z-[100] w-[min(92vw,430px)] overflow-hidden rounded-2xl border border-yellow-400/25 bg-[#0b121b]/98 p-5 shadow-2xl shadow-black/70 backdrop-blur-xl">
      <div className="mb-4">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-yellow-400">
          {authMode === 'login' ? 'Acceso' : 'Registro'}
        </p>
        <h2 className="mt-1 text-xl font-black text-white">
          {authMode === 'login' ? 'Entra a tu cuenta' : 'Crea tu cuenta'}
        </h2>
        <p className="mt-1 text-xs leading-5 text-gray-400">
          {authMode === 'login'
            ? 'Accede a tu dashboard de personajes y equipos.'
            : 'Crea una cuenta para empezar a sincronizar tus personajes.'}
        </p>
      </div>

      <AuthForm mode={authMode} showLabels />
    </div>
  ) : null

  return (
    <main className="min-h-screen overflow-hidden bg-[#070d14] text-gray-100">
      <section className="relative min-h-screen">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-35"
          style={{ backgroundImage: "url('/client-bg.jpg')" }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(245,158,11,0.24),transparent_34%),linear-gradient(180deg,rgba(7,13,20,0.76),#070d14_88%)]" />
        <div className="absolute left-1/2 top-24 h-64 w-64 -translate-x-1/2 rounded-full bg-yellow-500/10 blur-3xl" />

        <header className="relative z-[80] border-b border-white/10 bg-[#0f1923]/80 px-5 py-4 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-5">
            <Link href="/" className="flex items-center gap-2 text-xl font-black tracking-tight text-yellow-400">
              <img src="/app-icon.png" alt="" className="h-8 w-8 rounded-full object-contain" />
              <span>KeystoneSync</span>
            </Link>
            <nav className="hidden items-center gap-7 text-sm text-gray-300 md:flex">
              <a href="#features" className="transition hover:text-white">Caracteristicas</a>
              <a href="#how" className="transition hover:text-white">Como funciona</a>
              <a href="#download" className="transition hover:text-white">Descargar</a>
              <Link href="/teams" className="transition hover:text-white">Equipos</Link>
            </nav>
            <div ref={authRef} className="flex items-center gap-3">
              <a
                href={CLIENT_DOWNLOAD_URL}
                className="hidden rounded-lg border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-sm font-bold text-yellow-300 transition hover:border-yellow-400/60 hover:bg-yellow-400/15 hover:text-yellow-200 sm:inline-flex"
              >
                Descargar
              </a>

              <div className="relative">
                <button
                  onClick={() => openAuth('login')}
                  className={`rounded-lg border px-4 py-2 text-sm transition ${authAnchor === 'login' ? 'border-yellow-400/70 bg-yellow-400/15 text-yellow-200 shadow-lg shadow-yellow-500/10' : 'border-white/10 text-gray-200 hover:border-yellow-400/50 hover:text-white'}`}
                >
                  Iniciar sesion
                </button>
                {authAnchor === 'login' && authPanel}
              </div>

              <div className="relative">
                <button
                  onClick={() => openAuth('register')}
                  className={`rounded-lg px-4 py-2 text-sm font-bold shadow-lg transition ${authAnchor === 'register' ? 'bg-yellow-300 text-gray-950 shadow-yellow-500/30' : 'bg-yellow-500 text-gray-950 shadow-yellow-500/20 hover:bg-yellow-400'}`}
                >
                  Registrarse
                </button>
                {authAnchor === 'register' && authPanel}
              </div>
            </div>
          </div>
        </header>

        <div className="relative z-10 mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl items-center gap-12 px-5 py-16 lg:grid-cols-[0.92fr_1.08fr]">
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
                href={CLIENT_DOWNLOAD_URL}
                className="rounded-xl bg-yellow-500 px-6 py-3 text-sm font-black text-gray-950 shadow-2xl shadow-yellow-500/20 transition hover:-translate-y-0.5 hover:bg-yellow-400"
              >
                Descargar para Windows
              </a>
              <button onClick={() => openAuth('login')} className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-bold text-white backdrop-blur transition hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/10">
                Ir al dashboard
              </button>
            </div>
            <p className="mt-4 text-xs text-gray-500">Requiere World of Warcraft Retail. El instalador incluira KeystoneClient y el addon KeystoneSync.</p>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 rounded-[2rem] bg-yellow-500/10 blur-3xl" />
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#050a12]/95 shadow-2xl shadow-black/60 backdrop-blur-xl">
              <WeeklyPreviewTable />
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="border-y border-white/10 bg-[#0b121b] px-5 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-yellow-400">Como funciona</p>
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
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-yellow-400">Caracteristicas</p>
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
                El cliente instala o actualiza el addon, detecta tu carpeta de WoW, sincroniza automaticamente y te avisa cuando haya nuevas versiones.
              </p>
            </div>
            <a
              href={CLIENT_DOWNLOAD_URL}
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

function WeeklyPreviewTable() {
  return (
    <div className="relative w-full overflow-hidden">
      <div className="absolute inset-x-0 top-0 z-20 h-16 bg-gradient-to-b from-[#050a12]/30 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 z-20 h-28 bg-gradient-to-t from-[#050a12] to-transparent pointer-events-none" />
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_72%_18%,rgba(245,158,11,0.12),transparent_34%)]" />

      <div className="min-w-[610px] scale-[0.92] origin-top-left opacity-90 sm:scale-100">
        <div className="grid grid-cols-[150px_repeat(4,1fr)] border-b border-white/5 text-[9px] font-black">
          <SummaryLabel>Character</SummaryLabel>
          {previewCharacters.map(character => (
            <SummaryCell key={character.name} className={character.className}>{character.name}</SummaryCell>
          ))}
          <SummaryLabel>Realm</SummaryLabel>
          {previewCharacters.map(character => <SummaryCell key={`${character.name}-realm`}>{character.realm}</SummaryCell>)}
          <SummaryLabel>Item Level</SummaryLabel>
          {previewCharacters.map(character => <SummaryCell key={`${character.name}-ilvl`} className="text-purple-300">{character.ilvl}</SummaryCell>)}
          <SummaryLabel>Rating</SummaryLabel>
          {previewCharacters.map(character => <SummaryCell key={`${character.name}-rating`} className="text-orange-400">{character.rating}</SummaryCell>)}
          <SummaryLabel>Current Keystone</SummaryLabel>
          {previewCharacters.map(character => <SummaryCell key={`${character.name}-key`}>{character.key}</SummaryCell>)}
        </div>

        <SectionRow>Dungeons</SectionRow>
        {dungeonPreviewRows.map(row => (
          <div key={row[0] as string} className="grid grid-cols-[150px_repeat(4,1fr)] border-b border-white/5 text-[9px]">
            <SummaryLabel>{row[0]}</SummaryLabel>
            {(row[1] as string[]).map((level, index) => (
              <SummaryCell key={`${row[0]}-${index}`}>
                <span className="font-black text-white">{level}</span>
                <span className="mx-1.5 inline-block h-1.5 w-1.5 rotate-45 bg-amber-500/80" />
                <span className="font-black text-orange-400">{(row[2] as string[])[index]}</span>
              </SummaryCell>
            ))}
          </div>
        ))}

        <SectionRow>Great Vault</SectionRow>
        {vaultPreviewRows.map(row => (
          <div key={row[0] as string} className="grid grid-cols-[150px_repeat(4,1fr)] border-b border-white/5 text-[9px]">
            <SummaryLabel>{row[0]}</SummaryLabel>
            {(row[1] as string[]).map((value, index) => (
              <SummaryCell key={`${row[0]}-${index}`} className="text-gray-300">{value}</SummaryCell>
            ))}
          </div>
        ))}

        <SectionRow>Prey Hunts</SectionRow>
        {preyPreviewRows.map(row => (
          <div key={row[0] as string} className="grid grid-cols-[150px_repeat(4,1fr)] border-b border-white/5 text-[9px]">
            <SummaryLabel>{row[0]}</SummaryLabel>
            {(row[1] as string[]).map((value, index) => (
              <SummaryCell key={`${row[0]}-${index}`}>{value}</SummaryCell>
            ))}
          </div>
        ))}

        <SectionRow>Currencies</SectionRow>
        {currencyPreviewRows.map(row => (
          <div key={row[0] as string} className="grid grid-cols-[150px_repeat(4,1fr)] border-b border-white/5 text-[9px]">
            <SummaryLabel className={row[1] as string}>{row[0]}</SummaryLabel>
            {(row[2] as string[]).map((value, index) => (
              <SummaryCell key={`${row[0]}-${index}`}>
                <span className="mr-2 inline-block h-3 w-3 rounded-sm border border-white/20 bg-gradient-to-br from-yellow-300/80 to-orange-700/90 align-[-2px]" />
                {value}
              </SummaryCell>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function SectionRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-white/5 bg-[#050912]/95 px-3 py-1.5 text-[9px] font-black text-yellow-400">
      {children}
    </div>
  )
}

function SummaryLabel({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`truncate border-r border-white/5 bg-[#050912] px-3 py-2 text-left font-black text-white/90 ${className}`}>
      {children}
    </div>
  )
}

function SummaryCell({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`border-r border-white/5 bg-[#111827]/70 px-2 py-2 text-center font-black text-white/80 odd:bg-[#0f1623]/80 ${className}`}>
      {children}
    </div>
  )
}
