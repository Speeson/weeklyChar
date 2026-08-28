'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface Affix {
  id: number
  name: string
  description: string
  icon_url: string
  wowhead_url: string
}

const THRESHOLDS = ['5+', '7+', '10+', '12+']

interface TooltipPos {
  top: number
  left: number
  name: string
  description: string
}

export default function WeeklyAffixes() {
  const [affixes, setAffixes] = useState<Affix[]>([])
  const [loading, setLoading] = useState(true)
  const [tooltip, setTooltip] = useState<TooltipPos | null>(null)
  const hoverTimer = useRef<number | null>(null)

  useEffect(() => {
    fetch('https://raider.io/api/v1/mythic-plus/affixes?region=eu&locale=en_US')
      .then(r => r.json())
      .then(data => setAffixes(data.affix_details ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    return () => {
      if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current)
    }
  }, [])

  if (loading) return (
    <section className="p-5 bg-gray-900/50 border border-gray-800 rounded-xl animate-pulse">
      <div className="h-3 w-44 bg-gray-800 rounded mb-5" />
      <div className="flex gap-4">
        {[1, 2, 3, 4].map(i => <div key={i} className="w-12 h-12 bg-gray-800 rounded-lg" />)}
      </div>
    </section>
  )

  if (!affixes.length) return null

  function handleEnter(event: React.MouseEvent<HTMLDivElement> | React.FocusEvent<HTMLDivElement>, affix: Affix) {
    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current)
    const rect = event.currentTarget.getBoundingClientRect()
    hoverTimer.current = window.setTimeout(() => {
      setTooltip({
        top: rect.top - 12,
        left: rect.left + rect.width / 2,
        name: affix.name,
        description: affix.description,
      })
    }, 40)
  }

  function handleLeave() {
    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current)
    setTooltip(null)
  }

  return (
    <section className="p-5 bg-gray-900/50 border border-gray-800 rounded-xl flex w-full flex-col">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
        Afijos Míticos+ · Semana actual
      </h2>
      <div className="grid grid-cols-4 gap-3">
        {affixes.map((a, i) => (
          <div
            key={a.id}
            className="relative group"
            onMouseEnter={event => handleEnter(event, a)}
            onMouseLeave={handleLeave}
            onFocus={event => handleEnter(event, a)}
            onBlur={handleLeave}
          >
            {/* Level threshold badge */}
            <span className="absolute -top-2 -right-2 z-10 px-1.5 py-0.5 bg-gray-950 border border-gray-700 rounded-full text-[10px] font-bold text-yellow-400 leading-none whitespace-nowrap">
              {THRESHOLDS[i] ?? ''}
            </span>

            {/* Icon */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={a.icon_url}
              alt={a.name}
              className="h-12 w-12 rounded-lg border border-gray-700 object-cover transition cursor-pointer group-hover:border-yellow-500/60"
            />
          </div>
        ))}
      </div>

      {tooltip && createPortal(
        <div
          className="pointer-events-none fixed w-60 p-3 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-[60]"
          style={{ top: tooltip.top, left: tooltip.left, transform: 'translate(-50%, -100%)' }}
        >
          <p className="text-sm font-semibold text-white mb-1.5">{tooltip.name}</p>
          <p className="text-xs text-gray-400 leading-relaxed">{tooltip.description}</p>
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-gray-700" />
        </div>,
        document.body,
      )}
    </section>
  )
}
