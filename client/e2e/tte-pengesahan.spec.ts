import { expect, test } from '@playwright/test'

import { users } from './fixtures/users'
import {
  apiGet,
  apiPatch,
  apiPost,
  createAuthenticatedApiContext,
  expectApiRejected,
  expectBackendAvailable,
} from './support/api'
import { expectMainContent, loginViaUi, searchPageIfAvailable } from './support/app'
import {
  createApprovedSopFixture,
  createPengajuanForSop,
  createReadySopFixture,
  ensureTteReady,
  finishEvaluation,
  nilaiSopSesuai,
  signAllSop,
  signBeritaAcara,
} from './support/e2e-flow'
import { e2ePin, validPdfBase64 } from './support/test-data'

test.describe('E2E TTE, berita acara, pengesahan, pencabutan, dan versi SOP', () => {
  test.beforeEach(async ({ request }) => {
    await expectBackendAvailable(request)
  })

  test('E2E-47 sampai E2E-49: profil TTE tersedia dan PIN salah ditolak', async () => {
    const pjEvaluator = await createAuthenticatedApiContext(users.pjEvaluator)
    try {
      await ensureTteReady(pjEvaluator)
      const profil = await apiGet<unknown | null>(pjEvaluator, '/tte/profil')
      expect(profil).not.toBeNull()
      await expectApiRejected(pjEvaluator, 'patch', '/tte/profil/pin', {
        pinLama: '000000',
        pinBaru: '111111',
      })
    } finally {
      await pjEvaluator.dispose()
    }
  })

  test('E2E-50 sampai E2E-54: BA ditandatangani berurutan dan Kepala OPD mengesahkan SOP', async ({ page }) => {
    const pjPenyusun = await createAuthenticatedApiContext(users.pjPenyusun)
    const evaluator = await createAuthenticatedApiContext(users.evaluator)
    const pjEvaluator = await createAuthenticatedApiContext(users.pjEvaluator)
    const kepalaOpd = await createAuthenticatedApiContext(users.kepalaOpd)
    try {
      const sop = await createReadySopFixture(pjPenyusun, 'TTE-ORDER')
      const pengajuanId = await createPengajuanForSop(pjPenyusun, sop.detailSopId)
      await nilaiSopSesuai(evaluator, pengajuanId, sop.detailSopId)
      await finishEvaluation(evaluator, pengajuanId, sop.baNumber)
      await ensureTteReady(pjEvaluator)
      await ensureTteReady(pjPenyusun)
      await ensureTteReady(kepalaOpd)

      await expectApiRejected(pjPenyusun, 'post', `/tte/tanda-tangani/ba/${pengajuanId}`, {
        pin: e2ePin,
        nomorDokumen: sop.baNumber,
        judulDokumen: `Berita Acara ${sop.title}`,
      })
      await signBeritaAcara(pjEvaluator, pengajuanId, sop.baNumber, `Berita Acara ${sop.title}`)
      await signBeritaAcara(pjPenyusun, pengajuanId, sop.baNumber, `Berita Acara ${sop.title}`)
      await expectApiRejected(kepalaOpd, 'post', `/tte/tanda-tangani/pengajuan/${pengajuanId}/sop-semua`, {
        pin: '000000',
        nomorDokumen: sop.number,
        judulDokumen: sop.title,
        sopPdfs: [{ detailSopId: sop.detailSopId, pdfBase64: validPdfBase64 }],
      })
      await signAllSop(kepalaOpd, pengajuanId, sop.detailSopId, sop.number, sop.title)

      await loginViaUi(page, users.kepalaOpd)
      await page.goto('/kepala-opd/sop')
      await expectMainContent(page)
      await searchPageIfAvailable(page, sop.title)
      await expect(page.locator('body')).toContainText(/berlaku|sop/i)
    } finally {
      await Promise.all([
        pjPenyusun.dispose(),
        evaluator.dispose(),
        pjEvaluator.dispose(),
        kepalaOpd.dispose(),
      ])
    }
  })

  test('E2E-55: Kepala OPD mencabut SOP berlaku sehingga tidak lagi tampil sebagai SOP berlaku', async ({ page }) => {
    const approved = await createApprovedSopFixture('REVOKE')
    const kepalaOpd = await createAuthenticatedApiContext(users.kepalaOpd)
    try {
      await apiPost(kepalaOpd, `/sop/cabut/${approved.detailSopId}`)

      await loginViaUi(page, users.kepalaOpd)
      await page.goto('/kepala-opd/sop')
      await expectMainContent(page)
      await searchPageIfAvailable(page, approved.title)
      await expect(page.locator('body')).toContainText(/dicabut|sop/i)

      await page.goto('/arsip')
      await searchPageIfAvailable(page, approved.title)
      await expect(page.getByText(approved.title)).toHaveCount(0)
    } finally {
      await kepalaOpd.dispose()
    }
  })

  test('E2E-57: versi lama digantikan setelah versi baru disahkan', async ({ page }) => {
    const original = await createApprovedSopFixture('REPLACE')
    const pjPenyusun = await createAuthenticatedApiContext(users.pjPenyusun)
    const evaluator = await createAuthenticatedApiContext(users.evaluator)
    const pjEvaluator = await createAuthenticatedApiContext(users.pjEvaluator)
    const kepalaOpd = await createAuthenticatedApiContext(users.kepalaOpd)
    try {
      const version = await apiPost<{ detail: { id: string; nomorSOP: string } }>(
        pjPenyusun,
        `/sop/${original.detailSopId}/buat-versi-baru`,
      )
      const newDetailId = version.detail.id
      await apiPatch(pjPenyusun, `/sop/status/${newDetailId}`, {
        status: 'MENUNGGU_PENGAJUAN_EVALUASI',
      })
      const pengajuanId = await createPengajuanForSop(pjPenyusun, newDetailId)
      await nilaiSopSesuai(evaluator, pengajuanId, newDetailId)
      const replacementBaNumber = `${original.baNumber}-V2`
      await finishEvaluation(evaluator, pengajuanId, replacementBaNumber)
      await ensureTteReady(pjEvaluator)
      await ensureTteReady(pjPenyusun)
      await ensureTteReady(kepalaOpd)
      await signBeritaAcara(pjEvaluator, pengajuanId, replacementBaNumber, `Berita Acara ${original.title}`)
      await signBeritaAcara(pjPenyusun, pengajuanId, replacementBaNumber, `Berita Acara ${original.title}`)
      await signAllSop(kepalaOpd, pengajuanId, newDetailId, version.detail.nomorSOP, original.title)

      await loginViaUi(page, users.penyusun)
      await page.goto(`/penyusun/sop/${original.detailSopId}`)
      await expectMainContent(page)
      await expect(page.locator('body')).toContainText(/digantikan|versi|berlaku/i)
    } finally {
      await Promise.all([
        pjPenyusun.dispose(),
        evaluator.dispose(),
        pjEvaluator.dispose(),
        kepalaOpd.dispose(),
      ])
    }
  })
})
