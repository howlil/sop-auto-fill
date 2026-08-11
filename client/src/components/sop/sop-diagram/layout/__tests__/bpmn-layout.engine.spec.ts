import { describe, expect, it } from 'vitest'
import {
  computeBpmnLayout,
  straightenSimpleCrossLaneTaskChains,
  type BpmnLayoutGlobalStep,
} from '../bpmn-layout.engine'
import { BPMN_SOP_CONTENT_MAX_WIDTH_PX } from '../bpmnDiagramMetrics'

describe('computeBpmnLayout', () => {
  it('should_fit_diagram_width_within_sop_content_budget', () => {
    const steps = [
      {
        id_step: 'a',
        seq_number: 1,
        name: 'Mulai: Menerima kebutuhan imunisasi rutin',
        type: 'terminator',
        id_implementer: 'imp-1',
      },
      {
        id_step: 'b',
        seq_number: 2,
        name: 'Memproses dan memverifikasi kelengkapan imunisasi rutin',
        type: 'task',
        id_implementer: 'imp-2',
      },
      {
        id_step: 'c',
        seq_number: 3,
        name: 'Selesai: Mendokumentasikan hasil imunisasi rutin',
        type: 'task',
        id_implementer: 'imp-3',
      },
      {
        id_step: 'd',
        seq_number: 4,
        name: 'Selesai: Mendokumentasikan hasil imunisasi rutin lanjutan',
        type: 'task',
        id_implementer: 'imp-4',
      },
    ]
    const connections = [
      { id: 'c1', from: 'bpmn-step-1', to: 'bpmn-step-2' },
      { id: 'c2', from: 'bpmn-step-2', to: 'bpmn-step-3' },
      { id: 'c3', from: 'bpmn-step-3', to: 'bpmn-step-4' },
    ]
    const result = computeBpmnLayout({
      steps,
      connections,
      implementerIds: ['imp-1', 'imp-2', 'imp-3', 'imp-4'],
      contentMaxWidthPx: BPMN_SOP_CONTENT_MAX_WIDTH_PX,
    })
    expect(result).not.toBeNull()
    const tasks = result!.globalSteps.filter((s) => s.type === 'task')
    for (const task of tasks) {
      expect(task.width).toBeGreaterThanOrEqual(96)
      expect(task.height).toBeLessThanOrEqual(task.width * 2.5)
    }
    const maxRight = Math.max(
      ...result!.globalSteps.map((s) => s.x + s.width / 2),
    )
    expect(result!.diagramContentWidth).toBeLessThanOrEqual(maxRight + 80)
    expect(result!.laneLayouts.length).toBe(4)
    const laneHeights = result!.laneLayouts.map((l) => l.height)
    expect(Math.min(...laneHeights)).toBeGreaterThanOrEqual(120)
    const columns = result!.globalSteps.map((s) => s.columnIndex)
    expect(new Set(columns).size).toBeGreaterThanOrEqual(1)
  })

  it('should_separate_two_tasks_in_same_swimlane_into_distinct_columns', () => {
    const steps = [
      {
        id_step: 'a',
        seq_number: 1,
        name: 'Selesai: Mendokumentasikan hasil imunisasi rutin',
        type: 'task',
        id_implementer: 'imp-front',
      },
      {
        id_step: 'b',
        seq_number: 2,
        name: 'Selesai: Mendokumentasikan hasil imunisasi rutin lanjutan',
        type: 'task',
        id_implementer: 'imp-front',
      },
    ]
    const connections = [{ id: 'c1', from: 'bpmn-step-1', to: 'bpmn-step-2' }]
    const result = computeBpmnLayout({
      steps,
      connections,
      implementerIds: ['imp-front'],
      contentMaxWidthPx: BPMN_SOP_CONTENT_MAX_WIDTH_PX,
    })
    expect(result).not.toBeNull()
    const laneSteps = result!.laneLayouts[0]!.steps
    const cols = laneSteps.map((s) => s.columnIndex)
    expect(new Set(cols).size).toBe(2)
    const xs = laneSteps.map((s) => s.x)
    expect(xs[1]).toBeGreaterThan(xs[0]!)
  })

  it('should_align_plain_cross_lane_handoff_in_the_same_column', () => {
    const steps = [
      {
        id_step: 'a',
        seq_number: 1,
        name: 'Menerima dokumen',
        type: 'task',
        id_implementer: 'imp-front',
      },
      {
        id_step: 'b',
        seq_number: 2,
        name: 'Memverifikasi dokumen',
        type: 'task',
        id_implementer: 'imp-back',
      },
    ]
    const connections = [{ id: 'c1', from: 'bpmn-step-1', to: 'bpmn-step-2' }]
    const result = computeBpmnLayout({
      steps,
      connections,
      implementerIds: ['imp-front', 'imp-back'],
      contentMaxWidthPx: BPMN_SOP_CONTENT_MAX_WIDTH_PX,
    })
    expect(result).not.toBeNull()
    const front = result!.globalSteps.find((step) => step.id === 'a')!
    const back = result!.globalSteps.find((step) => step.id === 'b')!
    expect(front.columnIndex).toBe(back.columnIndex)
    expect(front.x).toBe(back.x)
  })

  it('should_keep_main_handoff_left_and_push_decision_branch_right_in_same_lane', () => {
    const steps = [
      {
        id_step: 'a',
        seq_number: 1,
        name: 'Mulai',
        type: 'terminator',
        id_implementer: 'imp-1',
      },
      {
        id_step: 'b',
        seq_number: 2,
        name: 'Verifikasi',
        type: 'task',
        id_implementer: 'imp-2',
      },
      {
        id_step: 'c',
        seq_number: 3,
        name: 'Dokumentasi utama',
        type: 'task',
        id_implementer: 'imp-3',
      },
      {
        id_step: 'd',
        seq_number: 4,
        name: 'Gateway',
        type: 'decision',
        id_implementer: 'imp-1',
      },
      {
        id_step: 'e',
        seq_number: 5,
        name: 'Cabang Ya',
        type: 'task',
        id_implementer: 'imp-3',
      },
    ]
    const connections = [
      { id: 'c1', from: 'bpmn-step-1', to: 'bpmn-step-2' },
      { id: 'c2', from: 'bpmn-step-2', to: 'bpmn-step-3' },
      { id: 'c3', from: 'bpmn-step-3', to: 'bpmn-step-4' },
      { id: 'c4', from: 'bpmn-step-4', to: 'bpmn-step-5' },
    ]
    const result = computeBpmnLayout({
      steps,
      connections,
      implementerIds: ['imp-1', 'imp-2', 'imp-3'],
      contentMaxWidthPx: BPMN_SOP_CONTENT_MAX_WIDTH_PX,
    })
    expect(result).not.toBeNull()
    const mainLane3 = result!.globalSteps.find((s) => s.id === 'c')!
    const branchLane3 = result!.globalSteps.find((s) => s.id === 'e')!
    expect(mainLane3.columnIndex).toBeLessThan(branchLane3.columnIndex)
    expect(mainLane3.x).toBeLessThan(branchLane3.x)
  })

  it('should_match_router_lane_tops_to_the_contiguous_swimlane_table_rows', () => {
    const result = computeBpmnLayout({
      steps: [
        {
          id_step: 'a',
          seq_number: 1,
          name: 'Menerima dokumen',
          type: 'task',
          id_implementer: 'imp-front',
        },
        {
          id_step: 'b',
          seq_number: 2,
          name: 'Memverifikasi dokumen',
          type: 'task',
          id_implementer: 'imp-back',
        },
      ],
      connections: [{ id: 'c1', from: 'bpmn-step-1', to: 'bpmn-step-2' }],
      implementerIds: ['imp-front', 'imp-back'],
    })

    const routerLanes = result!.bpmnLaneLayoutForRouter!.lanes
    expect(routerLanes[0]!.top).toBe(0)
    expect(routerLanes[1]!.top).toBe(routerLanes[0]!.height)
  })

  it('should_straighten_a_shifted_simple_cross_lane_task_chain_when_lanes_are_free', () => {
    const makeStep = (
      id: string,
      seq: number,
      lane: number,
      columnIndex: number,
    ): BpmnLayoutGlobalStep => ({
      id,
      seq,
      lane,
      columnIndex,
      type: 'task',
      x: 0,
      y: 0,
      width: 96,
      height: 44,
      name: id,
      laneHeight: 152,
    })
    const steps = [
      makeStep('a', 1, 0, 1),
      makeStep('b', 2, 1, 2),
      makeStep('c', 3, 2, 3),
      makeStep('d', 4, 0, 4),
    ]
    const straightened = straightenSimpleCrossLaneTaskChains(steps, [
      { from: 'bpmn-step-1', to: 'bpmn-step-2' },
      { from: 'bpmn-step-2', to: 'bpmn-step-3' },
      { from: 'bpmn-step-3', to: 'bpmn-step-4' },
    ])

    expect(straightened.map((step) => step.columnIndex)).toEqual([1, 1, 1, 4])
  })

  it('should_not_straighten_a_lane_direction_reversal_back_into_the_previous_column', () => {
    const makeStep = (
      id: string,
      seq: number,
      lane: number,
      columnIndex: number,
    ): BpmnLayoutGlobalStep => ({
      id,
      seq,
      lane,
      columnIndex,
      type: 'task',
      x: 0,
      y: 0,
      width: 96,
      height: 44,
      name: id,
      laneHeight: 152,
    })
    const straightened = straightenSimpleCrossLaneTaskChains(
      [
        makeStep('a', 1, 0, 0),
        makeStep('b', 2, 1, 0),
        makeStep('d', 3, 3, 0),
        makeStep('c', 4, 2, 1),
        makeStep('b2', 5, 1, 2),
      ],
      [
        { from: 'bpmn-step-1', to: 'bpmn-step-2' },
        { from: 'bpmn-step-2', to: 'bpmn-step-3' },
        { from: 'bpmn-step-3', to: 'bpmn-step-4' },
        { from: 'bpmn-step-4', to: 'bpmn-step-5' },
      ],
    )

    expect(straightened.map((step) => step.columnIndex)).toEqual([0, 0, 0, 1, 1])
  })

  it('should_preserve_monotonic_lane_runs_after_the_full_layout_pipeline', () => {
    const laneIds = ['lane-a', 'lane-b', 'lane-c', 'lane-d']
    const laneBySeq = ['lane-a', 'lane-b', 'lane-d', 'lane-c', 'lane-b', 'lane-a']
    const result = computeBpmnLayout({
      steps: laneBySeq.map((id_implementer, index) => ({
        id_step: `s${index + 1}`,
        seq_number: index + 1,
        name: `Task ${index + 1}`,
        type: 'task',
        id_implementer,
      })),
      connections: laneBySeq.slice(1).map((_, index) => ({
        id: `c${index + 1}`,
        from: `bpmn-step-${index + 1}`,
        to: `bpmn-step-${index + 2}`,
      })),
      implementerIds: laneIds,
    })

    expect(result).not.toBeNull()
    expect(result!.globalSteps.map((step) => step.columnIndex)).toEqual([
      0, 0, 0, 1, 1, 1,
    ])
  })
})
