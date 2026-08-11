import { describe, expect, it } from 'vitest'
import { validateProsedurRows } from '../validateProsedurRows'
import type { ProsedurRow } from '@/types/ui/sop'

function completeRow(overrides: Partial<ProsedurRow> = {}): ProsedurRow {
  return {
    id: 'step-1',
    urutan: 1,
    kegiatan: 'Kegiatan uji',
    pelaksana: 'impl-1',
    mutu_kelengkapan: 'Form A',
    mutu_waktu: '5 m',
    output: 'Dokumen',
    keterangan: 'Catatan',
    type: 'task',
    ...overrides,
  }
}

describe('validateProsedurRows', () => {
  it('should_pass_when_all_rows_are_complete', () => {
    const rows = [
      completeRow({ id: 'start', type: 'terminator', terminatorRole: 'start' }),
      completeRow({ id: 'mid', urutan: 2 }),
      completeRow({
        id: 'end',
        urutan: 3,
        type: 'terminator',
        terminatorRole: 'end',
      }),
    ]
    const result = validateProsedurRows(rows, 1)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should_fail_when_kegiatan_or_kelengkapan_missing', () => {
    const rows = [completeRow({ kegiatan: '', mutu_kelengkapan: '' })]
    const result = validateProsedurRows(rows, 1)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Langkah 1: kegiatan wajib diisi')
    expect(result.errors).toContain('Langkah 1: kelengkapan wajib diisi')
  })

  it('should_require_decision_branches_when_type_is_decision', () => {
    const rows = [
      completeRow({
        type: 'decision',
        id_next_step_if_yes: undefined,
        id_next_step_if_no: undefined,
      }),
    ]
    const result = validateProsedurRows(rows, 1)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'Langkah 1: cabang "Ya" wajib menunjuk langkah berikutnya',
    )
    expect(result.errors).toContain(
      'Langkah 1: cabang "Tidak" wajib menunjuk langkah berikutnya',
    )
  })

  it('should_fail_when_no_implementers', () => {
    const result = validateProsedurRows([completeRow()], 0)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toMatch(/pelaksana/i)
  })
})
