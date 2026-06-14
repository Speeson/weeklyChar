'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/app/components/Navbar'
import { apiFetch, getToken } from '@/lib/auth'
import AccountSelect, { ALL_ACCOUNTS, accountOptions, filterByAccount } from '@/app/components/AccountSelect'
import { keystoneColor } from '@/lib/colors'

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

interface MoneyInfo {
  copper?: number
  gold?: number
  silver?: number
  copperOnly?: number
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
  wowAccount?: string | null
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
  money: MoneyInfo | null
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

const SUMMARY_SECTIONS = ['money', 'dungeons', 'greatVault', 'preyHunts', 'currencies'] as const
const SUMMARY_COLLAPSED_KEY = 'ks_summary_collapsed_sections'
const WEB_SETTINGS_KEY = 'ks_web_settings'

type SummarySection = typeof SUMMARY_SECTIONS[number]
type CollapsedSections = Record<SummarySection, boolean>

const DEFAULT_COLLAPSED_SECTIONS: CollapsedSections = {
  money: false,
  dungeons: false,
  greatVault: false,
  preyHunts: false,
  currencies: false,
}

function loadCollapsedSections(): CollapsedSections {
  if (typeof window === 'undefined') return DEFAULT_COLLAPSED_SECTIONS
  try {
    const raw = window.localStorage.getItem(SUMMARY_COLLAPSED_KEY)
    return { ...DEFAULT_COLLAPSED_SECTIONS, ...(raw ? JSON.parse(raw) : {}) }
  } catch {
    return DEFAULT_COLLAPSED_SECTIONS
  }
}

function saveCollapsedSections(value: CollapsedSections) {
  window.localStorage.setItem(SUMMARY_COLLAPSED_KEY, JSON.stringify(value))
}

function loadSummaryBlockVisibility(): Record<string, boolean> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(WEB_SETTINGS_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed?.summaryBlocks ?? {}
  } catch {
    return {}
  }
}

function dash(value: unknown) {
  return value === null || value === undefined || value === '' ? '—' : String(value)
}

function keystoneLabel(char: Character) {
  const key = char.currentKeystone
  if (!key?.level) return '—'
  const abbr = key.challengeMapId ? DUNGEON_ABBR.get(key.challengeMapId) : null
  const dungeon = abbr ?? key.dungeon ?? `ID ${key.challengeMapId}`
  return (
    <span className="inline-flex items-center justify-center gap-1">
      <span>{dungeon}</span>
      <span className="font-bold" style={{ color: keystoneColor(key.level) }}>+{key.level}</span>
    </span>
  )
}

function vaultSlots(bucket?: VaultBucket) {
  const slots = [...(bucket?.slots ?? [])].sort((a, b) => (a.threshold ?? 0) - (b.threshold ?? 0))
  if (!slots.length) return '— — —'
  return slots.slice(0, 3).map(slot => {
    if (slot.unlocked) return slot.level ? String(slot.level) : '✓'
    return '—'
  }).join('  ')
}

function vaultProgress(bucket: VaultBucket | undefined, maxProgress: number) {
  const slots = bucket?.slots ?? []
  if (!slots.length) return null
  const current = Math.min(maxProgress, Math.max(...slots.map(slot => slot.progress ?? 0)))
  return `(${current}/${maxProgress})`
}

function VaultProgress({ bucket, maxProgress }: { bucket?: VaultBucket; maxProgress: number }) {
  const progress = vaultProgress(bucket, maxProgress)
  return (
    <span className="whitespace-pre">
      {vaultSlots(bucket)}
      {progress && <span className="ml-2 text-xs text-gray-400">{progress}</span>}
    </span>
  )
}

function preyCount(bucket?: PreyBucket) {
  return bucket?.count ? String(bucket.count) : '—'
}

function moneyCopper(money?: MoneyInfo | null) {
  if (!money) return 0
  if (typeof money.copper === 'number') return money.copper
  return ((money.gold ?? 0) * 10000) + ((money.silver ?? 0) * 100) + (money.copperOnly ?? 0)
}

function formatMoney(copper: number) {
  if (!copper || copper < 0) return '—'
  const gold = Math.floor(copper / 10000)
  const silver = Math.floor((copper % 10000) / 100)
  const copperOnly = copper % 100
  return (
    <span className="inline-flex items-center justify-center gap-1 whitespace-nowrap text-xs font-semibold">
      <span className="text-yellow-300">{gold.toLocaleString('es-ES')}g</span>
      <span className="text-gray-300">{silver}s</span>
      <span className="text-orange-300">{copperOnly}c</span>
    </span>
  )
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
      <span className="min-w-5 font-bold" style={{ color: keystoneColor(run.level) }}>{run.level}</span>
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
      <span className="min-w-5 font-bold" style={{ color: keystoneColor(run.level) }}>{run.level}</span>
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
  const headerClass = section
    ? 'bg-gray-950/95 text-yellow-400 uppercase tracking-wide'
    : 'bg-gray-950/95 text-gray-100'

  return (
    <tr className={section ? 'bg-gray-950/80' : 'odd:bg-gray-900/70 even:bg-gray-900/45'}>
      <th className={`sticky left-0 z-[2] min-w-56 max-w-56 border-r border-gray-800/90 px-3 py-2 text-left text-xs font-bold shadow-[inset_-1px_0_0_rgba(0,0,0,0.45)] ${headerClass} ${labelClassName}`}>
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
  colSpan,
}: {
  children?: React.ReactNode
  className?: string
  style?: React.CSSProperties
  colSpan?: number
}) {
  return (
    <td colSpan={colSpan} className={`min-w-36 px-3 py-2 text-center text-sm border-l border-gray-950/60 ${className}`} style={style}>
      {children}
    </td>
  )
}

function SectionToggleRow({
  label,
  collapsed,
  onToggle,
  colSpan,
}: {
  label: string
  collapsed: boolean
  onToggle: () => void
  colSpan: number
}) {
  const arrows = collapsed ? '▼' : '▲'
  const action = collapsed ? 'Desplegar' : 'Compactar'

  return (
    <tr className="bg-gray-950/80">
      <th className="sticky left-0 z-[2] min-w-56 max-w-56 border-r border-gray-800/90 bg-gray-950/95 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-yellow-400 shadow-[inset_-1px_0_0_rgba(0,0,0,0.45)]">
        {label}
      </th>
      <td colSpan={Math.max(1, colSpan)} className="border-l border-gray-950/60 p-0">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-center gap-4 border-y border-yellow-500/40 bg-yellow-500/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-yellow-400 transition hover:bg-yellow-500 hover:text-gray-950"
        >
          <span className="font-black tracking-[0.35em]">{arrows}</span>
          {action}
          <span className="font-black tracking-[0.35em]">{arrows}</span>
        </button>
      </td>
    </tr>
  )
}

export default function SummaryPage() {
  const router = useRouter()
  const [characters, setCharacters] = useState<Character[]>([])
  const [selectedAccount, setSelectedAccount] = useState(ALL_ACCOUNTS)
  const [collapsedSections, setCollapsedSections] = useState<CollapsedSections>(loadCollapsedSections)
  const [summaryBlocks, setSummaryBlocks] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  function toggleSection(section: SummarySection) {
    setCollapsedSections(prev => {
      const next = { ...prev, [section]: !prev[section] }
      saveCollapsedSections(next)
      return next
    })
  }

  useEffect(() => {
    if (!getToken()) {
      router.push('/login')
      return
    }
    setSummaryBlocks(loadSummaryBlockVisibility())
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
  }, [characters, selectedAccount, collapsedSections])

  const accounts = accountOptions(characters)
  const visibleCharacters = filterByAccount(characters, selectedAccount)

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-950 text-gray-100 px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-7xl">
          {loading ? (
            <p className="text-gray-500">Cargando...</p>
          ) : characters.length === 0 ? (
            <p className="text-sm text-gray-500">Sin personajes todavía. Sincroniza desde KeystoneClient para generar el resumen.</p>
          ) : visibleCharacters.length === 0 ? (
            <>
              <div className="mb-4 flex justify-end">
                <AccountSelect accounts={accounts} value={selectedAccount} onChange={setSelectedAccount} />
              </div>
              <p className="text-sm text-gray-500">No hay personajes para esta cuenta.</p>
            </>
          ) : (
            <>
            <div className="mb-4 flex justify-end">
              <AccountSelect accounts={accounts} value={selectedAccount} onChange={setSelectedAccount} />
            </div>
            <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-900/40 shadow-2xl">
              <table className="w-full border-collapse text-sm">
                <tbody>
                  <InfoRow label="Character">
                    {visibleCharacters.map(c => (
                      <Cell key={c.id} className="font-bold" style={{ color: CLASS_COLORS[c.wowClass ?? ''] ?? '#67E8F9' }}>
                        {c.name}
                      </Cell>
                    ))}
                  </InfoRow>
                  <InfoRow label="Realm">{visibleCharacters.map(c => <Cell key={c.id}>{c.realm}</Cell>)}</InfoRow>
                  <InfoRow label="Item Level">{visibleCharacters.map(c => <Cell key={c.id} className="font-bold text-purple-400">{dash(c.ilvl)}</Cell>)}</InfoRow>
                  <InfoRow label="Rating">{visibleCharacters.map(c => <Cell key={c.id} className="font-bold text-orange-400">{c.rioScore ? Math.round(c.rioScore) : '—'}</Cell>)}</InfoRow>
                  <InfoRow label="Current Keystone">{visibleCharacters.map(c => <Cell key={c.id} className="font-bold text-gray-100">{keystoneLabel(c)}</Cell>)}</InfoRow>

                  {summaryBlocks.money !== false && <SectionToggleRow
                    label="Coins"
                    collapsed={collapsedSections.money}
                    onToggle={() => toggleSection('money')}
                    colSpan={visibleCharacters.length}
                  />}
                  {summaryBlocks.money !== false && !collapsedSections.money && (
                    <>
                      <InfoRow label="Gold">
                        {visibleCharacters.map(c => <Cell key={c.id}>{formatMoney(moneyCopper(c.money))}</Cell>)}
                      </InfoRow>
                      <InfoRow label="TOTAL">
                        <Cell colSpan={visibleCharacters.length} className="bg-emerald-500/10 font-bold" style={{ color: '#34d399' }}>
                          {formatMoney(visibleCharacters.reduce((sum, c) => sum + moneyCopper(c.money), 0))}
                        </Cell>
                      </InfoRow>
                    </>
                  )}

                  <SectionToggleRow
                    label="Dungeons"
                    collapsed={collapsedSections.dungeons}
                    onToggle={() => toggleSection('dungeons')}
                    colSpan={visibleCharacters.length}
                  />
                  {!collapsedSections.dungeons && DUNGEONS.map(dungeon => (
                    <InfoRow
                      key={dungeon.id}
                      label={
                        <WowheadLink type="spell" id={dungeon.spellId} className="gap-3 text-gray-100" noIcon={false}>
                          {dungeon.name}
                        </WowheadLink>
                      }
                    >
                      {visibleCharacters.map(c => <Cell key={c.id}>{dungeonCellWithRating(c, dungeon.id)}</Cell>)}
                    </InfoRow>
                  ))}

                  <SectionToggleRow
                    label="Great Vault"
                    collapsed={collapsedSections.greatVault}
                    onToggle={() => toggleSection('greatVault')}
                    colSpan={visibleCharacters.length}
                  />
                  {!collapsedSections.greatVault && (
                    <>
                      <InfoRow label="Raids">{visibleCharacters.map(c => <Cell key={c.id}><VaultProgress bucket={c.vault?.raid} maxProgress={6} /></Cell>)}</InfoRow>
                      <InfoRow label="Dungeons">{visibleCharacters.map(c => <Cell key={c.id} className="text-green-400"><VaultProgress bucket={c.vault?.dungeons} maxProgress={8} /></Cell>)}</InfoRow>
                      <InfoRow label="World">{visibleCharacters.map(c => <Cell key={c.id}><VaultProgress bucket={c.vault?.world} maxProgress={8} /></Cell>)}</InfoRow>
                    </>
                  )}

                  <SectionToggleRow
                    label="Prey Hunts"
                    collapsed={collapsedSections.preyHunts}
                    onToggle={() => toggleSection('preyHunts')}
                    colSpan={visibleCharacters.length}
                  />
                  {!collapsedSections.preyHunts && (
                    <>
                      <InfoRow label="Normal">{visibleCharacters.map(c => <Cell key={c.id}>{preyCount(c.preyHunts?.normal)}</Cell>)}</InfoRow>
                      <InfoRow label="Hard">{visibleCharacters.map(c => <Cell key={c.id}>{preyCount(c.preyHunts?.hard)}</Cell>)}</InfoRow>
                      <InfoRow label="Nightmare">{visibleCharacters.map(c => <Cell key={c.id}>{preyCount(c.preyHunts?.nightmare)}</Cell>)}</InfoRow>
                    </>
                  )}

                  <SectionToggleRow
                    label="Currencies"
                    collapsed={collapsedSections.currencies}
                    onToggle={() => toggleSection('currencies')}
                    colSpan={visibleCharacters.length}
                  />
                  {!collapsedSections.currencies && CURRENCIES.map(currency => (
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
                      {visibleCharacters.map(c => (
                        <Cell key={c.id} className={currency.color}>
                          {currencyValue(c, currency)}
                        </Cell>
                      ))}
                    </InfoRow>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      </main>
    </>
  )
}
