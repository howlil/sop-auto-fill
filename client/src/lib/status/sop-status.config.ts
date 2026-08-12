import type { StatusSOP } from '@/types/dto/sop.dto'
import type { StatusBadgeColors } from './status-badge.types'
import { STATUS_BADGE_COLORS_DEFAULT } from './status-badge.types'

/** Warna badge untuk status authoring SOP yang masih dipertahankan. */
export const SOP_STATUS_BADGE_COLORS: Record<StatusSOP, StatusBadgeColors> = {
  DRAFT: { color: 'text-secondary-foreground', bgColor: 'bg-surface-muted' },
  COMPLETED: { color: 'text-emerald-800', bgColor: 'bg-emerald-100' },
  ARCHIVED: { color: 'text-slate-700', bgColor: 'bg-slate-100' },
}

const SOP_STATUS_FILTER_VALUES = ['DRAFT', 'COMPLETED', 'ARCHIVED'] as const satisfies readonly StatusSOP[]

const SOP_STATUS_FILTER_LABELS: Record<(typeof SOP_STATUS_FILTER_VALUES)[number], string> = {
  DRAFT: 'Draft',
  COMPLETED: 'Selesai',
  ARCHIVED: 'Diarsipkan',
}

export function getSopStatusColors(status: string): StatusBadgeColors {
  return SOP_STATUS_BADGE_COLORS[status as StatusSOP] ?? STATUS_BADGE_COLORS_DEFAULT
}

export const SOP_STATUS_FILTER_OPTIONS = [
  { value: 'all' as const, label: 'Semua Status' },
  ...SOP_STATUS_FILTER_VALUES.map((value) => ({
    value,
    label: SOP_STATUS_FILTER_LABELS[value],
  })),
] as const
