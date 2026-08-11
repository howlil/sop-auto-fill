import { describe, expect, it } from 'vitest'
import {
  tryBuildDedicatedFlowchartPath,
  type TryDedicatedFlowchartPathInput,
} from '../flowchart-dedicated-route.util'
import { pickColumnGutterBusX, pickColumnPipeX } from '../flowchart-column-bounds.util'

describe('tryBuildDedicatedFlowchartPath', () => {
  const colA = { left: 40, top: 0, right: 160, bottom: 560 }
  const colB = { left: 180, top: 0, right: 300, bottom: 560 }
  const colC = { left: 320, top: 0, right: 440, bottom: 560 }
  const pelaksana = { left: 32, top: 0, right: 448, bottom: 560 }

  function build(
    overrides: Partial<TryDedicatedFlowchartPathInput>,
  ): TryDedicatedFlowchartPathInput {
    return {
      fromShape: { left: 70, top: 80, width: 60, height: 40 },
      toShape: { left: 70, top: 320, width: 60, height: 40 },
      fromIsDiamond: false,
      toIsDiamond: false,
      sourceColumn: colA,
      targetColumn: colA,
      routingBounds: pelaksana,
      columns: { a: colA, b: colB, c: colC },
      pelaksana,
      gridLayout: null,
      obstacles: [],
      occupied: [],
      destAbove: false,
      destBelow: true,
      sameCol: true,
      isCrossColumn: false,
      isLinearDown: true,
      sourceType: 'flowchart-process',
      targetType: 'flowchart-process',
      fromId: 'sop-step-1',
      toId: 'sop-step-3',
      loopbackCorridorIndex: 0,
      crossColumnGutterSlot: 0,
      columnTrunkSlot: 0,
      sourceJetty: 12,
      targetJetty: 12,
      ...overrides,
    }
  }

  it('should_leave_adjacent_sequential_edges_to_the_simple_router', () => {
    const result = tryBuildDedicatedFlowchartPath(build({
      toId: 'sop-step-2',
      toShape: { left: 70, top: 180, width: 60, height: 40 },
    }))

    expect(result).toBeNull()
  })

  it('should_route_long_same_column_edges_through_a_deterministic_trunk', () => {
    const result = tryBuildDedicatedFlowchartPath(build({ columnTrunkSlot: 1 }))

    expect(result).not.toBeNull()
    expect(result!.sSide).toBe('bottom')
    expect(result!.eSide).toBe('top')
    expect(result!.path.some((point) =>
      point.x === pickColumnPipeX('right', colA, 0, 10),
    )).toBe(true)
  })

  it('should_route_long_cross_column_edges_through_the_column_gutter_bus', () => {
    const result = tryBuildDedicatedFlowchartPath(build({
      toShape: { left: 350, top: 320, width: 60, height: 40 },
      sameCol: false,
      isCrossColumn: true,
      isLinearDown: false,
    }))

    expect(result).not.toBeNull()
    expect(result!.path.some((point) =>
      point.x === pickColumnGutterBusX(colA, colC, 0),
    )).toBe(true)
  })

  it('should_route_non_decision_backward_edges_through_a_side_corridor', () => {
    const result = tryBuildDedicatedFlowchartPath(build({
      fromShape: { left: 70, top: 320, width: 60, height: 40 },
      toShape: { left: 70, top: 80, width: 60, height: 40 },
      destAbove: true,
      destBelow: false,
      isLinearDown: false,
      fromId: 'sop-step-4',
      toId: 'sop-step-1',
    }))

    expect(result).not.toBeNull()
    expect(['left', 'right']).toContain(result!.sSide)
    expect(result!.eSide).toBe(result!.sSide)
    expect(result!.path.some((point) =>
      point.x === pickColumnPipeX(result!.sSide as 'left' | 'right', pelaksana, 0, 18),
    )).toBe(true)
  })

  it('should_route_cross_column_backward_edges_through_the_combined_outer_corridor', () => {
    const result = tryBuildDedicatedFlowchartPath(build({
      fromShape: { left: 350, top: 320, width: 60, height: 40 },
      toShape: { left: 70, top: 80, width: 60, height: 40 },
      sourceColumn: colC,
      targetColumn: colA,
      sameCol: false,
      isCrossColumn: true,
      destAbove: true,
      destBelow: false,
      isLinearDown: false,
      fromId: 'sop-step-4',
      toId: 'sop-step-1',
    }))

    expect(result).not.toBeNull()
    expect(result!.sSide).toBe('left')
    expect(result!.eSide).toBe('left')
    expect(result!.path.some((point) =>
      point.x === pickColumnPipeX('left', pelaksana, 0, 18),
    )).toBe(true)
  })

  it('should_defer_to_the_generic_router_when_a_channel_is_blocked', () => {
    const trunkX = pickColumnPipeX('left', colA, 0, 10)
    const result = tryBuildDedicatedFlowchartPath(build({
      obstacles: [{ left: trunkX - 4, top: 160, width: 8, height: 60 }],
    }))

    expect(result).toBeNull()
  })

  it('should_defer_to_the_generic_router_when_a_channel_overlaps_an_existing_arrow', () => {
    const trunkX = pickColumnPipeX('left', colA, 0, 10)
    const result = tryBuildDedicatedFlowchartPath(build({
      occupied: [{ x1: trunkX, y1: 130, x2: trunkX, y2: 300 }],
    }))

    expect(result).toBeNull()
  })
})
