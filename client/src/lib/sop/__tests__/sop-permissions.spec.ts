import { describe, expect, it } from 'vitest'
import { ROLES } from '@/utils/constants'
import {
  canKirimUlangKeEvaluatorAfterRevisi,
  canHapusSopDraftAwal,
  getKirimUlangRoleBlockingReason,
  isSopEligibleForSigning,
} from '../sop-permissions'

describe('sop-permissions', () => {
  it('should_only_allow_kepala_opd_signing_after_pj_penyusun_ba_signature', () => {
    expect(isSopEligibleForSigning({ status: 'MENUNGGU_TTD_PJ_EVALUATOR' })).toBe(false)
    expect(
      isSopEligibleForSigning({
        status: 'DIVERIFIKASI_PJ_EVALUATOR_ORGANISASI',
      }),
    ).toBe(true)
  })

  it('should_allow_kirim_ulang_only_for_pj_penyusun', () => {
    expect(canKirimUlangKeEvaluatorAfterRevisi(ROLES.PJ_PENYUSUN)).toBe(true)
    expect(canKirimUlangKeEvaluatorAfterRevisi(ROLES.PENYUSUN)).toBe(false)
    expect(canKirimUlangKeEvaluatorAfterRevisi(null)).toBe(false)
    expect(getKirimUlangRoleBlockingReason(ROLES.PJ_PENYUSUN)).toBeNull()
    expect(getKirimUlangRoleBlockingReason(ROLES.PENYUSUN)).toContain('PJ Penyusun')
  })

  it('should_only_allow_deleting_initial_sop_draft', () => {
    expect(canHapusSopDraftAwal({ status: 'DRAFT', versi: 1, canHapusSopDraft: true })).toBe(true)
    expect(canHapusSopDraftAwal({ status: 'SEDANG_DISUSUN', versi: 1, canHapusSopDraft: true })).toBe(false)
    expect(canHapusSopDraftAwal({ status: 'DRAFT', versi: 2, canHapusSopDraft: true })).toBe(false)
    expect(canHapusSopDraftAwal({ status: 'DRAFT', versi: 1, canHapusSopDraft: false })).toBe(false)
  })
})
