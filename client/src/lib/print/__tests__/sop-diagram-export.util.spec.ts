import { describe, expect, it } from 'vitest'
import { buildSopDiagramExportCacheKey } from '../sop-diagram-export.util'

describe('buildSopDiagramExportCacheKey', () => {
  it('menghasilkan kunci stabil untuk input yang sama', () => {
    const input = {
      name: 'SOP',
      prosedurRows: [],
      implementers: [{ id: 'p1', name: 'Pelaksana' }],
    }
    expect(buildSopDiagramExportCacheKey(input)).toBe(buildSopDiagramExportCacheKey(input))
  })

  it('berbeda bila konfigurasi diagram berubah', () => {
    const base = {
      name: 'SOP',
      prosedurRows: [],
      implementers: [{ id: 'p1', name: 'Pelaksana' }],
    }
    const keyA = buildSopDiagramExportCacheKey({
      ...base,
      diagramKonfigurasi: { flowchart: { layoutSeed: 1, pathOverrides: null } },
    })
    const keyB = buildSopDiagramExportCacheKey({
      ...base,
      diagramKonfigurasi: { flowchart: { layoutSeed: 2, pathOverrides: null } },
    })
    expect(keyA).not.toBe(keyB)
  })
})
