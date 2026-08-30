import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const teamPage = readFileSync(new URL('../app/teams/[id]/page.tsx', import.meta.url), 'utf8')
const selector = readFileSync(new URL('../app/teams/[id]/StoneSelector.tsx', import.meta.url), 'utf8')
const teamDrawer = readFileSync(new URL('../app/teams/[id]/TeamKeystoneLootObjectivesDrawer.tsx', import.meta.url), 'utf8')
const sharedList = readFileSync(new URL('../app/components/KeystoneLootObjectiveList.tsx', import.meta.url), 'utf8')
const tooltip = readFileSync(new URL('../app/components/KeystoneLootItemTooltip.tsx', import.meta.url), 'utf8')
const ownerDrawer = readFileSync(new URL('../app/characters/KeystoneLootObjectivesDrawer.tsx', import.meta.url), 'utf8')
const settings = readFileSync(new URL('../app/settings/page.tsx', import.meta.url), 'utf8')
const helpers = readFileSync(new URL('./keystoneLootObjectives.ts', import.meta.url), 'utf8')

test('Settings uses the approved single-toggle wording and preserves account-backed behavior', () => {
  assert.match(settings, /Compartir mis objetivos de KeystoneLoot con mis equipos/u)
  assert.match(settings, /Permite que los miembros de tus equipos usen tus objetivos de KeystoneLoot para planificar piedras y ver qué objetos necesitas en cada mazmorra\./u)
  assert.doesNotMatch(settings, /Los objetos de tu wishlist no se muestran directamente/u)
  assert.match(settings, /GET|apiFetch\('\/api\/me'/u)
  assert.match(settings, /PATCH/u)
  assert.match(settings, /body: JSON\.stringify\(\{ shareKeystoneLootWithTeams: nextValue \}\)/u)
  assert.match(settings, /setShareKeystoneLootWithTeams\(nextValue\)/u)
  assert.match(settings, /checked=\{shareKeystoneLootWithTeams \?\? false\}/u)
  assert.match(settings, /setShareKeystoneLootWithTeams\(previousValue\)/u)
  assert.match(settings, /Restaurar valores solo afecta a las preferencias locales/u)
  const resetBody = settings.match(/function reset\(\) \{([\s\S]*?)\n  \}/u)?.[1] ?? ''
  assert.doesNotMatch(resetBody, /shareKeystoneLootWithTeams|updatePrivacy/u)
})

test('Team flow exposes the aggregate Selector and keeps the future planner disabled', () => {
  assert.match(teamPage, /StoneSelector/u)
  assert.doesNotMatch(teamPage, /KeystonePlanner/u)
  assert.match(selector, /buildKeystoneSelectorPath/u)
  assert.match(selector, /Planificar piedra/u)
  assert.match(selector, /Próximamente/u)
  assert.doesNotMatch(selector, /\/recommendations/u)
})

test('general Team character views open an exact-character filtered drawer', () => {
  assert.match(teamPage, /TeamKeystoneLootObjectivesDrawer/u)
  assert.match(teamPage, /onViewObjectives\(member, char, event\.currentTarget\)/u)
  assert.match(teamPage, /Ver objetivos/u)
  assert.match(teamPage, /aria-haspopup="dialog"/u)
  assert.match(teamDrawer, /buildTeamObjectivesPath/u)
  assert.match(teamDrawer, /MIDNIGHT_SEASON_2_DUNGEONS\.map/u)
  assert.match(teamDrawer, /specOptionsForClass/u)
  assert.match(teamDrawer, /Cargar más/u)
  assert.match(teamDrawer, /res\.status === 403/u)
  assert.match(teamDrawer, /setResponse\(null\)/u)
  assert.match(teamDrawer, /requestAnimationFrame/u)
})

test('Owner, Team and Selector surfaces reuse one safe tooltip presentation component', () => {
  assert.match(ownerDrawer, /KeystoneLootObjectiveList/u)
  assert.match(teamDrawer, /KeystoneLootObjectiveList/u)
  assert.match(selector, /KeystoneLootItemTooltip/u)
  assert.match(sharedList, /objectiveItemName/u)
  assert.match(sharedList, /tierPresentation/u)
  assert.match(sharedList, /voidcorePresentation/u)
  assert.match(sharedList, /objective\.iconUrl/u)
  assert.match(sharedList, /<svg/u)
  assert.match(sharedList, /break-words/u)
  assert.match(tooltip, /slotName/u)
  assert.match(tooltip, /statNames/u)
  assert.doesNotMatch(tooltip, /bonusIds|gems|enchant|usedItems/u)
})

test('team surfaces expose every authoritative status without raw wishlist fields', () => {
  for (const copy of [
    'Este miembro no comparte sus objetivos de KeystoneLoot con el equipo.',
    'No hay datos de KeystoneLoot disponibles para este personaje.',
    'La versión de KeystoneLoot de este personaje no es compatible.',
    'No hay objetivos para esta mazmorra y especialización.',
  ]) assert.ok(teamDrawer.includes(copy) || helpers.includes(copy))

  for (const forbidden of ['characterKey', 'bonusIds', 'gems', 'enchant', 'usedItems']) {
    assert.doesNotMatch(teamDrawer, new RegExp(forbidden, 'u'))
    assert.doesNotMatch(selector, new RegExp(forbidden, 'u'))
  }
})
