import { describe, expect, it } from 'vitest'
import {
  resolveHorizontalTrackY,
  resolveVerticalTrackX,
  segmentConflictsWithOccupied,
} from '../bpmn-segment-tracks.util'

describe('bpmn-segment-tracks.util', () => {
  it('should_offset_horizontal_track_when_a_trunk_is_already_occupied', () => {
    const occupied = [{ x1: 40, y1: 100, x2: 200, y2: 100 }]
    const y = resolveHorizontalTrackY(100, 40, 200, occupied)
    expect(y).not.toBe(100)
    expect(
      segmentConflictsWithOccupied({ x1: 40, y1: y, x2: 200, y2: y }, occupied),
    ).toBe(false)
  })

  it('should_offset_vertical_track_when_a_corridor_is_already_occupied', () => {
    const occupied = [{ x1: 120, y1: 40, x2: 120, y2: 260 }]
    const x = resolveVerticalTrackX(120, 40, 260, occupied)
    expect(x).not.toBe(120)
    expect(
      segmentConflictsWithOccupied({ x1: x, y1: 40, x2: x, y2: 260 }, occupied),
    ).toBe(false)
  })

  it('should_keep_local_track_when_the_only_conflict_is_a_crossing', () => {
    const occupied = [{ x1: 120, y1: 40, x2: 120, y2: 260 }]
    const y = resolveHorizontalTrackY(100, 40, 200, occupied)
    expect(y).toBe(100)
  })
})
