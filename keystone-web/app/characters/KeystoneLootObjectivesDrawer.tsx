'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/auth'
import { MIDNIGHT_SEASON_2_DUNGEONS } from '@/lib/season2'
import { specName, specOptionsForClass } from '@/lib/wowSpecs'
import KeystoneLootObjectiveList from '@/app/components/KeystoneLootObjectiveList'
import {
  buildOwnerObjectivesPath,
  characterObjectiveTitle,
  createObjectiveRequestIdentity,
  formatObjectiveFreshness,
  isObjectiveRequestCurrent,
  mergeObjectivePages,
  ownerObjectiveStatusMessage,
  parseOwnerObjectivesResponse,
  type ObjectiveRequestIdentity,
  type OwnerObjectivesResponse,
} from '@/lib/keystoneLootObjectives'

export type OwnerObjectiveCharacter = {
  id: number
  name: string
  realm: string
  wowClass?: string | null
}

type Props = {
  character: OwnerObjectiveCharacter | null
  returnFocusElement: HTMLButtonElement | null
  onClose: () => void
}

export default function KeystoneLootObjectivesDrawer({ character, returnFocusElement, onClose }: Props) {
  const router = useRouter()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const activeController = useRef<AbortController | null>(null)
  const requestGeneration = useRef(0)
  const activeIdentity = useRef<ObjectiveRequestIdentity | null>(null)
  const [dungeonId, setDungeonId] = useState<number | null>(null)
  const [specId, setSpecId] = useState<number | null>(null)
  const [response, setResponse] = useState<OwnerObjectivesResponse | null>(null)
  const [observedSpecIds, setObservedSpecIds] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const specOptions = useMemo(() => {
    const options = new Map(specOptionsForClass(character?.wowClass).map(option => [option.id, option]))
    for (const id of observedSpecIds) options.set(id, { id, name: specName(id) })
    return [...options.values()].sort((a, b) => a.id - b.id)
  }, [character?.wowClass, observedSpecIds])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!character || !dialog || dialog.open) return
    dialog.showModal()
    closeButtonRef.current?.focus()
  }, [character])

  useEffect(() => () => {
    activeController.current?.abort()
    activeIdentity.current = null
    requestGeneration.current += 1
  }, [])

  const loadObjectives = useCallback(async (
    target: OwnerObjectiveCharacter,
    targetDungeonId: number | null,
    targetSpecId: number | null,
    cursor: string | null,
    append: boolean,
  ) => {
    activeController.current?.abort()
    const controller = new AbortController()
    activeController.current = controller
    const identity = createObjectiveRequestIdentity(
      target.id,
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
      const result = await apiFetch(buildOwnerObjectivesPath(target.id, {
        dungeonId: targetDungeonId,
        specId: targetSpecId,
        cursor,
      }), { signal: controller.signal })
      if (result.status === 401) {
        router.push('/login')
        return
      }
      if (result.status === 404) throw new Error('El personaje ya no está disponible.')
      if (result.status === 400) throw new Error('Los filtros solicitados no son válidos.')
      if (!result.ok) throw new Error('No se pudieron cargar los objetivos de KeystoneLoot.')

      const parsed = parseOwnerObjectivesResponse(await result.json())
      if (!parsed) throw new Error('La respuesta de KeystoneLoot no tiene un formato válido.')
      if (!isObjectiveRequestCurrent(identity, activeIdentity.current)) return

      setResponse(previous => mergeObjectivePages(previous, parsed, append))
      setObservedSpecIds(previous => [...new Set([
        ...previous,
        ...parsed.objectives.map(objective => objective.specId),
      ])])
    } catch (reason) {
      if (controller.signal.aborted || !isObjectiveRequestCurrent(identity, activeIdentity.current)) return
      setError(reason instanceof Error ? reason.message : 'No se pudieron cargar los objetivos de KeystoneLoot.')
    } finally {
      if (isObjectiveRequestCurrent(identity, activeIdentity.current)) {
        if (append) setLoadingMore(false)
        else setLoading(false)
      }
    }
  }, [router])

  useEffect(() => {
    if (!character) return
    const timer = window.setTimeout(() => {
      void loadObjectives(character, null, null, null, false)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [character, loadObjectives])

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
    if (!character) return
    const next = value ? Number(value) : null
    setDungeonId(next)
    setResponse(null)
    void loadObjectives(character, next, specId, null, false)
  }

  function changeSpec(value: string) {
    if (!character) return
    const next = value ? Number(value) : null
    setSpecId(next)
    setResponse(null)
    void loadObjectives(character, dungeonId, next, null, false)
  }

  if (!character) return null

  const freshness = response?.snapshot ? formatObjectiveFreshness(response.snapshot.updatedAt) : null
  const statusMessage = response ? ownerObjectiveStatusMessage(response.status) : null

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="keystone-loot-objectives-title"
      aria-describedby="keystone-loot-objectives-description"
      onCancel={event => { event.preventDefault(); closeDrawer() }}
      onClose={handleDialogClose}
      onClick={event => { if (event.target === dialogRef.current) closeDrawer() }}
      className="m-0 ml-auto h-dvh max-h-none w-full max-w-none overflow-hidden border-0 bg-gray-950 p-0 text-gray-100 shadow-2xl backdrop:bg-black/70 sm:max-w-xl"
    >
      <div className="flex h-full flex-col">
        <header className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950/95 px-4 py-4 backdrop-blur sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-yellow-400">KeystoneLoot</p>
              <h2 id="keystone-loot-objectives-title" className="mt-1 break-words text-xl font-semibold">
                {characterObjectiveTitle(character)}
              </h2>
              <p id="keystone-loot-objectives-description" className="mt-1 text-sm text-gray-400">
                Objetivos privados importados desde el addon.
              </p>
              {character.wowClass && <p className="mt-1 text-xs text-gray-500">{character.wowClass}</p>}
              {freshness && (
                <p className="mt-2 text-xs text-gray-400" title={freshness.exact}>
                  {freshness.relative}
                  {freshness.warning && <span className="ml-2 text-amber-300">· {freshness.warning}</span>}
                  {response?.snapshot && <span> · addon {response.snapshot.addonVersion}</span>}
                </p>
              )}
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeDrawer}
              aria-label="Cerrar objetivos"
              className="min-h-11 min-w-11 rounded border border-gray-700 text-xl text-gray-300 hover:border-gray-500 hover:text-white"
            >
              ×
            </button>
          </div>
        </header>

        <div className="overflow-y-auto px-4 py-5 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-gray-300">
              <span className="mb-1 block text-xs text-gray-500">Mazmorra</span>
              <select
                value={dungeonId ?? ''}
                onChange={event => changeDungeon(event.target.value)}
                className="min-h-11 w-full rounded border border-gray-700 bg-gray-900 px-3 text-gray-100"
              >
                <option value="">Todas</option>
                {MIDNIGHT_SEASON_2_DUNGEONS.map(dungeon => (
                  <option key={dungeon.id} value={dungeon.id}>{dungeon.name}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-gray-300">
              <span className="mb-1 block text-xs text-gray-500">Especialización</span>
              <select
                value={specId ?? ''}
                onChange={event => changeSpec(event.target.value)}
                className="min-h-11 w-full rounded border border-gray-700 bg-gray-900 px-3 text-gray-100"
              >
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
                <button
                  type="button"
                  onClick={() => void loadObjectives(character, dungeonId, specId, null, false)}
                  className="mt-3 min-h-11 rounded border border-red-700 px-4 hover:bg-red-900/40"
                >
                  Reintentar
                </button>
              </div>
            )}
            {!loading && !error && statusMessage && (
              <p className="rounded border border-gray-800 bg-gray-900/60 p-4 text-sm text-gray-300">{statusMessage}</p>
            )}
            {!loading && !error && response?.status === 'available' && (
              <>
                <KeystoneLootObjectiveList objectives={response.objectives} />
                {response.nextCursor && (
                  <button
                    type="button"
                    disabled={loadingMore}
                    onClick={() => void loadObjectives(character, dungeonId, specId, response.nextCursor, true)}
                    className="mt-4 min-h-11 w-full rounded border border-gray-700 px-4 text-sm text-gray-200 hover:border-gray-500 disabled:cursor-wait disabled:opacity-60"
                  >
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
