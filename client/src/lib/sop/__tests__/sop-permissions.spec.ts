import { describe, expect, it } from 'vitest'
import {
  canBuatVersiBaru,
  canEditSop,
  canHapusSopDraftAwal,
  canHapusVersiDraft,
} from '../sop-permissions'

describe('sop-permissions', () => {
  it('hanya mengizinkan edit pada draft', () => {
    expect(canEditSop('DRAFT')).toBe(true)
    expect(canEditSop('COMPLETED')).toBe(false)
    expect(canEditSop('ARCHIVED')).toBe(false)
  })

  it('mengizinkan versi baru dari SOP completed', () => {
    expect(canBuatVersiBaru({ status: 'COMPLETED' })).toBe(true)
    expect(canBuatVersiBaru({ status: 'DRAFT' })).toBe(false)
    expect(canBuatVersiBaru({ status: 'ARCHIVED' })).toBe(false)
    expect(canBuatVersiBaru({ status: 'DRAFT', canBuatVersiBaru: true })).toBe(true)
  })

  it('hanya mengizinkan hapus versi draft ketika server mengizinkan', () => {
    expect(canHapusVersiDraft('DRAFT', true)).toBe(true)
    expect(canHapusVersiDraft('DRAFT', false)).toBe(false)
    expect(canHapusVersiDraft('COMPLETED', true)).toBe(false)
  })

  it('hanya mengizinkan penghapusan SOP draft awal', () => {
    expect(canHapusSopDraftAwal({ status: 'DRAFT', versi: 1, canHapusSopDraft: true })).toBe(true)
    expect(canHapusSopDraftAwal({ status: 'COMPLETED', versi: 1, canHapusSopDraft: true })).toBe(false)
    expect(canHapusSopDraftAwal({ status: 'DRAFT', versi: 2, canHapusSopDraft: true })).toBe(false)
    expect(canHapusSopDraftAwal({ status: 'DRAFT', versi: 1, canHapusSopDraft: false })).toBe(false)
  })
})
