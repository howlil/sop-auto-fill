import { expect, test } from '@playwright/test'
import {
  allProtectedRoutes,
  allUsers,
  navByRole,
  protectedRouteMatrix,
  users,
} from './fixtures/users'
import { expectBackendAvailable } from './support/api'
import {
  expectRouteLoads,
  expectVisibleNavigation,
  loginViaUi,
} from './support/app'
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  createAuthenticatedApiContext,
} from './support/api'
import {
  approveEvaluatedSopFixture,
  createReadySopFixture,
  expectPenyusunCannotResubmitRevision,
  expectPenyusunCannotSubmitEvaluation,
  finishEvaluation,
  nilaiSopPerluPerbaikan,
  nilaiSopSesuai,
} from './support/e2e-flow'
import { e2eRunId } from './support/test-data'

interface Opd {
  id: string
  nama: string
}

const navLabelByRoute: Record<string, string> = {
  '/pj-evaluator/grafik-evaluasi': 'Grafik Evaluasi',
  '/pj-evaluator/opd': 'OPD',
  '/pj-evaluator/penyusun': 'Penyusun',
  '/pj-evaluator/evaluator': 'Evaluator',
  '/pj-evaluator/evaluasi': 'Evaluasi SOP',
  '/evaluator/evaluasi': 'Evaluasi SOP',
  '/kepala-opd/sop': 'Pantau SOP',
  '/kepala-opd/pengajuan': 'Pengajuan SOP',
  '/penyusun/sop': 'SOP',
  '/penyusun/pelaksana': 'Pelaksana SOP',
  '/penyusun/peraturan': 'Peraturan',
  '/penyusun/pj-penyusun/berita-acara': 'Berita Acara',
}

test.describe('E2E otorisasi dan navigasi per role', () => {
  test.beforeEach(async ({ request }) => {
    await expectBackendAvailable(request)
  })

  for (const user of allUsers) {
    test(`menu utama sesuai kewenangan ${user.role}`, async ({ page }) => {
      await loginViaUi(page, user)
      await expectVisibleNavigation(page, navByRole[user.role])

      const allowed = new Set(navByRole[user.role])
      const allLabels = Object.values(navByRole).flat()
      for (const label of allLabels) {
        if (allowed.has(label)) continue
        await expect(page.getByRole('link', { name: label, exact: true })).toHaveCount(0)
      }
    })

    test(`route yang diizinkan untuk ${user.role} dapat dibuka`, async ({ page }) => {
      await loginViaUi(page, user)
      for (const route of protectedRouteMatrix[user.role]) {
        await test.step(`buka ${route}`, async () => {
          await expectRouteLoads(page, route)
        })
      }
    })

    test(`navigasi role lain tidak tersedia untuk ${user.role}`, async ({ page }) => {
      await loginViaUi(page, user)
      const forbiddenRoutes = allProtectedRoutes.filter(
        (route) => !protectedRouteMatrix[user.role].includes(route),
      )

      for (const route of forbiddenRoutes.slice(0, 3)) {
        await test.step(`tidak ada link ${route}`, async () => {
          const forbiddenLabel = navLabelByRoute[route]
          expect(forbiddenLabel).toBeTruthy()
          await expect(page.getByRole('link', { name: forbiddenLabel, exact: true })).toHaveCount(0)
        })
      }
    })
  }

  test('E2E-34: penyusun biasa tidak dapat membuat pengajuan evaluasi', async () => {
    const penyusun = await createAuthenticatedApiContext(users.penyusun)
    try {
      const sop = await createReadySopFixture(penyusun, 'RBAC-SUBMIT')
      await expectPenyusunCannotSubmitEvaluation(penyusun, sop.detailSopId)
    } finally {
      await penyusun.dispose()
    }
  })

  test('E2E-44: penyusun biasa tidak dapat mengirim ulang SOP revisi', async () => {
    const pjPenyusun = await createAuthenticatedApiContext(users.pjPenyusun)
    const penyusun = await createAuthenticatedApiContext(users.penyusun)
    const evaluator = await createAuthenticatedApiContext(users.evaluator)
    try {
      const sop = await createReadySopFixture(pjPenyusun, 'RBAC-RESUBMIT')
      const pengajuan = await apiPost<{ id?: string; pengajuanEvaluasiId?: string }>(
        pjPenyusun,
        '/evaluasi',
        {
          jenis: 'EVALUASI_REQUEST_OPD',
          sopDetailIds: [sop.detailSopId],
        },
      )
      const pengajuanId = pengajuan.id ?? pengajuan.pengajuanEvaluasiId
      if (!pengajuanId) throw new Error('Pengajuan tidak memuat id')
      await nilaiSopPerluPerbaikan(
        evaluator,
        pengajuanId,
        sop.detailSopId,
        'Catatan revisi RBAC E2E',
      )
      await apiPatch(pjPenyusun, `/evaluasi/${pengajuanId}/nilai/${sop.detailSopId}/tindak-lanjut-selesai`)
      await expectPenyusunCannotResubmitRevision(penyusun, sop.detailSopId)
      await apiPost(pjPenyusun, `/sop/penyusun-workbench/${sop.detailSopId}/kirim-ulang-evaluasi`)
      await nilaiSopSesuai(evaluator, pengajuanId, sop.detailSopId)
      await finishEvaluation(evaluator, pengajuanId, sop.baNumber)
      await approveEvaluatedSopFixture(sop, pengajuanId)
    } finally {
      await Promise.all([pjPenyusun.dispose(), penyusun.dispose(), evaluator.dispose()])
    }
  })

  test('E2E-70: data OPD lain tidak tampil untuk penyusun di luar kewenangan', async () => {
    const admin = await createAuthenticatedApiContext(users.pjEvaluator)
    const penyusun = await createAuthenticatedApiContext(users.penyusun)
    try {
      const otherOpdName = `OPD Terlarang ${e2eRunId('OPD-B')}`
      const otherOpd = await apiPost<Opd>(admin, '/opd', { nama: otherOpdName })
      const visibleToPenyusun = await apiGet<Opd[]>(
        penyusun,
        `/opd?search=${encodeURIComponent(otherOpdName)}`,
      )
      expect(visibleToPenyusun.map((opd) => opd.nama)).not.toContain(otherOpdName)
      await apiDelete(admin, `/opd/${otherOpd.id}`).catch(() => undefined)
    } finally {
      await Promise.all([admin.dispose(), penyusun.dispose()])
    }
  })
})
