import { expect, test, type Page, type Route } from '@playwright/test'

const API = 'https://api-keystonesync.esgarpe.dev'
const cors = { 'Access-Control-Allow-Origin': '*' }

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(body) })
}

async function mockAuthenticatedShell(page: Page) {
  await page.route(`${API}/api/me`, route => json(route, { username: 'Existing', avatarUrl: null, syncToken: 'sync', shareKeystoneLootWithTeams: true }))
  await page.route(`${API}/api/me/characters`, route => json(route, []))
  await page.route(`${API}/api/teams`, route => json(route, []))
}

test('login starts Battle.net in the official browser authorization page', async ({ page }) => {
  await page.route(`${API}/api/auth/battlenet/start`, route => json(route, {
    authorizationUrl: 'https://oauth.battle.net/authorize?response_type=code&scope=openid',
  }))
  await page.route('https://oauth.battle.net/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Battle.net authorization</h1>' }))
  await page.goto('/login')
  const battleNetButton = page.getByRole('button', { name: 'Continuar con Battle.net' })
  await expect(battleNetButton.locator('svg[aria-hidden="true"]')).toBeVisible()
  await battleNetButton.click()
  await expect(page).toHaveURL(/oauth\.battle\.net\/authorize/)
  await expect(page.getByRole('heading', { name: 'Battle.net authorization' })).toBeVisible()
})

test('linked Battle.net callback exchanges the ticket outside the URL and opens dashboard', async ({ page }) => {
  await mockAuthenticatedShell(page)
  let exchangeBody: unknown
  await page.route(`${API}/api/auth/battlenet/exchange`, async route => {
    exchangeBody = route.request().postDataJSON()
    await json(route, { status: 'ready', accessToken: 'keystone-jwt', tokenType: 'bearer' })
  })
  await page.goto('/login/battlenet/callback?ticket=opaque-ticket')
  await expect(page).toHaveURL(/\/dashboard$/)
  expect(exchangeBody).toEqual({ ticket: 'opaque-ticket' })
  expect(await page.evaluate(() => localStorage.getItem('access_token'))).toBe('keystone-jwt')
  expect(page.url()).not.toContain('keystone-jwt')
})

test('unknown Battle.net identity can create an explicitly named KeystoneSync account', async ({ page }) => {
  await mockAuthenticatedShell(page)
  await page.route(`${API}/api/auth/battlenet/onboarding/status`, route => json(route, {
    status: 'needs_onboarding', displayName: 'Speeson#1234', desktop: false,
  }))
  let registerBody: unknown
  await page.route(`${API}/api/auth/battlenet/onboarding/register`, async route => {
    registerBody = route.request().postDataJSON()
    await json(route, { status: 'ready', accessToken: 'registered-jwt', tokenType: 'bearer' })
  })
  await page.goto('/login/battlenet/onboarding?ticket=register-ticket')
  await expect(page.getByText('Speeson#1234')).toBeVisible()
  await page.getByLabel('Username KeystoneSync').fill('ChosenName')
  await page.getByRole('button', { name: 'Crear cuenta KeystoneSync' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  expect(registerBody).toEqual({ ticket: 'register-ticket', username: 'ChosenName' })
})

test('unknown Battle.net identity can link verified existing credentials', async ({ page }) => {
  await mockAuthenticatedShell(page)
  await page.route(`${API}/api/auth/battlenet/onboarding/status`, route => json(route, {
    status: 'needs_onboarding', displayName: 'Speeson#1234', desktop: false,
  }))
  let linkBody: unknown
  await page.route(`${API}/api/auth/battlenet/onboarding/link`, async route => {
    linkBody = route.request().postDataJSON()
    await json(route, { status: 'ready', accessToken: 'existing-jwt', tokenType: 'bearer' })
  })
  await page.goto('/login/battlenet/onboarding?ticket=link-ticket')
  await page.getByRole('button', { name: 'Vincular existente' }).click()
  await page.getByLabel('Username KeystoneSync').fill('Existing')
  await page.getByLabel('Password').fill('Correct1')
  await page.getByRole('button', { name: 'Vincular cuenta existente' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  expect(linkBody).toEqual({ ticket: 'link-ticket', username: 'Existing', password: 'Correct1' })
})

test('settings renders the linked BattleTag without exposing provider subject', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('access_token', 'keystone-jwt'))
  await page.route(`${API}/api/me`, route => json(route, { username: 'Existing', avatarUrl: null, syncToken: 'sync', shareKeystoneLootWithTeams: true }))
  await page.route(`${API}/api/me/identities`, route => json(route, {
    battleNet: { linked: true, displayName: 'Speeson#1234', linkedAt: '2026-09-08T00:00:00.000Z' },
  }))
  await page.goto('/settings')
  await expect(page.getByText('Speeson#1234 · Vinculado')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Desvincular' })).toBeVisible()
  await expect(page.getByText('private-subject')).toHaveCount(0)
})

test('settings renders the Battle.net icon on the link action', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('access_token', 'keystone-jwt'))
  await mockAuthenticatedShell(page)
  await page.route(`${API}/api/me/identities`, route => json(route, {
    battleNet: { linked: false, displayName: null, linkedAt: null },
  }))
  await page.goto('/settings')

  const linkButton = page.getByRole('button', { name: 'Vincular Battle.net' })
  await expect(linkButton).toBeVisible()
  await expect(linkButton.locator('svg[aria-hidden="true"]')).toBeVisible()
})
