'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { apiFetch, getToken } from '@/lib/auth'
import Navbar from '@/app/components/Navbar'
import AccountSelect, { ALL_ACCOUNTS, accountOptions, filterByAccount } from '@/app/components/AccountSelect'

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

function matchesDungeon(char: Character, query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true
  const dungeon = dungeonLabel(char).toLowerCase()
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
      <td className="py-2 pr-3 text-xs text-gray-300">{dungeonLabel(char)}</td>
      <td className="py-2 pr-3 text-center">
        {char.currentKeystone?.level ? <span className="font-bold text-white">+{char.currentKeystone.level}</span> : <span className="text-gray-600">-</span>}
      </td>
      <td className="py-2 pr-4 text-right text-[11px] text-gray-500">{formatDate(char.currentKeystone?.updatedAt ?? null)}</td>
    </tr>
  )
}

function MemberCard({
  member,
  query,
  selectedAccount,
  collapsed,
  onToggle,
}: {
  member: Member
  query: string
  selectedAccount: string
  collapsed: boolean
  onToggle: () => void
}) {
  const accountCharacters = filterByAccount(member.characters, selectedAccount)
  const characters = accountCharacters
    .filter(char => matchesDungeon(char, query))
    .sort((a, b) => (b.currentKeystone?.level ?? -1) - (a.currentKeystone?.level ?? -1) || a.name.localeCompare(b.name, 'es'))

  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900/45 shadow-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center justify-between gap-4 bg-gray-950/70 px-4 py-3 text-left transition hover:bg-gray-900 ${collapsed ? '' : 'border-b border-gray-800'}`}
        title={collapsed ? 'Expandir cuenta' : 'Contraer cuenta'}
      >
        <span className="truncate font-semibold text-gray-100">{member.username}</span>
        <span className="flex flex-shrink-0 items-center gap-2 text-[11px] text-gray-500">
          <span>{characters.length} / {accountCharacters.length} personajes</span>
          <svg className={`h-3.5 w-3.5 transition-transform ${collapsed ? '-rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>
      {!collapsed && (
        characters.length === 0 ? (
          <p className="px-4 py-5 text-center text-xs text-gray-600">Sin personajes para este filtro.</p>
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
  const [selectedAccount, setSelectedAccount] = useState(ALL_ACCOUNTS)
  const [copied, setCopied] = useState(false)
  const [collapsedMembers, setCollapsedMembers] = useState<Set<number>>(new Set())

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
  const accounts = accountOptions(allCharacters)
  const accountCharacters = filterByAccount(allCharacters, selectedAccount)
  const visibleCount = team.members.reduce(
    (total, member) => total + filterByAccount(member.characters, selectedAccount).filter(char => matchesDungeon(char, query)).length,
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

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-950 text-gray-100 px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <section className="rounded-2xl border border-gray-800 bg-gray-900/55 p-5 shadow-2xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500">Equipo</p>
                <h1 className="mt-1 text-2xl font-bold text-gray-100">{team.name}</h1>
              </div>

              <div className="flex flex-col items-start gap-3 sm:items-end">
              <AccountSelect accounts={accounts} value={selectedAccount} onChange={setSelectedAccount} />
              {team.isOwner && (
                <button
                  onClick={copyInviteCode}
                  className="inline-flex items-center justify-between gap-3 rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-left transition hover:border-yellow-500/60 hover:bg-gray-900"
                  title="Copiar codigo de invitacion"
                >
                  <span>
                    <span className="block text-[11px] uppercase tracking-wide text-gray-500">Codigo</span>
                    <code className="text-sm font-bold text-yellow-400">{team.inviteCode}</code>
                  </span>
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 8h10v12H8z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  {copied && <span className="text-xs text-green-400">Copiado</span>}
                </button>
              )}
              </div>
            </div>

            <div className="mt-5">
              <label className="mb-2 block text-xs font-medium text-gray-500">Buscar por mazmorra o nivel</label>
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Ej: Magister, Academy, +12..."
                className="w-full rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-gray-100 placeholder-gray-600 outline-none transition focus:border-yellow-500/70"
              />
              <p className="mt-2 text-xs text-gray-600">{visibleCount} de {accountCharacters.length} personajes visibles</p>
            </div>
          </section>

          {allCharacters.length === 0 ? (
            <p className="mt-8 text-sm text-gray-500">Ningun miembro tiene personajes registrados todavia.</p>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
              {team.members.map(member => (
                <MemberCard
                  key={member.userId}
                  member={member}
                  query={query}
                  selectedAccount={selectedAccount}
                  collapsed={collapsedMembers.has(member.userId)}
                  onToggle={() => toggleMember(member.userId)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
