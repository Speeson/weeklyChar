import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const drawer = readFileSync(new URL('../app/characters/KeystoneLootObjectivesDrawer.tsx', import.meta.url), 'utf8')
const charactersPage = readFileSync(new URL('../app/characters/page.tsx', import.meta.url), 'utf8')

test('owner drawer uses a labelled modal dialog with close, focus, live and retry behavior', () => {
  assert.match(drawer, /<dialog/u)
  assert.match(drawer, /showModal\(\)/u)
  assert.match(drawer, /aria-labelledby="keystone-loot-objectives-title"/u)
  assert.match(drawer, /onCancel=/u)
  assert.match(drawer, /requestAnimationFrame/u)
  assert.match(drawer, /aria-live="polite"/u)
  assert.match(drawer, /Reintentar/u)
  assert.match(drawer, /Cargar más/u)
})

test('drawer declares full-width mobile and bounded right-side desktop behavior', () => {
  assert.match(drawer, /h-dvh/u)
  assert.match(drawer, /w-full/u)
  assert.match(drawer, /max-h-none/u)
  assert.match(drawer, /max-w-none/u)
  assert.match(drawer, /sm:max-w-/u)
  assert.match(drawer, /overflow-y-auto/u)
  assert.match(drawer, /min-h-11/u)
  assert.match(drawer, /break-words/u)
})

test('Characters page exposes an exact-character dialog trigger without touching team UI', () => {
  assert.match(charactersPage, /Ver objetivos/u)
  assert.match(charactersPage, /aria-haspopup="dialog"/u)
  assert.match(charactersPage, /onViewObjectives\(char, event\.currentTarget\)/u)
  assert.match(charactersPage, /KeystoneLootObjectivesDrawer/u)
})

test('drawer renders loading, objective, icon fallback and every recoverable action path', () => {
  assert.match(drawer, /Cargando objetivos/u)
  assert.match(drawer, /response\.objectives\.map/u)
  assert.match(drawer, /objective\.iconUrl/u)
  assert.match(drawer, /<svg/u)
  assert.match(drawer, /ownerObjectiveStatusMessage/u)
  assert.match(drawer, /formatObjectiveFreshness/u)
  assert.match(drawer, /response\.nextCursor/u)
  assert.match(drawer, /loadObjectives\(character, dungeonId, specId, response\.nextCursor, true\)/u)
})

test('dungeon and specialization filters reset pagination and remain server-authoritative', () => {
  assert.match(drawer, /MIDNIGHT_SEASON_2_DUNGEONS\.map/u)
  assert.match(drawer, /specOptionsForClass/u)
  assert.match(drawer, /loadObjectives\(character, next, specId, null, false\)/u)
  assert.match(drawer, /loadObjectives\(character, dungeonId, next, null, false\)/u)
  assert.match(drawer, /buildOwnerObjectivesPath/u)
})

test('drawer combines abort and exact request identity guards for character and filter races', () => {
  assert.match(drawer, /AbortController/u)
  assert.match(drawer, /activeController\.current\?\.abort\(\)/u)
  assert.match(drawer, /createObjectiveRequestIdentity/u)
  assert.match(drawer, /isObjectiveRequestCurrent/u)
  assert.match(drawer, /activeIdentity\.current = null/u)
})
