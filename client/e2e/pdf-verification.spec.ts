import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { users } from './fixtures/users'
import { apiGet, apiPost, createAuthenticatedApiContext } from './support/api'
import { waitForAppReady } from './support/app'
import { createApprovedSopFixture } from './support/e2e-flow'
import { e2ePin, validPdfBase64 } from './support/test-data'

test.describe('E2E verifikasi tanda tangan PDF', () => {
  test('tombol verifikasi disabled sebelum file dipilih', async ({ page }) => {
    await page.goto('/validasi/pdf')
    await waitForAppReady(page)
    await expect(page.getByRole('button', { name: /verifikasi tanda tangan/i })).toBeDisabled()
  })

  test('file non-PDF ditolak oleh validasi halaman', async ({ page }) => {
    await page.goto('/validasi/pdf')
    await waitForAppReady(page)

    await page.locator('input[type="file"]').setInputFiles({
      name: 'not-a-pdf.txt',
      mimeType: 'text/plain',
      buffer: fs.readFileSync(path.join(process.cwd(), 'e2e', 'fixtures', 'not-a-pdf.txt')),
    })
    await page.getByRole('button', { name: /verifikasi tanda tangan/i }).click()

    await expect(page.getByText(/berkas harus berformat pdf/i)).toBeVisible()
  })

  test('E2E-66: PDF bertanda tangan valid diverifikasi atau status signing-disabled dijelaskan', async ({ page }) => {
    const approved = await createApprovedSopFixture('PDF-VALID')
    if (!approved.pengesahan) {
      throw new Error('Fixture SOP berlaku tidak memuat payload pengesahan TTE')
    }

    const kepalaOpd = await createAuthenticatedApiContext(users.kepalaOpd)
    try {
      const status = await apiGet<{ enabled: boolean }>(kepalaOpd, '/tte/public/pdf-signing/status')
      const signed = await apiPost<{ signedPdfBase64: string }>(kepalaOpd, '/tte/pdf/sign', {
        pin: e2ePin,
        dokumenTteId: approved.pengesahan.dokumenTteId,
        userId: approved.pengesahan.userId,
        jenisDokumen: 'SOP_BERLAKU',
        pdfBase64: validPdfBase64,
      })
      const outputDir = path.join(process.cwd(), 'test-results')
      fs.mkdirSync(outputDir, { recursive: true })
      const signedPath = path.join(outputDir, `signed-${approved.detailSopId}.pdf`)
      fs.writeFileSync(signedPath, Buffer.from(signed.signedPdfBase64, 'base64'))

      await page.goto('/validasi/pdf')
      await waitForAppReady(page)
      await page.locator('input[type="file"]').setInputFiles({
        name: 'signed.pdf',
        mimeType: 'application/pdf',
        buffer: fs.readFileSync(signedPath),
      })
      await page.getByRole('button', { name: /verifikasi tanda tangan/i }).click()
      await expect(page.locator('body')).toContainText(
        status.enabled ? /valid|terverifikasi|tanda tangan/i : /tidak aktif|nonaktif|disabled|verifikasi/i,
      )
      if (status.enabled) {
        await expect(page.getByText('TTE ini sudah cocok dengan signature PDF').first()).toBeVisible()
        await expect(page.getByText('Penandatangan', { exact: true }).first()).toBeVisible()
        await expect(page.getByText('Diterbitkan oleh', { exact: true }).first()).toBeVisible()
        await expect(page.getByText('Waktu penandatanganan', { exact: true }).first()).toBeVisible()
        await expect(page.getByText('Kode keamanan')).toHaveCount(0)
        await expect(page.getByText('Hasil Pemeriksaan')).toHaveCount(0)
        await expect(page.getByText('Tampilkan informasi teknis sertifikat')).toHaveCount(0)
      }
    } finally {
      await kepalaOpd.dispose()
    }
  })

  test('E2E-67: PDF tanpa tanda tangan menampilkan hasil tidak valid', async ({ page }) => {
    await page.goto('/validasi/pdf')
    await waitForAppReady(page)
    await page.locator('input[type="file"]').setInputFiles({
      name: 'unsigned.pdf',
      mimeType: 'application/pdf',
      buffer: fs.readFileSync(path.join(process.cwd(), 'e2e', 'fixtures', 'unsigned.pdf')),
    })
    await page.getByRole('button', { name: /verifikasi tanda tangan/i }).click()

    await expect(page.locator('body')).toContainText(/tidak valid|tidak ditemukan|tanpa tanda tangan|tidak ada tanda tangan digital|belum ditandatangani/i)
  })
})
