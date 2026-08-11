import { users } from '../fixtures/users'
import { expect, test } from '../fixtures/business-test'
import {
  approveAllSopAsHeadViaUi,
  createVersionViaUi,
  evaluateSopViaUi,
  expectEvaluationCompletionBlockedViaUi,
  expectPublicArchiveContains,
  openEvaluatorSubmission,
  rejectEvaluationViaUi,
  resubmitRevisionViaUi,
  reviseAndCompleteFollowUpViaUi,
  signBaAsPjEvaluatorViaUi,
  signBaAsPjPenyusunViaUi,
  submitEvaluationCompletionViaUi,
  submitEvaluationViaUi,
} from '../support/business-actions'
import {
  expectNilai,
  expectPengajuanStatus,
  expectRejectedEvaluation,
  expectSopStatus,
  getCurrentPengajuanId,
  getWorkbench,
} from '../support/business-audit'
import {
  advanceRevisionForAggregationPrecondition,
  ensureJourneyTteProfiles,
  seedActiveEvaluation,
  seedReadySops,
} from '../support/business-preconditions'
import { e2ePin } from '../support/test-data'

test.describe('End-to-End Business Journey — evaluation lifecycle', () => {
  test('J01 Happy Path — siap evaluasi sampai SOP berlaku dan terlihat publik', async ({
    publicPage,
    roleApi,
    roleSession,
  }) => {
    const [sop] = await seedReadySops(roleApi, 'J01-HAPPY')
    if (!sop) throw new Error('Precondition J01 gagal membuat SOP')
    await ensureJourneyTteProfiles(roleApi)

    const pjPenyusun = await roleSession(users.pjPenyusun)
    const evaluator = await roleSession(users.evaluator)
    const pjEvaluator = await roleSession(users.pjEvaluator)
    const kepalaOpd = await roleSession(users.kepalaOpd)

    let pengajuanId = ''

    await test.step('PJ Penyusun mengajukan SOP siap evaluasi melalui UI', async () => {
      await submitEvaluationViaUi(pjPenyusun.page, [sop.title])
      pengajuanId = await getCurrentPengajuanId(pjPenyusun.api)
      await expectPengajuanStatus(pjPenyusun.api, pengajuanId, 'SEDANG_DIEVALUASI')
      await expectSopStatus(pjPenyusun.api, sop.detailSopId, 'SEDANG_DIEVALUASI')
    })

    await test.step('Evaluator menilai SOP SESUAI dan menyelesaikan evaluasi melalui UI', async () => {
      await openEvaluatorSubmission(evaluator.page, pengajuanId)
      await evaluateSopViaUi(evaluator.page, { title: sop.title, result: 'SESUAI' })
      await expectNilai(evaluator.api, pengajuanId, sop.detailSopId, { hasil: 'SESUAI' })
      await submitEvaluationCompletionViaUi(evaluator.page, sop.baNumber)
      await expectPengajuanStatus(evaluator.api, pengajuanId, 'SELESAI_DIEVALUASI')
      await expectSopStatus(evaluator.api, sop.detailSopId, 'MENUNGGU_TTD_PJ_EVALUATOR')
    })

    await test.step('PJ Evaluator menandatangani Berita Acara melalui UI', async () => {
      await signBaAsPjEvaluatorViaUi(pjEvaluator.page, pengajuanId, e2ePin)
      await expectPengajuanStatus(pjEvaluator.api, pengajuanId, 'DITANDATANGANI_PJ_EVALUATOR')
    })

    await test.step('PJ Penyusun menandatangani Berita Acara melalui UI', async () => {
      await signBaAsPjPenyusunViaUi(pjPenyusun.page, pengajuanId, e2ePin)
      await expectPengajuanStatus(pjPenyusun.api, pengajuanId, 'DITANDATANGANI_PJ_PENYUSUN')
      await expectSopStatus(
        pjPenyusun.api,
        sop.detailSopId,
        'DIVERIFIKASI_PJ_EVALUATOR_ORGANISASI',
      )
    })

    await test.step('Kepala OPD mengesahkan SOP melalui UI', async () => {
      await approveAllSopAsHeadViaUi(kepalaOpd.page, pengajuanId, e2ePin)
      await expectPengajuanStatus(kepalaOpd.api, pengajuanId, 'SELESAI')
      await expectSopStatus(kepalaOpd.api, sop.detailSopId, 'BERLAKU')
    })

    await test.step('Outcome akhir dapat ditemukan dari arsip publik tanpa sesi login', async () => {
      await expectPublicArchiveContains(publicPage, sop.title)
    })
  })

  test('J02 Revision Loop — perbaikan, tindak lanjut, kirim ulang, dan evaluasi ulang', async ({
    roleApi,
    roleSession,
  }) => {
    const { pengajuanId, sops } = await seedActiveEvaluation(roleApi, 'J02-REVISION')
    const [sop] = sops
    if (!sop) throw new Error('Precondition J02 gagal membuat SOP')

    const evaluator = await roleSession(users.evaluator)
    const penyusun = await roleSession(users.penyusun)
    const pjPenyusun = await roleSession(users.pjPenyusun)
    const note = 'Lengkapi keluaran proses dan pastikan hasil setiap langkah dapat diverifikasi.'
    const revisedTitle = `${sop.title} Revisi`
    const finalBaNumber = `${sop.baNumber}-REV`

    await test.step('Evaluator meminta perbaikan dengan catatan resmi melalui UI', async () => {
      await openEvaluatorSubmission(evaluator.page, pengajuanId)
      await evaluateSopViaUi(evaluator.page, {
        title: sop.title,
        result: 'PERLU_PERBAIKAN',
        note,
      })
      await expectNilai(evaluator.api, pengajuanId, sop.detailSopId, {
        hasil: 'PERLU_PERBAIKAN',
        statusTindakLanjut: 'TERBUKA',
      })
      await expectSopStatus(evaluator.api, sop.detailSopId, 'REVISI_DARI_EVALUATOR')
    })

    await test.step('Penyusun membaca catatan, memperbaiki SOP, lalu menandai tindak lanjut selesai', async () => {
      await reviseAndCompleteFollowUpViaUi(penyusun.page, {
        detailSopId: sop.detailSopId,
        note,
        revisedTitle,
      })
      await expectNilai(penyusun.api, pengajuanId, sop.detailSopId, {
        statusTindakLanjut: 'SELESAI',
      })
    })

    await test.step('PJ Penyusun mengirim ulang revisi melalui UI', async () => {
      await resubmitRevisionViaUi(pjPenyusun.page, sop.detailSopId)
      await expectSopStatus(pjPenyusun.api, sop.detailSopId, 'SEDANG_DIEVALUASI')
    })

    await test.step('Evaluator melakukan penilaian ulang SESUAI dan menyelesaikan evaluasi', async () => {
      await openEvaluatorSubmission(evaluator.page, pengajuanId)
      await expect(evaluator.page.locator('body')).toContainText(/penilaian ulang|tinjauan ulang/i)
      await evaluateSopViaUi(evaluator.page, { title: revisedTitle, result: 'SESUAI' })
      await expectNilai(evaluator.api, pengajuanId, sop.detailSopId, { hasil: 'SESUAI' })
      await submitEvaluationCompletionViaUi(evaluator.page, finalBaNumber)
      await expectPengajuanStatus(evaluator.api, pengajuanId, 'SELESAI_DIEVALUASI')
    })
  })

  test('J03 Final Rejection — penolakan final mengunci versi dan memaksa versi baru', async ({
    roleApi,
    roleSession,
  }) => {
    const { pengajuanId, sops } = await seedActiveEvaluation(roleApi, 'J03-REJECT')
    const [sop] = sops
    if (!sop) throw new Error('Precondition J03 gagal membuat SOP')

    const evaluator = await roleSession(users.evaluator)
    const pjPenyusun = await roleSession(users.pjPenyusun)
    const reason = 'Dasar hukum dan keluaran proses belum memenuhi ketentuan evaluasi dokumen SOP.'

    await test.step('Evaluator menolak pengajuan secara final melalui UI', async () => {
      await openEvaluatorSubmission(evaluator.page, pengajuanId)
      await rejectEvaluationViaUi(evaluator.page, reason)
      await expectRejectedEvaluation(evaluator.api, pengajuanId, reason)
      await expectSopStatus(evaluator.api, sop.detailSopId, 'DITOLAK_EVALUATOR')
    })

    await test.step('Versi ditolak tidak menawarkan kirim ulang dan PJ Penyusun membuat versi baru', async () => {
      await pjPenyusun.page.goto(`/penyusun/sop/${sop.detailSopId}`)
      await expect(pjPenyusun.page.locator('body')).toContainText(/ditolak|versi/i)
      await expect(
        pjPenyusun.page.getByRole('button', { name: /kirim ulang evaluasi/i }),
      ).toHaveCount(0)

      const newDetailId = await createVersionViaUi(pjPenyusun.page, sop.detailSopId)
      const next = await getWorkbench(pjPenyusun.api, newDetailId)
      expect(next.detail.id).toBe(newDetailId)
      expect(next.detail.status).toBe('DRAFT')
      expect(next.detail.versi ?? 0).toBeGreaterThan(1)
      await expectSopStatus(pjPenyusun.api, sop.detailSopId, 'DITOLAK_EVALUATOR')
    })
  })

  test('J04 Mixed Multi-SOP — pengajuan tidak selesai sampai seluruh SOP memenuhi syarat', async ({
    roleApi,
    roleSession,
  }) => {
    const { pengajuanId, sops } = await seedActiveEvaluation(roleApi, 'J04-MIXED', 2)
    const [sopA, sopB] = sops
    if (!sopA || !sopB) throw new Error('Precondition J04 membutuhkan dua SOP')

    const evaluator = await roleSession(users.evaluator)
    const note = 'SOP kedua perlu perbaikan pada keluaran proses sebelum pengajuan dapat diselesaikan.'
    const finalBaNumber = `${sopA.baNumber}-MIX`

    await test.step('Evaluator memberi hasil berbeda pada dua SOP melalui UI', async () => {
      await openEvaluatorSubmission(evaluator.page, pengajuanId)
      await evaluateSopViaUi(evaluator.page, { title: sopA.title, result: 'SESUAI' })
      await expectNilai(evaluator.api, pengajuanId, sopA.detailSopId, { hasil: 'SESUAI' })

      await evaluateSopViaUi(evaluator.page, {
        title: sopB.title,
        result: 'PERLU_PERBAIKAN',
        note,
      })
      await expectNilai(evaluator.api, pengajuanId, sopB.detailSopId, {
        hasil: 'PERLU_PERBAIKAN',
        statusTindakLanjut: 'TERBUKA',
      })
    })

    await test.step('Aggregate gate menolak penyelesaian selama masih ada SOP perlu perbaikan', async () => {
      await expectEvaluationCompletionBlockedViaUi(evaluator.page)
      await expectPengajuanStatus(evaluator.api, pengajuanId, 'SEDANG_DIEVALUASI')
    })

    await test.step('Setelah SOP bermasalah ditindaklanjuti, evaluator dapat menilai ulang dan selesai', async () => {
      // Revision UI sendiri sudah diuji penuh pada J02; di J04 ini hanya setup state untuk
      // membuktikan invariant agregasi setelah mixed result diperbaiki.
      await advanceRevisionForAggregationPrecondition(roleApi, pengajuanId, sopB.detailSopId)
      await openEvaluatorSubmission(evaluator.page, pengajuanId)
      await evaluateSopViaUi(evaluator.page, { title: sopB.title, result: 'SESUAI' })
      await expectNilai(evaluator.api, pengajuanId, sopA.detailSopId, { hasil: 'SESUAI' })
      await expectNilai(evaluator.api, pengajuanId, sopB.detailSopId, { hasil: 'SESUAI' })
      await submitEvaluationCompletionViaUi(evaluator.page, finalBaNumber)
      await expectPengajuanStatus(evaluator.api, pengajuanId, 'SELESAI_DIEVALUASI')
    })
  })
})
