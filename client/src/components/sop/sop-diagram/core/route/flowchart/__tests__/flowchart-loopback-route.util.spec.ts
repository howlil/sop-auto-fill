import { describe, expect, it } from 'vitest'
import {
  assignLoopbackCorridorIndices,
  buildFlowchartLoopbackPath,
  FLOWCHART_LOOPBACK_CORRIDOR_STEP_PX,
  isHorizontalLoopbackSides,
} from '../flowchart-loopback-route.util'
import type { FlowchartGridLayout } from '../flowchart-grid-layout.util'

describe('flowchart-loopback-route.util', () => {
  const fromPos = { left: 200, top: 300, width: 66, height: 66, right: 266, bottom: 366 }
  const toPos = { left: 200, top: 80, width: 66, height: 66, right: 266, bottom: 146 }
  const fromShape = { left: fromPos.left, top: fromPos.top, width: fromPos.width, height: fromPos.height }
  const toShape = { left: toPos.left, top: toPos.top, width: toPos.width, height: toPos.height }
  const columnBounds = { left: 180, top: 20, right: 300, bottom: 500 }

  it('should_assign_distinct_corridor_indices_for_loopbacks', () => {
    const connections = [
      { id: 'c-b', from: 'sop-step-7', to: 'sop-step-5', sourceType: 'flowchart-decision', fromImplementerId: 'impl-b' },
      { id: 'c-a', from: 'sop-step-5', to: 'sop-step-2', sourceType: 'flowchart-decision', fromImplementerId: 'impl-a' },
      { id: 'c-linear', from: 'sop-step-2', to: 'sop-step-3', sourceType: 'flowchart-process' },
    ]
    const map = assignLoopbackCorridorIndices(connections)
    expect(map.get('c-a')).toBe(0)
    expect(map.get('c-b')).toBe(0)
    expect(map.has('c-linear')).toBe(false)
  })

  it('should_assign_a_corridor_to_explicit_task_loopbacks', () => {
    const map = assignLoopbackCorridorIndices([
      {
        id: 'c-task-back',
        from: 'sop-step-6',
        to: 'sop-step-2',
        sourceType: 'flowchart-process',
        fromImplementerId: 'impl-a',
      },
    ])

    expect(map.get('c-task-back')).toBe(0)
  })

  it('should_build_horizontal_loopback_with_separate_corridor_x', () => {
    const gridLayout: FlowchartGridLayout = {
      horizontalLines: [0, 80, 160, 240, 320, 400],
      verticalLines: [40, 200, 360],
      rowGutters: [120, 200, 280, 360],
      minGridX: 40,
      maxGridX: 360,
      minGridY: 0,
      maxGridY: 400,
    }
    const path0 = buildFlowchartLoopbackPath({
      fromPos,
      toPos,
      fromShape,
      toShape,
      sSide: 'left',
      eSide: 'left',
      fromIsDiamond: true,
      toIsDiamond: false,
      sourceJetty: 16,
      targetJetty: 16,
      corridorBounds: columnBounds,
      gridLayout,
      corridorIndex: 0,
      fromRow: 4,
      toRow: 1,
    })
    const path1 = buildFlowchartLoopbackPath({
      fromPos,
      toPos,
      fromShape,
      toShape,
      sSide: 'left',
      eSide: 'left',
      fromIsDiamond: true,
      toIsDiamond: false,
      sourceJetty: 16,
      targetJetty: 16,
      corridorBounds: columnBounds,
      gridLayout,
      corridorIndex: 1,
      fromRow: 4,
      toRow: 1,
    })
    expect(path0).not.toBeNull()
    expect(path1).not.toBeNull()
    const pipeX0 = columnBounds.left + 10
    const pipeX1 = pipeX0 + FLOWCHART_LOOPBACK_CORRIDOR_STEP_PX
    expect(path0!.some((p) => p.x === pipeX0)).toBe(true)
    expect(path1!.some((p) => p.x === pipeX1)).toBe(true)
    expect(isHorizontalLoopbackSides('left', 'left')).toBe(true)
    expect(isHorizontalLoopbackSides('left', 'top')).toBe(false)
  })

  it('should_keep_path_x_inside_corridor_bounds', () => {
    const path = buildFlowchartLoopbackPath({
      fromPos,
      toPos,
      fromShape,
      toShape,
      sSide: 'right',
      eSide: 'right',
      fromIsDiamond: true,
      toIsDiamond: false,
      sourceJetty: 16,
      targetJetty: 16,
      corridorBounds: columnBounds,
      gridLayout: null,
      corridorIndex: 0,
      fromRow: 4,
      toRow: 1,
    })
    expect(path).not.toBeNull()
    for (const p of path!) {
      expect(p.x).toBeGreaterThanOrEqual(columnBounds.left)
      expect(p.x).toBeLessThanOrEqual(columnBounds.right)
    }
  })
})
