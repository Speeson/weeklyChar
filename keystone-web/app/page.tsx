'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, getToken } from '@/lib/auth'
import Navbar from '@/app/components/Navbar'
import WeeklyReset from '@/app/components/WeeklyReset'
import WeeklyAffixes from '@/app/components/WeeklyAffixes'

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

function formatDate(unix: number | null): string {
  if (!unix) return '—'
  return new Date(unix * 1000).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const HIDDEN_KEY = 'ks_hidden_chars'

function getHidden(): Set<number> {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY)
    return raw ? new Set(JSON.parse(raw) as number[]) : new Set()
  } catch { return new Set() }
}

function saveHidden(h: Set<number>) {
  localStorage.setItem(HIDDEN_KEY, JSON.stringify([...h]))
}

export default function Dashboard() {
  const router = useRouter()
  const [characters, setCharacters] = useState<Character[]>([])
  const [hidden, setHidden] = useState<Set<number>>(new Set())
  const [managing, setManaging] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return }
    setHidden(getHidden())
    apiFetch('/api/me/characters')
      .then(r => {
        if (r.status === 401) { router.push('/login'); return [] }
        return r.ok ? r.json() : []
      })
      .then((chars: Character[]) => {
        chars.sort((a, b) => (b.currentKeystone?.level ?? -1) - (a.currentKeystone?.level ?? -1))
        setCharacters(chars)
      })
      .finally(() => setLoading(false))
  }, [router])

  function toggleHidden(id: number) {
    setHidden(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      saveHidden(next)
      return next
    })
  }

  if (loading) return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Cargando...</p>
      </main>
    </>
  )

  const visible = managing ? characters : characters.filter(c => !hidden.has(c.id))
  const hiddenCount = characters.filter(c => hidden.has(c.id)).length

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-950 text-gray-100 px-8 py-10">
        <div className="max-w-4xl mx-auto">

          <div className="flex justify-center items-stretch gap-4 mb-8 flex-wrap">
            <WeeklyAffixes />
            <WeeklyReset />
          </div>

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-200">
              Mis personajes
              {hiddenCount > 0 && !managing && (
                <span className="ml-2 text-xs text-gray-500">
                  ({hiddenCount} oculto{hiddenCount !== 1 ? 's' : ''})
                </span>
              )}
            </h2>
            {characters.length > 0 && (
              <button
                onClick={() => setManaging(m => !m)}
                className={`text-xs px-3 py-1.5 rounded border transition ${
                  managing
                    ? 'border-yellow-500/50 text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20'
                    : 'border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
                }`}
              >
                {managing ? '✓ Hecho' : '✎ Gestionar'}
              </button>
            )}
          </div>

          {managing && (
            <div className="mb-6 p-4 bg-gray-900 border border-gray-700 rounded-lg">
              <p className="text-xs text-gray-500 mb-3">
                Activa o desactiva los personajes que quieres ver en la tabla.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {characters.map(c => (
                  <label key={c.id} className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!hidden.has(c.id)}
                      onChange={() => toggleHidden(c.id)}
                      className="accent-yellow-400 w-4 h-4 cursor-pointer"
                    />
                    <span className={`text-sm ${hidden.has(c.id) ? 'text-gray-600' : 'text-gray-200'}`}>
                      {c.name}
                    </span>
                    <span className="text-xs text-gray-600 truncate">{c.realm}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {characters.length === 0 ? (
            <p className="text-gray-500 text-sm">
              Sin personajes todavía. Ejecuta KeystoneClient para importarlos.
            </p>
          ) : visible.length === 0 ? (
            <p className="text-gray-500 text-sm">
              Todos los personajes están ocultos.{' '}
              <button onClick={() => setManaging(true)} className="text-yellow-400 underline">
                Gestionar
              </button>
            </p>
          ) : (
            <CharacterTable characters={visible} />
          )}
        </div>
      </main>
    </>
  )
}

type SortKey = 'name' | 'realm' | 'dungeon' | 'level' | 'updatedAt'
type SortDir = 'asc' | 'desc'

export function CharacterTable({ characters }: { characters: Character[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('level')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'level' || key === 'updatedAt' ? 'desc' : 'asc')
    }
  }

  const sorted = [...characters].sort((a, b) => {
    let cmp = 0
    switch (sortKey) {
      case 'name':     cmp = a.name.localeCompare(b.name, 'es'); break
      case 'realm':    cmp = a.realm.localeCompare(b.realm, 'es'); break
      case 'dungeon': {
        const da = a.currentKeystone?.dungeon ?? ''
        const db = b.currentKeystone?.dungeon ?? ''
        cmp = da.localeCompare(db, 'es')
        break
      }
      case 'level':
        cmp = (a.currentKeystone?.level ?? -1) - (b.currentKeystone?.level ?? -1)
        break
      case 'updatedAt':
        cmp = (a.currentKeystone?.updatedAt ?? 0) - (b.currentKeystone?.updatedAt ?? 0)
        break
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  function Th({ col, children, last }: { col: SortKey; children: React.ReactNode; last?: boolean }) {
    const active = col === sortKey
    return (
      <th
        className={`pb-3 ${last ? '' : 'pr-6'} cursor-pointer select-none whitespace-nowrap`}
        onClick={() => handleSort(col)}
      >
        <span className={`inline-flex items-center gap-1 transition hover:text-white ${active ? 'text-yellow-400' : 'text-gray-400'}`}>
          {children}
          <span className="text-xs">{active ? (sortDir === 'asc' ? '↑' : '↓') : <span className="opacity-30">↕</span>}</span>
        </span>
      </th>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b border-gray-800">
            <Th col="name">Personaje</Th>
            <Th col="realm">Reino</Th>
            <Th col="dungeon">Mazmorra</Th>
            <Th col="level">Nivel</Th>
            <Th col="updatedAt" last>Última actualización</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(char => (
            <tr key={char.id} className="border-b border-gray-900 hover:bg-gray-900/50 transition">
              <td className="py-3 pr-6 font-semibold text-white">{char.name}</td>
              <td className="py-3 pr-6 text-gray-300">{char.realm}</td>
              <td className="py-3 pr-6 text-gray-300">
                {char.currentKeystone?.dungeon ?? (char.currentKeystone?.challengeMapId
                  ? `ID ${char.currentKeystone.challengeMapId}`
                  : '—')}
              </td>
              <td className="py-3 pr-6">
                {char.currentKeystone?.level
                  ? <span className="font-bold text-yellow-400">+{char.currentKeystone.level}</span>
                  : <span className="text-gray-600">—</span>}
              </td>
              <td className="py-3 text-gray-400 text-xs">
                {formatDate(char.currentKeystone?.updatedAt ?? null)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
