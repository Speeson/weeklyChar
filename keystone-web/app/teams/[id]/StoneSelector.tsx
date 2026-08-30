'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/auth'
import { wowClassColor } from '@/lib/colors'
import {
  buildKeystoneSelectorPath,
  createKeystoneSelectorRequestIdentity,
  groupSelectorObjectives,
  isKeystoneSelectorRequestCurrent,
  parseKeystoneSelectorResponse,
  selectorDungeonOptions,
  selectorObjectivesForSpec,
  type KeystoneSelectorCharacter,
  type KeystoneSelectorObjective,
  type KeystoneSelectorRequestIdentity,
  type KeystoneSelectorResponse,
  type KeystoneSelectorTierCounts,
} from '@/lib/keystoneSelector'
import { objectiveItemName, tierPresentation, voidcorePresentation } from '@/lib/keystoneLootObjectives'
import { specName } from '@/lib/wowSpecs'
import KeystoneLootItemTooltip from '@/app/components/KeystoneLootItemTooltip'

type SelectorTeamMember = {
  userId: number
  username: string
  characters: Array<{
    currentKeystone: {
      level: number | null
      challengeMapId: number | null
    } | null
  }>
}

type Props = {
  teamId: number
  members: SelectorTeamMember[]
}

const TIER_SUMMARY: Array<[keyof KeystoneSelectorTierCounts, string]> = [
  ['bestInSlot', 'BiS'],
  ['mustHave', 'Must'],
  ['niceToHave', 'Nice'],
  ['catalyst', 'Catalyst'],
  ['transmog', 'Transmog'],
  ['other', 'Other'],
]

function countCopy(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

function TierChips({ counts }: { counts: KeystoneSelectorTierCounts }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TIER_SUMMARY.filter(([key]) => counts[key] > 0).map(([key, label]) => (
        <span key={key} className="rounded-md border border-gray-700 bg-gray-950/70 px-2 py-1 text-[11px] text-gray-300">
          <strong className="text-gray-100">{counts[key]}</strong> {label}
        </span>
      ))}
    </div>
  )
}

function SelectorItemTile({ objective }: { objective: KeystoneSelectorObjective }) {
  const tier = tierPresentation(objective.tier)
  const voidcore = voidcorePresentation(objective.voidcoreState)
  const name = objectiveItemName(objective)
  return (
    <KeystoneLootItemTooltip
      objective={objective}
      triggerClassName={`group w-[76px] rounded-lg border p-1.5 text-center transition hover:-translate-y-0.5 motion-reduce:transform-none ${tier.tone}`}
    >
      {objective.iconUrl ? (
        <span
          role="img"
          aria-label={`Icono de ${name}`}
          className="mx-auto block h-13 w-13 rounded-md border border-current/30 bg-cover bg-center"
          style={{ backgroundImage: `url(${objective.iconUrl})` }}
        />
      ) : (
        <span aria-hidden="true" className="mx-auto flex h-13 w-13 items-center justify-center rounded-md border border-gray-700 bg-gray-900 text-lg text-gray-500">?</span>
      )}
      <span className="mt-1.5 block truncate text-[10px] font-semibold text-gray-100">{name}</span>
      <span className={`mt-0.5 block truncate text-[9px] ${voidcore.tone}`}>{voidcore.label}</span>
    </KeystoneLootItemTooltip>
  )
}

function ObjectiveGroups({ objectives }: { objectives: KeystoneSelectorObjective[] }) {
  const grouped = groupSelectorObjectives(objectives)
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {grouped.groups.map(group => (
        <section key={group.key} aria-label={group.label}>
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
            {group.label} · {group.objectives.length}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.objectives.map(objective => <SelectorItemTile key={`${objective.sourceType}:${objective.sourceId}:${objective.itemId}`} objective={objective} />)}
          </div>
        </section>
      ))}
      {grouped.completed.length > 0 && (
        <details className="rounded-lg border border-emerald-900/50 bg-emerald-950/10 p-3 sm:col-span-2 xl:col-span-3">
          <summary className="cursor-pointer text-xs font-bold text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
            Completados con Voidcore · {grouped.completed.length}
          </summary>
          <div className="mt-3 flex flex-wrap gap-2 opacity-75">
            {grouped.completed.map(objective => <SelectorItemTile key={`${objective.sourceType}:${objective.sourceId}:${objective.itemId}`} objective={objective} />)}
          </div>
        </details>
      )}
    </div>
  )
}

function SelectorCharacterCard({ character }: { character: KeystoneSelectorCharacter }) {
  const detailsId = `selector-character-${character.characterId}`
  const [expanded, setExpanded] = useState(false)
  const [selectedSpecId, setSelectedSpecId] = useState<number | null>(null)
  const objectives = selectorObjectivesForSpec(character.objectives, selectedSpecId)
  const oneSpec = character.specs.length === 1 ? character.specs[0] : null

  return (
    <article data-selector-character className="overflow-hidden rounded-xl border border-gray-800 bg-gray-950/60 shadow-lg shadow-black/20">
      <div className="p-4">
        <div className="flex items-start gap-3">
          {character.avatarUrl ? (
            <span
              role="img"
              aria-label={`Avatar de ${character.characterName}`}
              className="h-11 w-11 shrink-0 rounded-full border-2 bg-cover bg-center"
              style={{ borderColor: wowClassColor(character.wowClass), backgroundImage: `url(${character.avatarUrl})` }}
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 bg-gray-900 font-black"
              style={{ borderColor: wowClassColor(character.wowClass), color: wowClassColor(character.wowClass) }}
            >
              {character.characterName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-black" style={{ color: wowClassColor(character.wowClass) }}>{character.characterName}</h3>
                <p className="truncate text-xs text-gray-400">
                  {oneSpec ? `${specName(oneSpec.specId)} · ` : ''}{character.username} · {character.realm}
                </p>
              </div>
              <p className="shrink-0 text-right text-sm font-black text-white">
                {countCopy(character.totalObjectives, 'objetivo', 'objetivos')}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4"><TierChips counts={character.tierCounts} /></div>

        {character.specs.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Filtrar objetos por especialización">
            <button
              type="button"
              aria-pressed={selectedSpecId === null}
              onClick={() => setSelectedSpecId(null)}
              className={`rounded-full border px-3 py-1 text-[11px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 ${selectedSpecId === null ? 'border-yellow-400 bg-yellow-500/15 text-yellow-200' : 'border-gray-700 text-gray-400 hover:text-white'}`}
            >
              Todas · {character.totalObjectives}
            </button>
            {character.specs.map(spec => (
              <button
                key={spec.specId}
                type="button"
                aria-pressed={selectedSpecId === spec.specId}
                onClick={() => setSelectedSpecId(spec.specId)}
                className={`rounded-full border px-3 py-1 text-[11px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 ${selectedSpecId === spec.specId ? 'border-yellow-400 bg-yellow-500/15 text-yellow-200' : 'border-gray-700 text-gray-400 hover:text-white'}`}
              >
                {specName(spec.specId)} · {spec.objectiveCount}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={detailsId}
            onClick={() => setExpanded(value => !value)}
            className="min-h-10 rounded-lg border border-yellow-500/30 px-3 text-xs font-bold text-yellow-300 transition hover:border-yellow-400 hover:bg-yellow-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
          >
            {expanded ? 'Ocultar objetos' : 'Ver objetos'}
          </button>
        </div>
      </div>

      {expanded && (
        <div id={detailsId} className="border-t border-gray-800 bg-gray-900/35 p-4">
          <ObjectiveGroups objectives={objectives} />
        </div>
      )}
    </article>
  )
}

export default function StoneSelector({ teamId, members }: Props) {
  const router = useRouter()
  const baseOptions = useMemo(() => selectorDungeonOptions(members), [members])
  const [countOverrides, setCountOverrides] = useState<Record<number, number>>({})
  const options = baseOptions.map(option => ({
    ...option,
    stoneCount: countOverrides[option.id] ?? option.stoneCount,
  }))
  const [selectedDungeonId, setSelectedDungeonId] = useState<number | null>(null)
  const [response, setResponse] = useState<KeystoneSelectorResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const activeController = useRef<AbortController | null>(null)
  const requestGeneration = useRef(0)
  const activeIdentity = useRef<KeystoneSelectorRequestIdentity | null>(null)

  useEffect(() => () => {
    activeController.current?.abort()
    activeIdentity.current = null
    requestGeneration.current += 1
  }, [])

  async function loadDungeon(challengeMapId: number) {
    activeController.current?.abort()
    const controller = new AbortController()
    activeController.current = controller
    const identity = createKeystoneSelectorRequestIdentity(teamId, challengeMapId, ++requestGeneration.current)
    activeIdentity.current = identity
    setSelectedDungeonId(challengeMapId)
    setResponse(null)
    setLoading(true)
    setError(null)
    try {
      const result = await apiFetch(buildKeystoneSelectorPath(teamId, challengeMapId), { signal: controller.signal })
      if (!isKeystoneSelectorRequestCurrent(identity, activeIdentity.current)) return
      if (result.status === 401) {
        router.push('/login')
        return
      }
      if (result.status === 403) throw new Error('Ya no tienes acceso a este equipo.')
      if (result.status === 404) {
        router.push('/teams')
        return
      }
      if (!result.ok) throw new Error('No se pudo cargar el Selector de piedra.')
      const parsed = parseKeystoneSelectorResponse(await result.json(), teamId, challengeMapId)
      if (!parsed) throw new Error('La respuesta del Selector de piedra no tiene un formato válido.')
      if (!isKeystoneSelectorRequestCurrent(identity, activeIdentity.current)) return
      setResponse(parsed)
      setCountOverrides(previous => ({ ...previous, [challengeMapId]: parsed.availability.stoneCount }))
    } catch (reason) {
      if (controller.signal.aborted || !isKeystoneSelectorRequestCurrent(identity, activeIdentity.current)) return
      setError(reason instanceof Error ? reason.message : 'No se pudo cargar el Selector de piedra.')
    } finally {
      if (isKeystoneSelectorRequestCurrent(identity, activeIdentity.current)) setLoading(false)
    }
  }

  function closePanel() {
    activeController.current?.abort()
    activeIdentity.current = null
    requestGeneration.current += 1
    setSelectedDungeonId(null)
    setResponse(null)
    setLoading(false)
    setError(null)
  }

  const tierSummary = response
    ? TIER_SUMMARY.filter(([key]) => response.summary.tiers[key] > 0)
      .map(([key, label]) => `${response.summary.tiers[key]} ${label}`).join(' · ')
    : ''

  return (
    <section aria-labelledby="stone-selector-title" className="mt-6">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-yellow-500">KeystoneLoot</p>
          <h2 id="stone-selector-title" className="mt-1 text-lg font-black text-white">Selector de piedra</h2>
        </div>
        <p className="hidden text-xs text-gray-500 sm:block">Elige una mazmorra para ver qué gana el equipo.</p>
      </div>

      <div className="overflow-x-auto pb-2 [scrollbar-width:thin]">
        <div className="grid min-w-max auto-cols-[150px] grid-flow-col gap-2 sm:min-w-0 sm:grid-flow-row sm:grid-cols-4 xl:grid-cols-8">
          {options.map(option => {
            const selected = selectedDungeonId === option.id
            const available = option.stoneCount > 0
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                aria-label={`${option.name}, ${countCopy(option.stoneCount, 'piedra', 'piedras')}`}
                onClick={() => void loadDungeon(option.id)}
                className={`relative min-h-20 rounded-xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 motion-reduce:transition-none ${selected
                  ? 'border-emerald-400 bg-emerald-500/15 shadow-lg shadow-emerald-500/20'
                  : available
                    ? 'border-yellow-500/45 bg-yellow-500/[0.07] hover:border-yellow-300 hover:bg-yellow-500/10'
                    : 'border-gray-800 bg-gray-900/45 text-gray-500 hover:border-gray-600 hover:text-gray-300'}`}
              >
                <span className={`block text-[11px] font-black uppercase tracking-[0.12em] ${selected ? 'text-emerald-300' : available ? 'text-yellow-300' : 'text-gray-500'}`}>{option.abbr}</span>
                <span className="mt-1 block truncate text-xs font-semibold text-gray-200">{option.name}</span>
                <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-black tabular-nums ${selected ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-200' : available ? 'border-yellow-400/50 bg-yellow-400/10 text-yellow-200' : 'border-gray-700 bg-gray-950 text-gray-500'}`}>×{option.stoneCount}</span>
                {selected && <span aria-hidden="true" className="absolute -bottom-[3px] left-4 right-4 h-1 rounded-full bg-emerald-400 shadow shadow-emerald-400/50" />}
              </button>
            )
          })}
        </div>
      </div>

      {selectedDungeonId !== null && (
        <div
          role="tabpanel"
          aria-label="Objetivos del Selector de piedra"
          aria-busy={loading}
          className="mt-1 overflow-hidden rounded-2xl border border-yellow-500/30 bg-gray-900/55 shadow-2xl shadow-black/30"
        >
          <div className="flex items-center justify-between gap-3 border-b border-gray-800 bg-gray-950/75 px-3 py-3 sm:px-4">
            <div role="tablist" aria-label="Vista del Selector" className="flex min-w-0 items-center gap-2">
              <button type="button" role="tab" aria-selected="true" className="min-h-10 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 text-xs font-black uppercase tracking-wide text-yellow-200">Objetivos</button>
              <button type="button" role="tab" disabled aria-disabled="true" className="min-h-10 truncate rounded-lg border border-gray-800 px-3 text-xs font-bold text-gray-600 disabled:cursor-not-allowed">
                Planificar piedra <span className="hidden sm:inline">· Próximamente</span>
              </button>
            </div>
            <button type="button" onClick={closePanel} aria-label="Cerrar Selector de piedra" className="min-h-10 min-w-10 rounded-lg border border-gray-700 text-xl text-gray-400 hover:border-gray-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400">×</button>
          </div>

          <div className="min-h-48 p-4 sm:p-5" aria-live="polite">
            {loading && (
              <div className="space-y-3" aria-label="Cargando objetivos del Selector">
                <div className="h-5 w-56 animate-pulse rounded bg-gray-800 motion-reduce:animate-none" />
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="h-36 animate-pulse rounded-xl bg-gray-800/70 motion-reduce:animate-none" />
                  <div className="h-36 animate-pulse rounded-xl bg-gray-800/70 motion-reduce:animate-none" />
                </div>
              </div>
            )}

            {!loading && error && (
              <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                <p>{error}</p>
                <button type="button" onClick={() => void loadDungeon(selectedDungeonId)} className="mt-3 min-h-10 rounded-lg border border-red-400/40 px-3 text-xs font-bold hover:border-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300">Reintentar</button>
              </div>
            )}

            {!loading && !error && response && (
              <>
                <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-gray-800 bg-gray-950/55 px-4 py-3">
                  <div>
                    <p className="font-black text-white">
                      {countCopy(response.summary.charactersWithObjectives, 'personaje', 'personajes')} · {countCopy(response.summary.totalObjectives, 'objetivo', 'objetivos')}
                    </p>
                    {tierSummary && <p className="mt-1 text-xs text-gray-400">{tierSummary}</p>}
                  </div>
                  <p className="text-xs font-bold text-yellow-300">{countCopy(response.availability.stoneCount, 'piedra disponible', 'piedras disponibles')}</p>
                </div>

                {response.characters.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-sm font-semibold text-gray-300">Ningún personaje del equipo tiene objetivos pendientes en esta mazmorra.</p>
                    {response.availability.stoneCount === 0 && <p className="mt-2 text-xs text-gray-500">El equipo tampoco tiene una piedra de esta mazmorra actualmente.</p>}
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    {response.characters.map(character => <SelectorCharacterCard key={character.characterId} character={character} />)}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
