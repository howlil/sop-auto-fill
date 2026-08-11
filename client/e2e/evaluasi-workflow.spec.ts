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
  approveEvaluatedSopFixture,
  createApprovedSopFixture,
  createDraftSopFixture,
  createPengajuanForSop,
  createReadySopFixture,
  finishEvaluation,
  nilaiSopPerluPerbaikan,
  nilaiSopSesuai,
} from './support/e2e-flow'

test.describe('E2E workflow pengajuan, evaluasi, revisi, dan konsistensi status', () => {
  test.beforeEach(async ({ request }) => {
    await expectBackendAvailable(request)
  })

  test('E2E-32, E2E-35 sampai E2E-37, E2E-46: pengajuan valid dinilai sesuai sampai selesai evaluasi', async ({ page }) => {
    const pjPenyusun = await createAuthenticatedApiContext(users.pjPenyusun)
    const evaluator = await createAuthenticatedApiContext(users.evaluator)
    try {
      const sop = await createReadySopFixture(pjPenyusun, 'EVAL-OK')
      const pengajuanId = await createPengajuanForSop(pjPenyusun, sop.detailSopId)

      await nilaiSopSesuai(evaluator, pengajuanId, sop.detailSopId)
      await finishEvaluation(evaluator, pengajuanId, sop.baNumber)

      await loginViaUi(page, users.evaluator)
      await page.goto('/evaluator/evaluasi')
      await expectMainContent(page)
      await expect(page.locator('body')).toContainText(/evaluasi|pengajuan|sop/i)

      await page.goto(`/evaluator/evaluasi/pengajuan/${pengajuanId}`)
      await expectMainContent(page)
      await expect(page.locator('body')).toContainText(/selesai dievaluasi|sesuai|berita acara/i)
      await approveEvaluatedSopFixture(sop, pengajuanId)
    } finally {
      await Promise.all([pjPenyusun.dispose(), evaluator.dispose()])
    }
  })

  test('E2E-33 dan E2E-40: pengajuan tanpa SOP siap dan selesai evaluasi sebelum semua sesuai ditolak', async () => {
    const pjPenyusun = await createAuthenticatedApiContext(users.pjPenyusun)
    const evaluator = await createAuthenticatedApiContext(users.evaluator)
    try {
      const draft = await createDraftSopFixture(pjPenyusun, 'EVAL-BLOCKED')
      await expectApiRejected(pjPenyusun, 'post', '/evaluasi', {
        jenis: 'EVALUASI_REQUEST_OPD',
        sopDetailIds: [draft.detailSopId],
      })

      const ready = await createReadySopFixture(pjPenyusun, 'EVAL-NOTDONE')
      const pengajuanId = await createPengajuanForSop(pjPenyusun, ready.detailSopId)
      await expectApiRejected(evaluator, 'patch', `/evaluasi/${pengajuanId}/selesai`, {
        nomorBA: ready.baNumber,
      })
      await nilaiSopSesuai(evaluator, pengajuanId, ready.detailSopId)
      await finishEvaluation(evaluator, pengajuanId, ready.baNumber)
      await approveEvaluatedSopFixture(ready, pengajuanId)
    } finally {
      await Promise.all([pjPenyusun.dispose(), evaluator.dispose()])
    }
  })

  test('E2E-38 sampai E2E-45: revisi dibaca, ditindaklanjuti, dikirim ulang, lalu dinilai ulang', async ({ page }) => {
    const pjPenyusun = await createAuthenticatedApiContext(users.pjPenyusun)
    const evaluator = await createAuthenticatedApiContext(users.evaluator)
    try {
      const sop = await createReadySopFixture(pjPenyusun, 'EVAL-REV')
      const pengajuanId = await createPengajuanForSop(pjPenyusun, sop.detailSopId)

      await expectApiRejected(evaluator, 'patch', `/evaluasi/${pengajuanId}/nilai/${sop.detailSopId}`, {
        hasil: 'PERLU_PERBAIKAN',
      })
      const catatan = 'Lengkapi keluaran proses pada dokumen SOP.'
      await nilaiSopPerluPerbaikan(evaluator, pengajuanId, sop.detailSopId, catatan)

      await loginViaUi(page, users.penyusun)
      await page.goto(`/penyusun/sop/${sop.detailSopId}`)
      await expectMainContent(page)
      await expect(page.locator('body')).toContainText(/revisi|perbaikan|catatan/i)

      const penyusunAfterUi = await createAuthenticatedApiContext(users.penyusun)
      try {
        await apiPatch(penyusunAfterUi, `/evaluasi/${pengajuanId}/nilai/${sop.detailSopId}/tindak-lanjut-selesai`)
        await apiPost(pjPenyusun, `/sop/penyusun-workbench/${sop.detailSopId}/kirim-ulang-evaluasi`)
        await nilaiSopSesuai(evaluator, pengajuanId, sop.detailSopId)
        await finishEvaluation(evaluator, pengajuanId, sop.baNumber)
        const detail = await apiGet<{ status: string }>(pjPenyusun, `/evaluasi/${pengajuanId}`)
        expect(detail.status).toBe('SELESAI_DIEVALUASI')
        await approveEvaluatedSopFixture(sop, pengajuanId)
      } finally {
        await penyusunAfterUi.dispose()
      }
    } finally {
      await Promise.all([pjPenyusun.dispose(), evaluator.dispose()])
    }
  })

  test('Evaluator menolak final seluruh SOP dan PJ Penyusun wajib membuat versi baru', async () => {
    const pjPenyusun = await createAuthenticatedApiContext(users.pjPenyusun)
    const evaluator = await createAuthenticatedApiContext(users.evaluator)
    try {
      const sop = await createReadySopFixture(pjPenyusun, 'EVAL-REJECT')
      const pengajuanId = await createPengajuanForSop(pjPenyusun, sop.detailSopId)
      const alasan = 'Dasar hukum dan keluaran proses belum lengkap.'

      const ditolak = await apiPatch<{
        status: string
        alasanPenolakan: string
        version: number
      }>(evaluator, `/evaluasi/${pengajuanId}/tolak`, {
        alasan,
        version: 0,
      })
      expect(ditolak.status).toBe('DITOLAK')
      expect(ditolak.alasanPenolakan).toBe(alasan)

      const umpanBalik = await apiGet<{
        pengajuanStatus: string
        hasil: string
        catatan: string
      }>(pjPenyusun, `/evaluasi/umpan-balik/detail/${sop.detailSopId}`)
      expect(umpanBalik).toMatchObject({
        pengajuanStatus: 'DITOLAK',
        hasil: 'DITOLAK',
        catatan: alasan,
      })

      await expectApiRejected(
        pjPenyusun,
        'patch',
        `/evaluasi/${pengajuanId}/nilai/${sop.detailSopId}/tindak-lanjut-selesai`,
      )
      await expectApiRejected(
        pjPenyusun,
        'post',
        `/sop/penyusun-workbench/${sop.detailSopId}/kirim-ulang-evaluasi`,
      )

      const versiBaru = await apiPost<{
        detail: { id: string; status: string; versi: number }
      }>(pjPenyusun, `/sop/${sop.detailSopId}/buat-versi-baru`)
      expect(versiBaru.detail.id).not.toBe(sop.detailSopId)
      expect(versiBaru.detail.status).toBe('DRAFT')
      expect(versiBaru.detail.versi).toBeGreaterThan(1)

      const tetapDitolak = await apiGet<{ status: string }>(evaluator, `/evaluasi/${pengajuanId}`)
      expect(tetapDitolak.status).toBe('DITOLAK')
    } finally {
      await Promise.all([pjPenyusun.dispose(), evaluator.dispose()])
    }
  })

  test('E2E-69: status SOP konsisten setelah refresh, logout-login, dan perpindahan peran', async ({ page }) => {
    const approved = await createApprovedSopFixture('CONSISTENT')

    await loginViaUi(page, users.penyusun)
    await page.goto('/penyusun/sop')
    await searchPageIfAvailable(page, approved.title)
    await expect(page.getByText(approved.title).first()).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('body')).toContainText(/berlaku/i)

    await page.context().clearCookies()
    await loginViaUi(page, users.kepalaOpd)
    await page.goto('/kepala-opd/sop')
    await expectMainContent(page)
    await searchPageIfAvailable(page, approved.title)
    await expect(page.locator('body')).toContainText(/berlaku|sop/i)

    await page.context().clearCookies()
    await loginViaUi(page, users.pjEvaluator)
    await page.goto('/pj-evaluator/evaluasi')
    await expectMainContent(page)
    await expect(page.locator('body')).toContainText(/evaluasi|pengajuan|sop/i)
  })
})
