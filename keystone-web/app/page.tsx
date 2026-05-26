'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiFetch, clearToken, getToken } from '@/lib/auth'

interface Keystone {
  level: number | null
  dungeon: string | null
  challengeMapId: number | null
  updatedAt: number | null
}

interface Character {
  id: number
  name: string
  realm: string
  region: string
  currentKeystone: Keystone | null
}

interface Me {
  username: string
  syncToken: string
}

function formatDate(unix: number | null): string {
  if (!unix) return '—'
  return new Date(unix * 1000).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function Dashboard() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [characters, setCharacters] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)
  const [showToken, setShowToken] = useState(false)

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return }
    Promise.all([
      apiFetch('/api/me').then(r => r.ok ? r.json() : null),
      apiFetch('/api/me/characters').then(r => r.ok ? r.json() : []),
    ]).then(([meData, chars]) => {
      if (!meData) { router.push('/login'); return }
      setMe(meData)
      setCharacters(chars)
    }).finally(() => setLoading(false))
  }, [router])

  function logout() {
    clearToken()
    router.push('/login')
  }

  if (loading) return <main className="min-h-screen bg-gray-950 flex items-center justify-center"><p className="text-gray-400">Cargando...</p></main>

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-yellow-400">KeystoneSync</h1>
          <div className="flex items-center gap-4">
            <Link href="/teams" className="text-sm text-gray-400 hover:text-white transition">Teams</Link>
            <span className="text-sm text-gray-500">{me?.username}</span>
            <button onClick={logout} className="text-sm text-gray-500 hover:text-red-400 transition">Salir</button>
          </div>
        </div>

        {/* Sync token */}
        <div className="mb-8 p-4 bg-gray-900 border border-gray-800 rounded">
          <p className="text-sm text-gray-400 mb-2">Tu sync token — ponlo en el <code className="text-yellow-400">.env</code> del sincronizador:</p>
          <div className="flex items-center gap-3">
            <code className="flex-1 text-sm text-green-400 break-all">
              {showToken ? me?.syncToken : '••••••••••••••••••••••••••••••••'}
            </code>
            <button onClick={() => setShowToken(v => !v)} className="text-xs text-gray-500 hover:text-white transition shrink-0">
              {showToken ? 'Ocultar' : 'Mostrar'}
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(me?.syncToken ?? '')}
              className="text-xs text-gray-500 hover:text-white transition shrink-0"
            >
              Copiar
            </button>
          </div>
        </div>

        {/* Characters */}
        <h2 className="text-lg font-semibold text-gray-200 mb-4">Mis personajes</h2>
        {characters.length === 0 ? (
          <p className="text-gray-500 text-sm">Sin personajes todavía. Ejecuta el sincronizador para importarlos.</p>
        ) : (
          <CharacterTable characters={characters} />
        )}
      </div>
    </main>
  )
}

export function CharacterTable({ characters }: { characters: Character[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-gray-400 border-b border-gray-800">
          <th className="pb-3 pr-6">Personaje</th>
          <th className="pb-3 pr-6">Reino</th>
          <th className="pb-3 pr-6">Mazmorra</th>
          <th className="pb-3 pr-6">Nivel</th>
          <th className="pb-3">Última actualización</th>
        </tr>
      </thead>
      <tbody>
        {characters.map(char => (
          <tr key={char.id} className="border-b border-gray-900 hover:bg-gray-900 transition">
            <td className="py-3 pr-6 font-semibold text-white">{char.name}</td>
            <td className="py-3 pr-6 text-gray-300">{char.realm}</td>
            <td className="py-3 pr-6 text-gray-300">
              {char.currentKeystone?.dungeon ?? (char.currentKeystone?.challengeMapId ? `ID ${char.currentKeystone.challengeMapId}` : '—')}
            </td>
            <td className="py-3 pr-6">
              {char.currentKeystone?.level
                ? <span className="font-bold text-yellow-400">+{char.currentKeystone.level}</span>
                : <span className="text-gray-600">—</span>}
            </td>
            <td className="py-3 text-gray-400 text-xs">{formatDate(char.currentKeystone?.updatedAt ?? null)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
