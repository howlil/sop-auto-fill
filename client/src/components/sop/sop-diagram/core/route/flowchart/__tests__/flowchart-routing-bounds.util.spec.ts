import { describe, expect, it } from 'vitest'
import {
  computeConnectionRoutingBounds,
  inferTightColumnFromShape,
  resolveColumnForConnection,
} from '../flowchart-routing-bounds.util'

describe('flowchart-routing-bounds.util', () => {
  const pelaksana = { left: 40, top: 10, right: 420, bottom: 500 }
  const colA = { left: 50, top: 10, right: 150, bottom: 500 }
  const colB = { left: 170, top: 10, right: 270, bottom: 500 }

  it('should_tighten_bounds_to_source_column_not_full_swimlane', () => {
    const bounds = computeConnectionRoutingBounds({
      pelaksana,
      sourceColumn: colB,
      targetColumn: colB,
      isCrossColumn: false,
    })
    expect(bounds).not.toBeNull()
    expect(bounds!.left).toBeGreaterThan(pelaksana.left + 20)
    expect(bounds!.right).toBeLessThan(pelaksana.right - 20)
    expect(bounds!.right).toBeLessThanOrEqual(colB.right)
  })

  it('should_resolve_column_by_implementer_id', () => {
    const columns = { implA: colA, implB: colB }
    expect(
      resolveColumnForConnection('implB', 200, 180, 260, columns, pelaksana)?.left,
    ).toBe(170)
  })

  it('should_infer_tight_column_from_shape_when_map_empty', () => {
    const tight = inferTightColumnFromShape(190, 250, pelaksana)
    expect(tight).not.toBeNull()
    expect(tight!.left).toBeGreaterThan(40)
    expect(tight!.right).toBeLessThan(420)
  })
})
