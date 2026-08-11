import type { StatusTindakLanjut } from '@/types/dto/evaluasi.dto'

/** Selaras dengan server `STATUS_TINDAK_LANJUT_LABELS` di status-display.ts */
export const STATUS_TINDAK_LANJUT_LABELS: Record<StatusTindakLanjut, string> = {
  TERBUKA: 'Menunggu tindak lanjut OPD',
  SELESAI: 'Siap dinilai ulang',
}

export function getStatusTindakLanjutLabel(
  status: StatusTindakLanjut | string | null | undefined,
  apiLabel?: string | null,
): string | null {
  if (apiLabel?.trim()) {
    return apiLabel.trim()
  }
  if (status === 'TERBUKA' || status === 'SELESAI') {
    return STATUS_TINDAK_LANJUT_LABELS[status]
  }
  return null
}

export function getStatusTindakLanjutBadgeClass(
  status: StatusTindakLanjut | string | null | undefined,
): string {
  if (status === 'SELESAI') {
    return 'bg-green-600 text-white border-0'
  }
  if (status === 'TERBUKA') {
    return 'bg-blue-600 text-white border-0'
  }
  return 'bg-surface-subtle0 text-white border-0'
}
