import { describe, expect, it } from 'vitest'
import {
  buildDiagramEdgeKey,
  parseDiagramEdgeKey,
  pathOverridesToArrowConfig,
  arrowConfigToPathOverrides,
  buildDiagramStateForPreviewTab,
  buildConnectionEdgeMetas,
  diagramSlicesEqual,
  resetDiagramSlicePaths,
} from '@/lib/sop/diagram-config.mapper'

describe('diagram-config.mapper', () => {
  it('should_build_and_parse_edge_key', () => {
    const key = buildDiagramEdgeKey('langkah-a', 'langkah-b', 'YA')
    expect(key).toBe('langkah-a|langkah-b|YA')
    expect(parseDiagramEdgeKey(key)).toEqual({
      dariLangkahId: 'langkah-a',
      keLangkahId: 'langkah-b',
      cabang: 'YA',
    })
  })

  it('should_map_path_overrides_to_connection_ids', () => {
    const rows = [
      { id: 'l1', no: 1, kegiatan: 'A', pelaksana: 'p1' },
      { id: 'l2', no: 2, kegiatan: 'B', pelaksana: 'p1' },
    ]
    const steps = [
      { seq_number: 1, name: 'A', type: 'task', id_step: 'l1', id_implementer: 'p1' },
      { seq_number: 2, name: 'B', type: 'task', id_step: 'l2', id_implementer: 'p1' },
    ]
    const connections = [{
      id: 'conn-1-to-2',
      from: 'sop-step-1',
      to: 'sop-step-2',
    }]
    const metas = buildConnectionEdgeMetas(connections, rows as never, steps as never)
    const overrides = {
      edges: {
        'l1|l2|UTAMA': {
          sSide: 'bottom' as const,
          eSide: 'top' as const,
          startPoint: { x: 1, y: 2 },
          endPoint: { x: 3, y: 4 },
          bendPoints: [],
        },
      },
    }
    const arrowConfig = pathOverridesToArrowConfig(overrides, metas)
    expect(Object.keys(arrowConfig)).toContain('conn-1-to-2')
    const roundTrip = arrowConfigToPathOverrides(arrowConfig, {}, metas)
    expect(roundTrip.edges?.['l1|l2|UTAMA']).toBeDefined()
  })

  it('should_map_bpmn_terminator_shapes_to_real_langkah_ids', () => {
    const rows = [
      { id: 'langkah-awal', no: 1, kegiatan: 'A', pelaksana: 'p1' },
      { id: 'langkah-akhir', no: 2, kegiatan: 'B', pelaksana: 'p1' },
    ]
    const steps = [
      { seq_number: 1, name: 'A', type: 'task', id_step: 'langkah-awal', id_implementer: 'p1' },
      { seq_number: 2, name: 'B', type: 'task', id_step: 'langkah-akhir', id_implementer: 'p1' },
    ]
    const connections = [
      { id: 'conn-start', from: 'bpmn-step-0', to: 'bpmn-step-1' },
      { id: 'conn-end', from: 'bpmn-step-2', to: 'bpmn-step-3' },
    ]
    const metas = buildConnectionEdgeMetas(connections, rows as never, steps as never)
    const startMeta = metas.find((meta) => meta.connectionId === 'conn-start')
    const endMeta = metas.find((meta) => meta.connectionId === 'conn-end')
    expect(startMeta?.dariLangkahId).toBe('langkah-awal')
    expect(startMeta?.keLangkahId).toBe('langkah-awal')
    expect(endMeta?.dariLangkahId).toBe('langkah-akhir')
    expect(endMeta?.keLangkahId).toBe('langkah-akhir')
  })

  it('should_compare_diagram_slices_without_json_stringify', () => {
    const sliceA = {
      layoutSeed: 1,
      pathOverrides: {
        edges: {
          'l1|l2|UTAMA': {
            sSide: 'bottom' as const,
            eSide: 'top' as const,
            startPoint: { x: 1, y: 2 },
            endPoint: { x: 3, y: 4 },
            bendPoints: [{ x: 2, y: 3 }],
          },
        },
      },
    }
    const sliceB = {
      layoutSeed: 1,
      pathOverrides: {
        edges: {
          'l1|l2|UTAMA': {
            sSide: 'bottom' as const,
            eSide: 'top' as const,
            startPoint: { x: 1, y: 2 },
            endPoint: { x: 3, y: 4 },
            bendPoints: [{ x: 2, y: 3 }],
          },
        },
      },
    }
    expect(diagramSlicesEqual(sliceA, sliceB)).toBe(true)
    expect(
      diagramSlicesEqual(sliceA, {
        ...sliceB,
        pathOverrides: {
          edges: {
            'l1|l2|UTAMA': {
              ...sliceB.pathOverrides!.edges!['l1|l2|UTAMA'],
              bendPoints: [{ x: 9, y: 3 }],
            },
          },
        },
      }),
    ).toBe(false)
  })

  it('should_reset_all_manual_paths_and_keep_label_positions', () => {
    const next = resetDiagramSlicePaths({
      layoutSeed: 3,
      pathOverrides: {
        edges: {
          'l1|l2|UTAMA': {
            sSide: 'bottom',
            eSide: 'top',
            startPoint: { x: 1, y: 2 },
            endPoint: { x: 3, y: 4 },
            bendPoints: [{ x: 2, y: 3 }],
          },
          'l2|l3|UTAMA': {
            sSide: 'right',
            eSide: 'left',
            startPoint: { x: 10, y: 20 },
            endPoint: { x: 30, y: 40 },
            bendPoints: [],
          },
        },
        labels: {
          'conn-1-to-2': { x: 5, y: 6 },
        },
      },
    })

    expect(next.layoutSeed).toBe(4)
    expect(next.pathOverrides?.edges).toBeUndefined()
    expect(next.pathOverrides?.labels).toEqual({
      'conn-1-to-2': { x: 5, y: 6 },
    })
  })

  it('should_build_preview_state_for_active_tab', () => {
    const rows = [
      { id: 'l1', no: 1, kegiatan: 'A', pelaksana: 'p1' },
      { id: 'l2', no: 2, kegiatan: 'B', pelaksana: 'p1' },
    ]
    const state = buildDiagramStateForPreviewTab({
      diagramKonfigurasi: {
        flowchart: {
          layoutSeed: 2,
          pathOverrides: {
            edges: {
              'l1|l2|UTAMA': {
                sSide: 'bottom',
                eSide: 'top',
                startPoint: { x: 1, y: 2 },
                endPoint: { x: 3, y: 4 },
                bendPoints: [],
              },
            },
          },
        },
      },
      prosedurRows: rows as never,
      implementers: [{ id: 'p1', name: 'Pelaksana' }],
      activeTab: 'flowchart',
    })
    expect(state.pathLayoutSeed).toBe(2)
    expect(Object.keys(state.arrowConfig)).toContain('conn-1-to-2')
  })
})
