'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/auth'
import KeystoneLootObjectiveList from '@/app/components/KeystoneLootObjectiveList'
import { specName } from '@/lib/wowSpecs'
import {
  buildTeamObjectivesPath,
  createTeamObjectiveRequestIdentity,
  isTeamObjectiveRequestCurrent,
  mergeTeamObjectivePages,
  parseTeamObjectivesResponse,
  teamObjectiveStatusMessage,
  teamObjectiveRequestErrorMessage,
  type TeamObjectiveRequestIdentity,
  type TeamObjectivesResponse,
} from '@/lib/keystoneLootObjectives'

export type PlannerObjectiveTarget = {
  memberUsername: string
  characterId: number
  character: string
  realm: string
  specId: number
  challengeMapId: number
  dungeonName: string
}

type Props = {
  teamId: number
  target: PlannerObjectiveTarget
  returnFocusElement: HTMLButtonElement | null
  onBack: () => void
}

export default function KeystonePlannerObjectivePanel({ teamId, target, returnFocusElement, onBack }: Props) {
  const router = useRouter()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const activeController = useRef<AbortController | null>(null)
  const requestGeneration = useRef(0)
  const activeIdentity = useRef<TeamObjectiveRequestIdentity | null>(null)
  const [response, setResponse] = useState<TeamObjectivesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  useEffect(() => () => {
    activeController.current?.abort()
    activeIdentity.current = null
    requestGeneration.current += 1
  }, [])

  const loadObjectives = useCallback(async (cursor: string | null, append: boolean) => {
    activeController.current?.abort()
    const controller = new AbortController()
    activeController.current = controller
    const identity = createTeamObjectiveRequestIdentity(
      teamId,
      target.characterId,
      target.challengeMapId,
      target.specId,
      cursor,
      ++requestGeneration.current,
    )
    activeIdentity.current = identity
    if (append) setLoadingMore(true)
    else setLoading(true)
    setError(null)

    try {
      const res = await apiFetch(buildTeamObjectivesPath(teamId, target.characterId, {
        dungeonId: target.challengeMapId,
        specId: target.specId,
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
      if (res.status === 400) throw new Error('La selección ya no es válida.')
      if (!res.ok) throw new Error('No se pudieron cargar los objetivos.')

      const parsed = parseTeamObjectivesResponse(await res.json())
      if (!parsed) throw new Error('No se pudieron cargar los objetivos.')
      if (!isTeamObjectiveRequestCurrent(identity, activeIdentity.current)) return
      setResponse(previous => mergeTeamObjectivePages(previous, parsed, append))
    } catch (reason) {
      if (controller.signal.aborted || !isTeamObjectiveRequestCurrent(identity, activeIdentity.current)) return
      setError(teamObjectiveRequestErrorMessage(reason))
    } finally {
      if (isTeamObjectiveRequestCurrent(identity, activeIdentity.current)) {
        if (append) setLoadingMore(false)
        else setLoading(false)
      }
    }
  }, [router, target.challengeMapId, target.characterId, target.specId, teamId])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadObjectives(null, false), 0)
    return () => window.clearTimeout(timer)
  }, [loadObjectives])

  function back() {
    activeController.current?.abort()
    activeIdentity.current = null
    requestGeneration.current += 1
    onBack()
    requestAnimationFrame(() => returnFocusElement?.focus())
  }

  const statusMessage = response ? teamObjectiveStatusMessage(response.status) : null

  return (
    <aside aria-labelledby="planner-objectives-title" className="min-w-0 rounded-xl border border-yellow-500/25 bg-gray-950/80 p-4 lg:sticky lg:top-0 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto">
      <div className="flex items-start justify-between gap-3 border-b border-gray-800 pb-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-yellow-400">{target.memberUsername}</p>
          <h3 ref={headingRef} tabIndex={-1} id="planner-objectives-title" className="mt-1 break-words text-lg font-black text-white focus:outline-none">
            {target.character} — {target.realm}
          </h3>
          <p className="mt-1 break-words text-sm text-gray-300">{specName(target.specId)} · {target.dungeonName}</p>
          <p className="mt-1 text-xs text-gray-500">Los objetivos completados con Voidcore siguen visibles, pero no puntúan en la recomendación.</p>
        </div>
        <button type="button" onClick={back} className="hidden min-h-11 rounded border border-gray-700 px-3 text-xs font-bold text-gray-300 hover:border-gray-500 hover:text-white lg:inline-flex lg:items-center">
          Cerrar detalle
        </button>
      </div>

      <button type="button" onClick={back} className="mt-3 inline-flex min-h-11 items-center rounded border border-gray-700 px-3 text-sm font-bold text-gray-200 hover:border-yellow-500/60 hover:text-yellow-300 lg:hidden">
        ← Volver
      </button>

      <div aria-live="polite" className="mt-4">
        {loading && <p className="py-8 text-center text-sm text-gray-400">Cargando objetivos...</p>}
        {!loading && error && (
          <div role="alert" className="rounded border border-red-900/70 bg-red-950/30 p-4 text-sm text-red-200">
            <p>{error}</p>
            <button type="button" onClick={() => void loadObjectives(null, false)} className="mt-3 min-h-11 rounded border border-red-700 px-4 hover:bg-red-900/40">Reintentar</button>
          </div>
        )}
        {!loading && !error && statusMessage && <p className="rounded border border-gray-800 bg-gray-900/60 p-4 text-sm text-gray-300">{statusMessage}</p>}
        {!loading && !error && response?.status === 'available' && (
          <>
            <KeystoneLootObjectiveList objectives={response.objectives} showContext={false} />
            {response.nextCursor && (
              <button type="button" disabled={loadingMore} onClick={() => void loadObjectives(response.nextCursor, true)} className="mt-4 min-h-11 w-full rounded border border-gray-700 px-4 text-sm text-gray-200 hover:border-gray-500 disabled:cursor-wait disabled:opacity-60">
                {loadingMore ? 'Cargando...' : 'Cargar más'}
              </button>
            )}
          </>
        )}
      </div>
    </aside>
  )
}
