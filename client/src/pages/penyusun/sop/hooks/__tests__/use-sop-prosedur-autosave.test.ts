import { describe, expect, it } from 'vitest'
import {
  buildSopProsedurSnapshot,
  pickNonEmptyTrimmed,
} from '@/pages/penyusun/sop/hooks/use-sop-prosedur-autosave'
import type { ProsedurRow } from '@/types/ui/sop'

describe('pickNonEmptyTrimmed', () => {
  it('should_return_first_non_empty_after_trim', () => {
    expect(pickNonEmptyTrimmed('', '  x ', undefined)).toBe('x')
  })

  it('should_return_undefined_when_all_empty', () => {
    expect(pickNonEmptyTrimmed('', null, '   ')).toBeUndefined()
  })
})

describe('buildSopProsedurSnapshot', () => {
  it('should_use_mutu_kelengkapan_and_output_when_canonical_fields_are_empty_strings', () => {
    const row: ProsedurRow = {
      id: 'step-1',
      urutan: 1,
      no: 1,
      kegiatan: 'Kegiatan A',
      pelaksana: 'pel-1',
      kelengkapan: '',
      mutu_kelengkapan: 'Kelengkapan dari UI',
      keluaran: '',
      output: 'Output dari UI',
      keterangan: 'catatan',
      type: 'task',
    }
    const snapshot = buildSopProsedurSnapshot([{ id: 'pel-1', name: 'Pelaksana' }], [row])
    expect(snapshot.langkah).toHaveLength(1)
    expect(snapshot.langkah[0]?.kelengkapan).toBe('Kelengkapan dari UI')
    expect(snapshot.langkah[0]?.keluaran).toBe('Output dari UI')
    expect(snapshot.langkah[0]?.keterangan).toBe('catatan')
  })
})
