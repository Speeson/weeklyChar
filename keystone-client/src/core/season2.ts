import altarOfFangs from "../assets/dungeon-teleports/altar-of-fangs.jpg";
import blindingVale from "../assets/dungeon-teleports/blinding-vale.jpg";
import denOfNalorakk from "../assets/dungeon-teleports/den-of-nalorakk.jpg";
import kingsRest from "../assets/dungeon-teleports/kings-rest.jpg";
import murderRow from "../assets/dungeon-teleports/murder-row.jpg";
import rubyLifePools from "../assets/dungeon-teleports/ruby-life-pools.jpg";
import templeOfSethraliss from "../assets/dungeon-teleports/temple-of-sethraliss.jpg";
import voidscarArena from "../assets/dungeon-teleports/voidscar-arena.jpg";

export type SeasonDungeon = { id: number; name: string; nameEs: string; abbr: string; teleportIconUrl: string };

// TODO: Web, Worker, and Client intentionally keep small seasonal display allowlists;
// consolidate them only when a shared build boundary is introduced deliberately.
export const MIDNIGHT_SEASON_2_DUNGEONS: readonly SeasonDungeon[] = [
  { id: 588, name: "Altar of Fangs", nameEs: "Altar de los Colmillos", abbr: "AOF", teleportIconUrl: altarOfFangs },
  { id: 587, name: "Murder Row", nameEs: "Frontal de la Muerte", abbr: "MR", teleportIconUrl: murderRow },
  { id: 586, name: "Den of Nalorakk", nameEs: "Guarida de Nalorakk", abbr: "DON", teleportIconUrl: denOfNalorakk },
  { id: 584, name: "The Blinding Vale", nameEs: "El Valle Cegador", abbr: "BV", teleportIconUrl: blindingVale },
  { id: 585, name: "Voidscar Arena", nameEs: "Arena Lacravacua", abbr: "VSA", teleportIconUrl: voidscarArena },
  { id: 249, name: "Kings' Rest", nameEs: "Reposo de los Reyes", abbr: "KR", teleportIconUrl: kingsRest },
  { id: 250, name: "Temple of Sethraliss", nameEs: "Templo de Sethraliss", abbr: "TOS", teleportIconUrl: templeOfSethraliss },
  { id: 399, name: "Ruby Life Pools", nameEs: "Estanques de Vida Rubí", abbr: "RLP", teleportIconUrl: rubyLifePools },
];

export const SEASON_2_DUNGEON_BY_ID = new Map(MIDNIGHT_SEASON_2_DUNGEONS.map(dungeon => [dungeon.id, dungeon]));

export function compactTeamKeystone(level: number, challengeMapId: number, dungeon: string | null): string {
  return `+${level} ${SEASON_2_DUNGEON_BY_ID.get(challengeMapId)?.abbr ?? dungeon ?? `ID ${challengeMapId}`}`;
}
