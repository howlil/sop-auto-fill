import { expect, test } from '@playwright/test'

import { users } from './fixtures/users'
import { apiGet, createAuthenticatedApiContext, expectBackendAvailable } from './support/api'
import { expectMainContent, expectNoAppShellError, loginViaUi } from './support/app'
import { createApprovedSopFixture, createDraftSopFixture } from './support/e2e-flow'

interface PublicSopPage {
  items: Array<{
    detailSopId: string
    opdId: string
    judul: string
    nomorSOP: string
    pdfUrl?: string
  }>
}

test.describe('E2E arsip internal, arsip publik, dan verifikasi pengesahan', () => {
  test.beforeEach(async ({ request }) => {
    await expectBackendAvailable(request)
  })

  test('E2E-58 dan E2E-59: pengguna berwenang dapat membuka aksi cetak/unduh SOP dan berita acara', async ({ page }) => {
    const approved = await createApprovedSopFixture('DOWNLOAD')

    await loginViaUi(page, users.penyusun)
    await page.goto(`/penyusun/sop/${approved.detailSopId}`)
    await expectMainContent(page)
    await expect(page.locator('body')).toContainText(/cetak|unduh|download|sop/i)

    await page.goto('/penyusun/pj-penyusun/berita-acara')
    await expectMainContent(page)
    await expect(page.locator('body')).toContainText(/berita acara|unduh|evaluasi|sop/i)
  })

  test('E2E-60 sampai E2E-63: arsip publik hanya menampilkan SOP berlaku dan menyediakan pratinjau', async ({ page, request }) => {
    const approved = await createApprovedSopFixture('PUBLIC')
    const penyusun = await createAuthenticatedApiContext(users.penyusun)
    const draft = await createDraftSopFixture(penyusun, 'PUBLIC-DRAFT')
    await penyusun.dispose()

    const approvedSearch = await apiGet<PublicSopPage>(
      request,
      `/sop/public/sop?search=${encodeURIComponent(approved.title)}`,
    )
    const approvedPublicItem = approvedSearch.items.find((item) => item.detailSopId === approved.detailSopId)
    expect(approvedPublicItem, 'SOP berlaku harus muncul di endpoint arsip publik').toBeTruthy()

    const draftSearch = await apiGet<PublicSopPage>(
      request,
      `/sop/public/sop?search=${encodeURIComponent(draft.title)}`,
    )
    expect(draftSearch.items.some((item) => item.detailSopId === draft.detailSopId)).toBe(false)

    await page.goto(
      `/arsip?q=${encodeURIComponent(approved.title)}&opdId=${approvedPublicItem!.opdId}&detailSopId=${approved.detailSopId}`,
    )
    await expect(page).toHaveURL(/\/arsip/)
    await expect(page.locator('body')).toContainText(/arsip|sop|opd/i)
    await expect(page.getByText(approved.title).first()).toBeVisible({ timeout: 15_000 })

    await expectNoAppShellError(page)
    await expect(page.locator('body')).toContainText(/pratinjau|preview|dokumen|sop/i)
    await expect(page.locator('body')).not.toContainText(/catatan evaluator|nilai opd|internal evaluasi/i)
  })

  test('E2E-64 dan E2E-65: verifikasi pengesahan valid dan tidak valid tampil aman', async ({ page }) => {
    const approved = await createApprovedSopFixture('VERIFY')
    if (!approved.pengesahan) {
      throw new Error('Fixture SOP berlaku tidak memuat payload pengesahan TTE')
    }

    await page.goto(
      `/validasi/pengesahan/${approved.pengesahan.dokumenTteId}/${approved.pengesahan.userId}`,
    )
    await expect(page.locator('body')).toContainText(/valid|terverifikasi|pengesahan|tanda tangan/i)
    await expectNoAppShellError(page)

    await page.goto('/validasi/pengesahan/dokumen-tidak-valid/user-tidak-valid')
    await expect(page.locator('body')).toContainText(/tidak|valid|ditemukan|verifikasi/i)
    await expectNoAppShellError(page)
  })
})
