import { describe, expect, it } from 'vitest'
import { isOrthogonalPath } from '@/components/sop/sop-diagram/core/route/shared/orthogonal-path-normalization.util'
import {
  alignEndpointSegmentPreservingEndpoint,
  insertWaypointAtSegmentMidpoint,
  removeWaypoint,
  dragSegmentFromOrigin,
  dragWaypointFromOrigin,
  dragWaypointOrthogonal,
  endpointIndexForKind,
  forkStraightPathForEndpointDrag,
  getDraggedEndpointKind,
  isPerpendicularEndpointDrag,
  isStraightTwoPointPath,
  simplifyOrthogonalPath,
} from '../orthogonal-path-edit.util'

describe('orthogonal-path-edit.util', () => {
  const basePath = [
    { x: 0, y: 0 },
    { x: 0, y: 100 },
    { x: 200, y: 100 },
    { x: 200, y: 200 },
  ]

  it('should_insert_waypoint_on_segment', () => {
    const next = insertWaypointAtSegmentMidpoint(basePath, 2)
    expect(next.length).toBeGreaterThanOrEqual(basePath.length)
  })

  it('should_remove_internal_waypoint', () => {
    const next = removeWaypoint(basePath, 2)
    expect(next.length).toBe(basePath.length - 1)
  })

  it('should_drag_waypoint_with_orthogonal_constraint', () => {
    const next = dragWaypointOrthogonal(basePath, 2, 0, 10)
    expect(next[2]?.y).not.toBe(basePath[2]?.y)
  })

  it('should_drag_segment_horizontally_without_normalize_jitter', () => {
    const path = [
      { x: 0, y: 0 },
      { x: 0, y: 100 },
      { x: 200, y: 100 },
    ]
    const moved = dragSegmentFromOrigin(path, 1, 0, 12, { normalize: false })
    expect(moved[1]?.y).toBe(112)
    expect(moved[2]?.y).toBe(112)
    expect(moved[1]?.x).toBe(0)
    expect(moved[2]?.x).toBe(200)
  })

  it('should_drag_waypoint_from_origin_with_stable_delta', () => {
    const path = [
      { x: 100, y: 100 },
      { x: 100, y: 200 },
      { x: 200, y: 200 },
    ]
    const moved = dragWaypointFromOrigin(path, 1, 0, 16, { normalize: false })
    expect(moved[1]?.y).toBe(216)
    expect(moved[1]?.x).toBe(100)
  })

  it('should_move_next_vertical_bend_when_corner_is_dragged_horizontally', () => {
    const path = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]
    const moved = dragWaypointFromOrigin(path, 1, 16, 0, { normalize: false })
    expect(moved).toEqual([
      { x: 0, y: 0 },
      { x: 116, y: 0 },
      { x: 116, y: 100 },
    ])
    expect(isOrthogonalPath(moved)).toBe(true)
  })

  it('should_move_previous_horizontal_bend_when_corner_is_dragged_vertically', () => {
    const path = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]
    const moved = dragWaypointFromOrigin(path, 1, 0, 20, { normalize: false })
    expect(moved).toEqual([
      { x: 0, y: 20 },
      { x: 100, y: 20 },
      { x: 100, y: 100 },
    ])
    expect(isOrthogonalPath(moved)).toBe(true)
  })

  it('should_simplify_collinear_middle_points', () => {
    const zigZag = [
      { x: 0, y: 0 },
      { x: 0, y: 50 },
      { x: 0, y: 100 },
      { x: 200, y: 100 },
    ]
    const simplified = simplifyOrthogonalPath(zigZag)
    expect(simplified.length).toBeLessThan(zigZag.length)
  })

  it('should_remove_small_horizontal_notch_on_vertical_spine', () => {
    const withNotch = [
      { x: 100, y: 0 },
      { x: 100, y: 40 },
      { x: 120, y: 40 },
      { x: 120, y: 60 },
      { x: 100, y: 60 },
      { x: 100, y: 100 },
    ]
    const simplified = simplifyOrthogonalPath(withNotch)
    expect(simplified.length).toBeLessThanOrEqual(4)
    expect(simplified[0]).toEqual({ x: 100, y: 0 })
    expect(simplified[simplified.length - 1]).toEqual({ x: 100, y: 100 })
  })

  it('should_collapse_small_rectangle_detour', () => {
    const smallNotch = [
      { x: 0, y: 0 },
      { x: 0, y: 50 },
      { x: 12, y: 50 },
      { x: 12, y: 58 },
      { x: 0, y: 58 },
      { x: 0, y: 100 },
    ]
    const simplified = simplifyOrthogonalPath(smallNotch)
    expect(simplified.length).toBeLessThan(smallNotch.length)
    expect(simplified[0]).toEqual({ x: 0, y: 0 })
    expect(simplified[simplified.length - 1]).toEqual({ x: 0, y: 100 })
  })

  it('should_remove_large_horizontal_notch_on_vertical_spine', () => {
    const wideNotch = [
      { x: 100, y: 0 },
      { x: 100, y: 40 },
      { x: 132, y: 40 },
      { x: 132, y: 60 },
      { x: 100, y: 60 },
      { x: 100, y: 100 },
    ]
    const simplified = simplifyOrthogonalPath(wideNotch)
    expect(simplified.length).toBeLessThanOrEqual(4)
    expect(simplified[0]).toEqual({ x: 100, y: 0 })
    expect(simplified[simplified.length - 1]).toEqual({ x: 100, y: 100 })
    expect(simplified.every((p) => p.x === 100 || p.y === 0 || p.y === 100)).toBe(true)
  })

  it('should_remove_small_horizontal_jog_on_vertical_spine', () => {
    const verticalWithJog = [
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 108, y: 50 },
      { x: 108, y: 52 },
      { x: 100, y: 52 },
      { x: 100, y: 100 },
    ]
    const simplified = simplifyOrthogonalPath(verticalWithJog, 12)
    expect(simplified.length).toBeLessThanOrEqual(4)
    expect(simplified[0]).toEqual({ x: 100, y: 0 })
    expect(simplified[simplified.length - 1]).toEqual({ x: 100, y: 100 })
  })

  it('should_not_remove_wide_detour_that_does_not_return_to_spine', () => {
    const offSpineJog = [
      { x: 0, y: 0 },
      { x: 0, y: 50 },
      { x: 80, y: 50 },
      { x: 80, y: 100 },
      { x: 200, y: 100 },
    ]
    const simplified = simplifyOrthogonalPath(offSpineJog)
    expect(simplified.length).toBeGreaterThanOrEqual(4)
    expect(simplified.some((p) => p.x === 80)).toBe(true)
  })

  it('should_fork_horizontal_when_drag_end_perpendicular_down', () => {
    const straight = [
      { x: 0, y: 100 },
      { x: 200, y: 100 },
    ]
    expect(isStraightTwoPointPath(straight)).toBe(true)
    expect(isPerpendicularEndpointDrag(straight, 0, 80)).toBe(true)
    const forked = forkStraightPathForEndpointDrag(straight, 1, 0, 80)
    expect(forked).not.toBeNull()
    expect(forked).toHaveLength(3)
    expect(forked![0]).toEqual({ x: 0, y: 100 })
    expect(forked![1]).toEqual({ x: 200, y: 100 })
    expect(forked![2]).toEqual({ x: 200, y: 180 })
    expect(forked![0]!.y).toBe(forked![1]!.y)
    expect(forked![1]!.x).toBe(forked![2]!.x)
  })

  it('should_keep_tracking_end_endpoint_after_straight_path_forks', () => {
    const straight = [
      { x: 0, y: 100 },
      { x: 200, y: 100 },
    ]
    const kind = getDraggedEndpointKind(straight, 1)
    const forked = forkStraightPathForEndpointDrag(straight, 1, 0, 80)
    expect(kind).toBe('end')
    expect(forked).toHaveLength(3)
    expect(endpointIndexForKind(forked!, kind!)).toBe(2)
  })

  it('should_align_neighbor_without_moving_snapped_endpoint', () => {
    const path = [
      { x: 100, y: 100 },
      { x: 180, y: 160 },
      { x: 240, y: 160 },
    ]
    const aligned = alignEndpointSegmentPreservingEndpoint(path, 0)
    expect(aligned[0]).toEqual({ x: 100, y: 100 })
    expect(aligned[1]).toEqual({ x: 180, y: 100 })
  })

  it('should_not_fork_when_drag_along_horizontal', () => {
    const straight = [
      { x: 0, y: 100 },
      { x: 200, y: 100 },
    ]
    expect(isPerpendicularEndpointDrag(straight, 80, 0)).toBe(false)
    expect(forkStraightPathForEndpointDrag(straight, 1, 80, 0)).toBeNull()
  })

  it('should_fork_vertical_when_drag_end_perpendicular_sideways', () => {
    const straight = [
      { x: 100, y: 0 },
      { x: 100, y: 200 },
    ]
    expect(isPerpendicularEndpointDrag(straight, 80, 0)).toBe(true)
    const forked = forkStraightPathForEndpointDrag(straight, 1, 80, 0)
    expect(forked).toHaveLength(3)
    expect(forked![0]).toEqual({ x: 100, y: 0 })
    expect(forked![1]).toEqual({ x: 100, y: 200 })
    expect(forked![2]).toEqual({ x: 180, y: 200 })
    expect(forked![0]!.x).toBe(forked![1]!.x)
    expect(forked![1]!.y).toBe(forked![2]!.y)
  })
})
