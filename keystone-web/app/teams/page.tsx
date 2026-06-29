'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiFetch, getToken } from '@/lib/auth'
import Navbar from '@/app/components/Navbar'

interface Team {
  id: number
  name: string
  inviteCode: string
  isOwner: boolean
  memberCount: number
}

export default function TeamsPage() {
  const router = useRouter()
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [newTeamName, setNewTeamName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return }
    fetchTeams()
  }, [router])

  async function fetchTeams() {
    const res = await apiFetch('/api/teams')
    if (res.ok) setTeams(await res.json())
    setLoading(false)
  }

  async function createTeam(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setCreating(true)
    try {
      const res = await apiFetch('/api/teams', {
        method: 'POST',
        body: JSON.stringify({ name: newTeamName }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.detail); return }
      setTeams(prev => [...prev, data])
      setNewTeamName('')
    } finally {
      setCreating(false)
    }
  }

  async function joinTeam(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setJoining(true)
    try {
      const res = await apiFetch('/api/teams/join', {
        method: 'POST',
        body: JSON.stringify({ invite_code: inviteCode }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.detail); return }
      setTeams(prev => [...prev, data])
      setInviteCode('')
    } finally {
      setJoining(false)
    }
  }

  if (loading) return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Cargando...</p>
      </main>
    </>
  )

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-950 text-gray-100 px-8 py-10">
        <div className="max-w-5xl mx-auto">

          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="p-4 bg-gray-900/60 border border-gray-800 rounded-2xl shadow-xl">
              <h2 className="font-semibold text-gray-200 mb-3">Crear equipo</h2>
              <form onSubmit={createTeam} className="space-y-3">
                <input
                  type="text"
                  placeholder="Nombre del equipo"
                  value={newTeamName}
                  onChange={e => setNewTeamName(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 text-sm"
                />
                <button
                  type="submit"
                  disabled={creating}
                  className="w-full py-2 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-gray-900 font-semibold rounded-xl transition text-sm"
                >
                  {creating ? 'Creando...' : 'Crear'}
                </button>
              </form>
            </div>

            <div className="p-4 bg-gray-900/60 border border-gray-800 rounded-2xl shadow-xl">
              <h2 className="font-semibold text-gray-200 mb-3">Unirse a un equipo</h2>
              <form onSubmit={joinTeam} className="space-y-3">
                <input
                  type="text"
                  placeholder="Código de invitación"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 text-sm"
                />
                <button
                  type="submit"
                  disabled={joining}
                  className="w-full py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-semibold rounded-xl transition text-sm"
                >
                  {joining ? 'Uniéndose...' : 'Unirse'}
                </button>
              </form>
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between gap-3">
            <h1 className="text-lg font-bold text-gray-100">Tus equipos</h1>
            <div className="inline-flex rounded-xl border border-gray-800 bg-gray-900 p-1">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${viewMode === 'grid' ? 'bg-yellow-500 text-gray-950' : 'text-gray-400 hover:text-white'}`}
              >
                Cuadrícula
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${viewMode === 'list' ? 'bg-yellow-500 text-gray-950' : 'text-gray-400 hover:text-white'}`}
              >
                Lista
              </button>
            </div>
          </div>

          {teams.length === 0 ? (
            <p className="text-gray-500 text-sm">No perteneces a ningún equipo todavía.</p>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 gap-4 md:grid-cols-2' : 'space-y-3'}>
              {teams.map(team => (
                <Link
                  key={team.id}
                  href={`/teams/${team.id}`}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-gray-800 bg-gray-900/60 p-4 shadow-xl transition hover:border-yellow-500/60 hover:bg-gray-900"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{team.name}</p>
                    <p className="text-sm text-gray-500">
                      {team.memberCount} miembro{team.memberCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="mb-1 text-xs text-gray-500">
                      Codigo: <code className="text-yellow-400">{team.inviteCode}</code>
                    </p>
                    <span className="text-xs text-gray-600">Ver →</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
