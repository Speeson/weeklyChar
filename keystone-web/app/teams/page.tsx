'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiFetch, getToken } from '@/lib/auth'

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

  if (loading) return <main className="min-h-screen bg-gray-950 flex items-center justify-center"><p className="text-gray-400">Cargando...</p></main>

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-3xl mx-auto">

        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-yellow-400">Teams</h1>
          <Link href="/" className="text-sm text-gray-400 hover:text-white transition">← Dashboard</Link>
        </div>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        {/* Lista de teams */}
        {teams.length === 0 ? (
          <p className="text-gray-500 text-sm mb-8">No perteneces a ningún team todavía.</p>
        ) : (
          <div className="space-y-3 mb-8">
            {teams.map(team => (
              <Link
                key={team.id}
                href={`/teams/${team.id}`}
                className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded hover:border-yellow-500 transition"
              >
                <div>
                  <p className="font-semibold text-white">{team.name}</p>
                  <p className="text-sm text-gray-500">{team.memberCount} miembro{team.memberCount !== 1 ? 's' : ''}</p>
                </div>
                <div className="text-right">
                  {team.isOwner && (
                    <p className="text-xs text-gray-500 mb-1">
                      Código: <code className="text-yellow-400">{team.inviteCode}</code>
                    </p>
                  )}
                  <span className="text-xs text-gray-600">Ver →</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Crear team */}
          <div className="p-4 bg-gray-900 border border-gray-800 rounded">
            <h2 className="font-semibold text-gray-200 mb-3">Crear team</h2>
            <form onSubmit={createTeam} className="space-y-3">
              <input
                type="text"
                placeholder="Nombre del team"
                value={newTeamName}
                onChange={e => setNewTeamName(e.target.value)}
                required
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 text-sm"
              />
              <button
                type="submit"
                disabled={creating}
                className="w-full py-2 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-gray-900 font-semibold rounded transition text-sm"
              >
                {creating ? 'Creando...' : 'Crear'}
              </button>
            </form>
          </div>

          {/* Unirse a team */}
          <div className="p-4 bg-gray-900 border border-gray-800 rounded">
            <h2 className="font-semibold text-gray-200 mb-3">Unirse a un team</h2>
            <form onSubmit={joinTeam} className="space-y-3">
              <input
                type="text"
                placeholder="Código de invitación"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value)}
                required
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 text-sm"
              />
              <button
                type="submit"
                disabled={joining}
                className="w-full py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-semibold rounded transition text-sm"
              >
                {joining ? 'Uniéndose...' : 'Unirse'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  )
}
