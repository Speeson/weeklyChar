'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/auth'
import {
  PLAY_PREFERENCE_LABELS,
  buildPlannerPreferencesPayload,
  parsePlannerCharacters,
  parsePlannerPreferencesResponse,
  plannerPreferenceRows,
  type PlannerCharacter,
  type PlannerPlayPreference,
  type PlannerPreferenceInput,
} from '@/lib/keystonePlanner'
import { specName, specOptionsForClass } from '@/lib/wowSpecs'

type Props = {
  onClose: () => void
  onSaved?: () => void
  returnFocusElement?: HTMLElement | null
}

const PREFERENCE_VALUES = Object.keys(PLAY_PREFERENCE_LABELS) as PlannerPlayPreference[]

export default function PlannerPreferencesDialog({ onClose, onSaved, returnFocusElement }: Props) {
  const router = useRouter()
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const [characters, setCharacters] = useState<PlannerCharacter[]>([])
  const [rows, setRows] = useState<PlannerPreferenceInput[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void Promise.all([
      apiFetch('/api/me/characters', { signal: controller.signal }),
      apiFetch('/api/me/planner/preferences', { signal: controller.signal }),
    ]).then(async ([characterResult, preferenceResult]) => {
      if (characterResult.status === 401 || preferenceResult.status === 401) {
        router.push('/login')
        return
      }
      if (!characterResult.ok || !preferenceResult.ok) throw new Error('No se pudo cargar tu configuración del Planner.')
      const parsedCharacters = parsePlannerCharacters(await characterResult.json())
      const parsedPreferences = parsePlannerPreferencesResponse(await preferenceResult.json())
      if (!parsedCharacters || !parsedPreferences) throw new Error('La configuración recibida no tiene un formato válido.')
      setCharacters(parsedCharacters)
      setRows(plannerPreferenceRows(parsedCharacters, parsedPreferences))
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'No se pudo cargar tu configuración del Planner.')
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [router])

  useEffect(() => {
    closeRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable.at(-1)!
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      returnFocusElement?.focus()
    }
  }, [onClose, returnFocusElement])

  const rowsByCharacter = useMemo(() => new Map(characters.map(character => [
    character.id, rows.filter(row => row.characterId === character.id),
  ])), [characters, rows])

  function updateRow(characterId: number, specId: number, changes: Partial<PlannerPreferenceInput>) {
    setRows(current => current.map(row => row.characterId === characterId && row.specId === specId
      ? { ...row, ...changes } : row))
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const result = await apiFetch('/api/me/planner/preferences', {
        method: 'PUT',
        body: JSON.stringify(buildPlannerPreferencesPayload(rows)),
      })
      if (result.status === 401) { router.push('/login'); return }
      if (!result.ok) {
        const data = await result.json().catch(() => null) as { detail?: string } | null
        throw new Error(data?.detail ?? 'No se pudieron guardar las preferencias.')
      }
      const parsed = parsePlannerPreferencesResponse(await result.json())
      if (!parsed) throw new Error('La respuesta de guardado no tiene un formato válido.')
      onSaved?.()
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudieron guardar las preferencias.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 px-3 py-4 backdrop-blur-sm">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="planner-preferences-title" className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-yellow-500/30 bg-gray-950 shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-gray-800 px-4 py-4 sm:px-6">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-yellow-500">Keystone Planner</p>
            <h2 id="planner-preferences-title" className="mt-1 text-xl font-black text-white">Mis preferencias de juego</h2>
            <p className="mt-1 text-xs text-gray-400">El guardado reemplaza tu configuración completa. Nada se activa automáticamente.</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Cerrar preferencias" className="min-h-11 min-w-11 rounded-lg border border-gray-700 text-xl text-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400">×</button>
        </header>

        <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6" aria-live="polite">
            {loading && <p className="py-12 text-center text-sm text-gray-400">Cargando preferencias…</p>}
            {!loading && error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
            {!loading && !error && characters.length === 0 && <p className="py-12 text-center text-sm text-gray-400">No tienes personajes sincronizados.</p>}
            {!loading && characters.length > 0 && (
              <div className="space-y-4">
                {characters.map(character => {
                  const options = specOptionsForClass(character.wowClass)
                  const characterRows = rowsByCharacter.get(character.id) ?? []
                  return (
                    <section key={character.id} className="rounded-xl border border-gray-800 bg-gray-900/45 p-4" aria-labelledby={`preference-character-${character.id}`}>
                      <div className="mb-3">
                        <h3 id={`preference-character-${character.id}`} className="font-black text-white">{character.name}</h3>
                        <p className="text-xs text-gray-400">{character.realm}{character.wowClass ? ` · ${character.wowClass}` : ''}</p>
                      </div>
                      {!character.wowClass || options.length === 0 ? (
                        <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-200">No se puede configurar todavía porque no tenemos una clase sincronizada para este personaje. Sincronízalo de nuevo con KeystoneClient.</p>
                      ) : (
                        <div className="grid gap-3 lg:grid-cols-2">
                          {characterRows.map(row => {
                            const lootOptions = specOptionsForClass(character.wowClass)
                            return (
                              <fieldset key={row.specId} className="rounded-lg border border-gray-800 bg-gray-950/65 p-3">
                                <legend className="px-1 text-sm font-bold text-gray-100">{specName(row.specId)}</legend>
                                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                                  <label className="text-xs font-semibold text-gray-300">
                                    Disponibilidad
                                    <select value={row.playPreference} onChange={event => updateRow(character.id, row.specId, { playPreference: event.target.value as PlannerPlayPreference })} className="mt-1 min-h-11 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400">
                                      {PREFERENCE_VALUES.map(value => <option key={value} value={value}>{PLAY_PREFERENCE_LABELS[value]}</option>)}
                                    </select>
                                  </label>
                                  {row.playPreference === 'disabled' ? <p className="self-end rounded-lg border border-gray-800 px-3 py-2 text-xs text-gray-500">Activa esta especialización para elegir objetivos de loot.</p> : <label className="text-xs font-semibold text-gray-300">
                                    Objetivos de loot
                                    <select value={row.lootSpecId} onChange={event => updateRow(character.id, row.specId, { lootSpecId: Number(event.target.value) })} className="mt-1 min-h-11 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400">
                                      {lootOptions.map(spec => <option key={spec.id} value={spec.id}>{spec.name}</option>)}
                                    </select>
                                  </label>}
                                </div>
                              </fieldset>
                            )
                          })}
                        </div>
                      )}
                    </section>
                  )
                })}
              </div>
            )}
          </div>
          <footer className="flex justify-end gap-3 border-t border-gray-800 bg-gray-950 px-4 py-4 sm:px-6">
            <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-gray-700 px-4 text-sm font-bold text-gray-300">Cancelar</button>
            <button type="submit" disabled={loading || saving || Boolean(error)} className="min-h-11 rounded-xl bg-yellow-500 px-5 text-sm font-black text-gray-950 disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar configuración'}</button>
          </footer>
        </form>
      </div>
    </div>
  )
}
