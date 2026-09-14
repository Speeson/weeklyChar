import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const sourceDir = join(root, 'tools', 'planner-ranking-data', 'source')
const outputPath = join(root, 'keystone-worker', 'src', 'plannerRankingDataGenerated.ts')
const sourceFiles = [
  'midnight-s2-buff-impact-full.json',
  'midnight-s2-utility-catalog-canonical.json',
  'midnight-s2-dungeon-mechanics.json',
  'midnight-s2-dungeon-utility-relevance.json',
]
const raw = Object.fromEntries(sourceFiles.map(name => [name, readFileSync(join(sourceDir, name), 'utf8')]))
const parse = name => JSON.parse(raw[name])
const buffs = parse(sourceFiles[0])
const utility = parse(sourceFiles[1])
const mechanics = parse(sourceFiles[2])
const relevance = parse(sourceFiles[3])

const offensiveBuffs = [
  'MARK_OF_THE_WILD', 'BATTLE_SHOUT', 'ARCANE_INTELLECT', 'SKYFURY', 'CHAOS_BRAND', 'MYSTIC_TOUCH',
]
const providerByClass = [
  ['Druid', 'MARK_OF_THE_WILD'],
  ['Warrior', 'BATTLE_SHOUT'],
  ['Mage', 'ARCANE_INTELLECT'],
  ['Shaman', 'SKYFURY'],
  ['Demon Hunter', 'CHAOS_BRAND'],
  ['Monk', 'MYSTIC_TOUCH'],
]
const classNameByKey = {
  DEATH_KNIGHT: 'Death Knight', DEMON_HUNTER: 'Demon Hunter', DRUID: 'Druid', EVOKER: 'Evoker',
  HUNTER: 'Hunter', MAGE: 'Mage', MONK: 'Monk', PALADIN: 'Paladin', PRIEST: 'Priest', ROGUE: 'Rogue',
  SHAMAN: 'Shaman', WARLOCK: 'Warlock', WARRIOR: 'Warrior',
}
const availabilityFactor = {
  baseline: 1000,
  spec_only: 1000,
  spec_access: 1000,
  racial: 1000,
  class_talent: 500,
  spec_talent: 500,
  choice_talent: 500,
  hero_talent: 500,
  pet_conditional: 500,
}
const dungeonMapIdByName = {
  'Altar of Fangs': 588,
  'Den of Nalorakk': 586,
  'Murder Row': 587,
  'The Blinding Vale': 584,
  'Voidscar Arena': 585,
  "King's Rest": 249,
  'Ruby Life Pools': 399,
  'Temple of Sethraliss': 250,
}

function invariant(condition, message) {
  if (!condition) throw new Error(message)
}

function median(values) {
  const ordered = [...values].sort((left, right) => left - right)
  const middle = Math.floor(ordered.length / 2)
  return ordered.length % 2 === 0 ? (ordered[middle - 1] + ordered[middle]) / 2 : ordered[middle]
}

invariant(buffs.schemaVersion === 1 && utility.schemaVersion === 1 && relevance.schemaVersion === 1,
  'Unsupported planner ranking source schema')
invariant(relevance.canonicalUtilityCatalog === sourceFiles[1], 'Dungeon relevance catalog reference mismatch')
invariant(relevance.mechanicsEvidenceDataset === sourceFiles[2], 'Dungeon relevance mechanics reference mismatch')
invariant(mechanics.datasetId === relevance.mechanicsEvidenceDataset.replace('.json', '-v1')
  || mechanics.datasetId === 'midnight-s2-dungeon-mechanics-v1', 'Unexpected mechanics evidence dataset')
invariant(!offensiveBuffs.includes('HUNTERS_MARK'), "Hunter's Mark must remain excluded from production scoring")

const offensiveProfiles = {}
for (const [specId, spec] of Object.entries(buffs.specs)) {
  offensiveProfiles[specId] = {
    name: spec.name,
    gains: Object.fromEntries(offensiveBuffs.map(buff => [buff, Math.max(0, spec.results[buff].mplusWeightedDelta)])),
    provenance: { source: 'simc', confidence: 'high', method: 'exact_profile' },
  }
}

const archetypes = [
  { specId: 103, name: 'Feral Druid', donors: [70, 71, 72, 251, 252, 255, 259, 260, 261, 263, 269, 577], confidence: 'medium' },
  { specId: 102, name: 'Balance Druid', donors: [62, 63, 64, 258, 262, 265, 266, 267], confidence: 'medium' },
  { specId: 1467, name: 'Devastation Evoker', donors: [62, 63, 64, 258, 262, 265, 266, 267], confidence: 'medium' },
  { specId: 1473, name: 'Augmentation Evoker', donors: [62, 63, 64, 258, 262, 265, 266, 267], confidence: 'low' },
]
for (const archetype of archetypes) {
  invariant(!offensiveProfiles[archetype.specId], `Fallback ${archetype.specId} unexpectedly has exact SimC data`)
  offensiveProfiles[archetype.specId] = {
    name: archetype.name,
    gains: Object.fromEntries(offensiveBuffs.map(buff => [buff, median(archetype.donors.map(specId => {
      const donor = offensiveProfiles[specId]
      invariant(donor, `Missing fallback donor ${specId}`)
      return donor.gains[buff]
    }))])),
    provenance: {
      source: 'archetype_estimate',
      confidence: archetype.confidence,
      method: 'per_buff_archetype_median',
      donorSpecIds: [...archetype.donors],
    },
  }
}

const utilityCapabilities = Object.fromEntries(Object.entries(utility.capabilities)
  .filter(([, definition]) => definition.layer === 'defensive' || definition.layer === 'secondary')
  .map(([id, definition]) => [id, {
    layer: definition.layer,
    tier: definition.tier,
    stacking: definition.stacking,
  }]))

const utilityAbilities = utility.abilities.flatMap(ability => {
  if (!ability.scoringEligible) return []
  const capabilities = ability.capabilities.filter(id => utilityCapabilities[id])
  if (capabilities.length === 0) return []
  invariant(classNameByKey[ability.class], `Unknown utility class ${ability.class}`)
  invariant(availabilityFactor[ability.availability] !== undefined,
    `Unknown availability ${ability.availability} on ${ability.key}`)
  return [{
    key: ability.key,
    name: ability.name,
    spellId: ability.spellId,
    wowClass: classNameByKey[ability.class],
    specs: [...ability.specs].sort(),
    capabilities: [...capabilities].sort(),
    availability: ability.availability,
    availabilityFactor: availabilityFactor[ability.availability],
  }]
}).sort((left, right) => left.key.localeCompare(right.key))

const dungeonRelevanceByMapId = {}
for (const dungeon of Object.values(relevance.dungeons)) {
  const mapId = dungeonMapIdByName[dungeon.name]
  invariant(mapId, `Unknown dungeon ${dungeon.name}`)
  dungeonRelevanceByMapId[mapId] = Object.fromEntries(Object.entries(dungeon.scores)
    .filter(([capability]) => utilityCapabilities[capability])
    .sort(([left], [right]) => left.localeCompare(right)))
}

const sourceSha256 = createHash('sha256')
for (const name of sourceFiles) sourceSha256.update(name).update('\0').update(raw[name]).update('\0')
const production = {
  version: 'midnight-s2-v1',
  sourceSha256: sourceSha256.digest('hex'),
  source: {
    buffDataset: `${buffs.generator}:${buffs.schemaVersion}:${buffs.simulationCraft.version}`,
    utilityCatalog: utility.catalogId,
    mechanicsDataset: mechanics.datasetId,
    dungeonRelevanceDataset: relevance.datasetId,
  },
  offensiveBuffs,
  providerByClass,
  offensiveProfiles,
  utilityCapabilities,
  utilityAbilities,
  dungeonRelevanceByMapId,
}
const output = `// Generated by tools/planner-ranking-data/generate.mjs. Do not edit by hand.\n`
  + `export const PLANNER_RANKING_DATA = ${JSON.stringify(production, null, 2)} as const\n`

if (process.argv.includes('--check')) {
  let current = ''
  try { current = readFileSync(outputPath, 'utf8') } catch {}
  if (current !== output) {
    console.error('Planner ranking production data is stale. Run: node tools/planner-ranking-data/generate.mjs')
    process.exitCode = 1
  } else {
    console.log('Planner ranking production data is current.')
  }
} else {
  writeFileSync(outputPath, output)
  console.log(`Generated ${outputPath}`)
}
