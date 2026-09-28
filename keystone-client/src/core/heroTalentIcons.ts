import heroTalentIconsUrl from "../assets/hero-talent-icons.webp";
import type { TalentTreeSnapshot } from "./types";

const GRID_COLUMNS = 7;
const GRID_ROWS = 6;

// The bundled sprite packs the official Blizzard atlas members in this order.
// New snapshots resolve by atlas name; subtree IDs only support older captures.
const HERO_ICON_ATLASES = [
  "talents-heroclass-deathknight-deathbringer",
  "talents-heroclass-demonhunter-felscarred",
  "talents-heroclass-druid-wildstalker",
  "talents-heroclass-hunter-packleader",
  "talents-heroclass-monk-conduitofthecelestials",
  "talents-heroclass-paladin-templar",
  "talents-heroclass-rogue-fatebound",
  "talents-heroclass-rogue-trickster",
  "talents-heroclass-shaman-farseer",
  "talents-heroclass-shaman-stormbringer",
  "talents-heroclass-deathknight-rideroftheapocalypse",
  "talents-heroclass-demonhunter-felscarred2",
  "talents-heroclass-evoker-chronowarden",
  "talents-heroclass-hunter-sentinel",
  "talents-heroclass-monk-masterofharmony",
  "talents-heroclass-priest-archon",
  "talents-heroclass-shaman-totemic",
  "talents-heroclass-warrior-colossus",
  "talents-heroclass-warrior-mountainthane",
  "talents-heroclass-warrior-slayer",
  "talents-heroclass-deathknight-sanlayn",
  "talents-heroclass-druid-druidoftheclaw",
  "talents-heroclass-evoker-flameshaper",
  "talents-heroclass-mage-frostfire",
  "talents-heroclass-monk-shadopan",
  "talents-heroclass-priest-oracle",
  "talents-heroclass-warlock-diabolist",
  "talents-heroclass-demonhunter-aldrachireaver",
  "talents-heroclass-druid-eluneschosen",
  "talents-heroclass-evoker-scalecommander",
  "talents-heroclass-mage-spellslinger",
  "talents-heroclass-paladin-heraldofthesun",
  "talents-heroclass-priest-voidweaver",
  "talents-heroclass-warlock-hellcaller",
  "talents-heroclass-demonhunter-annihilator",
  "talents-heroclass-druid-keeperofthegrove",
  "talents-heroclass-hunter-darkranger",
  "talents-heroclass-mage-sunfury",
  "talents-heroclass-paladin-lightsmith",
  "talents-heroclass-rogue-deathstalker",
  "talents-heroclass-warlock-soulharvester",
] as const;

const atlasIndexes = new Map<string, number>(HERO_ICON_ATLASES.map((atlas, index) => [atlas, index]));

const atlasBySubTreeId: Readonly<Record<number, string>> = {
  18: "talents-heroclass-priest-voidweaver",
  19: "talents-heroclass-priest-archon",
  20: "talents-heroclass-priest-oracle",
  21: "talents-heroclass-druid-druidoftheclaw",
  22: "talents-heroclass-druid-wildstalker",
  23: "talents-heroclass-druid-keeperofthegrove",
  24: "talents-heroclass-druid-eluneschosen",
  31: "talents-heroclass-deathknight-sanlayn",
  32: "talents-heroclass-deathknight-rideroftheapocalypse",
  33: "talents-heroclass-deathknight-deathbringer",
  34: "talents-heroclass-demonhunter-felscarred",
  35: "talents-heroclass-demonhunter-aldrachireaver",
  36: "talents-heroclass-evoker-scalecommander",
  37: "talents-heroclass-evoker-flameshaper",
  38: "talents-heroclass-evoker-chronowarden",
  39: "talents-heroclass-mage-sunfury",
  40: "talents-heroclass-mage-spellslinger",
  41: "talents-heroclass-mage-frostfire",
  42: "talents-heroclass-hunter-sentinel",
  43: "talents-heroclass-hunter-packleader",
  44: "talents-heroclass-hunter-darkranger",
  48: "talents-heroclass-paladin-templar",
  49: "talents-heroclass-paladin-lightsmith",
  50: "talents-heroclass-paladin-heraldofthesun",
  51: "talents-heroclass-rogue-trickster",
  52: "talents-heroclass-rogue-fatebound",
  53: "talents-heroclass-rogue-deathstalker",
  54: "talents-heroclass-shaman-totemic",
  55: "talents-heroclass-shaman-stormbringer",
  56: "talents-heroclass-shaman-farseer",
  57: "talents-heroclass-warlock-soulharvester",
  58: "talents-heroclass-warlock-hellcaller",
  59: "talents-heroclass-warlock-diabolist",
  60: "talents-heroclass-warrior-slayer",
  61: "talents-heroclass-warrior-mountainthane",
  62: "talents-heroclass-warrior-colossus",
  64: "talents-heroclass-monk-conduitofthecelestials",
  65: "talents-heroclass-monk-shadopan",
  66: "talents-heroclass-monk-masterofharmony",
  70: "talents-heroclass-shaman-stormbringer",
  71: "talents-heroclass-shaman-totemic",
  72: "talents-heroclass-shaman-farseer",
  73: "talents-heroclass-shaman-stormbringer",
  74: "talents-heroclass-shaman-totemic",
  75: "talents-heroclass-shaman-farseer",
  124: "talents-heroclass-demonhunter-annihilator",
  126: "talents-heroclass-demonhunter-felscarred2",
};

export type HeroTalentIcon = {
  atlas: string;
  backgroundImage: string;
  backgroundPosition: string;
  backgroundSize: string;
};

export function heroTalentIcon(tree: TalentTreeSnapshot | undefined): HeroTalentIcon | null {
  const explicitAtlas = typeof tree?.iconAtlas === "string" ? tree.iconAtlas.toLowerCase() : null;
  const atlas = explicitAtlas && atlasIndexes.has(explicitAtlas)
    ? explicitAtlas
    : tree?.subTreeId ? atlasBySubTreeId[tree.subTreeId] : null;
  const index = atlas ? atlasIndexes.get(atlas) : undefined;
  if (!atlas || index === undefined) return null;

  const column = index % GRID_COLUMNS;
  const row = Math.floor(index / GRID_COLUMNS);
  return {
    atlas,
    backgroundImage: `url("${heroTalentIconsUrl}")`,
    backgroundPosition: `${column * 100 / (GRID_COLUMNS - 1)}% ${row * 100 / (GRID_ROWS - 1)}%`,
    backgroundSize: `${GRID_COLUMNS * 100}% ${GRID_ROWS * 100}%`,
  };
}
