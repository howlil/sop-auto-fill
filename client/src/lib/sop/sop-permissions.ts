import type { StatusSOP } from '@/types/dto/sop.dto'
import { ROLES } from '@/utils/constants'

export function canEditSop(status: StatusSOP): boolean {
  return (
    status === 'DRAFT' ||
    status === 'SEDANG_DISUSUN' ||
    status === 'REVISI_DARI_EVALUATOR'
  )
}

export function canKepalaOpdSignSop(status: string): boolean {
  return status === 'DIVERIFIKASI_PJ_EVALUATOR_ORGANISASI'
}

export function isSopEligibleForSigning(sop: { status: string }): boolean {
  return sop.status === 'DIVERIFIKASI_PJ_EVALUATOR_ORGANISASI'
}

export function canPjPenyusunRunCoordinatorActions(role: string): boolean {
  return role === ROLES.PJ_PENYUSUN
}

export function canBuatVersiBaru(row: {
  canBuatVersiBaru?: boolean
}): boolean {
  return row.canBuatVersiBaru === true
}

export function canHapusVersiDraft(
  status: StatusSOP,
  canHapusDraft?: boolean,
): boolean {
  return status === 'DRAFT' && canHapusDraft === true
}

export function canHapusSopDraftAwal(row: {
  status: string
  versi?: number | null
  canHapusSopDraft?: boolean
}): boolean {
  return row.status === 'DRAFT' && row.versi === 1 && row.canHapusSopDraft === true
}

/** Kirim ulang ke evaluator setelah revisi evaluator — hanya PJ Penyusun. */
export function canKirimUlangKeEvaluatorAfterRevisi(
  role: string | null | undefined,
): boolean {
  return role === ROLES.PJ_PENYUSUN
}

export function getKirimUlangRoleBlockingReason(
  role: string | null | undefined,
): string | null {
  if (canKirimUlangKeEvaluatorAfterRevisi(role)) {
    return null
  }
  return 'Hanya PJ Penyusun yang dapat mengirim ulang ke evaluator. Hubungi PJ Penyusun OPD Anda.'
}
