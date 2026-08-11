import type { APIRequestContext } from '@playwright/test'

import { users } from '../fixtures/users'
import {
  apiGet,
  apiPatch,
  apiPost,
  createAuthenticatedApiContext,
  expectApiRejected,
} from './api'
import { e2ePin, sopFixture, validPdfBase64 } from './test-data'

interface SopRow {
  id: string
  detailSopId: string
  judul: string
  nomorSop: string
  status: string
}

interface Workbench {
  detail: {
    id: string
    sopId: string
    status: string
    nomorSOP: string
    judul?: string
  }
  langkah: unknown[]
  logEdit: unknown[]
  tteSignaturePayloadKepalaOpd?: {
    dokumenTteId: string
    userId: string
  }
}

interface Pelaksana {
  id: string
  namaPelaksana: string
}

interface Peraturan {
  id: string
  namaPeraturan: string
}

interface Pengajuan {
  id?: string
  pengajuanEvaluasiId?: string
  status: string
  version?: number
  sopItems?: Array<{
    detailSopId: string
    hasilEvaluasi?: string
  }>
  nilaiEvaluasi?: Array<{
    sopDetailId: string
    version: number
    hasil?: string
  }>
}

interface SignedRow {
  dokumenTteId: string
  userId: string
}

export interface ReadySopFixture {
  title: string
  number: string
  baNumber: string
  sopId: string
  detailSopId: string
}

export interface ApprovedSopFixture extends ReadySopFixture {
  pengajuanId: string
  pengesahan?: {
    dokumenTteId: string
    userId: string
  }
}

export async function createReadySopFixture(
  context: APIRequestContext,
  prefix = 'SOP',
): Promise<ReadySopFixture> {
  const fixture = sopFixture(prefix)
  const relatedFixture = sopFixture(`${prefix}-REL`)
  const pelaksana = await apiPost<Pelaksana>(context, '/pelaksana', {
    namaPelaksana: `P-${fixture.suffix}`,
  })
  const peraturan = await apiPost<Peraturan>(context, '/peraturan', {
    namaPeraturan: `Peraturan E2E ${fixture.suffix}`,
    nomor: `PER-${fixture.suffix}`,
    tahun: 2026,
    tentang: `Dasar hukum E2E ${fixture.suffix}`,
  })
  const sop = await apiPost<SopRow>(context, '/sop', {
    judul: fixture.title,
    nomorSop: fixture.number,
    namaLembaga: 'Biro Organisasi Sumbar',
  })
  const relatedSop = await apiPost<SopRow>(context, '/sop', {
    judul: relatedFixture.title,
    nomorSop: relatedFixture.number,
    namaLembaga: 'Biro Organisasi Sumbar',
  })
  const detailSopId = sop.detailSopId

  await apiPatch<Workbench>(context, `/sop/header/${detailSopId}`, {
    namaLembaga: 'Biro Organisasi Sumbar',
    dasarHukumPeraturanIds: [peraturan.id],
    sopTerkaitDetailIds: [relatedSop.detailSopId],
    lampiran: {
      peringatan: ['Dokumen harus mengikuti standar SOP.'],
      kualifikasiPelaksanaan: ['Memahami proses layanan.'],
      peralatanPerlengkapan: ['Komputer dan jaringan.'],
      pencatatanPendataan: ['Arsip digital SOP.'],
    },
  })
  await apiPatch<Workbench>(context, `/sop/langkah/${detailSopId}`, {
    pelaksana: [{ pelaksanaId: pelaksana.id }],
    langkah: [
      {
        tempId: `${fixture.suffix}-start`,
        jenis: 'AWAL_AKHIR',
        kegiatan: 'Mulai',
        kelengkapan: 'Berkas awal',
        keluaran: 'Dokumen diterima',
        keterangan: 'Awal prosedur',
        waktu: 5,
        satuanWaktu: 'm',
        pelaksanaId: pelaksana.id,
      },
      {
        tempId: `${fixture.suffix}-process`,
        jenis: 'KEGIATAN',
        kegiatan: 'Memeriksa kelengkapan dokumen',
        kelengkapan: 'Dokumen SOP',
        keluaran: 'Dokumen tervalidasi',
        keterangan: 'Pemeriksaan kelengkapan',
        waktu: 15,
        satuanWaktu: 'm',
        pelaksanaId: pelaksana.id,
      },
      {
        tempId: `${fixture.suffix}-end`,
        jenis: 'AWAL_AKHIR',
        kegiatan: 'Selesai',
        kelengkapan: 'Hasil pemeriksaan',
        keluaran: 'SOP siap diproses',
        keterangan: 'Akhir prosedur',
        waktu: 5,
        satuanWaktu: 'm',
        pelaksanaId: pelaksana.id,
      },
    ],
  })
  await apiPatch<Workbench>(context, `/sop/status/${detailSopId}`, {
    status: 'MENUNGGU_PENGAJUAN_EVALUASI',
  })

  return {
    title: fixture.title,
    number: fixture.number,
    baNumber: fixture.baNumber,
    sopId: sop.id,
    detailSopId,
  }
}

export async function createDraftSopFixture(
  context: APIRequestContext,
  prefix = 'DRAFT',
): Promise<ReadySopFixture> {
  const fixture = sopFixture(prefix)
  const sop = await apiPost<SopRow>(context, '/sop', {
    judul: fixture.title,
    nomorSop: fixture.number,
    namaLembaga: 'Biro Organisasi Sumbar',
  })
  return {
    title: fixture.title,
    number: fixture.number,
    baNumber: fixture.baNumber,
    sopId: sop.id,
    detailSopId: sop.detailSopId,
  }
}

export async function createPengajuanForSop(
  context: APIRequestContext,
  detailSopId: string,
): Promise<string> {
  const pengajuan = await apiPost<Pengajuan>(context, '/evaluasi', {
    jenis: 'EVALUASI_REQUEST_OPD',
    sopDetailIds: [detailSopId],
  })
  return resolvePengajuanId(pengajuan)
}

export async function nilaiSopSesuai(
  context: APIRequestContext,
  pengajuanId: string,
  detailSopId: string,
): Promise<void> {
  const detail = await apiGet<Pengajuan>(context, `/evaluasi/${pengajuanId}`)
  const version = detail.nilaiEvaluasi?.find((row) => row.sopDetailId === detailSopId)?.version ?? 0
  await apiPatch(context, `/evaluasi/${pengajuanId}/nilai/${detailSopId}`, {
    hasil: 'SESUAI',
    version,
  })
}

export async function nilaiSopPerluPerbaikan(
  context: APIRequestContext,
  pengajuanId: string,
  detailSopId: string,
  catatan: string,
): Promise<void> {
  const detail = await apiGet<Pengajuan>(context, `/evaluasi/${pengajuanId}`)
  const version = detail.nilaiEvaluasi?.find((row) => row.sopDetailId === detailSopId)?.version ?? 0
  await apiPatch(context, `/evaluasi/${pengajuanId}/nilai/${detailSopId}`, {
    hasil: 'PERLU_PERBAIKAN',
    catatan,
    version,
  })
}

export async function finishEvaluation(
  context: APIRequestContext,
  pengajuanId: string,
  nomorBA: string,
): Promise<void> {
  await apiPatch(context, `/evaluasi/${pengajuanId}/selesai`, { nomorBA })
}

export async function ensureTteReady(context: APIRequestContext): Promise<void> {
  const profil = await apiGet<unknown | null>(context, '/tte/profil')
  if (profil !== null) return
  await apiPost(context, '/tte/profil/setup/generate', { pin: e2ePin })
}

export async function signBeritaAcara(
  context: APIRequestContext,
  pengajuanId: string,
  nomorDokumen: string,
  judulDokumen: string,
): Promise<SignedRow> {
  return apiPost<SignedRow>(context, `/tte/tanda-tangani/ba/${pengajuanId}`, {
    pin: e2ePin,
    nomorDokumen,
    judulDokumen,
  })
}

export async function signAllSop(
  context: APIRequestContext,
  pengajuanId: string,
  detailSopId: string,
  nomorDokumen: string,
  judulDokumen: string,
): Promise<void> {
  await apiPost(context, `/tte/tanda-tangani/pengajuan/${pengajuanId}/sop-semua`, {
    pin: e2ePin,
    nomorDokumen,
    judulDokumen,
    sopPdfs: [{ detailSopId, pdfBase64: validPdfBase64 }],
  })
}

export async function createApprovedSopFixture(prefix = 'APPROVED'): Promise<ApprovedSopFixture> {
  const pjPenyusun = await createAuthenticatedApiContext(users.pjPenyusun)
  const evaluator = await createAuthenticatedApiContext(users.evaluator)
  const pjEvaluator = await createAuthenticatedApiContext(users.pjEvaluator)
  const kepalaOpd = await createAuthenticatedApiContext(users.kepalaOpd)
  try {
    const sop = await createReadySopFixture(pjPenyusun, prefix)
    const pengajuanId = await createPengajuanForSop(pjPenyusun, sop.detailSopId)
    await nilaiSopSesuai(evaluator, pengajuanId, sop.detailSopId)
    await finishEvaluation(evaluator, pengajuanId, sop.baNumber)
    await ensureTteReady(pjEvaluator)
    await ensureTteReady(pjPenyusun)
    await ensureTteReady(kepalaOpd)
    await signBeritaAcara(pjEvaluator, pengajuanId, sop.baNumber, `Berita Acara ${sop.title}`)
    await signBeritaAcara(pjPenyusun, pengajuanId, sop.baNumber, `Berita Acara ${sop.title}`)
    await signAllSop(kepalaOpd, pengajuanId, sop.detailSopId, sop.number, sop.title)
    const workbench = await apiGet<Workbench>(kepalaOpd, `/sop/penyusun-workbench/${sop.detailSopId}`)
    return {
      ...sop,
      pengajuanId,
      pengesahan: workbench.tteSignaturePayloadKepalaOpd,
    }
  } finally {
    await Promise.all([
      pjPenyusun.dispose(),
      evaluator.dispose(),
      pjEvaluator.dispose(),
      kepalaOpd.dispose(),
    ])
  }
}

export async function approveEvaluatedSopFixture(
  sop: ReadySopFixture,
  pengajuanId: string,
): Promise<void> {
  const pjEvaluator = await createAuthenticatedApiContext(users.pjEvaluator)
  const pjPenyusun = await createAuthenticatedApiContext(users.pjPenyusun)
  const kepalaOpd = await createAuthenticatedApiContext(users.kepalaOpd)
  try {
    await ensureTteReady(pjEvaluator)
    await ensureTteReady(pjPenyusun)
    await ensureTteReady(kepalaOpd)
    await signBeritaAcara(pjEvaluator, pengajuanId, sop.baNumber, `Berita Acara ${sop.title}`)
    await signBeritaAcara(pjPenyusun, pengajuanId, sop.baNumber, `Berita Acara ${sop.title}`)
    await signAllSop(kepalaOpd, pengajuanId, sop.detailSopId, sop.number, sop.title)
  } finally {
    await Promise.all([pjEvaluator.dispose(), pjPenyusun.dispose(), kepalaOpd.dispose()])
  }
}

export async function expectPenyusunCannotSubmitEvaluation(
  context: APIRequestContext,
  detailSopId: string,
): Promise<void> {
  await expectApiRejected(context, 'post', '/evaluasi', {
    jenis: 'EVALUASI_REQUEST_OPD',
    sopDetailIds: [detailSopId],
  })
}

export async function expectPenyusunCannotResubmitRevision(
  context: APIRequestContext,
  detailSopId: string,
): Promise<void> {
  await expectApiRejected(
    context,
    'post',
    `/sop/penyusun-workbench/${detailSopId}/kirim-ulang-evaluasi`,
  )
}

function resolvePengajuanId(pengajuan: Pengajuan): string {
  const id = pengajuan.id ?? pengajuan.pengajuanEvaluasiId
  if (!id) throw new Error(`Pengajuan response tidak memuat id: ${JSON.stringify(pengajuan)}`)
  return id
}
