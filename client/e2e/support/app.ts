import { expect, type Locator, type Page } from '@playwright/test'
import type { E2eUser } from '../fixtures/users'
import { apiBaseURL } from './api'

const appErrorPattern =
  /unexpected application error|terjadi kesalahan|cannot get|internal server error/i
const browserApiBaseURL =
  process.env.E2E_BROWSER_API_BASE_URL ?? apiBaseURL.replace('127.0.0.1', 'localhost')

export async function expectNoAppShellError(page: Page): Promise<void> {
  await expect(page.locator('body')).not.toContainText(appErrorPattern)
}

export async function expectMainContent(page: Page): Promise<void> {
  await waitForAppReady(page)
  await expect(page.locator('#main-content, main, body').first()).toBeVisible()
  await expectNoAppShellError(page)
}

export async function loginViaUi(page: Page, user: E2eUser): Promise<void> {
  await page.goto('/login')
  await waitForAppReady(page)
  await expect(page.getByRole('heading', { name: /selamat datang/i })).toBeVisible()
  await page.getByLabel('Email').fill(user.email)
  await page.locator('input#password, input[name="password"], input[type="password"]').first().fill(user.password)
  await page.getByRole('button', { name: /^masuk$/i }).click()
  await expect(page).toHaveURL(new RegExp(escapeRegExp(user.landingPath)))
  await expectMainContent(page)
}

export async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded')
  // SSR markup may be visible before React has attached event handlers. Waiting on
  // the root hydration marker prevents interactions from being overwritten by hydration.
  await expect(page.locator('html[data-app-hydrated="true"]')).toBeAttached()
  await expect(page.locator('body')).toBeVisible()
}

export async function logoutViaUi(page: Page): Promise<void> {
  await page.getByRole('button', { name: /profil/i }).click()
  await page.getByRole('menuitem', { name: /logout/i }).click()
  await expect(page).toHaveURL(/\/($|\?)/)
}

export async function expectVisibleNavigation(
  page: Page,
  labels: string[],
): Promise<void> {
  for (const label of labels) {
    await expect(page.getByRole('link', { name: label, exact: true }).first()).toBeVisible()
  }
}

export async function expectRouteLoads(page: Page, path: string): Promise<void> {
  await page.goto(path)
  await expect(page).toHaveURL(new RegExp(escapeRegExp(path)))
  await expectMainContent(page)
}

export async function expectForbiddenRedirect(
  page: Page,
  forbiddenPath: string,
  landingPath: string,
): Promise<void> {
  await page.goto(forbiddenPath)
  await expect(page).not.toHaveURL(new RegExp(escapeRegExp(forbiddenPath)))
  await expect(page).toHaveURL(new RegExp(escapeRegExp(landingPath)))
  await expectMainContent(page)
}

export async function fillByLabelOrPlaceholder(
  page: Page,
  labelOrPlaceholder: string | RegExp,
  value: string,
): Promise<void> {
  const byLabel = page.getByLabel(labelOrPlaceholder).first()
  if (await byLabel.isVisible().catch(() => false)) {
    await byLabel.fill(value)
    return
  }

  const byPlaceholder = page.getByPlaceholder(labelOrPlaceholder).first()
  await expect(byPlaceholder).toBeVisible()
  await byPlaceholder.fill(value)
}

export async function clickIfEnabled(locator: Locator): Promise<boolean> {
  if (!(await locator.isVisible().catch(() => false))) return false
  if (!(await locator.isEnabled().catch(() => false))) return false
  await locator.click()
  return true
}

export function uniqueSuffix(prefix = 'E2E'): string {
  const raw = `${prefix}-${new Date().toISOString()}-${Math.random().toString(36).slice(2, 8)}`
  return raw.replace(/[^A-Za-z0-9-]/g, '').slice(0, 48)
}

export async function expectToastOrPersistedText(
  page: Page,
  text: string | RegExp,
): Promise<void> {
  await expect(page.getByText(text).first()).toBeVisible({ timeout: 15_000 })
}

export async function searchPageIfAvailable(
  page: Page,
  value: string,
): Promise<void> {
  const inputs = page.locator(
    'main input[placeholder*="cari" i], main input[placeholder*="pencarian" i], main input[placeholder*="search" i], main input[aria-label*="cari" i], main input[aria-label*="pencarian" i], main input[aria-label*="search" i]',
  )
  await expect(inputs.first()).toBeVisible()
  const count = await inputs.count()

  for (let index = 0; index < count; index += 1) {
    const input = inputs.nth(index)
    if (!(await input.isVisible().catch(() => false))) continue
    await input.fill(value)
    await expect(input).toHaveValue(value)

    // Arsip global search is debounced into router state. Synchronize on that
    // observable state instead of sleeping or assuming fill() means results are ready.
    if ((await input.getAttribute('id')) === 'arsip-global-search') {
      await expect(page).toHaveURL((url) => url.searchParams.get('q') === value)
    }
    return
  }

  throw new Error('Search input tidak ditemukan pada halaman ini')
}

export async function apiDeleteViaActivePageSession(
  page: Page,
  url: string,
): Promise<void> {
  const targetUrl = toApiUrl(url)
  const status = await page.evaluate(async (requestUrl) => {
    const response = await fetch(requestUrl, {
      method: 'DELETE',
      credentials: 'include',
    })
    return response.status
  }, targetUrl)
  expect(status, `DELETE ${url} via active page session`).toBeGreaterThanOrEqual(200)
  expect(status, `DELETE ${url} via active page session`).toBeLessThan(300)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function toApiUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url
  const path = url.startsWith('/') ? url : `/${url}`
  return `${browserApiBaseURL.replace(/\/$/, '')}${path}`
}
