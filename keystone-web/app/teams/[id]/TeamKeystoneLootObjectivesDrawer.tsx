'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/auth'
import KeystoneLootObjectiveList from '@/app/components/KeystoneLootObjectiveList'
import { MIDNIGHT_SEASON_2_DUNGEONS } from '@/lib/season2'
import { specName, specOptionsForClass } from '@/lib/wowSpecs'
import {
  buildTeamObjectivesPath,
  characterObjectiveTitle,
  createTeamObjectiveRequestIdentity,
  formatObjectiveFreshness,
  isTeamObjectiveRequestCurrent,
  mergeTeamObjectivePages,
  parseTeamObjectivesResponse,
  teamObjectiveStatusMessage,
  teamObjectiveRequestErrorMessage,
  type TeamObjectiveRequestIdentity,
  type TeamObjectivesResponse,
} from '@/lib/keystoneLootObjectives'

export type TeamObjectiveTarget = {
  memberUsername: string
  character: {
    id: number
    name: string
    realm: string
    wowClass?: string | null
  }
}

type Props = {
  teamId: number
  target: TeamObjectiveTarget
  returnFocusElement: HTMLButtonElement | null
  onClose: () => void
}

export default function TeamKeystoneLootObjectivesDrawer({ teamId, target, returnFocusElement, onClose }: Props) {
  const router = useRouter()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const activeController = useRef<AbortController | null>(null)
  const requestGeneration = useRef(0)
  const activeIdentity = useRef<TeamObjectiveRequestIdentity | null>(null)
  const [dungeonId, setDungeonId] = useState<number | null>(null)
  const [specId, setSpecId] = useState<number | null>(null)
  const [response, setResponse] = useState<TeamObjectivesResponse | null>(null)
  const [observedSpecIds, setObservedSpecIds] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const specOptions = useMemo(() => {
    const options = new Map(specOptionsForClass(target.character.wowClass).map(option => [option.id, option]))
    for (const id of observedSpecIds) options.set(id, { id, name: specName(id) })
    return [...options.values()].sort((left, right) => left.id - right.id)
  }, [observedSpecIds, target.character.wowClass])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || dialog.open) return
    dialog.showModal()
    closeButtonRef.current?.focus()
  }, [])

  useEffect(() => () => {
    activeController.current?.abort()
    activeIdentity.current = null
    requestGeneration.current += 1
  }, [])

  const loadObjectives = useCallback(async (
    targetDungeonId: number | null,
    targetSpecId: number | null,
    cursor: string | null,
    append: boolean,
  ) => {
    activeController.current?.abort()
    const controller = new AbortController()
    activeController.current = controller
    const identity = createTeamObjectiveRequestIdentity(
      teamId,
      target.character.id,
      targetDungeonId,
      targetSpecId,
      cursor,
      ++requestGeneration.current,
    )
    activeIdentity.current = identity
    if (append) setLoadingMore(true)
    else setLoading(true)
    setError(null)

    try {
      const res = await apiFetch(buildTeamObjectivesPath(teamId, target.character.id, {
        dungeonId: targetDungeonId,
        specId: targetSpecId,
        cursor,
      }), { signal: controller.signal })
      if (!isTeamObjectiveRequestCurrent(identity, activeIdentity.current)) return
      if (res.status === 401) {
        setResponse(null)
        router.push('/login')
        throw new Error('Tu sesión ha caducado.')
      }
      if (res.status === 403) {
        setResponse(null)
        throw new Error('Ya no tienes acceso a los objetivos de este equipo.')
      }
      if (res.status === 404) {
        setResponse(null)
        throw new Error('El personaje ya no está disponible en este equipo.')
      }
      if (res.status === 400) throw new Error('Los filtros solicitados no son válidos.')
      if (!res.ok) throw new Error('No se pudieron cargar los objetivos.')

      const parsed = parseTeamObjectivesResponse(await res.json())
      if (!parsed) throw new Error('No se pudieron cargar los objetivos.')
      if (!isTeamObjectiveRequestCurrent(identity, activeIdentity.current)) return
      setResponse(previous => mergeTeamObjectivePages(previous, parsed, append))
      if (parsed.status === 'available') {
        setObservedSpecIds(previous => [...new Set([
          ...previous,
          ...parsed.objectives.map(objective => objective.specId),
        ])])
      }
    } catch (reason) {
      if (controller.signal.aborted || !isTeamObjectiveRequestCurrent(identity, activeIdentity.current)) return
      setError(teamObjectiveRequestErrorMessage(reason))
    } finally {
      if (isTeamObjectiveRequestCurrent(identity, activeIdentity.current)) {
        if (append) setLoadingMore(false)
        else setLoading(false)
      }
    }
  }, [router, target.character.id, teamId])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadObjectives(null, null, null, false), 0)
    return () => window.clearTimeout(timer)
  }, [loadObjectives])

  function closeDrawer() {
    activeController.current?.abort()
    activeIdentity.current = null
    requestGeneration.current += 1
    dialogRef.current?.close()
  }

  function handleDialogClose() {
    onClose()
    requestAnimationFrame(() => returnFocusElement?.focus())
  }

  function changeDungeon(value: string) {
    const next = value ? Number(value) : null
    setDungeonId(next)
    setResponse(null)
    void loadObjectives(next, specId, null, false)
  }

  function changeSpec(value: string) {
    const next = value ? Number(value) : null
    setSpecId(next)
    setResponse(null)
    void loadObjectives(dungeonId, next, null, false)
  }

  const freshness = response?.status === 'available'
    ? formatObjectiveFreshness(response.updatedAt)
    : null
  const statusMessage = response ? teamObjectiveStatusMessage(response.status) : null

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="team-keystone-loot-objectives-title"
      aria-describedby="team-keystone-loot-objectives-description"
      onCancel={event => { event.preventDefault(); closeDrawer() }}
      onClose={handleDialogClose}
      onClick={event => { if (event.target === dialogRef.current) closeDrawer() }}
      className="m-0 ml-auto h-dvh max-h-none w-full max-w-none overflow-hidden border-0 bg-gray-950 p-0 text-gray-100 shadow-2xl backdrop:bg-black/70 sm:max-w-xl"
    >
      <div className="flex h-full flex-col">
        <header className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950/95 px-4 py-4 backdrop-blur sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-yellow-400">{target.memberUsername} · KeystoneLoot</p>
              <h2 id="team-keystone-loot-objectives-title" className="mt-1 break-words text-xl font-semibold">
                {characterObjectiveTitle(target.character)}
              </h2>
              <p id="team-keystone-loot-objectives-description" className="mt-1 text-sm text-gray-400">
                Objetivos compartidos con este equipo.
              </p>
              {target.character.wowClass && <p className="mt-1 text-xs text-gray-500">{target.character.wowClass}</p>}
              {freshness && (
                <p className="mt-2 text-xs text-gray-400" title={freshness.exact}>
                  {freshness.relative}
                  {freshness.warning && <span className="ml-2 text-amber-300">· {freshness.warning}</span>}
                </p>
              )}
            </div>
            <button ref={closeButtonRef} type="button" onClick={closeDrawer} aria-label="Cerrar objetivos" className="min-h-11 min-w-11 rounded border border-gray-700 text-xl text-gray-300 hover:border-gray-500 hover:text-white">×</button>
          </div>
        </header>

        <div className="overflow-y-auto px-4 py-5 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-gray-300">
              <span className="mb-1 block text-xs text-gray-500">Mazmorra</span>
              <select value={dungeonId ?? ''} onChange={event => changeDungeon(event.target.value)} className="min-h-11 w-full rounded border border-gray-700 bg-gray-900 px-3 text-gray-100">
                <option value="">Todas</option>
                {MIDNIGHT_SEASON_2_DUNGEONS.map(dungeon => <option key={dungeon.id} value={dungeon.id}>{dungeon.name}</option>)}
              </select>
            </label>
            <label className="text-sm text-gray-300">
              <span className="mb-1 block text-xs text-gray-500">Especialización</span>
              <select value={specId ?? ''} onChange={event => changeSpec(event.target.value)} className="min-h-11 w-full rounded border border-gray-700 bg-gray-900 px-3 text-gray-100">
                <option value="">Todas</option>
                {specOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
              </select>
            </label>
          </div>

          <div aria-live="polite" className="mt-5">
            {loading && <p className="py-10 text-center text-sm text-gray-400">Cargando objetivos...</p>}
            {!loading && error && (
              <div className="rounded border border-red-900/70 bg-red-950/30 p-4 text-sm text-red-200">
                <p>{error}</p>
                <button type="button" onClick={() => void loadObjectives(dungeonId, specId, null, false)} className="mt-3 min-h-11 rounded border border-red-700 px-4 hover:bg-red-900/40">Reintentar</button>
              </div>
            )}
            {!loading && !error && statusMessage && <p className="rounded border border-gray-800 bg-gray-900/60 p-4 text-sm text-gray-300">{statusMessage}</p>}
            {!loading && !error && response?.status === 'available' && (
              <>
                <KeystoneLootObjectiveList objectives={response.objectives} />
                {response.nextCursor && (
                  <button type="button" disabled={loadingMore} onClick={() => void loadObjectives(dungeonId, specId, response.nextCursor, true)} className="mt-4 min-h-11 w-full rounded border border-gray-700 px-4 text-sm text-gray-200 hover:border-gray-500 disabled:cursor-wait disabled:opacity-60">
                    {loadingMore ? 'Cargando...' : 'Cargar más'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </dialog>
  )
}
