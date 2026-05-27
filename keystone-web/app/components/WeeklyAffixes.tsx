'use client'

import { useEffect, useState } from 'react'

interface Affix {
  id: number
  name: string
  description: string
  icon_url: string
  wowhead_url: string
}

const THRESHOLDS = ['5+', '7+', '10+', '12+']

export default function WeeklyAffixes() {
  const [affixes, setAffixes] = useState<Affix[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('https://raider.io/api/v1/mythic-plus/affixes?region=eu&locale=en_US')
      .then(r => r.json())
      .then(data => setAffixes(data.affix_details ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
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

  return (
    <section className="p-5 bg-gray-900/50 border border-gray-800 rounded-xl flex flex-col w-fit">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
        Afijos Míticos+ · Semana actual
      </h2>
      <div className="flex-1 flex items-center gap-6">
        {affixes.map((a, i) => (
          <div key={a.id} className="relative group">
            {/* Level threshold badge */}
            <span className="absolute -top-2 -right-2 z-10 px-1.5 py-0.5 bg-gray-950 border border-gray-700 rounded-full text-[10px] font-bold text-yellow-400 leading-none whitespace-nowrap">
              {THRESHOLDS[i] ?? ''}
            </span>

            {/* Icon */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={a.icon_url}
              alt={a.name}
              className="w-12 h-12 rounded-lg border border-gray-700 group-hover:border-yellow-500/60 transition cursor-pointer"
            />

            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-60 p-3 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none z-50">
              <p className="text-sm font-semibold text-white mb-1.5">{a.name}</p>
              <p className="text-xs text-gray-400 leading-relaxed">{a.description}</p>
              {/* Arrow */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-gray-700" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
