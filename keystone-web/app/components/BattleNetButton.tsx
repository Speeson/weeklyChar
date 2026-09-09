'use client'

import { useState } from 'react'
import { startBattleNetLogin } from '@/lib/battlenet'
import BattleNetIcon from '@/app/components/BattleNetIcon'

export default function BattleNetButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      window.location.assign(await startBattleNetLogin())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Battle.net no esta disponible temporalmente.')
      setLoading(false)
    }
  }

  return (
    <div className="mt-5 space-y-3">
      <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-gray-600">
        <span className="h-px flex-1 bg-gray-800" />
        o
        <span className="h-px flex-1 bg-gray-800" />
      </div>
      <button
        type="button"
        onClick={start}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-400/40 bg-blue-500/10 py-2.5 text-sm font-black text-blue-200 transition hover:bg-blue-500/20 disabled:opacity-50"
      >
        <BattleNetIcon className="h-5 w-5 shrink-0" />
        {loading ? 'Abriendo Battle.net...' : 'Continuar con Battle.net'}
      </button>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    </div>
  )
}
