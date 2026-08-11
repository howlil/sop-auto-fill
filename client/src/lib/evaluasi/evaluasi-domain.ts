import type {
  EvaluasiWorkspacePengajuanAktif,
  HasilEvaluasiDisplay,
  StatusHasilEvaluasi,
  StatusTindakLanjut,
  UmpanBalikEvaluasiDetail,
} from '@/types/dto/evaluasi.dto'
import { STATUS_HASIL_EVALUASI } from '@/types/dto/evaluasi.dto'

/** Tahap penilaian per SOP di workspace evaluator (turunan hasil + tindak lanjut + status dokumen). */
export type TahapPenilaianSop =
  | 'belum_dinilai'
  | 'ditolak'
  | 'menunggu_perbaikan_opd'
  | 'tinjauan_ulang'
  | 'sesuai'

const STATUS_DETAIL_SIAP_TINJAU_ULANG = new Set([
  'DIAJUKAN_EVALUASI',
  'SEDANG_DIEVALUASI',
])

export interface DeriveTahapPenilaianInput {
  readonly hasil: HasilEvaluasiDisplay | StatusHasilEvaluasi | string | null | undefined
  readonly statusTindakLanjut?: StatusTindakLanjut | string | null
  readonly statusDetail?: string | null
}

export function deriveTahapPenilaianSop(input: DeriveTahapPenilaianInput): TahapPenilaianSop {
  const hasil = input.hasil
  if (hasil === 'DITOLAK') {
    return 'ditolak'
  }
  if (hasil === STATUS_HASIL_EVALUASI.SESUAI) {
    return 'sesuai'
  }
  if (
    hasil === null ||
    hasil === undefined ||
    hasil === '' ||
    hasil === 'BELUM_DINILAI'
  ) {
    return 'belum_dinilai'
  }
  if (hasil !== STATUS_HASIL_EVALUASI.PERLU_PERBAIKAN) {
    return 'belum_dinilai'
  }
  const statusDetail = input.statusDetail ?? ''
  const tindak = input.statusTindakLanjut ?? null
  if (
    tindak === 'SELESAI' &&
    STATUS_DETAIL_SIAP_TINJAU_ULANG.has(statusDetail)
  ) {
    return 'tinjauan_ulang'
  }
  if (
    tindak === 'TERBUKA' ||
    statusDetail === 'REVISI_DARI_EVALUATOR'
  ) {
    return 'menunggu_perbaikan_opd'
  }
  if (tindak === 'SELESAI') {
    return 'tinjauan_ulang'
  }
  return 'menunggu_perbaikan_opd'
}

export interface TahapPenilaianCopy {
  readonly badgeLabel: string
  readonly badgeClassName: string
  readonly bannerTitle: string | null
  readonly bannerDescription: string | null
}

export function getTahapPenilaianCopy(tahap: TahapPenilaianSop): TahapPenilaianCopy {
  switch (tahap) {
    case 'ditolak':
      return {
        badgeLabel: 'Ditolak',
        badgeClassName: 'bg-red-100 text-red-800 border-red-200',
        bannerTitle: 'Versi SOP ditolak',
        bannerDescription:
          'Versi ini ditutup dan tidak dapat diajukan ulang. Penyusun wajib membuat versi baru untuk melanjutkan.',
      }
    case 'tinjauan_ulang':
      return {
        badgeLabel: 'Siap tinjau ulang',
        badgeClassName: 'bg-sky-100 text-sky-800 border-sky-200',
        bannerTitle: 'Dokumen sudah diperbaiki',
        bannerDescription:
          'Penyusun sudah menyelesaikan perbaikan dan mengirim ulang dokumen ini. Tinjau preview, lalu tetapkan hasil penilaian ulang di bawah.',
      }
    case 'menunggu_perbaikan_opd':
      return {
        badgeLabel: 'Menunggu perbaikan OPD',
        badgeClassName: 'bg-amber-100 text-amber-800 border-amber-200',
        bannerTitle: 'Menunggu perbaikan penyusun',
        bannerDescription:
          'OPD masih memperbaiki dokumen sesuai catatan Anda. Anda dapat melanjutkan penilaian SOP lain dalam pengajuan ini.',
      }
    case 'sesuai':
      return {
        badgeLabel: 'Sesuai',
        badgeClassName: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        bannerTitle: null,
        bannerDescription: null,
      }
    case 'belum_dinilai':
      return {
        badgeLabel: 'Belum dinilai',
        badgeClassName: 'bg-surface-muted text-secondary-foreground border-border',
        bannerTitle: null,
        bannerDescription: null,
      }
  }
}

/** true bila dokumen diperbarui setelah penyusun menandai tindak lanjut. */
export function isDetailDiperbaruiSetelahTindakLanjut(
  detailUpdatedAt: string | null | undefined,
  ditindaklanjutiPada: string | null | undefined,
): boolean {
  if (!detailUpdatedAt || !ditindaklanjutiPada) {
    return false
  }
  return Date.parse(detailUpdatedAt) > Date.parse(ditindaklanjutiPada)
}

export interface StatusHasilEvaluasiForm {
  hasil: StatusHasilEvaluasi
  catatan: string
}

export function getStatusSopAfterEvaluasi(hasil: StatusHasilEvaluasi): string {
  return hasil === 'SESUAI' ? 'MENUNGGU_TTD_PJ_EVALUATOR' : 'REVISI_DARI_EVALUATOR'
}

export function isFormEvaluasiSopComplete(
  form: StatusHasilEvaluasiForm,
): boolean {
  return Boolean(form.hasil && (form.hasil as string) !== '')
}

/** true hanya bila hasil sudah disimpan di server (bukan turunan BELUM_DINILAI). */
export function hasHasilEvaluasiTersimpan(
  hasil: StatusHasilEvaluasi | string | null | undefined,
): boolean {
  return (
    hasil === STATUS_HASIL_EVALUASI.SESUAI ||
    hasil === STATUS_HASIL_EVALUASI.PERLU_PERBAIKAN ||
    hasil === 'DITOLAK'
  )
}

export interface AjukanEvaluasiSnapshotRow {
  readonly detailSopId: string
  readonly judul: string
  readonly nomorSOP: string
  readonly hasilLabel: string
}

export function getAjukanEvaluasiBlockingReason(
  pengajuan: EvaluasiWorkspacePengajuanAktif | null | undefined,
  ratingOPD: number | null,
): string | null {
  if (!pengajuan) {
    return 'Tidak ada pengajuan evaluasi aktif untuk OPD ini.'
  }
  const wajibSkorOpd = pengajuan.jenis !== 'EVALUASI_REQUEST_OPD'
  if (
    wajibSkorOpd &&
    (ratingOPD === null || ratingOPD < 1 || ratingOPD > 5)
  ) {
    return 'Isi skor OPD (1–5) di tab Evaluasi OPD.'
  }
  if (pengajuan.nilaiPerDetail.length === 0) {
    return 'Pengajuan belum memiliki daftar dokumen untuk dinilai.'
  }

  let jumlahBelumSesuai = 0
  for (const row of pengajuan.nilaiPerDetail) {
    if (row.hasil !== STATUS_HASIL_EVALUASI.SESUAI) {
      jumlahBelumSesuai += 1
    }
  }

  if (jumlahBelumSesuai > 0) {
    return `Masih ada ${jumlahBelumSesuai} SOP yang belum Sesuai. Simpan penilaian per dokumen terlebih dahulu.`
  }
  return null
}

export function canKirimUlangSetelahRevisi(
  umpanBalik: UmpanBalikEvaluasiDetail | null | undefined,
): boolean {
  if (!umpanBalik) {
    return false
  }
  return umpanBalik.pengajuanStatus !== 'DITOLAK' && umpanBalik.hasil !== 'DITOLAK'
}

export function getKirimUlangBlockingReason(
  umpanBalik: UmpanBalikEvaluasiDetail | null | undefined,
): string | null {
  if (!umpanBalik) {
    return 'Tidak ada umpan balik evaluasi aktif untuk dokumen ini.'
  }
  if (umpanBalik.pengajuanStatus === 'DITOLAK' || umpanBalik.hasil === 'DITOLAK') {
    return 'Versi yang ditolak tidak dapat dikirim ulang. Buat versi baru untuk melanjutkan.'
  }
  return null
}

export function buildAjukanEvaluasiSnapshotRows(
  pengajuan: EvaluasiWorkspacePengajuanAktif | null | undefined,
  judulByDetailId: Map<string, { judul: string; nomorSOP: string }>,
): AjukanEvaluasiSnapshotRow[] {
  if (!pengajuan) return []

  return pengajuan.nilaiPerDetail.map((row) => {
    const meta = judulByDetailId.get(row.detailSopId)

    const hasilLabel = row.hasilLabel

    return {
      detailSopId: row.detailSopId,
      judul: meta?.judul ?? `${row.detailSopId.slice(0, 8)}.`,
      nomorSOP: meta?.nomorSOP ?? '-',
      hasilLabel,
    }
  })
}
