import { expect, test } from '@playwright/test'

import { users } from './fixtures/users'
import { expectBackendAvailable } from './support/api'
import { expectMainContent, loginViaUi } from './support/app'

test.describe('regresi layout aplikasi', () => {
  test.beforeEach(async ({ request }) => {
    await expectBackendAvailable(request)
  })

  test('konten utama evaluator tidak terkompres oleh collision design token', async ({ page }) => {
    await loginViaUi(page, users.evaluator)
    await page.goto('/evaluator/evaluasi')
    await expectMainContent(page)

    const content = page.locator('[data-app-content]')
    await expect(content).toBeVisible()

    const box = await content.boundingBox()
    expect(box).not.toBeNull()
    expect(box?.width).toBeGreaterThan(640)
  })
})
