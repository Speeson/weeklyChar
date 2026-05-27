'use client'

import { useEffect, useState } from 'react'

function getNextReset(): Date {
  const now = new Date()
  const reset = new Date(now)
  reset.setUTCHours(7, 0, 0, 0)
  // 0=Dom, 3=Mie — WoW EU reset: miércoles 07:00 UTC (09:00 CEST)
  const daysUntilWed = (3 - reset.getUTCDay() + 7) % 7
  reset.setUTCDate(reset.getUTCDate() + daysUntilWed)
  if (reset <= now) reset.setUTCDate(reset.getUTCDate() + 7)
  return reset
}

function fmt(ms: number): string {
  if (ms <= 0) return '¡Ahora!'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export default function WeeklyReset() {
  const [text, setText] = useState('')

  useEffect(() => {
    const tick = () => setText(fmt(getNextReset().getTime() - Date.now()))
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [])

  if (!text) return null

  return (
    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-800/70 border border-gray-700/50 text-xs text-gray-300">
      <span>⏱</span>
      Reset semanal en{' '}
      <span className="font-semibold text-yellow-400">{text}</span>
    </span>
  )
}
