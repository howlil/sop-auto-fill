import { describe, expect, it } from 'vitest'
import { transitionBpmnLaneRun } from '../bpmn-lane-run.util'

describe('transitionBpmnLaneRun', () => {
  it('should_keep_a_consistent_downward_sweep_in_the_same_column', () => {
    expect(transitionBpmnLaneRun(0, 2, 0)).toEqual({
      columnAdvance: 0,
      direction: 1,
    })
    expect(transitionBpmnLaneRun(2, 3, 1)).toEqual({
      columnAdvance: 0,
      direction: 1,
    })
  })

  it('should_start_a_new_column_when_the_lane_direction_reverses', () => {
    expect(transitionBpmnLaneRun(3, 2, 1)).toEqual({
      columnAdvance: 1,
      direction: -1,
    })
    expect(transitionBpmnLaneRun(0, 1, -1)).toEqual({
      columnAdvance: 1,
      direction: 1,
    })
  })

  it('should_start_a_fresh_column_for_same_lane_or_explicit_boundaries', () => {
    expect(transitionBpmnLaneRun(1, 1, 1)).toEqual({
      columnAdvance: 1,
      direction: 0,
    })
    expect(transitionBpmnLaneRun(1, 2, 1, true)).toEqual({
      columnAdvance: 1,
      direction: 0,
    })
  })
})
