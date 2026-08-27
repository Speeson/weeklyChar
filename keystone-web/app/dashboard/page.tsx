'use client'

import { type CSSProperties, type DragEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiFetch, getToken, getUsername, hydrateProfile } from '@/lib/auth'
import Navbar from '@/app/components/Navbar'
import WeeklyAffixes from '@/app/components/WeeklyAffixes'
import WeeklyReset from '@/app/components/WeeklyReset'
import {
  compactKeystoneLabel,
  DUNGEON_ABBR_BY_ID,
  DUNGEON_ABBR_BY_NAME,
  DUNGEON_FULL_NAME_BY_ABBR,
  fullKeystoneLabel,
} from '@/lib/season2'

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
  vault?: {
    dungeons?: VaultBucket
  } | null
  currencies?: Record<string, CurrencyInfo> | null
}

interface VaultSlot {
  level?: number | null
  progress?: number | null
  threshold?: number | null
  unlocked?: boolean
}

interface VaultBucket {
  unlocked?: number
  slots?: VaultSlot[]
}

interface CurrencyInfo {
  quantity?: number
  trackedQuantity?: number
  totalEarned?: number
  maxQuantity?: number
  isWeeklyComplete?: boolean
  displayColor?: string | null
}

interface Team {
  id: number
  name: string
  inviteCode: string
  isOwner: boolean
  memberCount: number
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

const COLLAPSED_TEAMS_KEY = 'ks_dashboard_collapsed_teams'
const COLLAPSED_MEMBERS_KEY = 'ks_dashboard_collapsed_members'
const TEAM_ORDER_KEY = 'ks_dashboard_team_order'

function classColor(wowClass: string | null | undefined) {
  return CLASS_COLORS[wowClass ?? ''] ?? '#E5E7EB'
}

function classCardStyle(wowClass: string | null | undefined) {
  const color = classColor(wowClass)
  return {
    '--class-glow': `${color}88`,
    '--class-soft': `${color}24`,
    borderColor: `${color}55`,
    background: `linear-gradient(135deg, ${color}24, rgba(17, 24, 39, 0.76) 42%, rgba(3, 7, 18, 0.72))`,
  } as CSSProperties
}

function keystoneLabel(char: Character) {
  return compactKeystoneLabel(char.currentKeystone)
}

function keystoneSearchText(char: Character) {
  const key = char.currentKeystone
  const abbr = key?.challengeMapId ? DUNGEON_ABBR_BY_ID.get(key.challengeMapId) : null
  const nameAbbr = key?.dungeon ? DUNGEON_ABBR_BY_NAME.get(key.dungeon.toLowerCase()) : null
  return [
    char.name,
    char.wowClass,
    key?.dungeon,
    abbr,
    nameAbbr,
    key?.level ? `+${key.level}` : '',
  ].filter(Boolean).join(' ').toLowerCase()
}

function matchesFilter(char: Character, filter: string) {
  const query = filter.trim().toLowerCase()
  if (!query) return true
  return keystoneSearchText(char).includes(query)
}

function isStale(char: Character) {
  const updatedAt = char.currentKeystone?.updatedAt
  if (!updatedAt) return true
  return Date.now() - updatedAt * 1000 > 1000 * 60 * 60 * 24
}

function relativeTime(unix: number | null | undefined) {
  if (!unix) return 'Sin fecha'
  const seconds = Math.max(0, Math.floor((Date.now() - unix * 1000) / 1000))
  if (seconds < 60) return 'Ahora'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `Hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `Hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `Hace ${days} d`
}

function vaultSlots(bucket?: VaultBucket) {
  const slots = [...(bucket?.slots ?? [])].sort((a, b) => (a.threshold ?? 0) - (b.threshold ?? 0))
  if (!slots.length) return '— — —'
  return slots.slice(0, 3).map(slot => {
    if (slot.unlocked) return slot.level ? String(slot.level) : '✓'
    return '—'
  }).join('  ')
}

function vaultProgress(bucket?: VaultBucket) {
  const slots = bucket?.slots ?? []
  if (!slots.length) return '(0/8)'
  const current = Math.min(8, Math.max(...slots.map(slot => slot.progress ?? 0)))
  return `(${current}/8)`
}

function nebulousVoidcore(char: Character) {
  const info = char.currencies?.nebulousVoidcore
  if (!info) return '—'
  return info.quantity ?? info.trackedQuantity ?? info.totalEarned ?? 0
}

function CharacterInfoTooltip({ char }: { char: Character }) {
  const dungeons = char.vault?.dungeons
  const voidcore = nebulousVoidcore(char)

  return (
    <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-3 w-max -translate-x-1/2 rounded-xl border border-gray-700 bg-gray-950/95 p-3 text-left opacity-0 shadow-2xl shadow-black/60 backdrop-blur transition group-hover:opacity-100">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500">Great Vault - Dungeons</p>
          <div className="mt-1 flex min-w-full items-center justify-between gap-3 rounded-lg bg-gray-900/80 px-3 py-2">
          <span className="whitespace-pre text-sm font-semibold text-green-400">{vaultSlots(dungeons)}</span>
          <span className="text-xs font-bold text-gray-400">{vaultProgress(dungeons)}</span>
          </div>
        </div>
        <div className="mt-4 flex flex-shrink-0 items-center gap-2 rounded-lg bg-gray-900/80 px-3 py-2">
          <img
            src="https://wow.zamimg.com/images/wow/icons/small/inv_1205_voidforge_fluctuatingvoidcores_green.jpg"
            alt=""
            aria-hidden="true"
            width={20}
            height={20}
            className="h-5 w-5 rounded border border-gray-700 bg-gray-950 object-cover"
          />
          <span className="text-sm font-black text-violet-200">{voidcore}</span>
        </div>
      </div>
    </div>
  )
}

function loadCollapsedTeams() {
  try {
    const raw = localStorage.getItem(COLLAPSED_TEAMS_KEY)
    return raw ? new Set(JSON.parse(raw) as number[]) : new Set<number>()
  } catch {
    return new Set<number>()
  }
}

function saveCollapsedTeams(value: Set<number>) {
  localStorage.setItem(COLLAPSED_TEAMS_KEY, JSON.stringify([...value]))
}

function loadCollapsedMembers() {
  try {
    const raw = localStorage.getItem(COLLAPSED_MEMBERS_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set<string>()
  } catch {
    return new Set<string>()
  }
}

function saveCollapsedMembers(value: Set<string>) {
  localStorage.setItem(COLLAPSED_MEMBERS_KEY, JSON.stringify([...value]))
}

function loadTeamOrder() {
  try {
    const raw = localStorage.getItem(TEAM_ORDER_KEY)
    return raw ? JSON.parse(raw) as number[] : []
  } catch {
    return []
  }
}

function saveTeamOrder(value: number[]) {
  localStorage.setItem(TEAM_ORDER_KEY, JSON.stringify(value))
}

function CharacterPill({ char, compact = false, showTooltip = false }: { char: Character; compact?: boolean; showTooltip?: boolean }) {
  const noKey = !char.currentKeystone?.level
  const stale = isStale(char)
  const avatarSize = compact ? 'h-6 w-6' : 'h-9 w-9'
  const stateClass = noKey
    ? 'border-gray-800 bg-gray-950/45 opacity-55'
    : stale
      ? 'border-amber-500/25 bg-amber-500/5'
      : 'border-gray-800 bg-gray-900/65 hover:border-yellow-500/50 hover:bg-gray-900'

  if (compact) {
    return (
      <div
        className={`group relative min-w-0 rounded-xl border px-2.5 py-1.5 shadow-[inset_0_1px_0_var(--class-soft)] transition-shadow duration-200 hover:shadow-[0_0_24px_var(--class-glow),inset_0_1px_0_var(--class-soft)] ${stateClass}`}
        style={classCardStyle(char.wowClass)}
        title={`${char.name} · ${fullKeystoneLabel(char.currentKeystone)} · ${relativeTime(char.currentKeystone?.updatedAt)}`}
      >
        <div className="flex items-center gap-2">
          {char.avatarUrl ? (
            <img src={char.avatarUrl} alt="" className={`${avatarSize} flex-shrink-0 rounded-full border border-gray-700 object-cover`} />
          ) : (
            <span className={`${avatarSize} flex-shrink-0 rounded-full border border-gray-700 bg-gray-950`} />
          )}
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-xs font-bold" style={{ color: classColor(char.wowClass) }}>
              {char.name}
            </p>
            <p className="truncate text-[10px] text-gray-500">{relativeTime(char.currentKeystone?.updatedAt)}</p>
          </div>
        </div>
        <div className={`mt-1.5 rounded-lg px-2 py-1 text-center text-[11px] font-black ${noKey ? 'bg-gray-900 text-gray-600' : 'bg-gray-950 text-yellow-300'}`}>
          {keystoneLabel(char)}
        </div>
        {showTooltip && <CharacterInfoTooltip char={char} />}
      </div>
    )
  }

  return (
    <div
      className={`group relative flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 shadow-[inset_0_1px_0_var(--class-soft)] transition-shadow duration-200 hover:shadow-[0_0_24px_var(--class-glow),inset_0_1px_0_var(--class-soft)] ${stateClass}`}
      style={classCardStyle(char.wowClass)}
      title={`${char.name} · ${fullKeystoneLabel(char.currentKeystone)} · ${relativeTime(char.currentKeystone?.updatedAt)}`}
    >
      {char.avatarUrl ? (
        <img src={char.avatarUrl} alt="" className={`${avatarSize} flex-shrink-0 rounded-full border border-gray-700 object-cover`} />
      ) : (
        <span className={`${avatarSize} flex-shrink-0 rounded-full border border-gray-700 bg-gray-950`} />
      )}
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-bold" style={{ color: classColor(char.wowClass) }}>
          {char.name}
        </p>
        <p className="truncate text-[10px] text-gray-500">{relativeTime(char.currentKeystone?.updatedAt)}</p>
      </div>
      <span className={`flex-shrink-0 rounded-lg px-2 py-1 text-xs font-black ${noKey ? 'bg-gray-900 text-gray-600' : 'bg-gray-950 text-yellow-300'}`}>
        {keystoneLabel(char)}
      </span>
      {showTooltip && <CharacterInfoTooltip char={char} />}
    </div>
  )
}

function TeamCard({
  team,
  currentUsername,
  filter,
  collapsed,
  collapsedMembers,
  onToggle,
  onToggleMember,
  onFocus,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  team: TeamDetail
  currentUsername: string | null
  filter: string
  collapsed: boolean
  collapsedMembers: Set<string>
  onToggle: () => void
  onToggleMember: (key: string) => void
  onFocus: () => void
  draggable?: boolean
  onDragStart?: () => void
  onDragOver?: (event: DragEvent<HTMLElement>) => void
  onDrop?: () => void
}) {
  const members = team.members
    .filter(member => member.username !== currentUsername)
    .map(member => ({
      ...member,
      characters: member.characters
        .filter(char => matchesFilter(char, filter))
        .sort((a, b) => (b.currentKeystone?.level ?? -1) - (a.currentKeystone?.level ?? -1) || a.name.localeCompare(b.name, 'es')),
    }))
  const visibleCount = members.reduce((sum, member) => sum + member.characters.length, 0)

  return (
    <section
      id={`dashboard-team-${team.id}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/55 shadow-xl transition ${draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${collapsed ? 'max-h-[76px]' : ''}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-gray-800 bg-gray-950/65 px-4 py-3">
        <button type="button" onClick={onFocus} className="min-w-0 flex-1 text-left" title="Centrar este equipo">
          <p className="truncate text-sm font-bold text-gray-100">{team.name}</p>
          <p className="text-[11px] text-gray-500">{visibleCount} personajes visibles</p>
        </button>
        <Link href={`/teams/${team.id}`} className="rounded-lg border border-yellow-500/30 px-2 py-1 text-[11px] font-semibold text-yellow-300 transition hover:bg-yellow-500/10">
          Ver
        </Link>
        <button type="button" onClick={onToggle} className="rounded-lg border border-gray-700 p-1.5 text-gray-400 transition hover:border-gray-500 hover:text-white">
          <svg className={`h-4 w-4 transition-transform ${collapsed ? '-rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      {!collapsed && (
        <div className="p-4">
          {members.length === 0 ? (
            <p className="py-4 text-center text-xs text-gray-600">No hay otros miembros en este equipo.</p>
          ) : visibleCount === 0 ? (
            <p className="py-4 text-center text-xs text-gray-600">Sin personajes para este filtro.</p>
          ) : (
            <div className="space-y-4">
              {members.map(member => member.characters.length > 0 && (
                <div key={member.userId} className="min-w-0 rounded-xl border border-gray-800/80 bg-gray-950/35 p-3">
                  <button
                    type="button"
                    onClick={() => onToggleMember(`${team.id}:${member.userId}`)}
                    className={`mb-2 flex w-full items-center justify-between border-b border-gray-800/80 pb-2 text-left ${collapsedMembers.has(`${team.id}:${member.userId}`) ? 'mb-0 border-b-0 pb-0' : ''}`}
                  >
                    <h3 className="truncate text-xs font-bold uppercase tracking-wide text-gray-400">{member.username}</h3>
                    <span className="flex items-center gap-2">
                      <span className="rounded-full bg-gray-900 px-2 py-0.5 text-[10px] text-gray-500">{member.characters.length}</span>
                      <svg className={`h-3.5 w-3.5 text-gray-500 transition-transform ${collapsedMembers.has(`${team.id}:${member.userId}`) ? '-rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                      </svg>
                    </span>
                  </button>
                  {!collapsedMembers.has(`${team.id}:${member.userId}`) && (
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
                      {member.characters.map(char => <CharacterPill key={char.id} char={char} compact />)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [characters, setCharacters] = useState<Character[]>([])
  const [teams, setTeams] = useState<TeamDetail[]>([])
  const [currentUsername, setCurrentUsername] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [collapsedTeams, setCollapsedTeams] = useState<Set<number>>(new Set())
  const [collapsedMembers, setCollapsedMembers] = useState<Set<string>>(new Set())
  const [teamOrder, setTeamOrder] = useState<number[]>([])
  const [draggedTeamId, setDraggedTeamId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) {
      router.push('/login')
      return
    }

    setCurrentUsername(getUsername())
    setCollapsedTeams(loadCollapsedTeams())
    setCollapsedMembers(loadCollapsedMembers())
    setTeamOrder(loadTeamOrder())
    hydrateProfile().then(profile => {
      if (profile?.username) setCurrentUsername(profile.username)
    }).catch(() => {})

    async function loadDashboard() {
      const [charsRes, teamsRes] = await Promise.all([
        apiFetch('/api/me/characters'),
        apiFetch('/api/teams'),
      ])
      if (charsRes.status === 401 || teamsRes.status === 401) {
        router.push('/login')
        return
      }

      const chars: Character[] = charsRes.ok ? await charsRes.json() : []
      const teamList: Team[] = teamsRes.ok ? await teamsRes.json() : []
      const teamDetails = await Promise.all(
        teamList.map(team => apiFetch(`/api/teams/${team.id}`).then(res => res.ok ? res.json() as Promise<TeamDetail> : null).catch(() => null)),
      )

      setCharacters(chars.sort((a, b) => (b.currentKeystone?.level ?? -1) - (a.currentKeystone?.level ?? -1) || a.name.localeCompare(b.name, 'es')))
      setTeams(teamDetails.filter(Boolean) as TeamDetail[])
      setLoading(false)
    }

    loadDashboard().catch(() => setLoading(false))
  }, [router])

  const visibleOwnCharacters = useMemo(
    () => characters.filter(char => matchesFilter(char, filter)),
    [characters, filter],
  )

  const dungeonStats = useMemo(() => {
    const counts = new Map<string, number>()
    const allChars = [
      ...characters,
      ...teams.flatMap(team => team.members.filter(member => member.username !== currentUsername).flatMap(member => member.characters)),
    ]
    for (const char of allChars) {
      const label = keystoneLabel(char)
      if (label === '—') continue
      const abbr = label.replace(/^\+\d+\s+/, '')
      counts.set(abbr, (counts.get(abbr) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [characters, teams, currentUsername])

  function teamVisibleCount(team: TeamDetail) {
    return team.members
      .filter(member => member.username !== currentUsername)
      .reduce((sum, member) => sum + member.characters.filter(char => matchesFilter(char, filter)).length, 0)
  }

  const orderedTeams = useMemo(() => {
    const manualOrder = teamOrder.filter(id => teams.some(team => team.id === id))
    const ordered = [...teams].sort((a, b) => {
      const ai = manualOrder.indexOf(a.id)
      const bi = manualOrder.indexOf(b.id)
      if (ai !== -1 || bi !== -1) {
        if (ai === -1) return 1
        if (bi === -1) return -1
        return ai - bi
      }
      return teamVisibleCount(b) - teamVisibleCount(a) || a.name.localeCompare(b.name, 'es')
    })
    return ordered
  }, [teams, teamOrder, currentUsername, filter])

  function toggleTeam(id: number) {
    setCollapsedTeams(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      saveCollapsedTeams(next)
      return next
    })
  }

  function toggleMember(key: string) {
    setCollapsedMembers(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      saveCollapsedMembers(next)
      return next
    })
  }

  function focusTeam(id: number) {
    document.getElementById(`dashboard-team-${id}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    })
  }

  function moveDraggedTeam(targetTeamId: number) {
    if (draggedTeamId === null || draggedTeamId === targetTeamId) return
    const ids = orderedTeams.map(team => team.id)
    const from = ids.indexOf(draggedTeamId)
    const to = ids.indexOf(targetTeamId)
    if (from === -1 || to === -1) return
    const next = [...ids]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setTeamOrder(next)
    saveTeamOrder(next)
    setDraggedTeamId(null)
  }

  if (loading) return (
    <>
      <Navbar />
      <main className="flex min-h-screen items-center justify-center bg-gray-950">
        <p className="text-gray-400">Cargando dashboard...</p>
      </main>
    </>
  )

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-950 px-4 py-6 text-gray-100 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[300px_1fr]">
          <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
            <WeeklyAffixes />
            <WeeklyReset />

            <section className="rounded-2xl border border-gray-800 bg-gray-900/55 p-4 shadow-xl">
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">Filtro rápido</h2>
              <input
                value={filter}
                onChange={event => setFilter(event.target.value)}
                placeholder="AOF, MR, KR, +14..."
                className="mt-3 w-full rounded-xl border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 outline-none transition focus:border-yellow-500/70"
              />
              {filter && (
                <button type="button" onClick={() => setFilter('')} className="mt-2 text-xs text-yellow-400 hover:text-yellow-300">
                  Limpiar filtro
                </button>
              )}
            </section>

            <section className="rounded-2xl border border-gray-800 bg-gray-900/55 p-4 shadow-xl">
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">Keys disponibles</h2>
              {dungeonStats.length === 0 ? (
                <p className="mt-3 text-xs text-gray-600">Sin piedras detectadas.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {dungeonStats.map(([abbr, count]) => (
                    <button
                      key={abbr}
                      type="button"
                      onClick={() => setFilter(abbr)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-800 bg-gray-950 px-3 py-2 text-left text-xs transition hover:border-yellow-500/60 hover:bg-gray-900"
                    >
                      <span className="min-w-0 truncate font-semibold text-gray-300">
                        {DUNGEON_FULL_NAME_BY_ABBR.get(abbr) ?? abbr}
                        <span className="ml-1 text-gray-500">({abbr})</span>
                      </span>
                      <span className="flex-shrink-0 font-black text-yellow-300">x{count}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </aside>

          <section className="min-w-0 space-y-6">
            <section className="rounded-2xl border border-gray-800 bg-gray-900/55 p-4 shadow-xl">
              <div className="mb-4 flex items-center justify-between gap-3">
                <Link href="/characters" className="group">
                  <h2 className="text-xl font-black text-gray-100 transition group-hover:text-yellow-300">Mis personajes</h2>
                </Link>
                <span className="rounded-full border border-gray-800 bg-gray-950 px-3 py-1 text-xs text-gray-500">
                  {visibleOwnCharacters.length} / {characters.length}
                </span>
              </div>

              {characters.length === 0 ? (
                <p className="text-sm text-gray-500">Sin personajes todavia. Sincroniza KeystoneClient para importarlos.</p>
              ) : visibleOwnCharacters.length === 0 ? (
                <p className="text-sm text-gray-500">Ningun personaje propio coincide con el filtro.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {visibleOwnCharacters.map(char => <CharacterPill key={char.id} char={char} showTooltip />)}
                </div>
              )}
            </section>

            <section>
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-100">Equipos</h2>
                </div>
                <Link href="/teams" className="rounded-lg border border-yellow-500/30 px-3 py-1.5 text-xs font-semibold text-yellow-300 transition hover:bg-yellow-500/10">
                  Ver equipos
                </Link>
              </div>

              {teams.length === 0 ? (
                <section className="rounded-2xl border border-gray-800 bg-gray-900/55 p-8 text-center text-sm text-gray-500">
                  No perteneces a ningun equipo todavia.
                </section>
              ) : (
                <div className="space-y-5">
                  {orderedTeams.map(team => (
                    <TeamCard
                      key={team.id}
                      team={team}
                      currentUsername={currentUsername}
                      filter={filter}
                      collapsed={collapsedTeams.has(team.id)}
                      collapsedMembers={collapsedMembers}
                      onToggle={() => toggleTeam(team.id)}
                      onToggleMember={toggleMember}
                      onFocus={() => focusTeam(team.id)}
                      draggable
                      onDragStart={() => setDraggedTeamId(team.id)}
                      onDragOver={event => event.preventDefault()}
                      onDrop={() => moveDraggedTeam(team.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          </section>
        </div>
      </main>
    </>
  )
}
