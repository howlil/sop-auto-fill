import type { StatusSOP } from '@/types/dto/sop.dto'
import type { StatusBadgeColors } from './status-badge.types'
import { STATUS_BADGE_COLORS_DEFAULT } from './status-badge.types'

/** Warna badge per nilai status dokumen (label dari server). */
export const SOP_STATUS_BADGE_COLORS: Record<string, StatusBadgeColors> = {
  DRAFT: { color: 'text-secondary-foreground', bgColor: 'bg-surface-muted' },
  SEDANG_DISUSUN: { color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
  MENUNGGU_PENGAJUAN_EVALUASI: { color: 'text-cyan-800', bgColor: 'bg-cyan-100' },
  DIAJUKAN_EVALUASI: { color: 'text-blue-700', bgColor: 'bg-blue-100' },
  SEDANG_DIEVALUASI: { color: 'text-amber-800', bgColor: 'bg-amber-100' },
  REVISI_DARI_EVALUATOR: { color: 'text-orange-700', bgColor: 'bg-orange-100' },
  DITOLAK_EVALUATOR: { color: 'text-red-800', bgColor: 'bg-red-100' },
  MENUNGGU_TTD_PJ_EVALUATOR: { color: 'text-teal-800', bgColor: 'bg-teal-100' },
  DIVERIFIKASI_PJ_EVALUATOR_ORGANISASI: {
    color: 'text-violet-800',
    bgColor: 'bg-violet-100',
  },
  BERLAKU: { color: 'text-emerald-800', bgColor: 'bg-emerald-100' },
  DIGANTIKAN: { color: 'text-secondary-foreground', bgColor: 'bg-surface-muted' },
  DICABUT: { color: 'text-rose-800', bgColor: 'bg-rose-100' },
}

const SOP_STATUS_FILTER_VALUES = [
  'DRAFT',
  'SEDANG_DISUSUN',
  'MENUNGGU_PENGAJUAN_EVALUASI',
  'DIAJUKAN_EVALUASI',
  'SEDANG_DIEVALUASI',
  'REVISI_DARI_EVALUATOR',
  'DITOLAK_EVALUATOR',
  'MENUNGGU_TTD_PJ_EVALUATOR',
  'DIVERIFIKASI_PJ_EVALUATOR_ORGANISASI',
  'BERLAKU',
  'DICABUT',
] as const satisfies readonly StatusSOP[]

const SOP_STATUS_FILTER_LABELS: Record<(typeof SOP_STATUS_FILTER_VALUES)[number], string> = {
  DRAFT: 'Draft',
  SEDANG_DISUSUN: 'Sedang disusun',
  MENUNGGU_PENGAJUAN_EVALUASI: 'Menunggu pengajuan evaluasi',
  DIAJUKAN_EVALUASI: 'Diajukan evaluasi',
  SEDANG_DIEVALUASI: 'Dalam penilaian',
  REVISI_DARI_EVALUATOR: 'Perlu revisi',
  DITOLAK_EVALUATOR: 'Ditolak evaluator',
  MENUNGGU_TTD_PJ_EVALUATOR: 'Menunggu TTD PJ Evaluator',
  DIVERIFIKASI_PJ_EVALUATOR_ORGANISASI: 'Menunggu pengesahan Kepala OPD',
  BERLAKU: 'Berlaku',
  DICABUT: 'Dicabut',
}

export function getSopStatusColors(status: string): StatusBadgeColors {
  return SOP_STATUS_BADGE_COLORS[status] ?? STATUS_BADGE_COLORS_DEFAULT
}

/** Opsi filter — label placeholder; halaman filter memakai label dari API bila tersedia. */
export const SOP_STATUS_FILTER_OPTIONS = [
  { value: 'all' as const, label: 'Semua Status' },
  ...SOP_STATUS_FILTER_VALUES.map((value) => ({
    value,
    label: SOP_STATUS_FILTER_LABELS[value],
  })),
] as const
