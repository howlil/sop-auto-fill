import { describe, expect, it } from 'vitest'
import { placeEdgeLabel } from '../edge-label-placement.util'

describe('placeEdgeLabel', () => {
  it('should_offset_perpendicular_from_first_segment', () => {
    const path = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]
    const pos = placeEdgeLabel({ path, label: 'Ya' })
    expect(pos).not.toBeNull()
    expect(pos!.y).not.toBe(0)
  })

  it('should_avoid_gateway_obstacle', () => {
    const path = [
      { x: 50, y: 50 },
      { x: 150, y: 50 },
    ]
    const obstacles = [{ left: 70, top: 30, width: 40, height: 40 }]
    const pos = placeEdgeLabel({ path, label: 'Tidak', obstacles })
    expect(pos).not.toBeNull()
    const inside =
      pos!.x >= 70 &&
      pos!.x <= 110 &&
      pos!.y >= 30 &&
      pos!.y <= 70
    expect(inside).toBe(false)
  })
})
