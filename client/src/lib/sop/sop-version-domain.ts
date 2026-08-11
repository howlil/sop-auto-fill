import type { SopDaftarRow, SopRiwayatVersiRow, StatusSOP } from '@/types/dto/sop.dto'

const TERMINAL_VERSION_STATUSES: ReadonlySet<StatusSOP> = new Set([
  'DITOLAK_EVALUATOR',
  'BERLAKU',
  'DIGANTIKAN',
  'DICABUT',
])

export function isTerminalVersionStatus(status: string): status is StatusSOP {
  return TERMINAL_VERSION_STATUSES.has(status as StatusSOP)
}

export function getNextSopVersion(rows: Array<Pick<SopRiwayatVersiRow, 'versi'>>): number {
  return rows.reduce((max, row) => Math.max(max, row.versi), 0) + 1
}

export function getBuatVersiDariRiwayatBlockingReason(
  row: Pick<SopRiwayatVersiRow, 'status' | 'canBuatVersiBaru'> | undefined,
): string | null {
  if (row === undefined) {
    return 'Versi sumber tidak ditemukan dalam riwayat.'
  }
  if (!isTerminalVersionStatus(row.status)) {
    return 'Hanya versi DITOLAK, BERLAKU, DIGANTIKAN, atau DICABUT yang dapat dijadikan sumber.'
  }
  if (!row.canBuatVersiBaru) {
    return 'Masih ada revisi versi yang belum selesai. Selesaikan atau hapus draft terlebih dahulu.'
  }
  return null
}

export function canBuatVersiBaruFromRow(row: {
  canBuatVersiBaru?: boolean
  versiBerlaku?: { detailSopId: string } | null
}): boolean {
  return row.canBuatVersiBaru === true
}

export function getBuatVersiBaruBlockingReason(row: SopDaftarRow): string | null {
  if (!row.canBuatVersiBaru) {
    return 'Belum ada versi terminal yang dapat dijadikan sumber, atau masih ada versi yang belum selesai.'
  }
  return null
}

export function canHapusVersiDraft(
  status: StatusSOP,
  canHapusDraft?: boolean,
): boolean {
  return status === 'DRAFT' && canHapusDraft === true
}

export function isRevisiDariBerlaku(
  revisiDariDetailSopId?: string | null,
): boolean {
  return revisiDariDetailSopId != null && revisiDariDetailSopId.length > 0
}
