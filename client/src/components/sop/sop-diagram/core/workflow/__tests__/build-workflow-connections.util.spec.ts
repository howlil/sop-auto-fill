import { describe, expect, it } from 'vitest'
import { buildWorkflowConnections } from '../build-workflow-connections.util'

describe('buildWorkflowConnections', () => {
  it('should_emit_yes_and_no_from_decision_and_link_last_step_to_end', () => {
    const steps = [
      { id_step: 'start-terminator', seq_number: 0, type: 'terminator' },
      { id_step: 's1', seq_number: 1, type: 'task' },
      {
        id_step: 'd1',
        seq_number: 2,
        type: 'decision',
        id_next_step_if_yes: 's3',
        id_next_step_if_no: 's4',
      },
      { id_step: 's3', seq_number: 3, type: 'task' },
      { id_step: 's4', seq_number: 4, type: 'task' },
      { id_step: 'end-terminator', seq_number: 5, type: 'terminator' },
    ]
    const conns = buildWorkflowConnections({
      steps,
      shapePrefix: 'bpmn-step-',
    })
    const ids = conns.map((c) => c.id)
    expect(ids).toContain('conn-2-yes-3')
    expect(ids).toContain('conn-2-no-4')
    expect(ids.some((id) => id.includes('to-5'))).toBe(true)
    expect(conns.filter((c) => c.from === 'bpmn-step-2')).toHaveLength(2)
  })

  it('should_follow_explicit_next_link_for_tasks_not_only_row_order', () => {
    const steps = [
      { id_step: 'start-terminator', seq_number: 0, type: 'terminator' },
      { id_step: 's1', seq_number: 1, type: 'task', id_next_step_if_yes: 's3' },
      { id_step: 's2', seq_number: 2, type: 'task' },
      { id_step: 's3', seq_number: 3, type: 'task' },
      { id_step: 'end-terminator', seq_number: 4, type: 'terminator' },
    ]
    const conns = buildWorkflowConnections({
      steps,
      shapePrefix: 'bpmn-step-',
    })
    expect(conns.some((c) => c.from === 'bpmn-step-1' && c.to === 'bpmn-step-3')).toBe(true)
    expect(conns.some((c) => c.from === 'bpmn-step-1' && c.to === 'bpmn-step-2')).toBe(false)
    expect(conns.some((c) => c.from === 'bpmn-step-3' && c.to === 'bpmn-step-4')).toBe(true)
  })
})
