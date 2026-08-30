import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const selector = readFileSync(new URL('../app/teams/[id]/StoneSelector.tsx', import.meta.url), 'utf8')
const teamPage = readFileSync(new URL('../app/teams/[id]/page.tsx', import.meta.url), 'utf8')
const tooltip = readFileSync(new URL('../app/components/KeystoneLootItemTooltip.tsx', import.meta.url), 'utf8')
const objectiveList = readFileSync(new URL('../app/components/KeystoneLootObjectiveList.tsx', import.meta.url), 'utf8')

test('Team page replaces the exposed recommendation planner with the inline Selector', () => {
  assert.match(teamPage, /StoneSelector/u)
  assert.doesNotMatch(teamPage, /<KeystonePlanner/u)
  assert.doesNotMatch(teamPage, /onRecommendationsChange/u)
  assert.match(selector, /Selector de piedra/u)
  assert.doesNotMatch(selector, /\/recommendations/u)
  assert.doesNotMatch(selector, /Composición recomendada/u)
})

test('Selector renders canonical dungeons, selectable zero-count controls and one inline panel', () => {
  assert.match(selector, /selectorDungeonOptions/u)
  assert.match(selector, /aria-pressed/u)
  assert.match(selector, /stoneCount/u)
  assert.doesNotMatch(selector, /disabled=\{option\.stoneCount === 0\}/u)
  assert.match(selector, /Objetivos/u)
  assert.match(selector, /Planificar piedra/u)
  assert.match(selector, /Próximamente/u)
  assert.match(selector, /disabled/u)
  assert.doesNotMatch(selector, /<dialog/u)
})

test('Selector protects requests and exposes loading, access, retry and empty states locally', () => {
  assert.match(selector, /AbortController/u)
  assert.match(selector, /activeController\.current\?\.abort\(\)/u)
  assert.match(selector, /createKeystoneSelectorRequestIdentity/u)
  assert.match(selector, /isKeystoneSelectorRequestCurrent/u)
  assert.match(selector, /aria-busy/u)
  assert.match(selector, /Reintentar/u)
  assert.match(selector, /Ya no tienes acceso/u)
  assert.match(selector, /Ningún personaje del equipo tiene objetivos pendientes/u)
})

test('Character details and item groups are inline, semantic and multi-spec aware', () => {
  assert.match(selector, /aria-expanded/u)
  assert.match(selector, /aria-controls/u)
  assert.match(selector, /Ver objetos/u)
  assert.match(selector, /Ocultar objetos/u)
  assert.match(selector, /selectorObjectivesForSpec/u)
  assert.match(selector, /groupSelectorObjectives/u)
  assert.match(selector, /Completados con Voidcore/u)
})

test('one shared portal tooltip supports keyboard, pointer, touch and existing objective lists', () => {
  assert.match(tooltip, /createPortal/u)
  assert.match(tooltip, /document\.body/u)
  assert.match(tooltip, /onMouseEnter/u)
  assert.match(tooltip, /onFocus/u)
  assert.match(tooltip, /onClick/u)
  assert.match(tooltip, /Escape/u)
  assert.match(tooltip, /role="tooltip"/u)
  assert.match(tooltip, /Estadísticas/u)
  assert.match(objectiveList, /KeystoneLootItemTooltip/u)
  assert.match(selector, /KeystoneLootItemTooltip/u)
  assert.doesNotMatch(tooltip, /statValue|quantity|bonusIds|gems|enchant/u)
})
