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
  itemQuantity?: number
  dustQuantity?: number
  dustMaxQuantity?: number
  dustTotalEarned?: number
  dustTrackedQuantity?: number
  trackedQuantity?: number
  totalEarned?: number
  maxQuantity?: number
  iconFileID?: number
  iconPath?: string | null
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
  texture?: number
  texturePath?: string | null
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

declare global {
  interface Window {
    $WowheadPower?: {
      refreshLinks?: () => void
    }
  }
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

const DUNGEONS = [
  { id: 402, name: "Algeth'ar Academy", abbr: 'AA', spellId: 393273 },
  { id: 558, name: "Magister's Terrace", abbr: 'MT', spellId: 1254572 },
  { id: 560, name: 'Maisara Caverns', abbr: 'MS', spellId: 1254559 },
  { id: 559, name: 'Nexus-Point Xenas', abbr: 'NPX', spellId: 1254563 },
  { id: 556, name: 'Pit of Saron', abbr: 'PoS', spellId: 1254555 },
  { id: 239, name: 'Seat of the Triumvirate', abbr: 'SEAT', spellId: 1254551 },
  { id: 161, name: 'Skyreach', abbr: 'SR', spellId: 159898 },
  { id: 557, name: 'Windrunner Spire', abbr: 'WS', spellId: 1254400 },
]

const DUNGEON_ABBR = new Map(DUNGEONS.map(d => [d.id, d.abbr]))

const CURRENCIES = [
  { key: 'heroDawncrest', label: 'Hero Dawncrest', color: 'text-purple-400', wowheadType: 'currency', wowheadId: 3345, iconName: 'inv_120_crest_hero' },
  { key: 'mythDawncrest', label: 'Myth Dawncrest', color: 'text-purple-400', wowheadType: 'currency', wowheadId: 3347, iconName: 'inv_120_crest_myth' },
  { key: 'dawnlightManaflux', label: 'Dawnlight Manaflux', color: 'text-orange-300', wowheadType: 'currency', wowheadId: 3378, localIcon: 'dawnlight-manaflux.jpg' },
  { key: 'radiantSparkDust', label: 'Radiant Spark Dust', color: 'text-pink-400', wowheadType: 'currency', wowheadId: 3212, localIcon: 'radiant-spark-dust.jpg' },
  { key: 'cofferKeyShards', label: 'Coffer Key Shards', color: 'text-sky-400', wowheadType: 'currency', wowheadId: 3310, iconName: 'inv_gizmo_hardenedadamantitetube' },
  { key: 'restoredCofferKey', label: 'Restored Coffer Key', color: 'text-purple-400', wowheadType: 'currency', wowheadId: 3028, iconName: 'inv_misc_key_15' },
  { key: 'nebulousVoidcore', label: 'Nebulous Voidcore', color: 'text-violet-300', wowheadType: 'currency', wowheadId: 3418, localIcon: 'nebulous-voidcore.jpg' },
] as const

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

function estimatedDungeonRating(run: SeasonDungeon) {
  if (run.rating && run.rating > 0) return Math.round(run.rating)

  const baseScores: Record<number, number> = {
    2: 155,
    3: 170,
    4: 200,
    5: 215,
    6: 230,
    7: 260,
    8: 275,
    9: 290,
    10: 320,
    11: 335,
    12: 365,
    13: 380,
    14: 395,
    15: 410,
    16: 425,
    17: 440,
    18: 455,
    19: 470,
    20: 485,
  }

  const base = baseScores[run.level] ?? (run.level > 20 ? 485 + ((run.level - 20) * 15) : 0)
  if (!base) return 0
  return base + Math.max(0, Math.min(run.upgradeLevel ?? 0, 3)) * 2
}

function dungeonCell(char: Character, mapId: number) {
  const run = dungeonFor(char, mapId)
  if (!run || !run.level) return <span className="text-gray-600">—</span>
  return (
    <span className="inline-flex items-center justify-center gap-2">
      <span className="min-w-5 font-bold text-white">{run.level}</span>
      <UpgradeMedal upgradeLevel={run.timed ? run.upgradeLevel ?? 0 : 0} />
      <span className="min-w-9 text-right text-xs font-semibold text-orange-400">{Math.round(run.rating ?? 0)}</span>
    </span>
  )
}

function dungeonCellWithRating(char: Character, mapId: number) {
  const run = dungeonFor(char, mapId)
  if (!run || !run.level) return <span className="text-gray-600">-</span>
  const rating = estimatedDungeonRating(run)

  return (
    <span className="inline-flex items-center justify-center gap-2">
      <span className="min-w-5 font-bold text-white">{run.level}</span>
      <UpgradeMedal upgradeLevel={run.timed ? run.upgradeLevel ?? 0 : 0} />
      <span className="min-w-9 text-right text-xs font-semibold text-orange-400">{rating || '-'}</span>
    </span>
  )
}

function UpgradeMedal({ upgradeLevel }: { upgradeLevel: number }) {
  if (upgradeLevel <= 0) return <span className="h-3 w-3 rounded-full border border-gray-700 bg-gray-800" title="Sin tiempo" />

  return (
    <img
      src={`/icons/medals/tier${Math.min(upgradeLevel, 3)}.avif`}
      alt={`+${upgradeLevel}`}
      title={`+${upgradeLevel}`}
      className="inline-block h-4 w-4 object-contain mix-blend-screen"
    />
  )
}

function wowheadHref(type: string, id: number) {
  return `https://www.wowhead.com/${type}=${id}`
}

function wowheadSearchHref(type: string, id: number) {
  return `https://www.wowhead.com/search?q=${encodeURIComponent(`${type}:${id}`)}`
}

function WowheadLink({
  children,
  type,
  id,
  className = '',
  noIcon = true,
}: {
  children: React.ReactNode
  type: string
  id: number
  className?: string
  noIcon?: boolean
}) {
  return (
    <a
      href={noIcon ? wowheadSearchHref(type, id) : wowheadHref(type, id)}
      data-wowhead={noIcon ? `${type}=${id}&domain=www&icon=false` : 'domain=www'}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center justify-center gap-2 no-underline ${className}`}
    >
      {children}
    </a>
  )
}

function WowheadIcon({
  iconName,
  localIcon,
}: {
  iconName?: string
  localIcon?: string
}) {
  const [failed, setFailed] = useState(false)
  if (failed || (!iconName && !localIcon)) return null

  const src = iconName
    ? `https://wow.zamimg.com/images/wow/icons/small/${iconName}.jpg`
    : `/icons/currencies/${localIcon}`

  return (
    <img
      src={src}
      alt=""
      onError={() => setFailed(true)}
      className="inline-block h-5 w-5 flex-shrink-0 rounded border border-gray-700 bg-gray-950 object-cover shadow-sm"
    />
  )
}

function currencyValue(char: Character, currency: typeof CURRENCIES[number]) {
  const key = currency.key
  const info = char.currencies?.[key]
  if (!info) return <span className="text-gray-600">—</span>
  const value = info.quantity ?? info.trackedQuantity ?? info.totalEarned ?? 0
  const red = key === 'nebulousVoidcore' && (info.isWeeklyComplete || info.displayColor === 'red')
  return (
    <WowheadLink
      type={currency.wowheadType}
      id={currency.wowheadId}
      className={red ? 'font-bold text-red-400' : 'font-semibold text-gray-100'}
    >
      <WowheadIcon iconName={'iconName' in currency ? currency.iconName : undefined} localIcon={'localIcon' in currency ? currency.localIcon : undefined} />
      {value}
    </WowheadLink>
  )
}

function InfoRow({
  label,
  children,
  section,
  icon,
  labelClassName = '',
}: {
  label: React.ReactNode
  children?: React.ReactNode
  section?: boolean
  icon?: React.ReactNode
  labelClassName?: string
}) {
  return (
    <tr className={section ? 'bg-gray-950/80' : 'odd:bg-gray-900/70 even:bg-gray-900/45'}>
      <th className={`sticky left-0 z-[1] min-w-56 max-w-56 px-3 py-2 text-left text-xs font-bold ${section ? 'bg-gray-950/95 text-yellow-400' : 'bg-gray-950 text-gray-100'} ${labelClassName}`}>
        <span className="flex min-w-0 items-center gap-2">
          {icon}
          <span className="truncate">{label}</span>
        </span>
      </th>
      {children}
    </tr>
  )
}

function Cell({
  children = null,
  className = '',
  style,
}: {
  children?: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <td className={`min-w-36 px-3 py-2 text-center text-sm border-l border-gray-950/60 ${className}`} style={style}>
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

  useEffect(() => {
    const timer = window.setTimeout(() => window.$WowheadPower?.refreshLinks?.(), 100)
    return () => window.clearTimeout(timer)
  }, [characters])

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-950 text-gray-100 px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-7xl">
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
                      <Cell key={c.id} className="font-bold" style={{ color: CLASS_COLORS[c.wowClass ?? ''] ?? '#67E8F9' }}>
                        {c.name}
                      </Cell>
                    ))}
                  </InfoRow>
                  <InfoRow label="Realm">{characters.map(c => <Cell key={c.id}>{c.realm}</Cell>)}</InfoRow>
                  <InfoRow label="Item Level">{characters.map(c => <Cell key={c.id} className="font-bold text-purple-400">{dash(c.ilvl)}</Cell>)}</InfoRow>
                  <InfoRow label="Rating">{characters.map(c => <Cell key={c.id} className="font-bold text-orange-400">{c.rioScore ? Math.round(c.rioScore) : '—'}</Cell>)}</InfoRow>
                  <InfoRow label="Current Keystone">{characters.map(c => <Cell key={c.id} className="font-bold text-gray-100">{keystoneLabel(c)}</Cell>)}</InfoRow>

                  <InfoRow label="Dungeons" section>{characters.map(c => <Cell key={c.id} />)}</InfoRow>
                  {DUNGEONS.map(dungeon => (
                    <InfoRow
                      key={dungeon.id}
                      label={
                        <WowheadLink type="spell" id={dungeon.spellId} className="gap-3 text-gray-100" noIcon={false}>
                          {dungeon.name}
                        </WowheadLink>
                      }
                    >
                      {characters.map(c => <Cell key={c.id}>{dungeonCellWithRating(c, dungeon.id)}</Cell>)}
                    </InfoRow>
                  ))}

                  <InfoRow label="Great Vault" section>{characters.map(c => <Cell key={c.id} />)}</InfoRow>
                  <InfoRow label="Raids">{characters.map(c => <Cell key={c.id}>{vaultSlots(c.vault?.raid)}</Cell>)}</InfoRow>
                  <InfoRow label="Dungeons">{characters.map(c => <Cell key={c.id} className="text-green-400">{vaultSlots(c.vault?.dungeons)}</Cell>)}</InfoRow>
                  <InfoRow label="World">{characters.map(c => <Cell key={c.id}>{vaultSlots(c.vault?.world)}</Cell>)}</InfoRow>

                  <InfoRow label="Prey Hunts" section>{characters.map(c => <Cell key={c.id} />)}</InfoRow>
                  <InfoRow label="Normal">{characters.map(c => <Cell key={c.id}>{preyCount(c.preyHunts?.normal)}</Cell>)}</InfoRow>
                  <InfoRow label="Hard">{characters.map(c => <Cell key={c.id}>{preyCount(c.preyHunts?.hard)}</Cell>)}</InfoRow>
                  <InfoRow label="Nightmare">{characters.map(c => <Cell key={c.id}>{preyCount(c.preyHunts?.nightmare)}</Cell>)}</InfoRow>

                  <InfoRow label="Currencies" section>{characters.map(c => <Cell key={c.id} />)}</InfoRow>
                  {CURRENCIES.map(currency => (
                    <InfoRow
                      key={currency.key}
                      label={
                        <WowheadLink type={currency.wowheadType} id={currency.wowheadId} className={currency.color}>
                          <WowheadIcon iconName={'iconName' in currency ? currency.iconName : undefined} localIcon={'localIcon' in currency ? currency.localIcon : undefined} />
                          {currency.label}
                        </WowheadLink>
                      }
                      labelClassName={currency.color}
                    >
                      {characters.map(c => (
                        <Cell key={c.id} className={currency.color}>
                          {currencyValue(c, currency)}
                        </Cell>
                      ))}
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
