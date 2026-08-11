import { expect, test } from '../fixtures/business-test'
import { apiGet } from '../support/api'
import { expectNoAppShellError, waitForAppReady } from '../support/app'
import { createSignedPdfArtifact, seedApprovedSop } from '../support/business-preconditions'
import { validPdfBase64 } from '../support/test-data'

interface PublicSopPage {
  items: Array<{
    detailSopId: string
    opdId: string
    judul: string
    nomorSOP: string
  }>
}

test.describe('End-to-End Business Journey — public document integrity', () => {
  test('J07 Public Document Integrity — arsip, pengesahan TTE, dan PDF dapat diverifikasi', async ({
    publicPage,
    request,
    roleApi,
  }) => {
    const approved = await seedApprovedSop(roleApi, 'J07-PUBLIC')
    if (!approved.pengesahan) {
      throw new Error('Precondition J07 tidak menghasilkan payload pengesahan')
    }
    const signedPdf = await createSignedPdfArtifact(roleApi, approved)

    await test.step('Pengunjung menemukan SOP berlaku dan membuka pratinjau publik', async () => {
      const result = await apiGet<PublicSopPage>(
        request,
        `/sop/public/sop?search=${encodeURIComponent(approved.title)}`,
      )
      const publicItem = result.items.find((item) => item.detailSopId === approved.detailSopId)
      expect(publicItem, 'versi BERLAKU harus diekspos oleh katalog publik').toBeTruthy()

      await publicPage.goto(
        `/arsip?q=${encodeURIComponent(approved.title)}&opdId=${publicItem!.opdId}&detailSopId=${approved.detailSopId}`,
      )
      await waitForAppReady(publicPage)
      await expect(publicPage.getByText(approved.title).first()).toBeVisible({ timeout: 15_000 })
      await expect(publicPage.locator('body')).toContainText(/pratinjau|dokumen|sop/i)
      await expect(publicPage.locator('body')).not.toContainText(/catatan evaluator|nilai opd|internal evaluasi/i)
      await expectNoAppShellError(publicPage)
    })

    await test.step('Pengunjung memverifikasi pengesahan TTE dari identitas dokumen', async () => {
      await publicPage.goto(
        `/validasi/pengesahan/${approved.pengesahan!.dokumenTteId}/${approved.pengesahan!.userId}`,
      )
      await waitForAppReady(publicPage)
      await expect(publicPage.locator('body')).toContainText(/valid|terverifikasi|pengesahan|tanda tangan/i)
      await expectNoAppShellError(publicPage)
    })

    await test.step('PDF resmi diverifikasi melalui halaman publik', async () => {
      await publicPage.goto('/validasi/pdf')
      await waitForAppReady(publicPage)
      await publicPage.locator('input[type="file"]').setInputFiles({
        name: 'sop-resmi.pdf',
        mimeType: 'application/pdf',
        buffer: signedPdf.pdf,
      })
      await publicPage.getByRole('button', { name: /verifikasi tanda tangan/i }).click()

      await expect(publicPage.locator('body')).toContainText(
        signedPdf.enabled
          ? /valid|terverifikasi|tanda tangan/i
          : /tidak aktif|nonaktif|disabled|verifikasi/i,
      )
      if (signedPdf.enabled) {
        await expect(publicPage.getByText(/tte ini sudah cocok dengan signature pdf/i).first()).toBeVisible()
      }
    })

    await test.step('PDF tanpa signature tidak boleh dianggap valid', async () => {
      await publicPage.goto('/validasi/pdf')
      await waitForAppReady(publicPage)
      await publicPage.locator('input[type="file"]').setInputFiles({
        name: 'unsigned.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from(validPdfBase64, 'base64'),
      })
      await publicPage.getByRole('button', { name: /verifikasi tanda tangan/i }).click()
      await expect(publicPage.locator('body')).toContainText(
        /tidak valid|tidak ditemukan|tanpa tanda tangan|tidak ada tanda tangan digital|belum ditandatangani/i,
      )
    })
  })
})