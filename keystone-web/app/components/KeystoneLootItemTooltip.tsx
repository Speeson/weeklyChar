'use client'

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { DUNGEON_NAME_BY_ID } from '@/lib/season2'
import { specName } from '@/lib/wowSpecs'
import {
  objectiveItemName,
  objectiveSourceLabel,
  tierPresentation,
  voidcorePresentation,
  type KeystoneLootVoidcoreState,
} from '@/lib/keystoneLootObjectives'

export type KeystoneLootTooltipItem = {
  itemId: number
  itemName: string | null
  iconUrl: string | null
  tier: number
  sourceType: string
  sourceId: number | string
  slotName: string | null
  itemClassName: string | null
  itemSubClassName: string | null
  statNames: readonly string[]
  voidcoreState: KeystoneLootVoidcoreState
  specId?: number
  specIds?: readonly number[]
}

type TooltipPosition = { left: number; top: number }

const TOOLTIP_WIDTH = 320
const VIEWPORT_MARGIN = 12

export default function KeystoneLootItemTooltip({
  objective,
  children,
  triggerClassName = '',
}: {
  objective: KeystoneLootTooltipItem
  children: ReactNode
  triggerClassName?: string
}) {
  const tooltipId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [position, setPosition] = useState<TooltipPosition | null>(null)

  const close = useCallback(() => {
    setOpen(false)
    setPinned(false)
  }, [])

  const place = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const tooltipHeight = tooltipRef.current?.offsetHeight ?? 280
    const left = Math.min(
      window.innerWidth - TOOLTIP_WIDTH - VIEWPORT_MARGIN,
      Math.max(VIEWPORT_MARGIN, rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2),
    )
    const below = rect.bottom + 10
    const top = below + tooltipHeight <= window.innerHeight - VIEWPORT_MARGIN
      ? below
      : Math.max(VIEWPORT_MARGIN, rect.top - tooltipHeight - 10)
    setPosition({ left, top })
  }, [])

  useEffect(() => {
    if (!open) return
    place()
    const frame = requestAnimationFrame(place)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, place])

  useEffect(() => {
    if (!open) return
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        close()
        triggerRef.current?.focus()
      }
    }
    function handlePointer(event: PointerEvent) {
      const target = event.target as Node
      if (!triggerRef.current?.contains(target) && !tooltipRef.current?.contains(target)) close()
    }
    document.addEventListener('keydown', handleKey)
    document.addEventListener('pointerdown', handlePointer)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('pointerdown', handlePointer)
    }
  }, [close, open])

  const itemName = objectiveItemName(objective)
  const tier = tierPresentation(objective.tier)
  const voidcore = voidcorePresentation(objective.voidcoreState)
  const source = objectiveSourceLabel(objective, DUNGEON_NAME_BY_ID)
  const specs = objective.specIds ?? (objective.specId ? [objective.specId] : [])
  const armorLine = [objective.slotName, objective.itemSubClassName].filter(Boolean).join(' · ')

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Detalles de ${itemName}`}
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={() => { setOpen(true); place() }}
        onMouseLeave={() => { if (!pinned) setOpen(false) }}
        onFocus={() => { setOpen(true); place() }}
        onBlur={event => {
          if (!pinned && !tooltipRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false)
        }}
        onClick={() => {
          setPinned(value => {
            const next = !value
            setOpen(next)
            return next
          })
        }}
        className={`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 ${triggerClassName}`}
      >
        {children}
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          className="fixed z-[100] w-80 max-w-[calc(100vw-24px)] rounded-xl border border-yellow-500/40 bg-gray-950 p-4 text-left text-gray-100 shadow-2xl shadow-black/70"
          style={position ?? { left: VIEWPORT_MARGIN, top: VIEWPORT_MARGIN }}
        >
          <div className="flex items-start gap-3">
            {objective.iconUrl ? (
              <span
                role="img"
                aria-label={`Icono de ${itemName}`}
                className="h-12 w-12 shrink-0 rounded-lg border border-yellow-500/30 bg-cover bg-center"
                style={{ backgroundImage: `url(${objective.iconUrl})` }}
              />
            ) : (
              <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-gray-700 bg-gray-900 text-lg text-gray-500">?</span>
            )}
            <div className="min-w-0">
              <p className="break-words font-bold leading-5 text-white">{itemName}</p>
              {armorLine && <p className="mt-1 text-sm text-gray-300">{armorLine}</p>}
              {objective.itemClassName && <p className="mt-0.5 text-xs text-gray-500">{objective.itemClassName}</p>}
              {!armorLine && !objective.itemClassName && objective.statNames.length === 0 && (
                <p className="mt-1 text-xs text-gray-500">Metadatos no disponibles</p>
              )}
            </div>
          </div>

          {objective.statNames.length > 0 && (
            <div className="mt-4 border-t border-gray-800 pt-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-yellow-400">Estadísticas</p>
              <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-300">
                {objective.statNames.map(stat => <li key={stat}>· {stat}</li>)}
              </ul>
            </div>
          )}

          <div className="mt-4 space-y-1 border-t border-gray-800 pt-3 text-xs">
            <p className="text-gray-300">{source}</p>
            {specs.length > 0 && <p className="text-gray-400">{specs.map(specName).join(' · ')}</p>}
            <p><span className={`inline-flex rounded border px-2 py-0.5 ${tier.tone}`}>{tier.label}</span></p>
            <p className={voidcore.tone}>{voidcore.label}</p>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
