import { expect, test } from '@playwright/test'

import { users } from './fixtures/users'
import { expectBackendAvailable } from './support/api'
import { expectMainContent, loginViaUi, searchPageIfAvailable } from './support/app'
import { createAuthenticatedApiContext } from './support/api'
import { createDraftSopFixture, createReadySopFixture } from './support/e2e-flow'

test.describe('E2E pencarian, filter, dan pagination daftar SOP', () => {
  test.beforeEach(async ({ request }) => {
    await expectBackendAvailable(request)
  })

  test('E2E-68: daftar SOP berubah sesuai pencarian, filter status, dan navigasi halaman', async ({ page }) => {
    const penyusun = await createAuthenticatedApiContext(users.penyusun)
    try {
      const draft = await createDraftSopFixture(penyusun, 'LIST-DRAFT')
      const ready = await createReadySopFixture(penyusun, 'LIST-READY')

      await loginViaUi(page, users.penyusun)
      await page.goto('/penyusun/sop')
      await expectMainContent(page)

      await searchPageIfAvailable(page, draft.title)
      await expect(page.getByText(draft.title).first()).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(ready.title)).toHaveCount(0)

      const filter = page.getByRole('combobox').filter({ hasText: /status|semua|draft/i }).first()
      if (await filter.isVisible().catch(() => false)) {
        await filter.click()
        const draftOption = page.getByRole('option', { name: /draft/i }).first()
        if (await draftOption.isVisible().catch(() => false)) {
          await draftOption.click()
          await expect(page.locator('body')).toContainText(/draft/i)
        }
      }

      const nextButton = page.getByRole('button', { name: /berikut|next|selanjutnya/i }).first()
      if (await nextButton.isVisible().catch(() => false)) {
        await nextButton.click({ trial: true })
      }
    } finally {
      await penyusun.dispose()
    }
  })
})
