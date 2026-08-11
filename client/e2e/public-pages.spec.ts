import { expect, test } from '@playwright/test'
import { expectNoAppShellError } from './support/app'

test.describe('E2E halaman publik', () => {
  test('landing page publik dapat dibuka tanpa login', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('body')).toBeVisible()
    await expectNoAppShellError(page)
  })

  test('arsip publik dapat dibuka tanpa login dan menyediakan pencarian/daftar SOP', async ({ page }) => {
    await page.goto('/arsip')
    await expect(page).toHaveURL(/\/arsip/)
    await expect(page.locator('body')).toContainText(/arsip|sop|opd/i)
    await expectNoAppShellError(page)

    const searchInput = page
      .getByPlaceholder(/cari judul|cari sop|cari opd|pencarian/i)
      .first()
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('SOP')
      await expectNoAppShellError(page)
    }
  })

  test('halaman verifikasi PDF dapat dibuka tanpa login', async ({ page }) => {
    await page.goto('/validasi/pdf')
    await expect(page).toHaveURL(/\/validasi\/pdf/)
    await expect(page.locator('body')).toContainText(/verifikasi|pdf|tanda tangan/i)
    await expectNoAppShellError(page)
  })

  test('tautan verifikasi pengesahan tidak valid menampilkan status aman', async ({ page }) => {
    await page.goto('/validasi/pengesahan/dokumen-tidak-valid/user-tidak-valid')
    await expect(page).toHaveURL(/\/validasi\/pengesahan/)
    await expect(page.locator('body')).toContainText(/tidak|valid|ditemukan|verifikasi/i)
    await expectNoAppShellError(page)
  })
})
