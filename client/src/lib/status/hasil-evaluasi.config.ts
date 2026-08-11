import type { StatusHasilEvaluasi } from '@/types/dto/evaluasi.dto'
import type { StatusBadgeColors } from './status-badge.types'
import { STATUS_BADGE_COLORS_DEFAULT } from './status-badge.types'

/** Nilai hasil dari server (termasuk turunan API BELUM_DINILAI). */
export type HasilEvaluasiDisplay = StatusHasilEvaluasi | 'DITOLAK' | 'BELUM_DINILAI'

export const HASIL_EVALUASI_BADGE_COLORS: Record<string, StatusBadgeColors> = {
  SESUAI: { color: 'text-emerald-800', bgColor: 'bg-emerald-100' },
  PERLU_PERBAIKAN: { color: 'text-amber-800', bgColor: 'bg-amber-100' },
  DITOLAK: { color: 'text-red-800', bgColor: 'bg-red-100' },
  BELUM_DINILAI: { color: 'text-secondary-foreground', bgColor: 'bg-surface-muted' },
}

export function getHasilEvaluasiColors(hasil: string): StatusBadgeColors {
  return HASIL_EVALUASI_BADGE_COLORS[hasil] ?? STATUS_BADGE_COLORS_DEFAULT
}
