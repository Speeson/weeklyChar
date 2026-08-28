'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/auth'
import { keystoneColor } from '@/lib/colors'
import {
  DUNGEON_ABBR_BY_ID,
  DUNGEON_ABBR_BY_NAME,
  MIDNIGHT_SEASON_2_DUNGEONS,
} from '@/lib/season2'
import {
  deriveAvailableStones,
  formatRecommendationSummary,
  parseTeamRecommendationsResponse,
  type AvailableStone,
  type MemberRecommendation,
  type PlannerMember,
  type TeamRecommendationsResponse,
} from '@/lib/keystoneRecommendations'
import { specName } from '@/lib/wowSpecs'

type KeystonePlannerProps = {
  teamId: number
  teamName: string
  currentUserId: number
  members: PlannerMember[]
  onRecommendationsChange: (response: TeamRecommendationsResponse | null) => void
}

function stoneDungeonName(stone: AvailableStone): string {
  if (stone.dungeon) return stone.dungeon
  return MIDNIGHT_SEASON_2_DUNGEONS.find(dungeon => dungeon.id === stone.challengeMapId)?.name
    ?? `ID ${stone.challengeMapId}`
}

function stoneDungeonAbbr(stone: AvailableStone): string | null {
  return DUNGEON_ABBR_BY_ID.get(stone.challengeMapId)
    ?? (stone.dungeon ? DUNGEON_ABBR_BY_NAME.get(stone.dungeon.toLowerCase()) : null)
    ?? null
}

function Avatar({ url, name, size = 'md' }: { url: string | null; name: string; size?: 'sm' | 'md' }) {
  const dimensions = size === 'sm' ? 'h-10 w-10' : 'h-12 w-12'
  if (url) {
    return (
      <span
        role="img"
        aria-label={`Avatar de ${name}`}
        className={`${dimensions} flex-shrink-0 rounded-full border border-gray-700 bg-cover bg-center`}
        style={{ backgroundImage: `url(${JSON.stringify(url).slice(1, -1)})` }}
      />
    )
  }
  return (
    <span aria-hidden="true" className={`${dimensions} flex flex-shrink-0 items-center justify-center rounded-full border border-gray-700 bg-gray-900 font-black text-yellow-300`}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

function StoneOption({
  stone,
  selected,
  disabled,
  onSelect,
}: {
  stone: AvailableStone
  selected: boolean
  disabled: boolean
  onSelect: () => void
}) {
  const abbr = stoneDungeonAbbr(stone)
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={`min-h-28 rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 disabled:cursor-wait disabled:opacity-65 ${selected ? 'border-yellow-400 bg-yellow-500/10 shadow-lg shadow-yellow-500/10' : 'border-gray-800 bg-gray-900/70 hover:border-yellow-500/50 hover:bg-gray-900'}`}
    >
      <div className="flex items-center gap-3">
        <Avatar url={stone.avatarUrl} name={stone.character} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate font-bold text-white">{stone.character}</p>
            <span className="flex-shrink-0 text-lg font-black tabular-nums" style={{ color: keystoneColor(stone.level) }}>+{stone.level}</span>
          </div>
          <p className="truncate text-xs text-gray-400">{stone.realm} · {stone.wowClass ?? 'Clase sin datos'}</p>
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-200">{stoneDungeonName(stone)}</p>
          <p className="mt-0.5 truncate text-xs text-gray-500">Piedra de {stone.memberUsername}</p>
        </div>
        {abbr && <span className="rounded-md border border-yellow-500/30 bg-gray-950 px-2 py-1 text-[11px] font-black text-yellow-300">{abbr}</span>}
      </div>
      {selected && <span className="mt-3 block text-xs font-bold text-yellow-300">Seleccionada</span>}
    </button>
  )
}

function StatusCard({ member, currentUserId }: { member: MemberRecommendation; currentUserId: number }) {
  if (member.status === 'recommended' && member.recommended) {
    const recommended = member.recommended
    const summary = formatRecommendationSummary(recommended.summary)
    return (
      <article className="rounded-xl border border-yellow-500/30 bg-yellow-500/[0.06] p-4 shadow-lg shadow-black/20">
        <p className="text-xs font-bold uppercase tracking-wide text-yellow-300">{member.username}</p>
        <div className="mt-3 flex items-center gap-3">
          <Avatar url={recommended.avatarUrl} name={recommended.character} />
          <div className="min-w-0">
            <p className="truncate text-lg font-black text-white">{recommended.character}</p>
            <p className="truncate text-sm text-gray-300">{specName(recommended.specId)} · {recommended.realm}</p>
            <p className="mt-0.5 text-xs text-gray-500">{recommended.wowClass ?? 'Clase sin datos'}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-300">
          {recommended.ilvl !== null && <span className="rounded-md border border-gray-800 bg-gray-950 px-2 py-1">ilvl {recommended.ilvl}</span>}
          {recommended.rioScore !== null && <span className="rounded-md border border-gray-800 bg-gray-950 px-2 py-1">Raider.IO {recommended.rioScore}</span>}
        </div>
        <p className="mt-4 font-semibold text-gray-100">{summary || 'Objetivos puntuables disponibles'}</p>
        {recommended.summary.voidcoreExcluded > 0 && (
          <p className="mt-2 text-xs leading-5 text-gray-400">
            {recommended.summary.voidcoreExcluded === 1
              ? '1 objetivo ya completado con Voidcore no cuenta para la recomendación.'
              : `${recommended.summary.voidcoreExcluded} objetivos ya completados con Voidcore no cuentan para la recomendación.`}
          </p>
        )}
      </article>
    )
  }

  const message = member.status === 'sharing_disabled'
    ? 'Este miembro ha desactivado el uso de su wishlist de KeystoneLoot para equipos.'
    : member.status === 'no_keystoneloot'
      ? 'No hay datos compatibles de KeystoneLoot sincronizados para este miembro.'
      : 'No tiene objetivos pendientes de KeystoneLoot para esta mazmorra.'

  return (
    <article className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
      <p className="font-bold text-gray-100">{member.username}</p>
      <p className="mt-2 text-sm leading-6 text-gray-400">{message}</p>
      {member.status === 'sharing_disabled' && member.userId === currentUserId && (
        <Link href="/settings" className="mt-3 inline-flex min-h-9 items-center rounded-lg border border-yellow-500/30 px-3 text-xs font-bold text-yellow-300 transition hover:border-yellow-400 hover:text-yellow-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400">
          Cambiar en Ajustes
        </Link>
      )}
    </article>
  )
}

export default function KeystonePlanner({
  teamId,
  teamName,
  currentUserId,
  members,
  onRecommendationsChange,
}: KeystonePlannerProps) {
  const router = useRouter()
  const stones = useMemo(() => deriveAvailableStones(members), [members])
  const [plannerOpen, setPlannerOpen] = useState(false)
  const [selectedStone, setSelectedStone] = useState<AvailableStone | null>(null)
  const [recommendations, setRecommendations] = useState<TeamRecommendationsResponse | null>(null)
  const [recommendationLoading, setRecommendationLoading] = useState(false)
  const [recommendationError, setRecommendationError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const requestGeneration = useRef(0)
  const activeRequest = useRef<AbortController | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (plannerOpen && !dialog.open) dialog.showModal()
    if (!plannerOpen && dialog.open) dialog.close()
  }, [plannerOpen])

  useEffect(() => () => {
    requestGeneration.current += 1
    activeRequest.current?.abort()
  }, [])

  function closePlanner() {
    setPlannerOpen(false)
    window.requestAnimationFrame(() => triggerRef.current?.focus())
  }

  async function requestRecommendations(stone: AvailableStone, force = false) {
    if (!force && recommendationLoading && selectedStone?.characterId === stone.characterId) return
    if (!force && recommendations?.challengeMapId === stone.challengeMapId
      && selectedStone?.characterId === stone.characterId && !recommendationError) return

    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    const generation = requestGeneration.current + 1
    requestGeneration.current = generation
    setSelectedStone(stone)
    setRecommendations(null)
    onRecommendationsChange(null)
    setRecommendationError(null)
    setRecommendationLoading(true)

    try {
      const res = await apiFetch(`/api/teams/${teamId}/recommendations?challengeMapId=${stone.challengeMapId}`, {
        signal: controller.signal,
      })
      if (generation !== requestGeneration.current) return
      if (res.status === 401) {
        router.push('/login')
        throw new Error('Tu sesión ha caducado. Vuelve a iniciar sesión.')
      }
      if (res.status === 403) throw new Error('Ya no tienes acceso a las recomendaciones de este equipo.')
      if (res.status === 404) throw new Error('El equipo ya no está disponible.')
      if (res.status === 400) throw new Error('La piedra seleccionada ya no es válida.')
      if (!res.ok) throw new Error('No se pudieron calcular las recomendaciones.')

      const data = parseTeamRecommendationsResponse(await res.json(), teamId, stone.challengeMapId)
      if (!data) {
        throw new Error('La respuesta de recomendaciones no corresponde a la piedra seleccionada.')
      }
      if (generation !== requestGeneration.current) return
      setRecommendations(data)
      onRecommendationsChange(data)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      if (generation !== requestGeneration.current) return
      setRecommendationError(error instanceof Error ? error.message : 'No se pudieron calcular las recomendaciones.')
    } finally {
      if (generation === requestGeneration.current) setRecommendationLoading(false)
    }
  }

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setPlannerOpen(true)}
          disabled={stones.length === 0}
          aria-haspopup="dialog"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-yellow-400 bg-yellow-500 px-4 py-2 text-sm font-black text-gray-950 shadow-lg shadow-yellow-500/10 transition hover:bg-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-200 disabled:cursor-not-allowed disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-500 disabled:shadow-none"
        >
          Planificar piedra
        </button>
        {stones.length === 0 && <p className="max-w-56 text-right text-[11px] leading-4 text-gray-500">No hay piedras actuales disponibles en este equipo.</p>}
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby="keystone-planner-title"
        aria-describedby="keystone-planner-description"
        onCancel={event => {
          event.preventDefault()
          closePlanner()
        }}
        onClose={() => setPlannerOpen(false)}
        onClick={event => {
          if (event.target === event.currentTarget) closePlanner()
        }}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-5xl overflow-y-auto rounded-2xl border border-yellow-500/30 bg-gray-950 p-0 text-gray-100 shadow-2xl shadow-black backdrop:bg-black/75 backdrop:backdrop-blur-sm"
      >
        <div className="p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4 border-b border-gray-800 pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-400">{teamName}</p>
              <h2 id="keystone-planner-title" className="mt-2 text-2xl font-black text-white">Planificar piedra</h2>
              <p id="keystone-planner-description" className="mt-1 max-w-2xl text-sm leading-6 text-gray-400">
                Elige una piedra actual del equipo. KeystoneSync pedirá al servidor una recomendación por miembro para esa mazmorra.
              </p>
            </div>
            <button
              type="button"
              onClick={closePlanner}
              className="min-h-10 rounded-lg border border-gray-700 px-3 text-sm font-semibold text-gray-300 transition hover:border-gray-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
            >
              Cerrar
            </button>
          </div>

          <section className="mt-5" aria-labelledby="keystone-stones-title">
            <h3 id="keystone-stones-title" className="font-bold text-gray-100">Elige una piedra del equipo</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {stones.map(stone => (
                <StoneOption
                  key={`${stone.memberUserId}:${stone.characterId}`}
                  stone={stone}
                  selected={selectedStone?.characterId === stone.characterId}
                  disabled={recommendationLoading && selectedStone?.characterId === stone.characterId}
                  onSelect={() => requestRecommendations(stone)}
                />
              ))}
            </div>
          </section>

          {selectedStone && (
            <section className="mt-6 rounded-xl border border-gray-800 bg-gray-900/55 p-4" aria-labelledby="selected-stone-title">
              <p id="selected-stone-title" className="text-xs font-bold uppercase tracking-wide text-gray-500">Piedra seleccionada</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar url={selectedStone.avatarUrl} name={selectedStone.character} size="sm" />
                  <div className="min-w-0">
                    <p className="font-black leading-5 text-white">{selectedStone.character} · {stoneDungeonName(selectedStone)}{stoneDungeonAbbr(selectedStone) ? ` (${stoneDungeonAbbr(selectedStone)})` : ''}</p>
                    <p className="text-sm text-gray-400">Piedra de {selectedStone.memberUsername} · {selectedStone.realm}</p>
                  </div>
                </div>
                <span className="text-2xl font-black tabular-nums" style={{ color: keystoneColor(selectedStone.level) }}>+{selectedStone.level}</span>
              </div>
              <p className="mt-3 text-xs text-gray-500">La recomendación usa la identidad de la mazmorra; el nivel se muestra solo como contexto de la piedra real.</p>
            </section>
          )}

          <div className="mt-6" aria-live="polite" aria-busy={recommendationLoading}>
            {recommendationLoading && (
              <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/[0.05] px-4 py-5 text-center text-sm text-yellow-200">
                Calculando recomendaciones...
              </div>
            )}
            {!recommendationLoading && recommendationError && selectedStone && (
              <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                <p className="text-sm text-red-200">{recommendationError}</p>
                <button
                  type="button"
                  onClick={() => requestRecommendations(selectedStone, true)}
                  className="mt-3 min-h-10 rounded-lg border border-red-400/40 px-3 text-xs font-bold text-red-200 transition hover:border-red-300 hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                >
                  Reintentar
                </button>
              </div>
            )}
            {!recommendationLoading && recommendations && (
              <section aria-labelledby="recommendations-title">
                <div className="mb-3">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-400">Resultado del servidor</p>
                  <h3 id="recommendations-title" className="mt-1 text-xl font-black text-white">Composición recomendada</h3>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {recommendations.members.map(member => (
                    <StatusCard key={member.userId} member={member} currentUserId={currentUserId} />
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </dialog>
    </>
  )
}
