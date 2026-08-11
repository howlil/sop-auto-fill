import { describe, expect, it } from 'vitest'
import {
  classifyFlowchartRouteComplexity,
  isSimpleSequentialFlow,
} from '../flowchart-route-complexity.util'

describe('flowchart-route-complexity.util', () => {
  it('should_classify_adjacent_linear_step_as_simple', () => {
    expect(
      isSimpleSequentialFlow({
        fromId: 'sop-step-1',
        toId: 'sop-step-2',
        destAbove: false,
        destBelow: true,
        sameCol: false,
        isCrossColumn: true,
        sourceType: 'flowchart-process',
        targetType: 'flowchart-process',
      }),
    ).toBe(true)
    expect(
      classifyFlowchartRouteComplexity({
        fromId: 'sop-step-1',
        toId: 'sop-step-2',
        destAbove: false,
        destBelow: true,
        sameCol: false,
        isCrossColumn: true,
        sourceType: 'flowchart-process',
      }),
    ).toBe('simple')
  })

  it('should_not_classify_decision_branch_as_simple', () => {
    expect(
      isSimpleSequentialFlow({
        fromId: 'sop-step-4',
        toId: 'sop-step-2',
        destAbove: true,
        destBelow: false,
        sameCol: false,
        isCrossColumn: true,
        sourceType: 'flowchart-decision',
        label: 'Tidak',
      }),
    ).toBe(false)
  })
})
