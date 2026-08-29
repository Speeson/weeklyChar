import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test'

const team = {
  id: 7,
  name: 'Poison Progression',
  inviteCode: 'STONE-S3',
  isOwner: true,
  ownerId: 1,
  currentUserId: 1,
  members: [
    {
      userId: 1,
      username: 'Speeson',
      characters: [
        {
          id: 10, name: 'Bakuhatsu', realm: "Zul'jin", region: 'eu', wowClass: 'Mage',
          avatarUrl: null,
          currentKeystone: { level: 14, dungeon: 'Ruby Life Pools', challengeMapId: 399, updatedAt: 1_800_000_000 },
        },
        {
          id: 11, name: 'Arcana', realm: "Zul'jin", region: 'eu', wowClass: 'Mage',
          avatarUrl: null,
          currentKeystone: { level: 12, dungeon: 'Ruby Life Pools', challengeMapId: 399, updatedAt: 1_800_000_000 },
        },
      ],
    },
    {
      userId: 2,
      username: 'Verylongmembernamefortesting',
      characters: [
        {
          id: 20, name: 'Longcharacternamefortesting', realm: 'Dun Modr', region: 'eu', wowClass: 'Druid',
          avatarUrl: null,
          currentKeystone: { level: 11, dungeon: 'Temple of Sethraliss', challengeMapId: 250, updatedAt: 1_800_000_000 },
        },
      ],
    },
  ],
}

const tierCounts = {
  bestInSlot: 2,
  mustHave: 1,
  niceToHave: 1,
  catalyst: 1,
  transmog: 0,
  other: 1,
}

const baseObjective = {
  itemId: 12345,
  itemName: 'Brazales estabilizantes de embalsamador',
  iconUrl: 'https://render.worldofwarcraft.com/eu/icons/56/object.jpg',
  tier: 3,
  specIds: [62, 64],
  sourceType: 'dungeon',
  sourceId: 399,
  slotId: 9,
  slotName: 'Muñecas',
  itemClassName: 'Armadura',
  itemSubClassName: 'Tela',
  statNames: ['Intelecto', 'Aguante', 'Celeridad', 'Maestría'],
  voidcoreState: 'pending',
}

function summary(challengeMapId = 399) {
  return {
    teamId: 7,
    challengeMapId,
    availability: {
      stoneCount: challengeMapId === 399 ? 2 : challengeMapId === 250 ? 1 : 0,
      stones: challengeMapId === 399 ? [
        { characterId: 10, characterName: 'Bakuhatsu', ownerUserId: 1, ownerUsername: 'Speeson', level: 14 },
        { characterId: 11, characterName: 'Arcana', ownerUserId: 1, ownerUsername: 'Speeson', level: 12 },
      ] : challengeMapId === 250 ? [
        { characterId: 20, characterName: 'Longcharacternamefortesting', ownerUserId: 2, ownerUsername: 'Verylongmembernamefortesting', level: 11 },
      ] : [],
    },
    summary: challengeMapId === 399
      ? { charactersWithObjectives: 2, totalObjectives: 6, tiers: tierCounts }
      : {
          charactersWithObjectives: 0,
          totalObjectives: 0,
          tiers: { bestInSlot: 0, mustHave: 0, niceToHave: 0, catalyst: 0, transmog: 0, other: 0 },
        },
    characters: challengeMapId === 399 ? [
      {
        userId: 1,
        username: 'Speeson',
        characterId: 10,
        characterName: 'Bakuhatsu',
        realm: "Zul'jin",
        region: 'eu',
        wowClass: 'Mage',
        avatarUrl: null,
        ilvl: 712,
        rioScore: 2800,
        totalObjectives: 5,
        tierCounts,
        specs: [
          { specId: 62, objectiveCount: 3, tierCounts },
          { specId: 64, objectiveCount: 4, tierCounts },
        ],
        objectives: [
          baseObjective,
          { ...baseObjective, itemId: 12346, itemName: 'Manto de ceniza', tier: 2, specIds: [64] },
          { ...baseObjective, itemId: 12347, itemName: 'Sello de la vida', tier: 1, specIds: [62] },
          { ...baseObjective, itemId: 12348, itemName: 'Catalizador latente', tier: 5, specIds: [64] },
          { ...baseObjective, itemId: 12349, itemName: 'Reliquia futura', tier: 99, specIds: [62] },
          { ...baseObjective, itemId: 12350, itemName: 'Recuerdo completado', tier: 3, specIds: [62, 64], voidcoreState: 'completed_with_voidcore' },
        ],
      },
      {
        userId: 2,
        username: 'Verylongmembernamefortesting',
        characterId: 20,
        characterName: 'Longcharacternamefortesting',
        realm: 'Dun Modr',
        region: 'eu',
        wowClass: 'Druid',
        avatarUrl: null,
        ilvl: null,
        rioScore: null,
        totalObjectives: 1,
        tierCounts: { ...tierCounts, bestInSlot: 1, mustHave: 0, niceToHave: 0, catalyst: 0, other: 0 },
        specs: [{ specId: 102, objectiveCount: 1, tierCounts }],
        objectives: [{
          ...baseObjective,
          itemId: 22222,
          itemName: null,
          iconUrl: null,
          slotName: null,
          itemClassName: null,
          itemSubClassName: null,
          statNames: [],
          specIds: [102],
        }],
      },
    ] : [],
  }
}

async function screenshot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true })
}

async function setup(page: Page, selectorHandler?: (route: Route, challengeMapId: number) => Promise<void>) {
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'visual-token')
    localStorage.setItem('username', 'Speeson')
  })
  await page.route('https://render.worldofwarcraft.com/**', route => route.fulfill({
    status: 200,
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#7c3aed"/><path d="M14 14h36v36H14z" fill="#facc15"/></svg>',
  }))
  await page.route('https://api-keystonesync.esgarpe.dev/**', async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/teams/7') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(team) })
      return
    }
    if (url.pathname === '/api/me') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, username: 'Speeson' }) })
      return
    }
    const match = url.pathname.match(/\/api\/teams\/7\/keystone-loot\/dungeons\/(\d+)\/summary/u)
    if (match) {
      const challengeMapId = Number(match[1])
      if (selectorHandler) await selectorHandler(route, challengeMapId)
      else await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(summary(challengeMapId)) })
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.goto('/teams/7')
  await expect(page.getByRole('heading', { name: 'Poison Progression' })).toBeVisible()
}

test('Selector closed shows all eight canonical dungeons and removes the old header planner', async ({ page }, testInfo) => {
  await setup(page)
  await expect(page.getByRole('heading', { name: 'Selector de piedra' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Ruby Life Pools.*2 piedras/u })).toBeVisible()
  await expect(page.getByRole('button', { name: /Temple of Sethraliss.*1 piedra/u })).toBeVisible()
  await expect(page.getByRole('button', { name: /Voidscar Arena.*0 piedras/u })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Planificar piedra' })).toHaveCount(0)
  await expect(page.getByRole('tabpanel')).toHaveCount(0)
  await screenshot(page, testInfo, 'desktop-selector-closed')
})

test('switching dungeons aborts stale results, keeps zero-count selectable and scopes loading to the panel', async ({ page }, testInfo) => {
  let releaseRuby!: () => void
  const rubyGate = new Promise<void>(resolve => { releaseRuby = resolve })
  await setup(page, async (route, challengeMapId) => {
    if (challengeMapId === 399) await rubyGate
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(summary(challengeMapId)) })
  })
  await page.getByRole('button', { name: /Ruby Life Pools.*2 piedras/u }).click()
  await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-busy', 'true')
  await expect(page.getByRole('heading', { name: 'Poison Progression' })).toBeVisible()
  await screenshot(page, testInfo, 'desktop-selector-loading')

  await page.getByRole('button', { name: /Voidscar Arena.*0 piedras/u }).click()
  await expect(page.getByText('Ningún personaje del equipo tiene objetivos pendientes en esta mazmorra.')).toBeVisible()
  releaseRuby()
  await expect(page.getByText('Brazales estabilizantes de embalsamador')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Voidscar Arena.*0 piedras/u })).toHaveAttribute('aria-pressed', 'true')
  await screenshot(page, testInfo, 'desktop-selector-empty')
})

test('summary preserves character order and expanded multi-spec grids expose completed items and keyboard tooltip', async ({ page }, testInfo) => {
  await setup(page)
  await page.getByRole('button', { name: /Ruby Life Pools.*2 piedras/u }).click()
  await expect(page.getByText('2 personajes · 6 objetivos')).toBeVisible()
  await expect(page.getByText('2 piedras disponibles')).toBeVisible()
  const cards = page.locator('[data-selector-character]')
  await expect(cards).toHaveCount(2)
  await expect(cards.nth(0)).toContainText('Bakuhatsu')
  await expect(cards.nth(1)).toContainText('Longcharacternamefortesting')

  await cards.nth(0).getByRole('button', { name: 'Ver objetos' }).click()
  await expect(cards.nth(0).getByRole('button', { name: /Arcane · 3/u })).toBeVisible()
  await expect(cards.nth(0).getByRole('button', { name: /Frost · 4/u })).toBeVisible()
  await expect(cards.nth(0).getByText('BEST IN SLOT · 1')).toBeVisible()
  await expect(cards.nth(0).getByText('Completados con Voidcore')).toBeVisible()

  await cards.nth(1).getByRole('button', { name: 'Ver objetos' }).click()
  await expect(cards.nth(1).getByRole('button', { name: /Todas · 1/u })).toHaveCount(0)
  const fallbackItem = cards.nth(1).getByRole('button', { name: /Objeto #22222/u })
  await fallbackItem.focus()
  await expect(page.getByRole('tooltip')).toContainText('Metadatos no disponibles')
  await page.keyboard.press('Escape')

  const item = cards.nth(0).getByRole('button', { name: /Brazales estabilizantes/u })
  await item.focus()
  await expect(page.getByRole('tooltip')).toContainText('Muñecas · Tela')
  await expect(page.getByRole('tooltip')).toContainText('Intelecto')
  await expect(page.getByRole('tooltip')).not.toContainText('+2732')
  await screenshot(page, testInfo, 'desktop-selector-expanded-tooltip')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('tooltip')).toHaveCount(0)
})

test.describe('touch viewport', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('mobile strip, expanded items and tap tooltip remain inside the viewport', async ({ page }, testInfo) => {
    await setup(page)
    await page.getByRole('button', { name: /Ruby Life Pools.*2 piedras/u }).click()
    const card = page.locator('[data-selector-character]').first()
    await card.getByRole('button', { name: 'Ver objetos' }).click()
    const item = card.getByRole('button', { name: /Brazales estabilizantes/u })
    await item.tap()
    await expect(page.getByRole('tooltip')).toBeVisible()
    const box = await page.getByRole('tooltip').boundingBox()
    expect(box).not.toBeNull()
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390)
    await screenshot(page, testInfo, 'mobile-selector-expanded-tooltip')
  })
})

test('lost Team access remains an inline recoverable Selector error', async ({ page }, testInfo) => {
  await setup(page, async route => {
    await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ detail: 'forbidden' }) })
  })
  await page.getByRole('button', { name: /Ruby Life Pools.*2 piedras/u }).click()
  await expect(page.getByRole('tabpanel').getByRole('alert')).toContainText('Ya no tienes acceso a este equipo.')
  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible()
  await screenshot(page, testInfo, 'desktop-selector-access-lost')
})
