import type { SopDaftarRow } from '@/types/dto/sop.dto'

const REVISI_IN_FLIGHT_BLOCK =
  'Tidak dapat mencabut SOP karena masih ada revisi yang sedang berjalan. Selesaikan atau batalkan revisi terlebih dahulu.'

/** Alasan tombol cabut disabled; null jika boleh dicabut. */
export function getCabutSopBlockingReason(row: SopDaftarRow | null | undefined): string | null {
  if (row == null) return 'Data SOP belum tersedia'
  if (row.canCabutSop === true) return null
  if (row.versiBerlaku == null) return 'SOP tidak memiliki versi berlaku yang dapat dicabut'
  if (row.versiBerlaku.status === 'DICABUT') return 'SOP sudah dicabut'
  if (row.versiBerlaku.status !== 'BERLAKU') {
    return 'Hanya SOP berstatus Berlaku yang dapat dicabut'
  }
  return REVISI_IN_FLIGHT_BLOCK
}

/** Apakah tombol aksi cabut ditampilkan (Kepala OPD, belum dicabut). */
export function canShowCabutSopAction(row: SopDaftarRow | null | undefined): boolean {
  if (row == null) return false
  if (row.versiBerlaku?.status === 'DICABUT') return false
  return row.canCabutSop === true || row.versiBerlaku?.status === 'BERLAKU'
}

/** ID workbench untuk pratinjau versi resmi (BERLAKU/DICABUT), bukan draft in-flight. */
export function resolveKepalaOpdWorkbenchId(
  sopHeaderId: string,
  row: SopDaftarRow | null | undefined,
): string {
  return row?.versiBerlaku?.detailSopId ?? row?.detailSopId ?? sopHeaderId
}
