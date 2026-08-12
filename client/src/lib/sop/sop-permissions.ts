import type { StatusSOP } from '@/types/dto/sop.dto'

export function canEditSop(status: StatusSOP): boolean {
  return status === 'DRAFT'
}

export function canBuatVersiBaru(row: {
  status?: StatusSOP
  canBuatVersiBaru?: boolean
}): boolean {
  if (row.canBuatVersiBaru !== undefined) return row.canBuatVersiBaru
  return row.status === 'COMPLETED'
}

export function canHapusVersiDraft(
  status: StatusSOP,
  canHapusDraft?: boolean,
): boolean {
  return status === 'DRAFT' && canHapusDraft === true
}

export function canHapusSopDraftAwal(row: {
  status: StatusSOP
  versi?: number | null
  canHapusSopDraft?: boolean
}): boolean {
  return row.status === 'DRAFT' && row.versi === 1 && row.canHapusSopDraft === true
}
