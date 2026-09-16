type Language = 'es' | 'en'

const TRACKS: Record<string, Record<Language, string>> = {
  veteran: { es: 'Veterano', en: 'Veteran' },
  veterano: { es: 'Veterano', en: 'Veteran' },
  champion: { es: 'Campeón', en: 'Champion' },
  campeon: { es: 'Campeón', en: 'Champion' },
  hero: { es: 'Héroe', en: 'Hero' },
  heroe: { es: 'Héroe', en: 'Hero' },
  myth: { es: 'Mito', en: 'Myth' },
  mito: { es: 'Mito', en: 'Myth' },
}

function trackLabel(track: unknown, language: Language): string | null {
  if (typeof track !== 'string') return null
  const trimmed = track.trim()
  if (!trimmed || trimmed.length > 64) return null
  const key = trimmed.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return TRACKS[key]?.[language] ?? trimmed
}

export function formatVaultReward(itemLevel: unknown, track: unknown, language: Language): string | null {
  if (typeof itemLevel !== 'number' || !Number.isFinite(itemLevel) || itemLevel <= 0) return null
  const label = trackLabel(track, language)
  return `ilvl ${Math.round(itemLevel)}${label ? ` (${label})` : ''}`
}
