const TRACKS = {
  explorer: { icon: '/upgrade-tracks/explorer.png', label: 'Explorer' },
  explorador: { icon: '/upgrade-tracks/explorer.png', label: 'Explorador' },
  adventurer: { icon: '/upgrade-tracks/adventurer.png', label: 'Adventurer' },
  aventurero: { icon: '/upgrade-tracks/adventurer.png', label: 'Aventurero' },
  veteran: { icon: '/upgrade-tracks/veteran.png', label: 'Veteran' },
  veterano: { icon: '/upgrade-tracks/veteran.png', label: 'Veterano' },
  champion: { icon: '/upgrade-tracks/champion.png', label: 'Champion' },
  campeon: { icon: '/upgrade-tracks/champion.png', label: 'Campeón' },
  hero: { icon: '/upgrade-tracks/hero.png', label: 'Hero' },
  heroe: { icon: '/upgrade-tracks/hero.png', label: 'Héroe' },
  myth: { icon: '/upgrade-tracks/myth.png', label: 'Myth' },
  mito: { icon: '/upgrade-tracks/myth.png', label: 'Mito' },
} as const

export default function UpgradeTrackIcon({ track, className = '' }: { track: unknown; className?: string }) {
  if (typeof track !== 'string') return null
  const key = track.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const data = TRACKS[key as keyof typeof TRACKS]
  if (!data) return null
  return <span aria-label={data.label}
    className={`inline-block h-5 w-5 shrink-0 bg-contain bg-center bg-no-repeat [filter:drop-shadow(0_1px_2px_#000)] ${className}`.trim()}
    role="img" style={{ backgroundImage: `url("${data.icon}")` }} />
}
