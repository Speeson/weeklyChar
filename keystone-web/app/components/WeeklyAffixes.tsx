'use client'

import { useEffect, useState } from 'react'

interface Affix {
  id: number
  name: string
  description: string
  icon_url: string
  wowhead_url: string
}

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
    <div className="p-5 bg-gray-900/50 border border-gray-800 rounded-xl animate-pulse">
      <div className="h-3 w-40 bg-gray-800 rounded mb-5" />
      <div className="flex gap-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-800 rounded-lg" />
            <div className="space-y-2">
              <div className="h-3 w-24 bg-gray-800 rounded" />
              <div className="h-2 w-36 bg-gray-800 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  if (!affixes.length) return null

  return (
    <section className="p-5 bg-gray-900/50 border border-gray-800 rounded-xl">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
        Afijos Míticos+ · Semana actual
      </h2>
      <div className="flex flex-wrap gap-6">
        {affixes.map((a, i) => (
          <a
            key={a.id}
            href={a.wowhead_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 group"
          >
            <div className="relative flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.icon_url}
                alt={a.name}
                className="w-12 h-12 rounded-lg border border-gray-700 group-hover:border-yellow-500/60 transition"
              />
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-950 border border-gray-700 rounded-full text-[10px] font-bold text-gray-400 flex items-center justify-center">
                {i + 1}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white group-hover:text-yellow-400 transition">
                {a.name}
              </p>
              <p className="text-xs text-gray-500 line-clamp-2 max-w-[200px]">
                {a.description}
              </p>
            </div>
          </a>
        ))}
      </div>
    </section>
  )
}
