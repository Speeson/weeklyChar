'use client'

import { useEffect, useState } from 'react'

function getNextReset(): Date {
  const now = new Date()
  const reset = new Date(now)
  reset.setUTCHours(7, 0, 0, 0)
  const daysUntilWed = (3 - reset.getUTCDay() + 7) % 7
  reset.setUTCDate(reset.getUTCDate() + daysUntilWed)
  if (reset <= now) reset.setUTCDate(reset.getUTCDate() + 7)
  return reset
}

export default function WeeklyReset() {
  const [d, setD] = useState(0)
  const [h, setH] = useState(0)
  const [m, setM] = useState(0)

  useEffect(() => {
    function tick() {
      const ms = getNextReset().getTime() - Date.now()
      if (ms <= 0) { setD(0); setH(0); setM(0); return }
      const s = Math.floor(ms / 1000)
      setD(Math.floor(s / 86400))
      setH(Math.floor((s % 86400) / 3600))
      setM(Math.floor((s % 3600) / 60))
    }
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <section className="p-5 bg-gray-900/50 border border-gray-800 rounded-xl flex flex-col">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
        Reset semanal
      </h2>
      <div className="flex-1 flex flex-col items-center justify-center gap-2">
        <div className="flex items-end gap-2 text-white">
          {d > 0 && (
            <span className="text-3xl font-bold leading-none">
              {d}<span className="text-sm font-normal text-gray-500 ml-0.5">d</span>
            </span>
          )}
          <span className="text-3xl font-bold leading-none">
            {h}<span className="text-sm font-normal text-gray-500 ml-0.5">h</span>
          </span>
          <span className="text-3xl font-bold leading-none">
            {m}<span className="text-sm font-normal text-gray-500 ml-0.5">m</span>
          </span>
        </div>
        <p className="text-xs text-gray-600">Miércoles · 09:00 CEST</p>
      </div>
    </section>
  )
}
