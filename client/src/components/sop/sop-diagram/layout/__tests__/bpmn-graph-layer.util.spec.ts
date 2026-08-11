import { describe, expect, it } from 'vitest'
import { assignStepColumns, buildMainSpineStepIds } from '../bpmn-graph-layer.util'

const IMP = ['lane-a', 'lane-b']

function step(
  id: string,
  seq: number,
  type: string,
  laneId: string,
): {
  id_step: string
  seq_number: number
  type: string
  id_implementer: string
} {
  return { id_step: id, seq_number: seq, type, id_implementer: laneId }
}

describe('assignStepColumns', () => {
  it('should_place_successor_one_column_right_when_same_lane', () => {
    const steps = [
      step('s1', 1, 'task', 'lane-a'),
      step('s2', 2, 'task', 'lane-a'),
    ]
    const connections = [{ from: 'bpmn-step-1', to: 'bpmn-step-2' }]
    const cols = assignStepColumns(steps, connections, IMP)
    expect(cols.get('s1')).toBe(0)
    expect(cols.get('s2')).toBe(1)
  })

  it('should_align_plain_cross_lane_handoff_in_the_same_global_layer', () => {
    const steps = [
      step('s1', 1, 'task', 'lane-a'),
      step('s2', 2, 'task', 'lane-b'),
    ]
    const connections = [{ from: 'bpmn-step-1', to: 'bpmn-step-2' }]
    const cols = assignStepColumns(steps, connections, IMP)
    expect(cols.get('s1')).toBe(0)
    expect(cols.get('s2')).toBe(0)
  })

  it('should_open_a_new_column_each_time_an_alternating_lane_chain_reverses_direction', () => {
    const steps = [
      step('s1', 1, 'task', 'lane-a'),
      step('s2', 2, 'task', 'lane-b'),
      step('s3', 3, 'task', 'lane-a'),
      step('s4', 4, 'task', 'lane-b'),
    ]
    const connections = [
      { from: 'bpmn-step-1', to: 'bpmn-step-2' },
      { from: 'bpmn-step-2', to: 'bpmn-step-3' },
      { from: 'bpmn-step-3', to: 'bpmn-step-4' },
    ]
    const cols = assignStepColumns(steps, connections, IMP)
    expect([...steps.map((s) => cols.get(s.id_step))]).toEqual([0, 0, 1, 2])
  })

  it('should_keep_skipped_lanes_compact_until_the_downward_sweep_reverses', () => {
    const steps = [
      step('s1', 1, 'task', 'lane-a'),
      step('s2', 2, 'task', 'lane-b'),
      step('s3', 3, 'task', 'lane-d'),
      step('s4', 4, 'task', 'lane-c'),
      step('s5', 5, 'task', 'lane-b'),
      step('s6', 6, 'task', 'lane-a'),
    ]
    const connections = [
      { from: 'bpmn-step-1', to: 'bpmn-step-2' },
      { from: 'bpmn-step-2', to: 'bpmn-step-3' },
      { from: 'bpmn-step-3', to: 'bpmn-step-4' },
      { from: 'bpmn-step-4', to: 'bpmn-step-5' },
      { from: 'bpmn-step-5', to: 'bpmn-step-6' },
    ]
    const cols = assignStepColumns(steps, connections, [
      'lane-a',
      'lane-b',
      'lane-c',
      'lane-d',
    ])
    expect([...steps.map((s) => cols.get(s.id_step))]).toEqual([0, 0, 0, 1, 1, 1])
  })

  it('should_keep_skipped_lanes_compact_until_an_upward_sweep_reverses', () => {
    const steps = [
      step('s1', 1, 'task', 'lane-d'),
      step('s2', 2, 'task', 'lane-c'),
      step('s3', 3, 'task', 'lane-a'),
      step('s4', 4, 'task', 'lane-b'),
    ]
    const connections = [
      { from: 'bpmn-step-1', to: 'bpmn-step-2' },
      { from: 'bpmn-step-2', to: 'bpmn-step-3' },
      { from: 'bpmn-step-3', to: 'bpmn-step-4' },
    ]
    const cols = assignStepColumns(steps, connections, [
      'lane-a',
      'lane-b',
      'lane-c',
      'lane-d',
    ])
    expect([...steps.map((s) => cols.get(s.id_step))]).toEqual([0, 0, 0, 1])
  })

  it('should_place_cross_lane_ya_branch_after_the_gateway_column', () => {
    const steps = [
      step('d1', 1, 'decision', 'lane-a'),
      step('y1', 2, 'task', 'lane-b'),
      step('n1', 3, 'task', 'lane-a'),
    ]
    const connections = [
      { from: 'bpmn-step-1', to: 'bpmn-step-2' },
      { from: 'bpmn-step-1', to: 'bpmn-step-3' },
    ]
    const cols = assignStepColumns(steps, connections, IMP)
    expect(cols.get('d1')).toBe(0)
    expect(cols.get('y1')).toBe(1)
    expect(cols.get('n1')).toBeGreaterThanOrEqual(1)
  })

  it('should_separate_ya_tidak_branches_from_decision', () => {
    const steps = [
      step('d1', 1, 'decision', 'lane-a'),
      step('y1', 2, 'task', 'lane-a'),
      step('n1', 3, 'task', 'lane-a'),
    ]
    const connections = [
      { from: 'bpmn-step-1', to: 'bpmn-step-2' },
      { from: 'bpmn-step-1', to: 'bpmn-step-3' },
    ]
    const cols = assignStepColumns(steps, connections, IMP)
    expect(cols.get('d1')).toBe(0)
    expect(cols.get('y1')).not.toBe(cols.get('n1'))
    expect(cols.get('y1')).toBeGreaterThanOrEqual(1)
    expect(cols.get('n1')).toBeGreaterThanOrEqual(1)
  })

  it('should_trace_main_spine_through_cross_lane_handoffs', () => {
    const steps = [
      step('s1', 1, 'terminator', 'lane-a'),
      step('s2', 2, 'task', 'lane-b'),
      step('s3', 3, 'task', 'lane-a'),
      step('d4', 4, 'decision', 'lane-a'),
      step('y5', 5, 'task', 'lane-b'),
    ]
    const connections = [
      { from: 'bpmn-step-1', to: 'bpmn-step-2' },
      { from: 'bpmn-step-2', to: 'bpmn-step-3' },
      { from: 'bpmn-step-3', to: 'bpmn-step-4' },
      { from: 'bpmn-step-4', to: 'bpmn-step-5' },
    ]
    const spine = buildMainSpineStepIds(steps, connections)
    expect(spine.has('s1')).toBe(true)
    expect(spine.has('s2')).toBe(true)
    expect(spine.has('s3')).toBe(true)
    expect(spine.has('d4')).toBe(true)
    expect(spine.has('y5')).toBe(true)
  })

  it('should_handle_loopback_tidak_after_forward_ya', () => {
    const steps = [
      step('d1', 1, 'decision', 'lane-a'),
      step('t2', 2, 'task', 'lane-a'),
      step('t3', 3, 'task', 'lane-a'),
    ]
    const connections = [
      { from: 'bpmn-step-1', to: 'bpmn-step-2' },
      { from: 'bpmn-step-2', to: 'bpmn-step-3' },
      { from: 'bpmn-step-3', to: 'bpmn-step-1' },
    ]
    const cols = assignStepColumns(steps, connections, IMP)
    expect(cols.get('d1')).toBe(0)
    expect(cols.get('t2')).toBeGreaterThan(cols.get('d1')!)
    expect(cols.get('t3')).toBeGreaterThanOrEqual(cols.get('t2')!)
  })
})
