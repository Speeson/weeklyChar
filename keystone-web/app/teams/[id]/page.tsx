'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { apiFetch, getToken } from '@/lib/auth'
import { CharacterTable } from '@/app/page'

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

interface Member {
  userId: number
  username: string
  characters: Character[]
}

interface TeamDetail {
  id: number
  name: string
  inviteCode: string
  isOwner: boolean
  members: Member[]
}

export default function TeamDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [team, setTeam] = useState<TeamDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return }
    apiFetch(`/api/teams/${params.id}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setTeam(data); else router.push('/teams') })
      .finally(() => setLoading(false))
  }, [params.id, router])

  if (loading) return <main className="min-h-screen bg-gray-950 flex items-center justify-center"><p className="text-gray-400">Cargando...</p></main>
  if (!team) return null

  const allCharacters = team.members.flatMap(m => m.characters)

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-4xl mx-auto">

        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-yellow-400">{team.name}</h1>
          <Link href="/teams" className="text-sm text-gray-400 hover:text-white transition">← Teams</Link>
        </div>

        {team.isOwner && (
          <p className="text-sm text-gray-500 mb-8">
            Código de invitación: <code className="text-yellow-400">{team.inviteCode}</code>
            <button
              onClick={() => navigator.clipboard.writeText(team.inviteCode)}
              className="ml-2 text-xs text-gray-600 hover:text-white transition"
            >
              Copiar
            </button>
          </p>
        )}

        {/* Miembros */}
        <div className="flex flex-wrap gap-2 mb-8">
          {team.members.map(m => (
            <span key={m.userId} className="px-3 py-1 bg-gray-800 rounded-full text-sm text-gray-300">
              {m.username}
              <span className="ml-1 text-gray-500">({m.characters.length})</span>
            </span>
          ))}
        </div>

        {/* Tabla con todos los personajes del team */}
        {allCharacters.length === 0 ? (
          <p className="text-gray-500 text-sm">Ningún miembro tiene personajes registrados todavía.</p>
        ) : (
          <CharacterTable characters={allCharacters} />
        )}
      </div>
    </main>
  )
}
