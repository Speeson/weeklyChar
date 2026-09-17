import explorerIcon from "../assets/upgrade-tracks/explorer.png";
import adventurerIcon from "../assets/upgrade-tracks/adventurer.png";
import veteranIcon from "../assets/upgrade-tracks/veteran.png";
import championIcon from "../assets/upgrade-tracks/champion.png";
import heroIcon from "../assets/upgrade-tracks/hero.png";
import mythIcon from "../assets/upgrade-tracks/myth.png";

const TRACKS = {
  explorer: { icon: explorerIcon, label: "Explorer" },
  explorador: { icon: explorerIcon, label: "Explorador" },
  adventurer: { icon: adventurerIcon, label: "Adventurer" },
  aventurero: { icon: adventurerIcon, label: "Aventurero" },
  veteran: { icon: veteranIcon, label: "Veteran" },
  veterano: { icon: veteranIcon, label: "Veterano" },
  champion: { icon: championIcon, label: "Champion" },
  campeon: { icon: championIcon, label: "Campeón" },
  hero: { icon: heroIcon, label: "Hero" },
  heroe: { icon: heroIcon, label: "Héroe" },
  myth: { icon: mythIcon, label: "Myth" },
  mito: { icon: mythIcon, label: "Mito" },
} as const;

export function UpgradeTrackIcon({ track, className = "" }: { track: unknown; className?: string }) {
  if (typeof track !== "string") return null;
  const key = track.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const data = TRACKS[key as keyof typeof TRACKS];
  if (!data) return null;
  return <span aria-label={data.label} className={`upgrade-track-icon ${className}`.trim()} role="img"
    style={{ backgroundImage: `url("${data.icon}")` }} />;
}
