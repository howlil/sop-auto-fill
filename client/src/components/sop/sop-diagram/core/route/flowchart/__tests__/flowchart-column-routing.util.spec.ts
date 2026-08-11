import { describe, expect, it } from 'vitest'
import {
  pickColumnGutterBusX,
  pickColumnPipeX,
  resolveColumnBoundsForShapeX,
} from '../flowchart-column-bounds.util'
import { assignCrossColumnGutterSlots, buildFlowchartCrossColumnPath } from '../flowchart-cross-column-route.util'
import { assignColumnTrunkSlots, buildFlowchartColumnTrunkPath } from '../flowchart-column-trunk.util'
import { assignLoopbackCorridorIndices } from '../flowchart-loopback-route.util'

describe('flowchart column routing utils', () => {
  const colA = { left: 40, top: 0, right: 140, bottom: 400 }
  const colB = { left: 160, top: 0, right: 260, bottom: 400 }
  const colC = { left: 280, top: 0, right: 380, bottom: 400 }

  it('should_resolve_column_by_shape_center_x', () => {
    const columns = { a: colA, b: colB, c: colC }
    expect(resolveColumnBoundsForShapeX(90, columns, null)?.left).toBe(40)
    expect(resolveColumnBoundsForShapeX(210, columns, null)?.left).toBe(160)
  })

  it('should_pick_distinct_pipe_x_per_slot_in_column', () => {
    expect(pickColumnPipeX('left', colB, 0, 18)).toBe(170)
    expect(pickColumnPipeX('left', colB, 1, 18)).toBe(188)
  })

  it('should_assign_loopback_corridor_per_implementer_column', () => {
    const connections = [
      { id: 'c-a', from: 'sop-step-5', to: 'sop-step-2', sourceType: 'flowchart-decision', fromImplementerId: 'front' },
      { id: 'c-b', from: 'sop-step-7', to: 'sop-step-5', sourceType: 'flowchart-decision', fromImplementerId: 'dokter' },
      { id: 'c-c', from: 'sop-step-9', to: 'sop-step-3', sourceType: 'flowchart-decision', fromImplementerId: 'front' },
    ]
    const map = assignLoopbackCorridorIndices(connections)
    expect(map.get('c-a')).toBe(0)
    expect(map.get('c-c')).toBe(1)
    expect(map.get('c-b')).toBe(0)
  })

  it('should_build_cross_column_bus_path_between_columns', () => {
    const fromShape = { left: 50, top: 80, width: 60, height: 40 }
    const toShape = { left: 180, top: 200, width: 60, height: 40 }
    const columns = { implA: colA, implB: colB }
    const path = buildFlowchartCrossColumnPath({
      fromShape,
      toShape,
      fromIsDiamond: false,
      toIsDiamond: false,
      sSide: 'bottom',
      eSide: 'top',
      sourceJetty: 12,
      targetJetty: 12,
      columns,
      pelaksanaFallback: null,
      gridLayout: null,
      gutterSlot: 0,
      fromRow: 1,
      toRow: 3,
    })
    expect(path).not.toBeNull()
    const busX = pickColumnGutterBusX(colA, colB, 0)
    expect(path!.some((p) => p.x === busX)).toBe(true)
  })

  it('should_build_column_trunk_with_separate_slots', () => {
    const column = colB
    const fromShape = { left: 190, top: 80, width: 40, height: 40 }
    const toShape = { left: 190, top: 200, width: 40, height: 40 }
    const path0 = buildFlowchartColumnTrunkPath({
      fromShape,
      toShape,
      fromIsDiamond: false,
      toIsDiamond: false,
      column,
      trunkSlot: 0,
      sourceJetty: 12,
      targetJetty: 12,
    })
    const path1 = buildFlowchartColumnTrunkPath({
      fromShape,
      toShape,
      fromIsDiamond: false,
      toIsDiamond: false,
      column,
      trunkSlot: 1,
      sourceJetty: 12,
      targetJetty: 12,
    })
    expect(path0).not.toBeNull()
    expect(path1).not.toBeNull()
    expect(path0!.some((p) => p.x === pickColumnPipeX('left', column, 0, 10))).toBe(true)
    expect(path1!.some((p) => p.x === pickColumnPipeX('right', column, 0, 10))).toBe(true)
  })

  it('should_assign_cross_column_and_trunk_slots', () => {
    const cross = assignCrossColumnGutterSlots([
      { id: 'x1', from: 'a', to: 'b', fromImplementerId: 'i1', toImplementerId: 'i2' },
      { id: 'x2', from: 'c', to: 'd', fromImplementerId: 'i1', toImplementerId: 'i2' },
    ])
    expect(cross.get('x1')).toBe(0)
    expect(cross.get('x2')).toBe(1)
    const trunk = assignColumnTrunkSlots([
      { id: 't1', from: 'sop-step-1', to: 'sop-step-2', fromImplementerId: 'i1', sourceType: 'flowchart-process' },
      { id: 't2', from: 'sop-step-2', to: 'sop-step-3', fromImplementerId: 'i1', sourceType: 'flowchart-process' },
    ])
    expect(trunk.get('t1')).toBe(0)
    expect(trunk.get('t2')).toBe(1)
  })
})
