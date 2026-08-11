import { expect, test } from '@playwright/test'
import { users } from './fixtures/users'
import { expectBackendAvailable } from './support/api'
import { expectMainContent, loginViaUi } from './support/app'

test.describe('E2E observasi workflow evaluasi, TTE, dan pengesahan', () => {
  test.beforeEach(async ({ request }) => {
    await expectBackendAvailable(request)
  })

  test('Evaluator dapat membuka workspace evaluasi dan melihat daftar/status pengajuan', async ({ page }) => {
    await loginViaUi(page, users.evaluator)
    await page.goto('/evaluator/evaluasi')
    await expectMainContent(page)
    await expect(page.locator('body')).toContainText(/evaluasi|pengajuan|sop/i)
  })

  test('PJ Evaluator dapat membuka manajemen evaluasi dan grafik evaluasi', async ({ page }) => {
    await loginViaUi(page, users.pjEvaluator)

    await page.goto('/pj-evaluator/grafik-evaluasi')
    await expectMainContent(page)
    await expect(page.locator('body')).toContainText(/grafik|evaluasi|opd/i)

    await page.goto('/pj-evaluator/evaluasi')
    await expectMainContent(page)
    await expect(page.locator('body')).toContainText(/evaluasi|pengajuan|berita acara|sop/i)
  })

  test('PJ Penyusun dapat membuka daftar berita acara untuk tahap tanda tangan OPD', async ({ page }) => {
    await loginViaUi(page, users.pjPenyusun)
    await page.goto('/penyusun/pj-penyusun/berita-acara')
    await expectMainContent(page)
    await expect(page.locator('body')).toContainText(/berita acara|evaluasi|sop/i)
  })

  test('Kepala OPD dapat membuka pemantauan SOP dan pengajuan pengesahan', async ({ page }) => {
    await loginViaUi(page, users.kepalaOpd)

    await page.goto('/kepala-opd/sop')
    await expectMainContent(page)
    await expect(page.locator('body')).toContainText(/sop|status|pantau/i)

    await page.goto('/kepala-opd/pengajuan')
    await expectMainContent(page)
    await expect(page.locator('body')).toContainText(/pengajuan|sop|pengesahan|berita acara/i)
  })
})
