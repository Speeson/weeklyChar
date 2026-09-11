import { expect, test, type Page, type Route } from '@playwright/test'

const team = {
  id: 7, name: 'Poison Progression', inviteCode: 'STONE-S3', isOwner: true, ownerId: 1, currentUserId: 1,
  members: [
    { userId: 1, username: 'Speeson', characters: [{ id: 10, name: 'Arcana', realm: 'Dun Modr', region: 'eu', wowClass: 'Mage', avatarUrl: null, currentKeystone: { level: 12, dungeon: 'Ruby Life Pools', challengeMapId: 399, updatedAt: 1_800_000_000 } }] },
    { userId: 2, username: 'Healer', characters: [{ id: 20, name: 'Hoja', realm: 'Dun Modr', region: 'eu', wowClass: 'Druid', avatarUrl: null, currentKeystone: { level: 11, dungeon: 'Temple of Sethraliss', challengeMapId: 250, updatedAt: 1_800_000_000 } }] },
    { userId: 3, username: 'Hunter', characters: [{ id: 30, name: 'Flecha', realm: 'Sanguino', region: 'eu', wowClass: 'Hunter', avatarUrl: null, currentKeystone: null }] },
    { userId: 4, username: 'Tank', characters: [] },
    { userId: 5, username: 'Rogue', characters: [] },
    { userId: 6, username: 'Sixth', characters: [] },
  ],
}

const ownerCharacters = [
  ...team.members[0].characters,
  { id: 11, name: 'Makabe', realm: 'Dun Modr', region: 'eu', wowClass: 'Druid', avatarUrl: null, currentKeystone: null },
  { id: 12, name: 'Sinclase', realm: 'Dun Modr', region: 'eu', wowClass: null, avatarUrl: null, currentKeystone: null },
]

function recommendation(rank: number) {
  return {
    rank, fingerprint: `plan-${rank}`,
    stone: { characterId: 10, characterName: 'Arcana', ownerUserId: 1, ownerUsername: 'Speeson', challengeMapId: 399, dungeon: 'Ruby Life Pools', level: 12 - rank + 1 },
    assignments: [
      { userId: 1, username: 'Speeson', characterId: 10, characterName: 'Arcana', wowClass: 'Mage', specId: 62, role: 'dps', lootSpecId: 64, playPreference: 'preferred', objectives: [{ itemId: 123 + rank, itemName: `Objeto ${rank}`, iconUrl: null, tier: 3, variantKey: `v-${rank}`, voidcoreState: 'pending' }], capabilities: [{ capabilityId: 'BLOODLUST', name: 'Bloodlust', type: 'major_utility', iconSpellId: 80353, stacking: 'unique', mode: 'guaranteed', condition: null }] },
      { userId: 2, username: 'Healer', characterId: 20, characterName: 'Hoja', wowClass: 'Druid', specId: 105, role: 'healer', lootSpecId: 105, playPreference: 'available', objectives: [], capabilities: [{ capabilityId: 'BATTLE_REZ', name: 'Battle Resurrection', type: 'major_utility', iconSpellId: 20484, stacking: 'unique', mode: 'guaranteed', condition: null }] },
    ],
    vacancies: [{ role: 'tank', preferredCapabilities: [] }, { role: 'dps', preferredCapabilities: ['CHAOS_BRAND'] }, { role: 'dps', preferredCapabilities: [] }],
    lootSummary: { weightedScore: 10, playersWithObjectives: 1, totalObjectives: 1, tierCounts: { bestInSlot: 1, mustHave: 0, niceToHave: 0, catalyst: 0, transmog: 0 } },
    levelSummary: { targetLevel: 10, stoneLevel: 12 - rank + 1, levelDistance: 2 - rank + 1 },
    preferenceSummary: { preferred: 1, available: 1, emergency: 0 },
    compositionSummary: { bloodlust: 'conditional', battleRez: 'guaranteed', uniqueCapabilities: [{ capabilityId: 'BLOODLUST', name: 'Bloodlust', type: 'major_utility', iconSpellId: 80353, stacking: 'unique', availability: 'conditional' }, { capabilityId: 'BATTLE_REZ', name: 'Battle Resurrection', type: 'major_utility', iconSpellId: 20484, stacking: 'unique', availability: 'guaranteed' }], damageProfile: 'magical', magicalDpsCount: 1, physicalDpsCount: 0, unknownDpsCount: 0, chaosBrandBeneficiaries: 1, mysticTouchBeneficiaries: 0, uniqueClassBuffCount: 1 },
    reasonCodes: ['PARTY_INCOMPLETE', 'HAS_LOOT_OBJECTIVES', rank === 2 ? 'TARGET_LEVEL_EXACT' : 'TARGET_LEVEL_NEARBY', 'BLOODLUST_GUARANTEED', 'BATTLE_REZ_PRESENT'],
  }
}

function plannerResponse(challengeMapId: number | null = null) {
  return { teamId: 7, challengeMapId, targetLevel: 10, availability: { eligibleStoneCount: 2 }, status: 'ok', diagnostics: { codes: [], unconfiguredUserIds: [], lockIssues: [] }, recommendations: [1, 2, 3].map(recommendation) }
}

async function setup(page: Page, plannerHandler?: (route: Route, body: Record<string, unknown>) => Promise<void>) {
  await page.addInitScript(() => localStorage.setItem('access_token', 'planner-token'))
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/teams/7') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(team) })
    if (url.pathname === '/api/me') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, username: 'Speeson' }) })
    if (url.pathname === '/api/me/characters') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ownerCharacters) })
    if (url.pathname === '/api/me/planner/preferences') {
      if (route.request().method() === 'PUT') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ preferences: [] }) })
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ preferences: [] }) })
    }
    if (url.pathname === '/api/teams/7/keystone-planner') {
      const body = route.request().postDataJSON() as Record<string, unknown>
      if (plannerHandler) return plannerHandler(route, body)
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(plannerResponse(body.challengeMapId as number | null)) })
    }
    if (url.pathname.includes('/keystone-loot/dungeons/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ teamId: 7, challengeMapId: Number(url.pathname.split('/').at(-2)), availability: { stoneCount: 0, stones: [] }, summary: { charactersWithObjectives: 0, totalObjectives: 0, tiers: { bestInSlot: 0, mustHave: 0, niceToHave: 0, catalyst: 0, transmog: 0, other: 0 } }, characters: [] }) })
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.goto('/teams/7')
  await expect(page.getByRole('heading', { name: 'Poison Progression' })).toBeVisible()
}

test('session entry starts with safe defaults, enforces participants and renders server Top 5', async ({ page }) => {
  let posted: Record<string, unknown> | null = null
  await setup(page, async (route, body) => { posted = body; await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(plannerResponse()) }) })
  const trigger = page.getByRole('button', { name: 'Planificar sesión' })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Planificar sesión' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('checkbox', { name: /Speeson/u })).toBeChecked()
  await expect(dialog.getByRole('checkbox', { name: /^Healer/u })).not.toBeChecked()
  await expect(dialog.getByRole('button', { name: 'Calcular Top 5' })).toBeDisabled()
  await expect(dialog.getByRole('slider', { name: 'Nivel objetivo' })).toHaveValue('10')
  await expect(dialog.getByRole('switch', { name: 'Optimizar composición' })).toBeChecked()
  await dialog.getByRole('checkbox', { name: /^Healer/u }).check()
  await dialog.getByRole('button', { name: 'Calcular Top 5' }).click()
  await expect(dialog.locator('[data-planner-recommendation]')).toHaveCount(3)
  await expect(dialog.getByText('Mejor opción')).toBeVisible()
  await expect(dialog.getByText('Bloodlust · Condicional').first()).toBeVisible()
  await dialog.locator('[data-planner-recommendation]').first().getByText('Objetivos · 0').click()
  await expect(dialog.getByText('Sin objetivos puntuables para esta recomendación.').first()).toBeVisible()
  expect(posted).toMatchObject({ participantUserIds: [1, 2], targetLevel: 10, challengeMapId: null, options: { optimizeComposition: true, bloodlust: true, battleRez: true, classBuffs: true, damageSynergy: true }, locks: [] })
  await dialog.getByRole('button', { name: 'Cerrar Keystone Planner' }).click()
  await expect(trigger).toBeFocused()
})

test('preferences default all specs disabled and save a full replacement', async ({ page }) => {
  let payload: { preferences?: unknown[] } | null = null
  await setup(page)
  await page.getByRole('button', { name: 'Planificar sesión' }).click()
  await page.getByRole('button', { name: 'Configurar mis personajes' }).click()
  const dialog = page.getByRole('dialog', { name: 'Mis preferencias de juego' })
  await expect(dialog.getByText('Arcana')).toBeVisible()
  const availability = dialog.getByLabel('Disponibilidad')
  await expect(availability).toHaveCount(7)
  await expect(availability.first()).toHaveValue('disabled')
  await availability.first().selectOption('preferred')
  await dialog.getByLabel('Objetivos de loot').first().selectOption('64')
  await availability.nth(1).selectOption('available')
  await availability.nth(2).selectOption('emergency')
  await expect(availability.nth(3)).toHaveValue('disabled')
  await expect(dialog.getByText(/No se puede configurar todavía/u)).toBeVisible()
  await page.route('**/api/me/planner/preferences', async route => {
    if (route.request().method() !== 'PUT') return route.fallback()
    payload = route.request().postDataJSON()
    const submitted = (payload as { preferences: Array<Record<string, unknown>> }).preferences.map(item => ({ ...item, role: 'dps', updatedAt: '2026-09-10 10:00:00' }))
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ preferences: submitted }) })
  })
  await dialog.getByRole('button', { name: 'Guardar configuración' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('Preferencias guardadas.')).toBeVisible()
  const saved = (payload as { preferences: Array<{ playPreference: string, lootSpecId: number }> } | null)?.preferences ?? []
  expect(saved).toHaveLength(7)
  expect(saved.slice(0, 4).map(item => item.playPreference)).toEqual(['preferred', 'available', 'emergency', 'disabled'])
  expect(saved[0].lootSpecId).toBe(64)
})

test('preferences load existing values without modifying teammate configuration', async ({ page }) => {
  await setup(page)
  await page.route('**/api/me/planner/preferences', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ preferences: [{ characterId: 10, specId: 62, role: 'dps', playPreference: 'preferred', lootSpecId: 64, updatedAt: '2026-09-10 10:00:00' }] }) }))
  await page.getByRole('button', { name: 'Planificar sesión' }).click()
  await page.getByRole('button', { name: 'Configurar mis personajes' }).click()
  const dialog = page.getByRole('dialog', { name: 'Mis preferencias de juego' })
  await expect(dialog.getByLabel('Disponibilidad').first()).toHaveValue('preferred')
  await expect(dialog.getByLabel('Objetivos de loot').first()).toHaveValue('64')
  await expect(dialog.getByText('Hoja')).toHaveCount(0)
})

test('locks stay visible, are removable and disappear with their participant', async ({ page }) => {
  await setup(page)
  await page.getByRole('button', { name: 'Planificar sesión' }).click()
  const dialog = page.getByRole('dialog', { name: 'Planificar sesión' })
  await dialog.getByRole('checkbox', { name: /^Healer/u }).check()
  await dialog.getByText('Opciones avanzadas y locks').click()
  await dialog.getByRole('combobox', { name: 'Participante' }).selectOption('2')
  await dialog.getByRole('combobox', { name: 'Rol' }).selectOption('healer')
  await dialog.getByRole('button', { name: 'Añadir lock' }).click()
  await expect(dialog.getByText('Healer: rol Sanador')).toBeVisible()
  await dialog.getByRole('checkbox', { name: /^Healer/u }).uncheck()
  await expect(dialog.getByText('Healer: rol Sanador')).toHaveCount(0)
})

test('participant selection permits five and blocks a sixth', async ({ page }) => {
  await setup(page)
  await page.getByRole('button', { name: 'Planificar sesión' }).click()
  const dialog = page.getByRole('dialog', { name: 'Planificar sesión' })
  for (const name of ['Healer', 'Hunter', 'Tank', 'Rogue']) await dialog.getByRole('checkbox', { name: new RegExp(`^${name}`, 'u') }).check()
  await expect(dialog.getByText('5 / 5')).toBeVisible()
  await expect(dialog.getByRole('checkbox', { name: /^Sixth/u })).toBeDisabled()
})

test('slider is keyboard-operable and composition suboptions retain values while disabled', async ({ page }) => {
  await setup(page)
  await page.getByRole('button', { name: 'Planificar sesión' }).click()
  const dialog = page.getByRole('dialog', { name: 'Planificar sesión' })
  const slider = dialog.getByRole('slider', { name: 'Nivel objetivo' })
  await slider.press('Home')
  await expect(slider).toHaveValue('1')
  await slider.press('End')
  await expect(slider).toHaveValue('20')
  const bloodlust = dialog.getByRole('checkbox', { name: 'Heroísmo' })
  await expect(bloodlust).toBeChecked()
  await dialog.getByRole('switch', { name: 'Optimizar composición' }).uncheck()
  await expect(bloodlust).toBeDisabled()
  await dialog.getByRole('switch', { name: 'Optimizar composición' }).check()
  await expect(bloodlust).toBeChecked()
})

test('empty, unconfigured, 422 and access-lost responses are explicit and recoverable', async ({ page }) => {
  let turn = 0
  await setup(page, async route => {
    turn += 1
    if (turn === 1) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...plannerResponse(), availability: { eligibleStoneCount: 0 }, status: 'no_valid_composition', diagnostics: { codes: ['NO_VALID_COMPOSITION'], unconfiguredUserIds: [], lockIssues: [] }, recommendations: [] }) })
    if (turn === 2) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...plannerResponse(), status: 'unconfigured_participants', diagnostics: { codes: ['UNCONFIGURED_PARTICIPANT'], unconfiguredUserIds: [2], lockIssues: [] }, recommendations: [] }) })
    if (turn === 3) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ ...plannerResponse(), status: 'invalid_input', diagnostics: { codes: ['INVALID_LOCK'], unconfiguredUserIds: [], lockIssues: ['LOCKS_HAVE_NO_CANDIDATE:2'] }, recommendations: [] }) })
    if (turn === 4) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...plannerResponse(), status: 'no_valid_composition', diagnostics: { codes: ['NO_VALID_COMPOSITION'], unconfiguredUserIds: [], lockIssues: [] }, recommendations: [] }) })
    if (turn === 5) return route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ detail: 'limit' }) })
    return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ detail: 'forbidden' }) })
  })
  await page.getByRole('button', { name: 'Planificar sesión' }).click()
  const dialog = page.getByRole('dialog', { name: 'Planificar sesión' })
  await dialog.getByRole('checkbox', { name: /^Healer/u }).check()
  const calculate = dialog.getByRole('button', { name: 'Calcular Top 5' })
  await calculate.click()
  await expect(dialog.getByText('No hay piedras disponibles')).toBeVisible()
  await dialog.getByRole('button', { name: 'Recalcular Top 5' }).click()
  await expect(dialog.getByText('Falta configurar: Healer')).toBeVisible()
  await dialog.getByRole('button', { name: 'Recalcular Top 5' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Los locks de Healer no coinciden con ninguna configuración disponible.')
  await dialog.getByRole('button', { name: 'Recalcular Top 5' }).click()
  await expect(dialog.getByText('No encontramos una composición válida')).toBeVisible()
  await dialog.getByRole('button', { name: 'Recalcular Top 5' }).click()
  await expect(dialog.getByRole('alert')).toContainText('El volumen de datos seleccionado supera los límites seguros del Planner.')
  await dialog.getByRole('button', { name: 'Reintentar' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Ya no tienes acceso a este equipo.')
})

test('an unconfigured current user gets the owner-only configuration action', async ({ page }) => {
  await setup(page, async route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...plannerResponse(), status: 'unconfigured_participants', diagnostics: { codes: ['UNCONFIGURED_PARTICIPANT'], unconfiguredUserIds: [1, 2], lockIssues: [] }, recommendations: [] }) }))
  await page.getByRole('button', { name: 'Planificar sesión' }).click()
  const dialog = page.getByRole('dialog', { name: 'Planificar sesión' })
  await dialog.getByRole('checkbox', { name: /^Healer/u }).check()
  await dialog.getByRole('button', { name: 'Calcular Top 5' }).click()
  await expect(dialog.getByText('Falta configurar: Speeson, Healer')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Configurar mis personajes' })).toHaveCount(2)
})

test('a new calculation aborts and rejects a late previous result', async ({ page }) => {
  let turn = 0
  let releaseFirst!: () => void
  const firstGate = new Promise<void>(resolve => { releaseFirst = resolve })
  await setup(page, async (route, body) => {
    turn += 1
    if (turn === 1) {
      await firstGate
      const old = plannerResponse(body.challengeMapId as number | null)
      old.recommendations[0].stone.dungeon = 'Resultado obsoleto'
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(old) }).catch(() => undefined)
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(plannerResponse(body.challengeMapId as number | null)) })
  })
  await page.getByRole('button', { name: 'Planificar sesión' }).click()
  const dialog = page.getByRole('dialog', { name: 'Planificar sesión' })
  await dialog.getByRole('checkbox', { name: /^Healer/u }).check()
  await dialog.getByRole('button', { name: 'Calcular Top 5' }).click()
  await dialog.getByRole('slider', { name: 'Nivel objetivo' }).press('ArrowRight')
  await dialog.getByRole('button', { name: 'Calcular Top 5' }).click()
  await expect(dialog.locator('[data-planner-recommendation]')).toHaveCount(3)
  releaseFirst()
  await expect(dialog.getByText('Resultado obsoleto')).toHaveCount(0)
})

for (const scenario of [
  { status: 401, destination: /\/login$/u, label: '401 redirects to login' },
  { status: 404, destination: /\/teams$/u, label: '404 redirects to Teams' },
] as const) {
  test(scenario.label, async ({ page }) => {
    await setup(page, async route => route.fulfill({ status: scenario.status, contentType: 'application/json', body: JSON.stringify({ detail: 'error' }) }))
    await page.getByRole('button', { name: 'Planificar sesión' }).click()
    const dialog = page.getByRole('dialog', { name: 'Planificar sesión' })
    await dialog.getByRole('checkbox', { name: /^Healer/u }).check()
    await dialog.getByRole('button', { name: 'Calcular Top 5' }).click()
    await expect(page).toHaveURL(scenario.destination)
  })
}

test('500 stays in the Planner with a generic retry action', async ({ page }) => {
  await setup(page, async route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'sensitive internal detail' }) }))
  await page.getByRole('button', { name: 'Planificar sesión' }).click()
  const dialog = page.getByRole('dialog', { name: 'Planificar sesión' })
  await dialog.getByRole('checkbox', { name: /^Healer/u }).check()
  await dialog.getByRole('button', { name: 'Calcular Top 5' }).click()
  await expect(dialog.getByRole('alert')).toContainText('No se pudo calcular el plan. Inténtalo de nuevo.')
  await expect(dialog.getByText('sensitive internal detail')).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Reintentar' })).toBeVisible()
})

test('network failures stay generic and retryable', async ({ page }) => {
  await setup(page, async route => route.abort('failed'))
  await page.getByRole('button', { name: 'Planificar sesión' }).click()
  const dialog = page.getByRole('dialog', { name: 'Planificar sesión' })
  await dialog.getByRole('checkbox', { name: /^Healer/u }).check()
  await dialog.getByRole('button', { name: 'Calcular Top 5' }).click()
  await expect(dialog.getByRole('alert')).toContainText('No se pudo calcular el plan. Inténtalo de nuevo.')
  await expect(dialog.getByRole('button', { name: 'Reintentar' })).toBeVisible()
})

test.describe('mobile and keyboard', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  test('stone entry is labelled, scrollable and Escape restores focus', async ({ page }) => {
    await setup(page)
    await page.getByRole('button', { name: /Ruby Life Pools/u }).click()
    const trigger = page.getByRole('tab', { name: 'Planificar piedra' })
    await trigger.click()
    await expect(page.getByRole('dialog', { name: /Planificar piedra/u })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: /Planificar piedra/u })).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })
})
