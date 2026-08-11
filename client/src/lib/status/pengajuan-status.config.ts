import type { StatusPengajuanEvaluasi } from '@/types/dto/evaluasi.dto'
import type { StatusBadgeColors } from './status-badge.types'
import { STATUS_BADGE_COLORS_DEFAULT } from './status-badge.types'

export const PENGAJUAN_STATUS_BADGE_COLORS: Record<
  StatusPengajuanEvaluasi,
  StatusBadgeColors
> = {
  SEDANG_DIEVALUASI: { color: 'text-amber-800', bgColor: 'bg-amber-100' },
  DITOLAK: { color: 'text-red-800', bgColor: 'bg-red-100' },
  SELESAI_DIEVALUASI: { color: 'text-sky-800', bgColor: 'bg-sky-100' },
  DITANDATANGANI_PJ_EVALUATOR: { color: 'text-orange-800', bgColor: 'bg-orange-100' },
  DITANDATANGANI_PJ_PENYUSUN: { color: 'text-teal-800', bgColor: 'bg-teal-100' },
  SELESAI: { color: 'text-emerald-800', bgColor: 'bg-emerald-100' },
}

export function getPengajuanStatusColors(status: string): StatusBadgeColors {
  return PENGAJUAN_STATUS_BADGE_COLORS[status as StatusPengajuanEvaluasi] ?? STATUS_BADGE_COLORS_DEFAULT
}
