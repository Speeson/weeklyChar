'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { apiFetch, getToken } from '@/lib/auth'
import { keystoneColor } from '@/lib/colors'
import Navbar from '@/app/components/Navbar'

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
  wowAccount?: string | null
  avatarUrl?: string | null
  wowClass?: string | null
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
  ownerId: number
  currentUserId: number
  members: Member[]
}

const CLASS_COLORS: Record<string, string> = {
  'Death Knight': '#C41E3A',
  'Demon Hunter': '#A330C9',
  Druid: '#FF7C0A',
  Evoker: '#33937F',
  Hunter: '#AAD372',
  Mage: '#3FC7EB',
  Monk: '#00FF98',
  Paladin: '#F48CBA',
  Priest: '#FFFFFF',
  Rogue: '#FFF468',
  Shaman: '#0070DD',
  Warlock: '#8788EE',
  Warrior: '#C69B6D',
}

const CLASS_ICON_NAMES: Record<string, string> = {
  'Death Knight': 'classicon_deathknight',
  'Demon Hunter': 'classicon_demonhunter',
  Druid: 'classicon_druid',
  Evoker: 'classicon_evoker',
  Hunter: 'classicon_hunter',
  Mage: 'classicon_mage',
  Monk: 'classicon_monk',
  Paladin: 'classicon_paladin',
  Priest: 'classicon_priest',
  Rogue: 'classicon_rogue',
  Shaman: 'classicon_shaman',
  Warlock: 'classicon_warlock',
  Warrior: 'classicon_warrior',
}

const DUNGEON_ABBR_BY_ID = new Map<number, string>([
  [557, 'WS'],
  [556, 'PoS'],
  [402, 'AA'],
  [239, 'SEAT'],
  [161, 'SR'],
  [560, 'MS'],
  [559, 'NPX'],
  [558, 'MT'],
])

const DUNGEON_ABBR_BY_NAME = new Map<string, string>([
  ['windrunner spire', 'WS'],
  ['pit of saron', 'PoS'],
  ["algeth'ar academy", 'AA'],
  ['seat of the triumvirate', 'SEAT'],
  ['skyreach', 'SR'],
  ['maisara caverns', 'MS'],
  ['nexus-point xenas', 'NPX'],
  ['nexus point xenas', 'NPX'],
  ["magister's terrace", 'MT'],
  ["magisters' terrace", 'MT'],
])

const TEAM_DUNGEONS = [
  { name: "Algeth'ar Academy", abbr: 'AA' },
  { name: "Magister's Terrace", abbr: 'MT' },
  { name: 'Maisara Caverns', abbr: 'MS' },
  { name: 'Nexus-Point Xenas', abbr: 'NPX' },
  { name: 'Pit of Saron', abbr: 'PoS' },
  { name: 'Seat of the Triumvirate', abbr: 'SEAT' },
  { name: 'Skyreach', abbr: 'SR' },
  { name: 'Windrunner Spire', abbr: 'WS' },
]

function formatDate(unix: number | null): string {
  if (!unix) return '-'
  return new Date(unix * 1000).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function classColor(wowClass: string | null | undefined) {
  return CLASS_COLORS[wowClass ?? ''] ?? '#E5E7EB'
}

function classIconUrl(wowClass: string | null | undefined) {
  const icon = CLASS_ICON_NAMES[wowClass ?? '']
  return icon ? `https://wow.zamimg.com/images/wow/icons/small/${icon}.jpg` : null
}

function dungeonLabel(char: Character) {
  return char.currentKeystone?.dungeon ?? (char.currentKeystone?.challengeMapId ? `ID ${char.currentKeystone.challengeMapId}` : '-')
}

function dungeonLabelWithAbbr(char: Character) {
  const key = char.currentKeystone
  const name = key?.dungeon ?? (key?.challengeMapId ? `ID ${key.challengeMapId}` : '-')
  if (!key || name === '-') return name
  const abbr = key.challengeMapId ? DUNGEON_ABBR_BY_ID.get(key.challengeMapId) : null
  const nameAbbr = key.dungeon ? DUNGEON_ABBR_BY_NAME.get(key.dungeon.toLowerCase()) : null
  const finalAbbr = abbr ?? nameAbbr
  return finalAbbr ? `${name} (${finalAbbr})` : name
}

function dungeonAbbr(char: Character) {
  const key = char.currentKeystone
  if (!key) return null
  const byId = key.challengeMapId ? DUNGEON_ABBR_BY_ID.get(key.challengeMapId) : null
  const byName = key.dungeon ? DUNGEON_ABBR_BY_NAME.get(key.dungeon.toLowerCase()) : null
  return byId ?? byName ?? null
}

function matchesDungeon(char: Character, query: string, selectedDungeons: string[]) {
  const normalized = query.trim().toLowerCase()
  const selectedMatch = selectedDungeons.length === 0 || (dungeonAbbr(char) ? selectedDungeons.includes(dungeonAbbr(char)!) : false)
  if (!selectedMatch) return false
  if (!normalized) return true
  const dungeon = dungeonLabelWithAbbr(char).toLowerCase()
  const level = char.currentKeystone?.level ? `+${char.currentKeystone.level}` : ''
  const character = `${char.name} ${char.realm}`.toLowerCase()
  return dungeon.includes(normalized) || level.includes(normalized) || character.includes(normalized)
}

function CompactCharacterRow({ char }: { char: Character }) {
  const classIcon = classIconUrl(char.wowClass)

  return (
    <tr className="border-t border-gray-900/90 hover:bg-gray-900/70 transition">
      <td className="py-2 pl-4 pr-3">
        <div className="flex items-center gap-2">
          {char.avatarUrl ? (
            <img src={char.avatarUrl} alt="" className="h-7 w-7 rounded-full border border-gray-700 object-cover" />
          ) : (
            <span className="h-7 w-7 rounded-full border border-gray-700 bg-gray-900" />
          )}
          {classIcon && (
            <img src={classIcon} alt={char.wowClass ?? ''} title={char.wowClass ?? ''} className="h-5 w-5 rounded border border-gray-700 object-cover" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold" style={{ color: classColor(char.wowClass) }}>{char.name}</p>
            <p className="truncate text-[11px] text-gray-500">{char.realm}</p>
          </div>
        </div>
      </td>
      <td className="py-2 pr-3 text-xs text-gray-300">{dungeonLabelWithAbbr(char)}</td>
      <td className="py-2 pr-3 text-center">
        {char.currentKeystone?.level ? <span className="font-bold" style={{ color: keystoneColor(char.currentKeystone.level) }}>+{char.currentKeystone.level}</span> : <span className="text-gray-600">-</span>}
      </td>
      <td className="py-2 pr-4 text-right text-[11px] text-gray-500">{formatDate(char.currentKeystone?.updatedAt ?? null)}</td>
    </tr>
  )
}

function CompactCharacterCard({ char }: { char: Character }) {
  const classIcon = classIconUrl(char.wowClass)

  return (
    <div className="grid min-w-0 grid-cols-[minmax(120px,1fr)_minmax(100px,1fr)_44px_70px] items-center gap-2 rounded-lg border border-gray-900/90 bg-gray-950/40 px-3 py-2 transition hover:bg-gray-900/70">
      <div className="flex min-w-0 items-center gap-2">
        {char.avatarUrl ? (
          <img src={char.avatarUrl} alt="" className="h-7 w-7 flex-shrink-0 rounded-full border border-gray-700 object-cover" />
        ) : (
          <span className="h-7 w-7 flex-shrink-0 rounded-full border border-gray-700 bg-gray-900" />
        )}
        {classIcon && (
          <img src={classIcon} alt={char.wowClass ?? ''} title={char.wowClass ?? ''} className="h-5 w-5 flex-shrink-0 rounded border border-gray-700 object-cover" />
        )}
        <p className="min-w-0 truncate text-sm font-semibold" style={{ color: classColor(char.wowClass) }}>{char.name}</p>
      </div>
      <span className="truncate text-xs text-gray-300">{dungeonLabelWithAbbr(char)}</span>
      <span className="text-center text-sm">
        {char.currentKeystone?.level ? <span className="font-bold" style={{ color: keystoneColor(char.currentKeystone.level) }}>+{char.currentKeystone.level}</span> : <span className="text-gray-600">-</span>}
      </span>
      <span className="text-right text-[10px] text-gray-500">{formatDate(char.currentKeystone?.updatedAt ?? null)}</span>
    </div>
  )
}

function MemberCard({
  member,
  query,
  selectedDungeons,
  collapsed,
  onToggle,
  layout,
  canRemove,
  onRemove,
  removing,
}: {
  member: Member
  query: string
  selectedDungeons: string[]
  collapsed: boolean
  onToggle: () => void
  layout: 'grid' | 'list'
  canRemove: boolean
  onRemove: () => void
  removing: boolean
}) {
  const characters = member.characters
    .filter(char => matchesDungeon(char, query, selectedDungeons))
    .sort((a, b) => (b.currentKeystone?.level ?? -1) - (a.currentKeystone?.level ?? -1) || a.name.localeCompare(b.name, 'es'))

  return (
    <section className="mb-5 break-inside-avoid overflow-hidden rounded-xl border border-gray-800 bg-gray-900/45 shadow-xl">
      <div className={`flex w-full items-center gap-2 bg-gray-950/70 px-4 py-3 transition ${collapsed ? '' : 'border-b border-gray-800'}`}>
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center justify-between gap-4 text-left"
          title={collapsed ? 'Expandir cuenta' : 'Contraer cuenta'}
        >
          <span className="truncate font-semibold text-gray-100">{member.username}</span>
          <span className="flex flex-shrink-0 items-center gap-2 text-[11px] text-gray-500">
            <span>{characters.length} / {member.characters.length} personajes</span>
            <svg className={`h-3.5 w-3.5 transition-transform ${collapsed ? '-rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </button>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            disabled={removing}
            className="flex-shrink-0 rounded-lg border border-red-500/30 px-3 py-1.5 text-[11px] font-bold text-red-300 transition hover:border-red-400 hover:bg-red-500/10 disabled:opacity-50"
          >
            {removing ? 'Eliminando...' : 'Eliminar'}
          </button>
        )}
      </div>
      {!collapsed && (
        characters.length === 0 ? (
          <p className="px-4 py-5 text-center text-xs text-gray-600">Sin personajes para este filtro.</p>
        ) : layout === 'list' ? (
          <div className="grid grid-cols-1 gap-2 p-3 md:grid-cols-2">
            {characters.map(char => <CompactCharacterCard key={char.id} char={char} />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-2 font-medium">Personaje</th>
                  <th className="py-2 pr-3 font-medium">Mazmorra</th>
                  <th className="py-2 pr-3 text-center font-medium">Nivel</th>
                  <th className="py-2 pr-4 text-right font-medium">Ultima act.</th>
                </tr>
              </thead>
              <tbody>
                {characters.map(char => <CompactCharacterRow key={char.id} char={char} />)}
              </tbody>
            </table>
          </div>
        )
      )}
    </section>
  )
}

export default function TeamDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [team, setTeam] = useState<TeamDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement | null>(null)
  const [selectedDungeons, setSelectedDungeons] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [copied, setCopied] = useState(false)
  const [collapsedMembers, setCollapsedMembers] = useState<Set<number>>(new Set())
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteUsername, setInviteUsername] = useState('')
  const [inviteMessage, setInviteMessage] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [sendingInvite, setSendingInvite] = useState(false)
  const [teamActionError, setTeamActionError] = useState<string | null>(null)
  const [removingUserId, setRemovingUserId] = useState<number | null>(null)
  const [leavingTeam, setLeavingTeam] = useState(false)

  useEffect(() => {
    if (!getToken()) {
      router.push('/login')
      return
    }
    apiFetch(`/api/teams/${params.id}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setTeam(data); else router.push('/teams') })
      .finally(() => setLoading(false))
  }, [params.id, router])

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!filterRef.current?.contains(event.target as Node)) {
        setFilterOpen(false)
      }
    }

    if (filterOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
    }

    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [filterOpen])

  if (loading) return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Cargando...</p>
      </main>
    </>
  )

  if (!team) return null

  const allCharacters = team.members.flatMap(member => member.characters)
  const visibleCount = team.members.reduce(
    (total, member) => total + member.characters.filter(char => matchesDungeon(char, query, selectedDungeons)).length,
    0,
  )

  async function copyInviteCode() {
    if (!team) return
    await navigator.clipboard.writeText(team.inviteCode)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  function toggleMember(userId: number) {
    setCollapsedMembers(prev => {
      const next = new Set(prev)
      next.has(userId) ? next.delete(userId) : next.add(userId)
      return next
    })
  }

  function toggleDungeon(abbr: string) {
    setSelectedDungeons(prev => (
      prev.includes(abbr) ? prev.filter(value => value !== abbr) : [...prev, abbr]
    ))
  }

  function clearFilters() {
    setQuery('')
    setSelectedDungeons([])
  }

  async function sendUsernameInvite(event: React.FormEvent) {
    event.preventDefault()
    if (!team) return
    setInviteError(null)
    setInviteMessage(null)
    setSendingInvite(true)
    try {
      const res = await apiFetch(`/api/teams/${team.id}/invites`, {
        method: 'POST',
        body: JSON.stringify({ username: inviteUsername }),
      })
      const data = await res.json()
      if (!res.ok) {
        setInviteError(data.detail ?? 'No se pudo enviar la invitacion.')
        return
      }
      setInviteUsername('')
      setInviteMessage(`Invitacion enviada a ${data.invitedUsername ?? 'usuario'}.`)
    } finally {
      setSendingInvite(false)
    }
  }

  async function removeMember(member: Member) {
    if (!team) return
    const confirmed = window.confirm(`Eliminar a ${member.username} del equipo ${team.name}?`)
    if (!confirmed) return
    setTeamActionError(null)
    setRemovingUserId(member.userId)
    try {
      const res = await apiFetch(`/api/teams/${team.id}/members/${member.userId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) {
        setTeamActionError(data.detail ?? 'No se pudo eliminar el miembro.')
        return
      }
      setTeam(prev => prev ? { ...prev, members: prev.members.filter(item => item.userId !== member.userId) } : prev)
    } finally {
      setRemovingUserId(null)
    }
  }

  async function leaveTeam() {
    if (!team) return
    const confirmed = window.confirm(`Salir del equipo ${team.name}?`)
    if (!confirmed) return
    setTeamActionError(null)
    setLeavingTeam(true)
    try {
      const res = await apiFetch(`/api/teams/${team.id}/leave`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        setTeamActionError(data.detail ?? 'No se pudo salir del equipo.')
        return
      }
      router.push('/teams')
    } finally {
      setLeavingTeam(false)
    }
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-950 text-gray-100 px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <section className="rounded-2xl border border-gray-800 bg-gray-900/55 p-3 shadow-2xl">
            <div className="grid gap-3 lg:grid-cols-[260px_minmax(260px,1fr)_260px] lg:items-stretch">
              <div className="flex flex-col justify-between gap-2">
                <Link href="/teams" className="inline-flex w-fit items-center gap-2 rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-sm font-semibold text-gray-300 transition hover:border-yellow-500/60 hover:text-yellow-300">
                  <span className="text-lg leading-none">←</span>
                  Volver a equipos
                </Link>
                <div className="flex w-fit items-center gap-2">
                  <div ref={filterRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setFilterOpen(open => !open)}
                      className="h-9 rounded-xl bg-yellow-500 px-4 text-xs font-black uppercase tracking-wide text-gray-950 shadow-lg shadow-yellow-500/10 transition hover:bg-yellow-400"
                    >
                      Filtrar{selectedDungeons.length > 0 || query ? ` (${visibleCount})` : ''}
                    </button>
                    {filterOpen && (
                      <div className="absolute left-0 top-full z-20 mt-2 w-80 rounded-2xl border border-yellow-500/30 bg-gray-950/95 p-4 shadow-2xl shadow-black/50 backdrop-blur">
                        <input
                          value={query}
                          onChange={event => setQuery(event.target.value)}
                          placeholder="Buscar personaje, dungeon o +nivel..."
                          className="mb-3 w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 outline-none transition focus:border-yellow-500/70"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          {TEAM_DUNGEONS.map(dungeon => (
                            <label key={dungeon.abbr} className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-800 bg-gray-900/70 px-2 py-2 text-xs text-gray-300 transition hover:border-yellow-500/50 hover:text-white">
                              <input
                                type="checkbox"
                                checked={selectedDungeons.includes(dungeon.abbr)}
                                onChange={() => toggleDungeon(dungeon.abbr)}
                                className="accent-yellow-500"
                              />
                              <span className="truncate">{dungeon.name}</span>
                              <span className="ml-auto font-bold text-yellow-400">{dungeon.abbr}</span>
                            </label>
                          ))}
                        </div>
                        <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500">
                          <span>{visibleCount} de {allCharacters.length} visibles</span>
                          <span>{selectedDungeons.length ? `${selectedDungeons.length} dungeons` : 'Todas las dungeons'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  {(query || selectedDungeons.length > 0) && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="h-9 rounded-xl border border-yellow-500/40 bg-gray-950 px-3 text-xs font-bold uppercase tracking-wide text-yellow-400 transition hover:bg-yellow-500 hover:text-gray-950"
                    >
                      Limpiar
                    </button>
                  )}
                  <div className="relative inline-flex h-9 w-20 rounded-xl border border-gray-800 bg-gray-950 p-1">
                    <span className={`absolute top-1 h-7 w-9 rounded-lg bg-yellow-500 transition-transform ${viewMode === 'list' ? 'translate-x-9' : 'translate-x-0'}`} />
                    <button
                      type="button"
                      onClick={() => setViewMode('grid')}
                      className={`relative z-10 flex h-7 w-9 items-center justify-center transition ${viewMode === 'grid' ? 'text-gray-950' : 'text-gray-500 hover:text-white'}`}
                      title="Cuadricula"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M3 3h6v6H3V3Zm8 0h6v6h-6V3ZM3 11h6v6H3v-6Zm8 0h6v6h-6v-6Z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      className={`relative z-10 flex h-7 w-9 items-center justify-center transition ${viewMode === 'list' ? 'text-gray-950' : 'text-gray-500 hover:text-white'}`}
                      title="Lista de cuentas"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M4 5h12v2H4V5Zm0 4h12v2H4V9Zm0 4h12v2H4v-2Z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center rounded-xl border border-gray-800 bg-gray-950/70 px-4 py-3 text-center">
                <h1 className="truncate text-2xl font-black text-yellow-400">{team.name}</h1>
              </div>

              <div className="flex flex-col justify-between gap-2 lg:items-end">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setInviteModalOpen(true)
                      setInviteError(null)
                      setInviteMessage(null)
                    }}
                    className="inline-flex items-center justify-center rounded-xl bg-yellow-500 px-4 py-3 text-sm font-black text-gray-950 shadow-lg shadow-yellow-500/10 transition hover:bg-yellow-400"
                  >
                    Invitar
                  </button>
                </div>

                <button
                  type="button"
                  onClick={leaveTeam}
                  disabled={leavingTeam}
                  className="inline-flex w-fit items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-300 transition hover:border-red-400 hover:bg-red-500/15 disabled:opacity-50"
                >
                  {leavingTeam ? 'Saliendo...' : 'Salir del equipo'}
                </button>
              </div>
            </div>
          </section>

          {teamActionError && (
            <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{teamActionError}</p>
          )}

          {allCharacters.length === 0 ? (
            <p className="mt-8 text-sm text-gray-500">Ningun miembro tiene personajes registrados todavia.</p>
          ) : (
            <div className={viewMode === 'grid' ? 'mt-6 columns-1 gap-5 xl:columns-2' : 'mt-6 space-y-5'}>
              {team.members.map(member => (
                <MemberCard
                  key={member.userId}
                  member={member}
                  query={query}
                  selectedDungeons={selectedDungeons}
                  collapsed={collapsedMembers.has(member.userId)}
                  onToggle={() => toggleMember(member.userId)}
                  layout={viewMode}
                  canRemove={team.isOwner && member.userId !== team.currentUserId}
                  onRemove={() => removeMember(member)}
                  removing={removingUserId === member.userId}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-yellow-500/30 bg-gray-950 p-5 shadow-2xl shadow-black">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-400">Invitar al grupo</p>
                <h2 className="mt-2 text-2xl font-black text-white">{team.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setInviteModalOpen(false)}
                className="rounded-lg border border-gray-800 px-3 py-1.5 text-sm text-gray-400 transition hover:border-gray-600 hover:text-white"
              >
                X
              </button>
            </div>

            <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
              <p className="mb-2 text-sm font-semibold text-gray-200">Invitacion manual</p>
              <div className="flex gap-2">
                <code className="flex-1 rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm font-bold text-yellow-400">{team.inviteCode}</code>
                <button
                  type="button"
                  onClick={copyInviteCode}
                  className="rounded-lg bg-yellow-500 px-3 py-2 text-xs font-black text-gray-950 transition hover:bg-yellow-400"
                >
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            <form onSubmit={sendUsernameInvite} className="mt-4 rounded-xl border border-gray-800 bg-gray-900/60 p-4">
              <label className="mb-2 block text-sm font-semibold text-gray-200">Invitar por username</label>
              <div className="flex gap-2">
                <input
                  value={inviteUsername}
                  onChange={event => setInviteUsername(event.target.value)}
                  placeholder="Username"
                  required
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-yellow-500/70"
                />
                <button
                  type="submit"
                  disabled={sendingInvite}
                  className="rounded-lg bg-yellow-500 px-4 py-2 text-sm font-black text-gray-950 transition hover:bg-yellow-400 disabled:opacity-50"
                >
                  {sendingInvite ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
              {inviteError && <p className="mt-3 text-sm text-red-400">{inviteError}</p>}
              {inviteMessage && <p className="mt-3 text-sm text-green-400">{inviteMessage}</p>}
            </form>
          </div>
        </div>
      )}
    </>
  )
}
