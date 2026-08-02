'use client'

import { useEffect, useState } from 'react'

const EU_WEEKLY_RESET_UTC_DAY = 3
const EU_WEEKLY_RESET_UTC_HOUR = 4

function getNextReset(): Date {
  const now = new Date()
  const reset = new Date(now)
  reset.setUTCHours(EU_WEEKLY_RESET_UTC_HOUR, 0, 0, 0)
  const daysUntilWed = (EU_WEEKLY_RESET_UTC_DAY - reset.getUTCDay() + 7) % 7
  reset.setUTCDate(reset.getUTCDate() + daysUntilWed)
  if (reset <= now) reset.setUTCDate(reset.getUTCDate() + 7)
  return reset
}

function formatResetDay(reset: Date) {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    timeZone: 'Europe/Madrid',
  }).format(reset)
}

function formatResetTime(reset: Date) {
  return new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Madrid',
    timeZoneName: 'short',
  }).format(reset)
}

export default function WeeklyReset() {
  const [d, setD] = useState(0)
  const [h, setH] = useState(0)
  const [m, setM] = useState(0)
  const [reset, setReset] = useState<Date | null>(null)

  useEffect(() => {
    function tick() {
      const nextReset = getNextReset()
      setReset(nextReset)
      const ms = nextReset.getTime() - Date.now()
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
    <section className="p-5 bg-gray-900/50 border border-gray-800 rounded-xl flex flex-col min-w-[160px]">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
        Reset semanal
      </h2>
      <div className="flex flex-1 items-center justify-between gap-4">
        <div className="flex items-end gap-3 text-white">
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
        <div className="text-right text-sm leading-tight text-gray-500">
          <p className="capitalize">{reset ? formatResetDay(reset) : 'Miércoles'}</p>
          <p>{reset ? formatResetTime(reset) : '06:00 CEST'}</p>
        </div>
      </div>
    </section>
  )
}
