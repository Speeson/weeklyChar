import { MIDNIGHT_SEASON_2_DUNGEONS } from "./season2";
import type { Character, CharacterCurrency, EquipmentItem, TalentNodeSnapshot, TalentTreeSnapshot } from "./types";

const slots = ["Head", "Neck", "Shoulder", "Back", "Chest", "Wrist", "Hands", "Waist", "Legs", "Feet", "Finger1", "Finger2", "Trinket1", "Trinket2", "MainHand", "OffHand"];
const equipment: EquipmentItem[] = slots.map((slotName, index) => ({
  slotId: index + 1, slotName, itemId: 240000 + index, itemName: `${slotName} of the Eclipse`, itemLink: `item:${240000 + index}:456:250001:0:0:0:0:90:102:0:13:1:2001:0`,
  quality: index % 5 === 0 ? 5 : 4, itemLevel: [308, 311, 308, 311, 321, 311, 308, 308, 331, 331, 311, 311, 311, 308, 321, 311][index],
  iconFileID: 1000 + index, iconPath: MIDNIGHT_SEASON_2_DUNGEONS[index % 8].teleportIconUrl, setId: index < 4 ? 36 : null,
  enchant: index % 3 === 0 ? { enchantId: 456, spellId: 1254400, name: "Authority of the Depths", iconFileID: 5929576 } : null,
  gems: index % 4 === 0 ? [{ itemId: 250001, itemLink: "item:250001", name: "Elusive Blasphemite", iconFileID: 5931199 }] : [], bonusIds: [2001, 2002], itemContext: 16, suffixId: 0,
}));

function nodes(prefix: number): TalentNodeSnapshot[] {
  return Array.from({ length: 12 }, (_, index) => ({
    nodeId: prefix + index, posX: index % 4, posY: Math.floor(index / 4), nodeType: index === 5 ? "choice" : "single",
    ranksPurchased: index % 3 === 0 ? 0 : index === 6 ? 2 : 1, maxRanks: index === 6 ? 2 : 1, activeEntryId: prefix * 10 + index,
    entries: [{ entryId: prefix * 10 + index, definitionId: prefix * 100 + index, spellId: 1254400 + index, overriddenSpellId: null, name: `Talent ${index + 1}`, description: `Descripción local del talento ${index + 1}.`, subtext: null, iconFileID: 2000 + index, iconPath: MIDNIGHT_SEASON_2_DUNGEONS[index % 8].teleportIconUrl, selected: index % 3 !== 0, rank: index === 6 ? 2 : index % 3 === 0 ? 0 : 1 }, ...(index === 5 ? [{ entryId: prefix * 10 + 99, definitionId: prefix * 100 + 99, spellId: 1254499, overriddenSpellId: null, name: "Choice Talent", description: "Segunda opción del nodo.", subtext: null, iconFileID: 2099, iconPath: MIDNIGHT_SEASON_2_DUNGEONS[7].teleportIconUrl, selected: false, rank: 0 }] : [])],
    visibleEdges: index < 8 ? [{ targetNodeId: prefix + index + 4, type: "required", visualStyle: "line", active: index % 3 !== 0 }] : [], subTreeId: null,
  }));
}

const tree = (treeId: number, type: string, name: string): TalentTreeSnapshot => {
  const treeNodes = nodes(treeId * 100);
  if (type === "hero") {
    treeNodes[0].ranksPurchased = 0;
    treeNodes[0].entries[0].selected = true;
    treeNodes[0].entries[0].rank = 1;
  }
  return { treeId, type, name, subTreeId: type === "hero" ? 24 : null, iconFileID: type === "hero" ? 5929576 : null, active: type === "hero" ? true : undefined, nodes: treeNodes };
};
const currency = (quantity: number, maxQuantity = 0, totalEarned = quantity): CharacterCurrency => ({ quantity, maxQuantity, totalEarned, useTotalEarnedForMaxQty: maxQuantity > 0 });

export function charactersPreview(): Character[] {
  const base = [
    ["Bakuhatsu", "Druid"], ["Makabe", "Warrior"], ["Speeral", "Mage"], ["Kaeloria", "Paladin"], ["Veyron", "Rogue"], ["Thaleya", "Druid"], ["Noxaria", "Warlock"], ["Astryn", "Priest"], ["Morwyn", "Shaman"],
  ];
  return base.map(([name, wowClass], index) => ({
    id: `characters-${index}`, name, realm: index >= 7 ? "Sanguino" : "Zul'jin", region: "eu", wowAccount: index === 8 ? "WOW Account 2" : "WoW Account", wowClass, avatarUrl: null, ilvl: 315.69, rioScore: 3000, currentKeystone: null, keystoneDisplay: "—",
    ...(index === 0 ? {
      equipment: { averageItemLevel: 315.69, setPieces: [{ setId: 36, count: 4 }], items: equipment },
      talents: { specId: 102, specName: "Equilibrio", specIconFileID: 136096, class: "Druida", configId: 77, loadoutName: "Mythic+", importString: "CYGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMzYmZmxMzMGzYmZmxMDAAAAAAAYmZGGzMzgxMzYmhZmZBAsB", characterLevel: 90, trees: [tree(1, "class", "DRUIDA"), tree(2, "hero", "ELEGIDO DE ELUNE"), tree(3, "spec", "EQUILIBRIO")] },
      omniumFolio: { systemId: 48, configId: 88, treeIds: [1186], trees: [tree(1186, "omnium", "OMNIUM FOLIO")] },
      mythicPlusSeason: { dungeons: MIDNIGHT_SEASON_2_DUNGEONS.map((dungeon, runIndex) => ({ challengeMapId: dungeon.id, level: [12, 10, 13, 11, 9, 12, 10, 11][runIndex], upgradeLevel: [2, 1, 3, 2, 1, 2, 1, 2][runIndex], timed: true, rating: [322, 305, 292, 320, 276, 307, 295, 336][runIndex] })) },
      vault: {
        raid: { slots: [{ progress: 1, threshold: 2, encounters: [{ encounterID: 7001, name: "Reina Ansurek", bestDifficulty: 16 }] }, { progress: 1, threshold: 4 }, { progress: 1, threshold: 6 }] },
        dungeons: { completedRuns: { heroic: 0, mythic: 0, mythicPlus: 8 }, topRuns: MIDNIGHT_SEASON_2_DUNGEONS.map((dungeon, runIndex) => ({ level: [12, 12, 11, 11, 11, 11, 10, 10][runIndex], mapChallengeModeID: dungeon.id, name: dungeon.nameEs })), slots: [{ level: 12, progress: 8, threshold: 1, unlocked: true }, { level: 11, progress: 8, threshold: 4, unlocked: true }, { level: 10, progress: 8, threshold: 8, unlocked: true }] },
        world: { tierProgress: [{ activityTierID: 301, difficulty: 8, numPoints: 4 }, { activityTierID: 302, difficulty: 7, numPoints: 2 }], slots: [{ progress: 6, threshold: 2, unlocked: true }, { progress: 6, threshold: 4, unlocked: true }, { progress: 6, threshold: 8, unlocked: false }] },
      },
      preyHunts: { normal: { count: 4 }, hard: { count: 2 }, nightmare: {} },
      currencies: {
        heroMistcrest: { ...currency(25, 450, 450), isMaxed: true }, mythMistcrest: currency(20, 450, 315), venomblightManaflux: currency(1, 8), tidalSparkDust: { ...currency(4, 4), isMaxed: true }, sparksOfTides: { itemQuantity: 6 },
        cofferKeyShards: { quantity: 0, quantityEarnedThisWeek: 600, maxWeeklyQuantity: 600 }, restoredCofferKey: currency(2), untaintedManaCrystals: { quantity: 143, quantityEarnedThisWeek: 250, maxWeeklyQuantity: 250, maxQuantity: 1000 }, nebulousVoidcore: currency(1, 3, 1), trovehuntersBounty: { questCompleted: true },
      }, money: { gold: 1284553, silver: 24, copper: 128455324, copperOnly: 17 },
    } : {}),
  }));
}
