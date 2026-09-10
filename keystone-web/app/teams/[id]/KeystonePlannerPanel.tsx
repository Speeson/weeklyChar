'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/auth'
import { wowClassColor } from '@/lib/colors'
import { DUNGEON_ABBR_BY_ID } from '@/lib/season2'
import { objectiveItemName, tierPresentation, voidcorePresentation } from '@/lib/keystoneLootObjectives'
import { specName, specOptionsForClass } from '@/lib/wowSpecs'
import KeystoneLootItemTooltip from '@/app/components/KeystoneLootItemTooltip'
import {
  DEFAULT_PLANNER_OPTIONS,
  PLANNER_DIAGNOSTIC_LABELS,
  PLANNER_REASON_LABELS,
  PLAY_PREFERENCE_LABELS,
  ROLE_LABELS,
  buildKeystonePlannerRequest,
  capabilityAvailabilityLabel,
  createPlannerRequestIdentity,
  damageProfileLabel,
  defaultParticipantIds,
  isPlannerRequestCurrent,
  locksForParticipants,
  parseKeystonePlannerResponse,
  plannerLockIssueLabel,
  plannerLockLabel,
  togglePlannerParticipant,
  type KeystonePlannerResponse,
  type PlannerLock,
  type PlannerOptions,
  type PlannerRecommendation,
  type PlannerRole,
} from '@/lib/keystonePlanner'
import PlannerPreferencesDialog from './PlannerPreferencesDialog'

export type PlannerTeamMember = {
  userId: number
  username: string
  characters: Array<{ id: number, name: string, realm: string, wowClass?: string | null, avatarUrl?: string | null }>
}

type Props = {
  teamId: number
  members: PlannerTeamMember[]
  currentUserId: number
  challengeMapId: number | null
  onClose: () => void
  returnFocusElement?: HTMLElement | null
}

type LockDraft = {
  type: PlannerLock['type']
  userId: number | null
  characterId: number | null
  specId: number | null
  role: PlannerRole
}

const GENERIC_ERROR = 'No se pudo calcular el plan. Inténtalo de nuevo.'
const NO_COMPOSITION = 'No hay una composición válida con estas restricciones. Ajusta participantes, preferencias o locks e inténtalo de nuevo.'
const DATA_LIMIT_ERROR = 'El volumen de datos seleccionado supera los límites seguros del Planner. Ajusta la selección e inténtalo de nuevo.'

function PlannerObjectiveTile({ objective, challengeMapId, specId }: {
  objective: PlannerRecommendation['assignments'][number]['objectives'][number]
  challengeMapId: number
  specId: number
}) {
  const tier = tierPresentation(objective.tier)
  const voidcore = voidcorePresentation(objective.voidcoreState)
  const name = objectiveItemName(objective)
  return (
    <KeystoneLootItemTooltip objective={{ ...objective, sourceType: 'dungeon', sourceId: challengeMapId, slotName: null, itemClassName: null, itemSubClassName: null, statNames: [], specId }} triggerClassName={`w-[76px] rounded-lg border p-1.5 text-center ${tier.tone}`}>
      {objective.iconUrl ? <span role="img" aria-label={`Icono de ${name}`} className="mx-auto block h-12 w-12 rounded-md border border-current/30 bg-cover bg-center" style={{ backgroundImage: `url(${objective.iconUrl})` }} />
        : <span aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center rounded-md border border-gray-700 bg-gray-900 text-gray-500">?</span>}
      <span className="mt-1 block truncate text-[10px] font-bold text-gray-100">{name}</span>
      <span className={`mt-0.5 block truncate text-[9px] ${voidcore.tone}`}>{voidcore.label}</span>
    </KeystoneLootItemTooltip>
  )
}

function CapabilityBadge({ capability, mode }: {
  capability: { name: string, condition?: string | null }
  mode: 'guaranteed' | 'conditional'
}) {
  const conditional = mode === 'conditional'
  return (
    <span title={capability.condition ?? undefined} className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold ${conditional ? 'border-amber-400/50 bg-amber-500/15 text-amber-200' : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'}`}>
      {capability.name}{conditional ? ' · Condicional' : ''}
    </span>
  )
}

function RecommendationCard({ recommendation, targetLevel, members }: { recommendation: PlannerRecommendation, targetLevel: number, members: PlannerTeamMember[] }) {
  const first = recommendation.rank === 1
  const abbr = DUNGEON_ABBR_BY_ID.get(recommendation.stone.challengeMapId)
  const assignments = recommendation.assignments.map(assignment => ({ assignment, used: false }))
  const vacancies = recommendation.vacancies.map(vacancy => ({ vacancy, used: false }))
  const partySlots = (['tank', 'healer', 'dps', 'dps', 'dps'] as PlannerRole[]).map(role => {
    const assigned = assignments.find(entry => !entry.used && entry.assignment.role === role)
    if (assigned) { assigned.used = true; return { role, assignment: assigned.assignment, vacancy: null } }
    const empty = vacancies.find(entry => !entry.used && entry.vacancy.role === role)
    if (empty) { empty.used = true; return { role, assignment: null, vacancy: empty.vacancy } }
    return { role, assignment: null, vacancy: { role, preferredCapabilities: [] } }
  })
  return (
    <article data-planner-recommendation className={`rounded-2xl border p-4 shadow-xl sm:p-5 ${first ? 'border-yellow-400/60 bg-yellow-500/[0.08] shadow-yellow-500/10' : 'border-gray-800 bg-gray-900/55 shadow-black/20'}`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={`text-xs font-black uppercase tracking-[0.18em] ${first ? 'text-yellow-300' : 'text-gray-400'}`}>Recomendación #{recommendation.rank}{first ? ' · Mejor opción' : ''}</p>
          <h3 className="mt-1 text-lg font-black text-white">{recommendation.stone.dungeon}{abbr ? ` (${abbr})` : ''}</h3>
          <p className="mt-1 text-xs text-gray-400">Piedra de {recommendation.stone.ownerUsername} · {recommendation.stone.characterName}</p>
        </div>
        <div className="rounded-xl border border-gray-700 bg-gray-950/75 px-3 py-2 text-right">
          <p className="text-xl font-black text-yellow-300">+{recommendation.stone.level}</p>
          <p className="text-[10px] text-gray-400">Objetivo +{targetLevel} · distancia {recommendation.levelSummary.levelDistance}</p>
        </div>
      </header>

      <section className="mt-4" aria-label="Por qué esta opción">
        <p className="mb-2 text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">Por qué esta opción</p>
        <div className="flex flex-wrap gap-1.5">
        {recommendation.reasonCodes.map(code => <span key={code} className="rounded-full border border-gray-700 bg-gray-950/70 px-2 py-1 text-[10px] font-semibold text-gray-300">{PLANNER_REASON_LABELS[code]}</span>)}
        </div>
      </section>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Party: un tanque, un sanador y tres DPS">
        {partySlots.map((slot, slotIndex) => slot.assignment ? (() => {
          const assignment = slot.assignment
          const avatar = members.find(member => member.userId === assignment.userId)?.characters.find(character => character.id === assignment.characterId)?.avatarUrl
          return <section key={`${slot.role}:${slotIndex}:${assignment.characterId}`} className="rounded-xl border border-gray-800 bg-gray-950/60 p-3">
            <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-gray-500">Slot {ROLE_LABELS[slot.role]}</p>
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 gap-2">
                {avatar && <span role="img" aria-label={`Avatar de ${assignment.characterName}`} className="h-9 w-9 shrink-0 rounded-full border border-gray-700 bg-cover bg-center" style={{ backgroundImage: `url(${avatar})` }} />}
                <div className="min-w-0">
                <p className="truncate font-black" style={{ color: wowClassColor(assignment.wowClass) }}>{assignment.characterName}</p>
                <p className="text-xs text-gray-400">{assignment.username} · {specName(assignment.specId)}</p>
                <p className="text-[10px] text-gray-500">{PLAY_PREFERENCE_LABELS[assignment.playPreference]}</p>
                </div>
              </div>
            </div>
            <span className="mt-2 inline-flex rounded border border-gray-700 px-2 py-1 text-[10px] text-gray-300">Loot: {specName(assignment.lootSpecId)}</span>
            {assignment.capabilities.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{assignment.capabilities.map(capability => <CapabilityBadge key={capability.capabilityId} capability={capability} mode={capability.mode!} />)}</div>}
            <details className="mt-3 border-t border-gray-800 pt-2">
              <summary className="cursor-pointer text-xs font-bold text-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400">Objetivos · {assignment.objectives.length}</summary>
              {assignment.objectives.length === 0 ? <p className="mt-2 text-xs text-gray-400">Sin objetivos puntuables para esta recomendación.</p>
                : <div className="mt-3 flex flex-wrap gap-2">{assignment.objectives.map(objective => <PlannerObjectiveTile key={`${objective.itemId}:${objective.variantKey}`} objective={objective} challengeMapId={recommendation.stone.challengeMapId} specId={assignment.lootSpecId} />)}</div>}
            </details>
          </section>
        })() : <section key={`${slot.role}:${slotIndex}:empty`} className="rounded-xl border border-dashed border-amber-500/35 bg-amber-500/[0.06] p-3">
          <p className="text-[10px] font-black uppercase tracking-wide text-amber-300">Slot {ROLE_LABELS[slot.role]}</p>
          <p className="mt-3 text-sm font-bold text-amber-100">Hueco libre</p>
          {slot.vacancy?.preferredCapabilities.length ? <p className="mt-2 text-xs text-amber-200">Preferiblemente: {slot.vacancy.preferredCapabilities.join(', ')}</p> : <p className="mt-2 text-xs text-gray-500">Sin preferencia adicional</p>}
        </section>)}
      </div>

      <div className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
        <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-3"><strong className="text-white">Botín</strong><p className="mt-1 text-gray-400">{recommendation.lootSummary.playersWithObjectives}/5 jugadores con objetivos puntuables · {recommendation.lootSummary.tierCounts.bestInSlot} BiS · {recommendation.lootSummary.tierCounts.mustHave} Must · {recommendation.lootSummary.tierCounts.niceToHave} Nice</p></div>
        <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-3"><strong className="text-white">Preferencias</strong><p className="mt-1 text-gray-400">{recommendation.preferenceSummary.preferred} preferidas · {recommendation.preferenceSummary.available} disponibles · {recommendation.preferenceSummary.emergency} emergencia</p></div>
        <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-3"><strong className="text-white">Composición</strong><p className="mt-1 text-gray-400">Heroísmo: {capabilityAvailabilityLabel(recommendation.compositionSummary.bloodlust)} · Battle Rez: {capabilityAvailabilityLabel(recommendation.compositionSummary.battleRez)} · {recommendation.compositionSummary.uniqueClassBuffCount} buffs únicos</p><p className="mt-1 text-gray-400">Chaos Brand: {recommendation.compositionSummary.chaosBrandBeneficiaries} · Mystic Touch: {recommendation.compositionSummary.mysticTouchBeneficiaries}</p><p className="mt-1 text-gray-400">{damageProfileLabel(recommendation.compositionSummary.damageProfile)}</p></div>
      </div>
      {recommendation.compositionSummary.uniqueCapabilities.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{recommendation.compositionSummary.uniqueCapabilities.map(capability => <CapabilityBadge key={capability.capabilityId} capability={capability} mode={capability.availability!} />)}</div>}
    </article>
  )
}

export default function KeystonePlannerPanel({ teamId, members, currentUserId, challengeMapId, onClose, returnFocusElement }: Props) {
  const router = useRouter()
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const activeController = useRef<AbortController | null>(null)
  const activeIdentity = useRef<ReturnType<typeof createPlannerRequestIdentity> | null>(null)
  const generation = useRef(0)
  const preferencesOpenRef = useRef(false)
  const [participants, setParticipants] = useState(() => defaultParticipantIds(currentUserId, members))
  const [targetLevel, setTargetLevel] = useState(10)
  const [options, setOptions] = useState<PlannerOptions>({ ...DEFAULT_PLANNER_OPTIONS })
  const [locks, setLocks] = useState<PlannerLock[]>([])
  const [advanced, setAdvanced] = useState(false)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [preferencesTrigger, setPreferencesTrigger] = useState<HTMLElement | null>(null)
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<KeystonePlannerResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [draft, setDraft] = useState<LockDraft>({ type: 'role', userId: null, characterId: null, specId: null, role: 'tank' })

  function invalidate() {
    activeController.current?.abort()
    activeIdentity.current = null
    generation.current += 1
    setResponse(null)
    setError(null)
    setNotice(null)
    setLoading(false)
  }

  function preferencesSaved() {
    invalidate()
    setNotice('Preferencias guardadas. Calcula de nuevo para obtener recomendaciones actualizadas.')
  }

  useEffect(() => {
    preferencesOpenRef.current = preferencesOpen
  }, [preferencesOpen])

  useEffect(() => {
    closeRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !preferencesOpenRef.current) onClose()
      if (event.key !== 'Tab' || preferencesOpenRef.current || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), select:not([disabled]), input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])')]
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable.at(-1)!
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      activeController.current?.abort()
      activeIdentity.current = null
      generation.current += 1
      returnFocusElement?.focus()
    }
  }, [onClose, returnFocusElement])

  useEffect(() => {
    activeController.current?.abort()
    activeIdentity.current = null
    generation.current += 1
  }, [teamId, challengeMapId])

  function selectParticipant(userId: number) {
    const next = togglePlannerParticipant(participants, userId)
    if (next.length === participants.length && next.every((id, index) => id === participants[index])) return
    invalidate()
    setParticipants(next)
    setLocks(current => locksForParticipants(current, next))
  }

  function updateOptions(changes: Partial<PlannerOptions>) {
    invalidate()
    setOptions(current => ({ ...current, ...changes }))
  }

  function addLock() {
    if (!draft.userId) return
    let lock: PlannerLock
    if (draft.type === 'role') lock = { type: 'role', userId: draft.userId, role: draft.role }
    else if (draft.type === 'character' && draft.characterId) lock = { type: 'character', userId: draft.userId, characterId: draft.characterId }
    else if (draft.type === 'assignment' && draft.characterId && draft.specId) lock = { type: 'assignment', userId: draft.userId, characterId: draft.characterId, specId: draft.specId }
    else return
    invalidate()
    setLocks(current => [...current.filter(existing => !(existing.type === lock.type && existing.userId === lock.userId)), lock])
  }

  async function calculate() {
    invalidate()
    const controller = new AbortController()
    activeController.current = controller
    const identity = createPlannerRequestIdentity(teamId, challengeMapId, ++generation.current)
    activeIdentity.current = identity
    setLoading(true)
    setNotice(null)
    try {
      const result = await apiFetch(`/api/teams/${teamId}/keystone-planner`, {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify(buildKeystonePlannerRequest({ participantUserIds: participants, targetLevel, challengeMapId, options, locks })),
      })
      if (!isPlannerRequestCurrent(identity, activeIdentity.current)) return
      if (result.status === 401) { router.push('/login'); return }
      if (result.status === 403) { setError('Ya no tienes acceso a este equipo.'); return }
      if (result.status === 404) { router.push('/teams'); return }
      const body = await result.json().catch(() => null)
      const parsed = parseKeystonePlannerResponse(body, teamId, challengeMapId)
      if (result.status === 422) { setError(DATA_LIMIT_ERROR); return }
      if (result.status === 400) {
        if (parsed) setResponse(parsed)
        else setError((body as { detail?: string } | null)?.detail ?? 'La solicitud del Planner no es válida.')
        return
      }
      if (!result.ok) { setError(GENERIC_ERROR); return }
      if (!parsed) { setError(GENERIC_ERROR); return }
      setResponse(parsed)
    } catch {
      if (!controller.signal.aborted && isPlannerRequestCurrent(identity, activeIdentity.current)) setError(GENERIC_ERROR)
    } finally {
      if (isPlannerRequestCurrent(identity, activeIdentity.current)) setLoading(false)
    }
  }

  const draftMember = members.find(member => member.userId === draft.userId)
  const draftCharacters = draftMember?.characters ?? []
  const draftCharacter = draftCharacters.find(character => character.id === draft.characterId)
  const draftSpecs = specOptionsForClass(draftCharacter?.wowClass)
  const unconfigured = response?.diagnostics.unconfiguredUserIds.map(userId => ({
    userId,
    username: members.find(member => member.userId === userId)?.username ?? `Usuario ${userId}`,
  })) ?? []

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-2 py-3 backdrop-blur-sm sm:px-4">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="keystone-planner-title" className="flex max-h-[95vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-yellow-500/35 bg-gray-950 shadow-2xl shadow-black">
        <header className="flex items-start justify-between gap-4 border-b border-gray-800 px-4 py-4 sm:px-6">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-yellow-500">Keystone Planner</p>
            <h2 id="keystone-planner-title" className="mt-1 text-xl font-black text-white">{challengeMapId === null ? 'Planificar sesión' : `Planificar piedra · ${DUNGEON_ABBR_BY_ID.get(challengeMapId) ?? challengeMapId}`}</h2>
            <p className="mt-1 text-xs text-gray-400">El Worker calcula las composiciones y ordena las recomendaciones.</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Cerrar Keystone Planner" className="min-h-11 min-w-11 rounded-lg border border-gray-700 text-xl text-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400">×</button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <section aria-labelledby="planner-participants-title">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div><h3 id="planner-participants-title" className="font-black text-white">Participantes</h3><p className="text-xs text-gray-400">Selecciona entre 2 y 5 jugadores. Empiezas solo con tu usuario.</p></div>
              <span className="text-xs font-bold text-yellow-300">{participants.length} / 5</span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {members.map(member => {
                const selected = participants.includes(member.userId)
                const limit = !selected && participants.length >= 5
                return <label key={member.userId} className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2 ${selected ? 'border-yellow-400/60 bg-yellow-500/10 text-white' : 'border-gray-800 bg-gray-900/50 text-gray-400'} ${limit ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'}`}><input type="checkbox" checked={selected} disabled={limit} onChange={() => selectParticipant(member.userId)} className="accent-yellow-500" /><span className="truncate text-sm font-bold">{member.username}{member.userId === currentUserId ? ' · Tú' : ''}</span></label>
              })}
            </div>
          </section>

          <section className="mt-5 grid gap-4 rounded-xl border border-gray-800 bg-gray-900/40 p-4 lg:grid-cols-[minmax(240px,1fr)_minmax(260px,1fr)]">
            <div>
              <label htmlFor="planner-target-level" className="flex justify-between text-sm font-bold text-white"><span>Nivel objetivo</span><output htmlFor="planner-target-level" className="text-yellow-300">+{targetLevel}</output></label>
              <input id="planner-target-level" type="range" min="1" max="20" step="1" value={targetLevel} onChange={event => { invalidate(); setTargetLevel(Number(event.target.value)) }} className="mt-3 w-full accent-yellow-500" />
              <div className="mt-1 flex justify-between text-[10px] text-gray-500"><span>+1</span><span>+20</span></div>
            </div>
            <div>
              <label className="flex min-h-12 cursor-pointer items-center justify-between rounded-xl border border-gray-700 bg-gray-950/60 px-3"><span className="text-sm font-bold text-white">Optimizar composición</span><input type="checkbox" role="switch" checked={options.optimizeComposition} onChange={event => updateOptions({ optimizeComposition: event.target.checked })} className="accent-yellow-500" /></label>
              <div className={`mt-2 grid grid-cols-2 gap-2 ${options.optimizeComposition ? '' : 'opacity-40'}`} aria-disabled={!options.optimizeComposition}>
                {([['bloodlust', 'Heroísmo'], ['battleRez', 'Battle rez'], ['classBuffs', 'Buffs de clase'], ['damageSynergy', 'Sinergia de daño']] as const).map(([key, label]) => <label key={key} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-gray-800 px-3 text-xs text-gray-300"><input type="checkbox" checked={options[key]} disabled={!options.optimizeComposition} onChange={event => updateOptions({ [key]: event.target.checked })} className="accent-yellow-500" />{label}</label>)}
              </div>
            </div>
          </section>

          <details open={advanced} onToggle={event => setAdvanced(event.currentTarget.open)} className="mt-4 rounded-xl border border-gray-800 bg-gray-900/35 p-4">
            <summary className="cursor-pointer font-black text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400">Opciones avanzadas y locks</summary>
            <div className="mt-4">
              <p className="text-xs text-gray-400">Los locks son restricciones explícitas. Al quitar un participante se eliminan sus locks.</p>
              {locks.length > 0 && <ul className="mt-3 space-y-2">{locks.map((lock, index) => <li key={`${lock.type}:${lock.userId}:${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-gray-700 bg-gray-950/65 px-3 py-2 text-xs text-gray-200"><span>{plannerLockLabel(lock, members)}</span><button type="button" aria-label={`Quitar lock ${plannerLockLabel(lock, members)}`} onClick={() => { invalidate(); setLocks(current => current.filter((_, itemIndex) => itemIndex !== index)) }} className="min-h-10 rounded-lg border border-red-500/30 px-3 font-bold text-red-300">Quitar</button></li>)}</ul>}
              <div className="mt-3 grid gap-2 rounded-xl border border-gray-800 p-3 sm:grid-cols-2 lg:grid-cols-5">
                <label className="text-xs text-gray-300">Tipo<select value={draft.type} onChange={event => setDraft(current => ({ ...current, type: event.target.value as PlannerLock['type'] }))} className="mt-1 min-h-11 w-full rounded-lg border border-gray-700 bg-gray-950 px-2"><option value="role">Rol</option><option value="character">Personaje</option><option value="assignment">Personaje + spec</option></select></label>
                <label className="text-xs text-gray-300">Participante<select value={draft.userId ?? ''} onChange={event => setDraft(current => ({ ...current, userId: Number(event.target.value) || null, characterId: null, specId: null }))} className="mt-1 min-h-11 w-full rounded-lg border border-gray-700 bg-gray-950 px-2"><option value="">Elegir…</option>{members.filter(member => participants.includes(member.userId)).map(member => <option key={member.userId} value={member.userId}>{member.username}</option>)}</select></label>
                {draft.type === 'role' ? <label className="text-xs text-gray-300">Rol<select value={draft.role} onChange={event => setDraft(current => ({ ...current, role: event.target.value as PlannerRole }))} className="mt-1 min-h-11 w-full rounded-lg border border-gray-700 bg-gray-950 px-2">{(Object.keys(ROLE_LABELS) as PlannerRole[]).map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></label>
                  : <><label className="text-xs text-gray-300">Personaje<select value={draft.characterId ?? ''} onChange={event => setDraft(current => ({ ...current, characterId: Number(event.target.value) || null, specId: null }))} className="mt-1 min-h-11 w-full rounded-lg border border-gray-700 bg-gray-950 px-2"><option value="">Elegir…</option>{draftCharacters.map(character => <option key={character.id} value={character.id}>{character.name}</option>)}</select></label>{draft.type === 'assignment' && <label className="text-xs text-gray-300">Especialización<select value={draft.specId ?? ''} disabled={!draftCharacter || draftSpecs.length === 0} onChange={event => setDraft(current => ({ ...current, specId: Number(event.target.value) || null }))} className="mt-1 min-h-11 w-full rounded-lg border border-gray-700 bg-gray-950 px-2 disabled:opacity-45"><option value="">Elegir…</option>{draftSpecs.map(spec => <option key={spec.id} value={spec.id}>{spec.name}</option>)}</select></label>}</>}
                <button type="button" onClick={addLock} disabled={!draft.userId || (draft.type !== 'role' && !draft.characterId) || (draft.type === 'assignment' && !draft.specId)} className="min-h-11 self-end rounded-lg border border-yellow-500/40 px-3 text-xs font-black text-yellow-300 disabled:opacity-40">Añadir lock</button>
              </div>
            </div>
          </details>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={event => { setPreferencesTrigger(event.currentTarget); setPreferencesOpen(true) }} className="min-h-11 rounded-xl border border-gray-700 px-4 text-sm font-bold text-gray-200">Configurar mis personajes</button>
            <button type="button" onClick={() => void calculate()} disabled={participants.length < 2 || loading} className="min-h-12 rounded-xl bg-yellow-500 px-6 text-sm font-black text-gray-950 shadow-lg shadow-yellow-500/10 disabled:cursor-not-allowed disabled:opacity-45">{loading ? 'Calculando…' : response ? 'Recalcular Top 3' : 'Calcular Top 3'}</button>
          </div>

          <div className="mt-5" aria-live="polite" aria-busy={loading}>
            {!loading && notice && <p role="status" className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{notice}</p>}
            {loading && <div className="grid gap-4 lg:grid-cols-3" aria-label="Calculando recomendaciones"><div className="h-52 animate-pulse rounded-2xl bg-gray-800 motion-reduce:animate-none" /><div className="h-52 animate-pulse rounded-2xl bg-gray-800 motion-reduce:animate-none" /><div className="h-52 animate-pulse rounded-2xl bg-gray-800 motion-reduce:animate-none" /></div>}
            {!loading && error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"><p>{error}</p><button type="button" onClick={() => void calculate()} className="mt-3 min-h-10 rounded-lg border border-red-400/40 px-3 text-xs font-bold">Reintentar</button></div>}
            {!loading && response && response.availability.eligibleStoneCount === 0 && <div className="rounded-xl border border-gray-700 bg-gray-900/50 p-5 text-center"><p className="font-bold text-gray-200">{challengeMapId === null ? 'No hay piedras disponibles' : 'No hay una piedra de esta mazmorra'}</p><p className="mt-2 text-xs text-gray-400">{challengeMapId === null ? 'Ninguno de los personajes seleccionados tiene actualmente una piedra válida para planificar.' : 'Ninguno de los jugadores seleccionados tiene actualmente esta piedra.'}</p></div>}
            {!loading && response && unconfigured.length > 0 && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"><p className="font-bold text-amber-100">Falta configurar: {unconfigured.map(item => item.username).join(', ')}</p>{unconfigured.some(item => item.userId === currentUserId) ? <button type="button" onClick={event => { setPreferencesTrigger(event.currentTarget); setPreferencesOpen(true) }} className="mt-3 min-h-10 rounded-lg border border-amber-400/50 px-3 text-xs font-black text-amber-100">Configurar mis personajes</button> : <p className="mt-2 text-xs text-amber-200">Cada compañero debe configurar sus propios personajes antes de calcular.</p>}</div>}
            {!loading && response && response.status === 'invalid_input' && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4"><ul className="space-y-1 text-sm text-red-200">{response.diagnostics.codes.map(code => <li key={code}>{PLANNER_DIAGNOSTIC_LABELS[code]}</li>)}{response.diagnostics.lockIssues.map(issue => <li key={issue}>{plannerLockIssueLabel(issue, members)}</li>)}</ul></div>}
            {!loading && response && response.status === 'no_valid_composition' && response.availability.eligibleStoneCount > 0 && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100"><p className="font-black">No encontramos una composición válida</p><p className="mt-1">{NO_COMPOSITION}</p></div>}
            {!loading && response?.status === 'ok' && <div className="grid gap-4">{response.recommendations.map(recommendation => <RecommendationCard key={recommendation.fingerprint} recommendation={recommendation} targetLevel={response.targetLevel} members={members} />)}</div>}
          </div>
        </div>
      </div>
      {preferencesOpen && <PlannerPreferencesDialog onClose={() => setPreferencesOpen(false)} onSaved={preferencesSaved} returnFocusElement={preferencesTrigger} />}
    </div>
  )
}
