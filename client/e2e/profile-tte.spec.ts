import { expect, test } from '@playwright/test'
import { users } from './fixtures/users'
import { expectBackendAvailable } from './support/api'
import { expectMainContent, loginViaUi } from './support/app'

test.describe('E2E profil akun dan TTE', () => {
  test.beforeEach(async ({ request }) => {
    await expectBackendAvailable(request)
  })

  test('profil semua role menampilkan identitas dan form kata sandi', async ({ page }) => {
    for (const user of [users.penyusun, users.evaluator, users.kepalaOpd]) {
      await test.step(`profil ${user.role}`, async () => {
        await page.context().clearCookies()
        await loginViaUi(page, user)
        await page.getByRole('button', { name: /profil/i }).click()
        await page.getByRole('menuitem', { name: /profil saya/i }).click()

        await expectMainContent(page)
        await expect(page.locator('body')).toContainText(/profil saya/i)
        await expect(page.locator('body')).toContainText(/kata sandi/i)
        await expect(page.getByRole('button', { name: /simpan perubahan/i })).toBeVisible()
      })
    }
  })

  test('role dengan kewenangan TTE melihat section sertifikat/PIN', async ({ page }) => {
    for (const user of [users.pjEvaluator, users.pjPenyusun, users.kepalaOpd]) {
      await test.step(`TTE ${user.role}`, async () => {
        await page.context().clearCookies()
        await loginViaUi(page, user)
        await page.goto(user.role === 'KEPALA_OPD' ? '/kepala-opd/me' : user.role === 'PJ_EVALUATOR' ? '/pj-evaluator/me' : '/penyusun/me')

        await expectMainContent(page)
        await expect(page.locator('body')).toContainText(/tte|sertifikat|pin/i)
        await expect(
          page.getByRole('button', { name: /ubah pin|atur sertifikat|ganti sertifikat|buat otomatis/i }).first(),
        ).toBeVisible({ timeout: 15_000 })
      })
    }
  })

  test('penyusun biasa tidak melihat aksi setup TTE', async ({ page }) => {
    await loginViaUi(page, users.penyusun)
    await page.goto('/penyusun/me')
    await expectMainContent(page)

    await expect(page.locator('body')).toContainText(/profil saya|kata sandi/i)
    await expect(
      page.getByRole('button', { name: /ubah pin|atur sertifikat|ganti sertifikat|buat otomatis/i }),
    ).toHaveCount(0)
  })
})
