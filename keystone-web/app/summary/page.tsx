'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/app/components/Navbar'
import { apiFetch, getToken } from '@/lib/auth'

interface Keystone {
  level: number | null
  dungeon: string | null
  challengeMapId: number | null
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

interface PreyBucket {
  count?: number
}

interface CurrencyInfo {
  quantity?: number
  trackedQuantity?: number
  totalEarned?: number
  maxQuantity?: number
  isWeeklyComplete?: boolean
  displayColor?: string | null
}

interface SeasonDungeon {
  challengeMapId: number
  name: string | null
  level: number
  timed?: boolean
  upgradeLevel?: number
  rating?: number
}

interface Character {
  id: number
  name: string
  realm: string
  rioScore: number | null
  wowClass: string | null
  ilvl: number | null
  currentKeystone: Keystone | null
  vault: {
    raid?: VaultBucket
    dungeons?: VaultBucket
    world?: VaultBucket
  } | null
  preyHunts: {
    normal?: PreyBucket
    hard?: PreyBucket
    nightmare?: PreyBucket
  } | null
  currencies: Record<string, CurrencyInfo> | null
  mythicPlusSeason: {
    rating?: number
    dungeons?: SeasonDungeon[]
  } | null
}

const CLASS_COLORS: Record<string, string> = {
  'Death Knight': 'text-red-500',
  'Demon Hunter': 'text-fuchsia-500',
  Druid: 'text-orange-400',
  Evoker: 'text-emerald-400',
  Hunter: 'text-lime-400',
  Mage: 'text-sky-300',
  Monk: 'text-teal-300',
  Paladin: 'text-pink-300',
  Priest: 'text-white',
  Rogue: 'text-yellow-300',
  Shaman: 'text-blue-400',
  Warlock: 'text-purple-400',
  Warrior: 'text-amber-700',
}

const DUNGEONS = [
  { id: 402, name: "Algeth'ar Academy", abbr: 'AA' },
  { id: 558, name: "Magister's Terrace", abbr: 'MT' },
  { id: 560, name: 'Maisara Caverns', abbr: 'MS' },
  { id: 559, name: 'Nexus-Point Xenas', abbr: 'NPX' },
  { id: 556, name: 'Pit of Saron', abbr: 'PoS' },
  { id: 239, name: 'Seat of the Triumvirate', abbr: 'SEAT' },
  { id: 161, name: 'Skyreach', abbr: 'SR' },
  { id: 557, name: 'Windrunner Spire', abbr: 'WS' },
]

const DUNGEON_ABBR = new Map(DUNGEONS.map(d => [d.id, d.abbr]))

const CURRENCIES = [
  { key: 'adventurerDawncrest', label: 'Adventurer Dawncrest', color: 'text-sky-400' },
  { key: 'veteranDawncrest', label: 'Veteran Dawncrest', color: 'text-violet-400' },
  { key: 'championDawncrest', label: 'Champion Dawncrest', color: 'text-purple-400' },
  { key: 'heroDawncrest', label: 'Hero Dawncrest', color: 'text-fuchsia-400' },
  { key: 'mythDawncrest', label: 'Myth Dawncrest', color: 'text-orange-400' },
  { key: 'dawnlightManaflux', label: 'Dawnlight Manaflux', color: 'text-orange-300' },
  { key: 'radiantSparkDust', label: 'Radiant Spark Dust', color: 'text-pink-400' },
  { key: 'sparksOfRadiance', label: 'Sparks of Radiance', color: 'text-amber-300' },
  { key: 'cofferKeyShards', label: 'Coffer Key Shards', color: 'text-sky-400' },
  { key: 'restoredCofferKey', label: 'Restored Coffer Key', color: 'text-purple-400' },
  { key: 'nebulousVoidcore', label: 'Nebulous Voidcore', color: 'text-violet-300' },
]

function dash(value: unknown) {
  return value === null || value === undefined || value === '' ? '—' : String(value)
}

function keystoneLabel(char: Character) {
  const key = char.currentKeystone
  if (!key?.level) return '—'
  const abbr = key.challengeMapId ? DUNGEON_ABBR.get(key.challengeMapId) : null
  return `${abbr ?? key.dungeon ?? `ID ${key.challengeMapId}`} +${key.level}`
}

function vaultSlots(bucket?: VaultBucket) {
  const slots = [...(bucket?.slots ?? [])].sort((a, b) => (a.threshold ?? 0) - (b.threshold ?? 0))
  if (!slots.length) return '— — —'
  return slots.slice(0, 3).map(slot => {
    if (slot.unlocked) return slot.level ? String(slot.level) : '✓'
    return '—'
  }).join('  ')
}

function preyCount(bucket?: PreyBucket) {
  return bucket?.count ? String(bucket.count) : '—'
}

function dungeonFor(char: Character, mapId: number) {
  return (char.mythicPlusSeason?.dungeons ?? []).find(d => d.challengeMapId === mapId)
}

function dungeonCell(char: Character, mapId: number) {
  const run = dungeonFor(char, mapId)
  if (!run || !run.level) return <span className="text-gray-600">—</span>
  return (
    <span className="inline-flex items-baseline justify-center gap-2">
      <span className="font-bold text-yellow-300">{run.level}</span>
      {run.timed && (run.upgradeLevel ?? 0) > 0 && (
        <span className="text-[10px] font-bold text-green-400">+{run.upgradeLevel}</span>
      )}
      <span className="text-xs font-semibold text-orange-400">{Math.round(run.rating ?? 0)}</span>
    </span>
  )
}

function currencyValue(char: Character, key: string) {
  const info = char.currencies?.[key]
  if (!info) return <span className="text-gray-600">—</span>
  const value = info.quantity ?? info.trackedQuantity ?? info.totalEarned ?? 0
  const red = key === 'nebulousVoidcore' && (info.isWeeklyComplete || info.displayColor === 'red')
  return <span className={red ? 'font-bold text-red-400' : 'font-semibold text-gray-100'}>{value}</span>
}

function InfoRow({ label, children, section }: { label: string; children?: React.ReactNode; section?: boolean }) {
  return (
    <tr className={section ? 'bg-gray-950/80' : 'odd:bg-gray-900/70 even:bg-gray-900/45'}>
      <th className={`sticky left-0 z-[1] min-w-44 max-w-44 px-3 py-2 text-left text-xs font-bold ${section ? 'bg-gray-950/95 text-yellow-400' : 'bg-gray-950 text-gray-100'}`}>
        {label}
      </th>
      {children}
    </tr>
  )
}

function Cell({ children = null, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <td className={`min-w-36 px-3 py-2 text-center text-sm border-l border-gray-950/60 ${className}`}>
      {children}
    </td>
  )
}

export default function SummaryPage() {
  const router = useRouter()
  const [characters, setCharacters] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) {
      router.push('/login')
      return
    }
    apiFetch('/api/me/characters')
      .then(r => {
        if (r.status === 401) {
          router.push('/login')
          return []
        }
        return r.ok ? r.json() : []
      })
      .then((chars: Character[]) => {
        chars.sort((a, b) => (b.rioScore ?? 0) - (a.rioScore ?? 0))
        setCharacters(chars)
      })
      .finally(() => setLoading(false))
  }, [router])

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-950 text-gray-100 px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-5">
            <h1 className="text-xl font-semibold text-gray-100">Resumen</h1>
            <p className="mt-1 text-sm text-gray-500">Vista semanal de personajes, vault, preys, mazmorras y currencies.</p>
          </div>

          {loading ? (
            <p className="text-gray-500">Cargando...</p>
          ) : characters.length === 0 ? (
            <p className="text-sm text-gray-500">Sin personajes todavía. Sincroniza desde KeystoneClient para generar el resumen.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-900/40 shadow-2xl">
              <table className="w-full border-collapse text-sm">
                <tbody>
                  <InfoRow label="Character">
                    {characters.map(c => (
                      <Cell key={c.id} className={`font-bold ${CLASS_COLORS[c.wowClass ?? ''] ?? 'text-cyan-300'}`}>
                        {c.name}
                      </Cell>
                    ))}
                  </InfoRow>
                  <InfoRow label="Realm">{characters.map(c => <Cell key={c.id}>{c.realm}</Cell>)}</InfoRow>
                  <InfoRow label="Item Level">{characters.map(c => <Cell key={c.id} className="font-bold text-purple-400">{dash(c.ilvl)}</Cell>)}</InfoRow>
                  <InfoRow label="Rating">{characters.map(c => <Cell key={c.id} className="font-bold text-orange-400">{c.rioScore ? Math.round(c.rioScore) : '—'}</Cell>)}</InfoRow>
                  <InfoRow label="Current Keystone">{characters.map(c => <Cell key={c.id} className="font-bold text-gray-100">{keystoneLabel(c)}</Cell>)}</InfoRow>

                  <InfoRow label="Great Vault" section>{characters.map(c => <Cell key={c.id} />)}</InfoRow>
                  <InfoRow label="Raids">{characters.map(c => <Cell key={c.id}>{vaultSlots(c.vault?.raid)}</Cell>)}</InfoRow>
                  <InfoRow label="Dungeons">{characters.map(c => <Cell key={c.id} className="text-green-400">{vaultSlots(c.vault?.dungeons)}</Cell>)}</InfoRow>
                  <InfoRow label="World">{characters.map(c => <Cell key={c.id}>{vaultSlots(c.vault?.world)}</Cell>)}</InfoRow>

                  <InfoRow label="Prey Hunts" section>{characters.map(c => <Cell key={c.id} />)}</InfoRow>
                  <InfoRow label="Normal">{characters.map(c => <Cell key={c.id}>{preyCount(c.preyHunts?.normal)}</Cell>)}</InfoRow>
                  <InfoRow label="Hard">{characters.map(c => <Cell key={c.id}>{preyCount(c.preyHunts?.hard)}</Cell>)}</InfoRow>
                  <InfoRow label="Nightmare">{characters.map(c => <Cell key={c.id}>{preyCount(c.preyHunts?.nightmare)}</Cell>)}</InfoRow>

                  <InfoRow label="Dungeons" section>{characters.map(c => <Cell key={c.id} />)}</InfoRow>
                  {DUNGEONS.map(dungeon => (
                    <InfoRow key={dungeon.id} label={dungeon.name}>
                      {characters.map(c => <Cell key={c.id}>{dungeonCell(c, dungeon.id)}</Cell>)}
                    </InfoRow>
                  ))}

                  <InfoRow label="Currencies" section>{characters.map(c => <Cell key={c.id} />)}</InfoRow>
                  {CURRENCIES.map(currency => (
                    <InfoRow key={currency.key} label={currency.label}>
                      {characters.map(c => <Cell key={c.id} className={currency.color}>{currencyValue(c, currency.key)}</Cell>)}
                    </InfoRow>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
