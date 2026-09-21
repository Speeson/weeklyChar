import explorerIcon from "../assets/upgrade-tracks/explorer.png";
import adventurerIcon from "../assets/upgrade-tracks/adventurer.png";
import veteranIcon from "../assets/upgrade-tracks/veteran.png";
import championIcon from "../assets/upgrade-tracks/champion.png";
import heroIcon from "../assets/upgrade-tracks/hero.png";
import mythIcon from "../assets/upgrade-tracks/myth.png";
import { useI18n } from "../core/i18n";

const TRACKS = {
  explorer: { icon: explorerIcon, labels: { es: "Explorador", en: "Explorer" } },
  explorador: { icon: explorerIcon, labels: { es: "Explorador", en: "Explorer" } },
  adventurer: { icon: adventurerIcon, labels: { es: "Aventurero", en: "Adventurer" } },
  aventurero: { icon: adventurerIcon, labels: { es: "Aventurero", en: "Adventurer" } },
  veteran: { icon: veteranIcon, labels: { es: "Veterano", en: "Veteran" } },
  veterano: { icon: veteranIcon, labels: { es: "Veterano", en: "Veteran" } },
  champion: { icon: championIcon, labels: { es: "Campeón", en: "Champion" } },
  campeon: { icon: championIcon, labels: { es: "Campeón", en: "Champion" } },
  hero: { icon: heroIcon, labels: { es: "Héroe", en: "Hero" } },
  heroe: { icon: heroIcon, labels: { es: "Héroe", en: "Hero" } },
  myth: { icon: mythIcon, labels: { es: "Mito", en: "Myth" } },
  mito: { icon: mythIcon, labels: { es: "Mito", en: "Myth" } },
} as const;

export function UpgradeTrackIcon({ track, className = "" }: { track: unknown; className?: string }) {
  const { language } = useI18n();
  if (typeof track !== "string") return null;
  const key = track.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const data = TRACKS[key as keyof typeof TRACKS];
  if (!data) return null;
  return <span aria-label={data.labels[language]} className={`upgrade-track-icon ${className}`.trim()} role="img"
    style={{ backgroundImage: `url("${data.icon}")` }} />;
}
