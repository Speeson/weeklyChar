export function keystoneColor(level: number | null | undefined) {
  if (!level) return '#4B5563'
  const stops = [
    { level: 2, color: [34, 197, 94] },
    { level: 7, color: [56, 189, 248] },
    { level: 12, color: [168, 85, 247] },
    { level: 16, color: [236, 72, 153] },
    { level: 20, color: [249, 115, 22] },
  ]
  const clamped = Math.max(stops[0].level, Math.min(level, stops[stops.length - 1].level))
  const nextIndex = stops.findIndex(stop => stop.level >= clamped)
  if (nextIndex <= 0) return `rgb(${stops[0].color.join(',')})`
  const from = stops[nextIndex - 1]
  const to = stops[nextIndex]
  const t = (clamped - from.level) / (to.level - from.level)
  const rgb = from.color.map((channel, i) => Math.round(channel + (to.color[i] - channel) * t))
  return `rgb(${rgb.join(',')})`
}
