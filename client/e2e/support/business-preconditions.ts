import { users } from '../fixtures/users'
import type { RoleApiFactory } from '../fixtures/business-test'
import { apiGet, apiPatch, apiPost } from './api'
import {
  createReadySopFixture,
  ensureTteReady,
  finishEvaluation,
  nilaiSopSesuai,
  signAllSop,
  signBeritaAcara,
  type ApprovedSopFixture,
  type ReadySopFixture,
} from './e2e-flow'
import { e2ePin, validPdfBase64 } from './test-data'

interface CreatedPengajuan {
  id: string
}

interface WorkbenchWithPengesahan {
  tteSignaturePayloadKepalaOpd?: {
    dokumenTteId: string
    userId: string
  }
}

export interface ActiveEvaluationFixture {
  pengajuanId: string
  sops: ReadySopFixture[]
}

/**
 * Mutation API di file ini hanya untuk membentuk PRECONDITION atau membersihkan
 * state lintas journey. Aksi yang menjadi objek pengujian harus dilakukan melalui
 * browser di business-actions.ts.
 */
export async function seedReadySops(
  apiFor: RoleApiFactory,
  prefix: string,
  count = 1,
): Promise<ReadySopFixture[]> {
  const pjPenyusun = await apiFor(users.pjPenyusun)
  const sops: ReadySopFixture[] = []
  for (let index = 0; index < count; index += 1) {
    sops.push(await createReadySopFixture(pjPenyusun, `${prefix}-${index + 1}`))
  }
  return sops
}

export async function seedActiveEvaluation(
  apiFor: RoleApiFactory,
  prefix: string,
  count = 1,
): Promise<ActiveEvaluationFixture> {
  const pjPenyusun = await apiFor(users.pjPenyusun)
  const sops: ReadySopFixture[] = []
  for (let index = 0; index < count; index += 1) {
    sops.push(await createReadySopFixture(pjPenyusun, `${prefix}-${index + 1}`))
  }
  const pengajuan = await apiPost<CreatedPengajuan>(pjPenyusun, '/evaluasi', {
    jenis: 'EVALUASI_REQUEST_OPD',
    sopDetailIds: sops.map((sop) => sop.detailSopId),
  })
  return { pengajuanId: pengajuan.id, sops }
}

/**
 * Menutup pengajuan yang sengaja berhenti di SELESAI_DIEVALUASI karena scope journey
 * hanya menguji evaluasi. Backend mendefinisikan state itu masih aktif sampai BA
 * ditandatangani kedua PJ dan SOP disahkan Kepala OPD. Tanpa cleanup ini, journey
 * berikutnya berbagi OPD dan akan ditolak oleh invariant satu pengajuan aktif per OPD.
 *
 * Cleanup tetap memakai API publik aplikasi dan diletakkan di layer precondition,
 * sehingga tidak menyamarkan aksi bisnis yang sedang diuji melalui browser.
 */
export async function finalizeEvaluationForJourneyIsolation(
  apiFor: RoleApiFactory,
  params: {
    pengajuanId: string
    sops: readonly ReadySopFixture[]
    baNumber: string
  },
): Promise<void> {
  if (params.sops.length === 0) {
    throw new Error('Cleanup isolation membutuhkan minimal satu SOP')
  }

  const pjEvaluator = await apiFor(users.pjEvaluator)
  const pjPenyusun = await apiFor(users.pjPenyusun)
  const kepalaOpd = await apiFor(users.kepalaOpd)

  await Promise.all([
    ensureTteReady(pjEvaluator),
    ensureTteReady(pjPenyusun),
    ensureTteReady(kepalaOpd),
  ])

  const joinedTitle = params.sops.map((sop) => sop.title).join(', ')
  await signBeritaAcara(
    pjEvaluator,
    params.pengajuanId,
    params.baNumber,
    `Berita Acara ${joinedTitle}`,
  )
  await signBeritaAcara(
    pjPenyusun,
    params.pengajuanId,
    params.baNumber,
    `Berita Acara ${joinedTitle}`,
  )

  await apiPost(kepalaOpd, `/tte/tanda-tangani/pengajuan/${params.pengajuanId}/sop-semua`, {
    pin: e2ePin,
    nomorDokumen: params.sops[0]?.number,
    judulDokumen: joinedTitle,
    sopPdfs: params.sops.map((sop) => ({
      detailSopId: sop.detailSopId,
      pdfBase64: validPdfBase64,
    })),
  })
}

export async function ensureJourneyTteProfiles(apiFor: RoleApiFactory): Promise<void> {
  const contexts = await Promise.all([
    apiFor(users.pjEvaluator),
    apiFor(users.pjPenyusun),
    apiFor(users.kepalaOpd),
  ])
  await Promise.all(contexts.map((context) => ensureTteReady(context)))
}

/**
 * Digunakan J04 setelah invariant mixed-result sudah dibuktikan dari UI.
 * Loop revisi UI penuh diuji terpisah di J02 sehingga J04 tetap fokus pada agregasi multi-SOP.
 */
export async function advanceRevisionForAggregationPrecondition(
  apiFor: RoleApiFactory,
  pengajuanId: string,
  detailSopId: string,
): Promise<void> {
  const pjPenyusun = await apiFor(users.pjPenyusun)
  await apiPatch(
    pjPenyusun,
    `/evaluasi/${pengajuanId}/nilai/${detailSopId}/tindak-lanjut-selesai`,
  )
  await apiPost(pjPenyusun, `/sop/penyusun-workbench/${detailSopId}/kirim-ulang-evaluasi`)
}

/**
 * Menyiapkan versi DRAFT yang baru dibuat dari UI sampai tepat sebelum aksi Kepala OPD.
 * J05 menguji create-version dan replacement invariant; evaluasi ulang tidak diduplikasi dari J01/J02.
 */
export async function advanceVersionToHeadSignaturePrecondition(
  apiFor: RoleApiFactory,
  params: {
    detailSopId: string
    title: string
    baNumber: string
  },
): Promise<string> {
  const pjPenyusun = await apiFor(users.pjPenyusun)
  const evaluator = await apiFor(users.evaluator)
  const pjEvaluator = await apiFor(users.pjEvaluator)

  await apiPatch(pjPenyusun, `/sop/status/${params.detailSopId}`, {
    status: 'MENUNGGU_PENGAJUAN_EVALUASI',
  })
  const pengajuan = await apiPost<CreatedPengajuan>(pjPenyusun, '/evaluasi', {
    jenis: 'EVALUASI_REQUEST_OPD',
    sopDetailIds: [params.detailSopId],
  })
  await nilaiSopSesuai(evaluator, pengajuan.id, params.detailSopId)
  await finishEvaluation(evaluator, pengajuan.id, params.baNumber)
  await ensureTteReady(pjEvaluator)
  await ensureTteReady(pjPenyusun)
  await signBeritaAcara(
    pjEvaluator,
    pengajuan.id,
    params.baNumber,
    `Berita Acara ${params.title}`,
  )
  await signBeritaAcara(
    pjPenyusun,
    pengajuan.id,
    params.baNumber,
    `Berita Acara ${params.title}`,
  )
  return pengajuan.id
}

export async function seedApprovedSop(
  apiFor: RoleApiFactory,
  prefix: string,
): Promise<ApprovedSopFixture> {
  const pjPenyusun = await apiFor(users.pjPenyusun)
  const evaluator = await apiFor(users.evaluator)
  const pjEvaluator = await apiFor(users.pjEvaluator)
  const kepalaOpd = await apiFor(users.kepalaOpd)

  const sop = await createReadySopFixture(pjPenyusun, prefix)
  const pengajuan = await apiPost<CreatedPengajuan>(pjPenyusun, '/evaluasi', {
    jenis: 'EVALUASI_REQUEST_OPD',
    sopDetailIds: [sop.detailSopId],
  })
  await nilaiSopSesuai(evaluator, pengajuan.id, sop.detailSopId)
  await finishEvaluation(evaluator, pengajuan.id, sop.baNumber)
  await ensureTteReady(pjEvaluator)
  await ensureTteReady(pjPenyusun)
  await ensureTteReady(kepalaOpd)
  await signBeritaAcara(
    pjEvaluator,
    pengajuan.id,
    sop.baNumber,
    `Berita Acara ${sop.title}`,
  )
  await signBeritaAcara(
    pjPenyusun,
    pengajuan.id,
    sop.baNumber,
    `Berita Acara ${sop.title}`,
  )
  await signAllSop(kepalaOpd, pengajuan.id, sop.detailSopId, sop.number, sop.title)

  const workbench = await apiGet<WorkbenchWithPengesahan>(
    kepalaOpd,
    `/sop/penyusun-workbench/${sop.detailSopId}`,
  )
  return {
    ...sop,
    pengajuanId: pengajuan.id,
    pengesahan: workbench.tteSignaturePayloadKepalaOpd,
  }
}

export async function createSignedPdfArtifact(
  apiFor: RoleApiFactory,
  approved: ApprovedSopFixture,
): Promise<{ enabled: boolean; pdf: Buffer }> {
  if (!approved.pengesahan) {
    throw new Error('SOP approved tidak memiliki payload pengesahan TTE')
  }

  const kepalaOpd = await apiFor(users.kepalaOpd)
  const status = await apiGet<{ enabled: boolean }>(kepalaOpd, '/tte/public/pdf-signing/status')
  const signed = await apiPost<{ signedPdfBase64: string }>(kepalaOpd, '/tte/pdf/sign', {
    pin: e2ePin,
    dokumenTteId: approved.pengesahan.dokumenTteId,
    userId: approved.pengesahan.userId,
    jenisDokumen: 'SOP_BERLAKU',
    pdfBase64: validPdfBase64,
  })

  return {
    enabled: status.enabled,
    pdf: Buffer.from(signed.signedPdfBase64, 'base64'),
  }
}