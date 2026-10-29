import type { CharacterCurrency } from "./types";
import { currentVaultWeekKey } from "./vaultWeek";

export type CharacterCurrencyKey =
  | "adventurerMistcrest" | "veteranMistcrest" | "championMistcrest"
  | "heroMistcrest" | "mythMistcrest" | "venomblightManaflux" | "tidalSparkDust"
  | "sparksOfTides" | "cofferKeyShards" | "restoredCofferKey" | "untaintedManaCrystals"
  | "nebulousVoidcore" | "trovehuntersBounty" | "scaleboundHeraldFlute"
  | "afflictedSoul" | "tormentedSoul" | "ascendantVenomstone"
  | "undercoin" | "remnantOfAnguish" | "timewarpedBadge" | "tradersTender" | "voidlightMarl";

export const CHARACTER_CURRENCIES: ReadonlyArray<{
  key: CharacterCurrencyKey;
  label: string;
  labelEs: string;
  wowheadType: "currency" | "item";
  wowheadId: number;
  iconName: string;
  iconFileID: number;
  symbol: string;
  color?: string;
}> = [
  { key: "adventurerMistcrest", label: "Adventurer Mistcrest", labelEs: "Blasón de bruma de aventurero", wowheadType: "currency", wowheadId: 3442, iconName: "inv_121_crest_adventurer", iconFileID: 0, symbol: "◆" },
  { key: "veteranMistcrest", label: "Veteran Mistcrest", labelEs: "Blasón de bruma de veterano", wowheadType: "currency", wowheadId: 3443, iconName: "inv_121_crest_veteran", iconFileID: 0, symbol: "◆" },
  { key: "championMistcrest", label: "Champion Mistcrest", labelEs: "Blasón de bruma de campeón", wowheadType: "currency", wowheadId: 3444, iconName: "inv_121_crest_champion", iconFileID: 0, symbol: "◆" },
  { key: "heroMistcrest", label: "Hero Mistcrest", labelEs: "Blasón de bruma de héroe", wowheadType: "currency", wowheadId: 3445, iconName: "inv_121_crest_hero", iconFileID: 7734058, symbol: "◆" },
  { key: "cofferKeyShards", label: "Coffer Key Shards", labelEs: "Fragmentos de llave de arca", wowheadType: "currency", wowheadId: 3310, iconName: "inv_gizmo_hardenedadamantitetube", iconFileID: 133016, symbol: "⚿" },
  { key: "tidalSparkDust", label: "Tidal Spark Dust", labelEs: "Polvo de chispa de las mareas", wowheadType: "currency", wowheadId: 3509, iconName: "inv_enchanting_dust_color3", iconFileID: 5929576, symbol: "♦" },
  { key: "venomblightManaflux", label: "Venomblight Manaflux", labelEs: "Manafluzo de añublo venenoso", wowheadType: "currency", wowheadId: 3465, iconName: "inv_10_blacksmithing_craftedoptional_blacksmithdye_earth", iconFileID: 4622293, symbol: "●" },
  { key: "untaintedManaCrystals", label: "Untainted Mana-Crystals", labelEs: "Cristales de maná impolutos", wowheadType: "currency", wowheadId: 3356, iconName: "jewelcrafting_uncut-epic-gem_color1", iconFileID: 5931199, symbol: "♦" },
  { key: "mythMistcrest", label: "Myth Mistcrest", labelEs: "Blasón de bruma de mito", wowheadType: "currency", wowheadId: 3446, iconName: "inv_121_crest_myth", iconFileID: 7734060, symbol: "◆" },
  { key: "restoredCofferKey", label: "Restored Coffer Key", labelEs: "Llave de arca restaurada", wowheadType: "currency", wowheadId: 3028, iconName: "inv_misc_key_15", iconFileID: 4622270, symbol: "⚿" },
  { key: "sparksOfTides", label: "Spark of Tides", labelEs: "Chispa de las mareas", wowheadType: "item", wowheadId: 274476, iconName: "inv_12_profession_questandcrafting_sparkwhole_green", iconFileID: 7551419, symbol: "◯" },
  { key: "nebulousVoidcore", label: "Nebulous Voidcore", labelEs: "Núcleo de vacío nebuloso", wowheadType: "currency", wowheadId: 3513, iconName: "inv_1205_voidforge_fluctuatingvoidcores_green", iconFileID: 7658129, symbol: "◉" },
  { key: "trovehuntersBounty", label: "Trovehunter's Bounty", labelEs: "Botín de cazatesoros", wowheadType: "item", wowheadId: 274374, iconName: "icon_treasuremap", iconFileID: 1064187, symbol: "✓" },
  { key: "scaleboundHeraldFlute", label: "Scalebound Herald's Flute", labelEs: "Flauta de heraldo de las escamas", wowheadType: "item", wowheadId: 275910, iconName: "inv_12_delves_heraldflute", iconFileID: 1928595, symbol: "♫" },
  { key: "afflictedSoul", label: "Afflicted Soul", labelEs: "Alma afligida", wowheadType: "item", wowheadId: 276547, iconName: "inv_misc_questionmark", iconFileID: 136214, symbol: "◉" },
  { key: "tormentedSoul", label: "Tormented Soul", labelEs: "Alma atormentada", wowheadType: "item", wowheadId: 276548, iconName: "inv_misc_questionmark", iconFileID: 236300, symbol: "◉" },
  { key: "ascendantVenomstone", label: "Ascendant Venomstone", labelEs: "Piedraveneno ascendente", wowheadType: "item", wowheadId: 280562, iconName: "inv_misc_questionmark", iconFileID: 7658134, symbol: "◆" },
  { key: "undercoin", label: "Undercoin", labelEs: "Inframoneda", wowheadType: "currency", wowheadId: 2803, iconName: "inv_misc_elvencoins", iconFileID: 0, symbol: "●" },
  { key: "remnantOfAnguish", label: "Remnant of Anguish", labelEs: "Remanente de angustia", wowheadType: "currency", wowheadId: 3392, iconName: "inv_10_elementalcombinedfoozles_blood", iconFileID: 0, symbol: "◆" },
  { key: "timewarpedBadge", label: "Timewarped Badge", labelEs: "Distintivo del tiempo", wowheadType: "currency", wowheadId: 1166, iconName: "pvecurrency-justice", iconFileID: 0, symbol: "◉" },
  { key: "tradersTender", label: "Trader's Tender", labelEs: "Cupón de comerciante", wowheadType: "currency", wowheadId: 2032, iconName: "tradingpostcurrency", iconFileID: 0, symbol: "●" },
  { key: "voidlightMarl", label: "Voidlight Marl", labelEs: "Marga de luz del Vacío", wowheadType: "currency", wowheadId: 3316, iconName: "inv_112_raidtrinkets_voidprism", iconFileID: 0, symbol: "◆" },
];

export const CHARACTER_CURRENCY_COLORS: Record<CharacterCurrencyKey, string> = {
  adventurerMistcrest: "#c084fc",
  veteranMistcrest: "#c084fc",
  championMistcrest: "#c084fc",
  heroMistcrest: "#c084fc",
  mythMistcrest: "#c084fc",
  venomblightManaflux: "#fdba74",
  tidalSparkDust: "#f472b6",
  sparksOfTides: "#67e8f9",
  cofferKeyShards: "#38bdf8",
  restoredCofferKey: "#c084fc",
  untaintedManaCrystals: "#67e8f9",
  nebulousVoidcore: "#c4b5fd",
  trovehuntersBounty: "#fcd34d",
  scaleboundHeraldFlute: "#f0cf69",
  afflictedSoul: "#c4b5fd",
  tormentedSoul: "#f472b6",
  ascendantVenomstone: "#86efac",
  undercoin: "#fcd34d",
  remnantOfAnguish: "#f472b6",
  timewarpedBadge: "#67e8f9",
  tradersTender: "#fcd34d",
  voidlightMarl: "#c4b5fd",
};

const finite = (value: unknown): number => typeof value === "number" && Number.isFinite(value) ? value : 0;

export function currencyCapState(currency: CharacterCurrency | null | undefined, key?: CharacterCurrencyKey) {
  const maxWeeklyQuantity = finite(currency?.maxWeeklyQuantity);
  const quantityEarnedThisWeek = finite(currency?.quantityEarnedThisWeek);
  const recordedMax = finite(currency?.maxQuantity);
  const totalEarned = finite(currency?.totalEarned);
  const maxQuantity = key?.toLowerCase().includes("mistcrest") && maxWeeklyQuantity === 0
    && currency?.canEarnPerWeek === false && currency?.useTotalEarnedForMaxQty === true
    && totalEarned > 0 && recordedMax === totalEarned ? 0 : recordedMax;
  const quantity = finite(currency?.quantity);
  const isWeeklyMaxed = maxWeeklyQuantity > 0 && quantityEarnedThisWeek >= maxWeeklyQuantity;
  const isSeasonMaxed = currency?.useTotalEarnedForMaxQty === true && maxQuantity > 0 && totalEarned >= maxQuantity;
  const isTotalMaxed = currency?.useTotalEarnedForMaxQty !== true && maxQuantity > 0 && quantity >= maxQuantity;
  return { maxQuantity, isWeeklyMaxed, isSeasonMaxed, isTotalMaxed, isMaxed: isWeeklyMaxed || isSeasonMaxed || isTotalMaxed };
}

export function voidcoreQuestCompleted(currency: CharacterCurrency | null | undefined, nowMs = Date.now()): boolean {
  return currency?.questCompleted === true && currency.weekKey === currentVaultWeekKey(nowMs);
}

export type TrovehunterDetail = "active" | "inBags" | "claimed";

export function trovehunterStatus(info: Pick<CharacterCurrency, "questCompleted" | "bagCount" | "hasBuff"> | null | undefined): {
  obtained: boolean;
  detail: TrovehunterDetail | null;
  known: boolean;
} {
  if (!info || (typeof info.questCompleted !== "boolean" && typeof info.bagCount !== "number" && typeof info.hasBuff !== "boolean")) {
    return { obtained: false, detail: null, known: false };
  }
  const inBags = finite(info.bagCount) > 0;
  const active = info.hasBuff === true;
  const obtained = info.questCompleted === true || inBags || active;
  if (!obtained) return { obtained: false, detail: null, known: true };
  if (active) return { obtained: true, detail: "active", known: true };
  if (inBags) return { obtained: true, detail: "inBags", known: true };
  return { obtained: true, detail: typeof info.bagCount === "number" && info.hasBuff === false ? "claimed" : null, known: true };
}

export function keystoneColor(level: number | null | undefined) {
  if (!level) return "#8b98aa";
  if (level >= 13) return "#db35ff";
  if (level >= 10) return "#ff8a00";
  if (level >= 7) return "#00d9ff";
  if (level >= 4) return "#00ff75";
  return "#fff";
}

export function estimatedDungeonRating(run: Record<string, unknown> | undefined): number {
  const rating = finite(run?.rating);
  if (rating > 0) return Math.round(rating);
  const level = finite(run?.level);
  const baseScores: Record<number, number> = { 2: 155, 3: 170, 4: 200, 5: 215, 6: 230, 7: 260, 8: 275, 9: 290, 10: 320, 11: 335, 12: 365, 13: 380, 14: 395, 15: 410, 16: 425, 17: 440, 18: 455, 19: 470, 20: 485 };
  const base = baseScores[level] ?? (level > 20 ? 485 + ((level - 20) * 15) : 0);
  return base ? base + Math.max(0, Math.min(finite(run?.upgradeLevel), 3)) * 2 : 0;
}
