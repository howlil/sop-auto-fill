import { describe, expect, it } from 'vitest'
import {
  buildEdgeAnchorId,
  buildVisualConnectorAnchors,
  filterAnchorsForEndpoint,
  findNearestAnchor,
  getAllowedShapeForEndpoint,
  parseLockedSideFromAnchorId,
  pickDiamondSideFromPointer,
  pickSnapSideForPointer,
  projectPointerToShapeEdge,
  resolveAnchorSnap,
  resolveConstrainedEdgeSnap,
  resolveEdgeMagneticSnap,
  resolveMagneticAnchorSnap,
  resolvePreferredEndpointSnap,
  snapDistanceToCenter,
  type DiagramShapeSnapTargets,
} from '../anchor-snap.util'

const anchors = [
  { id: 'start-top', x: 100, y: 80, side: 'top', kind: 'start' },
  { id: 'start-right', x: 140, y: 100, side: 'right', kind: 'start' },
  { id: 'end-left', x: 260, y: 100, side: 'left', kind: 'end' },
] as const

const shapeRect = { left: 100, top: 80, width: 40, height: 40 }

describe('anchor-snap.util', () => {
  it('should_find_nearest_anchor_by_kind', () => {
    const nearest = findNearestAnchor([...anchors], 132, 96, 'start')
    expect(nearest?.anchor.id).toBe('start-right')
  })

  it('should_snap_when_pointer_inside_threshold', () => {
    const snapped = resolveAnchorSnap({
      anchors: [...anchors],
      x: 136,
      y: 98,
      kind: 'start',
      snapDistancePx: 12,
      releaseDistancePx: 18,
      lockedAnchorId: null,
    })
    expect(snapped?.id).toBe('start-right')
  })

  it('should_keep_locked_anchor_until_release_threshold', () => {
    const keepLocked = resolveAnchorSnap({
      anchors: [...anchors],
      x: 152,
      y: 111,
      kind: 'start',
      snapDistancePx: 8,
      releaseDistancePx: 20,
      lockedAnchorId: 'start-right',
    })
    expect(keepLocked?.id).toBe('start-right')
  })

  it('should_return_magnetic_position_between_pointer_and_anchor', () => {
    const snapped = resolveMagneticAnchorSnap({
      anchors: [...anchors],
      x: 128,
      y: 100,
      kind: 'start',
      snapDistancePx: 16,
      releaseDistancePx: 24,
      hardSnapDistancePx: 5,
      lockedAnchorId: null,
    })
    expect(snapped?.anchor.id).toBe('start-right')
    expect(snapped?.hardSnapped).toBe(false)
    expect(snapped?.ratio).toBeGreaterThan(0)
    expect(snapped?.ratio).toBeLessThan(1)
    expect(snapped?.x).toBeGreaterThan(128)
    expect(snapped?.x).toBeLessThan(140)
    expect(snapped?.y).toBe(100)
  })

  it('should_hard_snap_when_inside_hard_snap_threshold', () => {
    const snapped = resolveMagneticAnchorSnap({
      anchors: [...anchors],
      x: 137,
      y: 100,
      kind: 'start',
      snapDistancePx: 16,
      releaseDistancePx: 24,
      hardSnapDistancePx: 5,
      lockedAnchorId: null,
    })
    expect(snapped?.anchor.id).toBe('start-right')
    expect(snapped?.hardSnapped).toBe(true)
    expect(snapped?.x).toBe(140)
    expect(snapped?.y).toBe(100)
  })

  it('should_keep_locked_anchor_magnetic_until_release_threshold', () => {
    const snapped = resolveMagneticAnchorSnap({
      anchors: [...anchors],
      x: 156,
      y: 100,
      kind: 'start',
      snapDistancePx: 8,
      releaseDistancePx: 20,
      hardSnapDistancePx: 4,
      lockedAnchorId: 'start-right',
    })
    expect(snapped?.anchor.id).toBe('start-right')
    expect(snapped?.x).toBeLessThan(156)
  })

  it('should_return_null_outside_snap_radius_when_unlocked', () => {
    const snapped = resolveMagneticAnchorSnap({
      anchors: [...anchors],
      x: 180,
      y: 100,
      kind: 'start',
      snapDistancePx: 16,
      releaseDistancePx: 24,
      hardSnapDistancePx: 5,
      lockedAnchorId: null,
    })
    expect(snapped).toBeNull()
  })

  it('should_project_pointer_to_nearest_edge', () => {
    const top = projectPointerToShapeEdge(shapeRect, 115, 70)
    expect(top?.side).toBe('top')
    expect(top?.y).toBe(80)
    expect(top?.distanceToEdge).toBe(10)

    const right = projectPointerToShapeEdge(shapeRect, 150, 95)
    expect(right?.side).toBe('right')
    expect(right?.x).toBe(140)
  })

  it('should_project_to_locked_side_only', () => {
    const locked = projectPointerToShapeEdge(shapeRect, 150, 95, 'top')
    expect(locked?.side).toBe('top')
    expect(locked?.y).toBe(80)
  })

  it('should_parse_locked_side_from_anchor_id', () => {
    expect(parseLockedSideFromAnchorId('conn-1-start-right', 'start')).toBe('right')
    expect(parseLockedSideFromAnchorId('conn-1-end-bottom', 'end')).toBe('bottom')
    expect(parseLockedSideFromAnchorId('other', 'start')).toBeNull()
  })

  it('should_edge_magnetic_snap_along_top_edge', () => {
    const snapped = resolveEdgeMagneticSnap({
      connectionId: 'conn-1',
      shape: shapeRect,
      x: 118,
      y: 68,
      kind: 'start',
      snapDistancePx: 28,
      releaseDistancePx: 36,
      hardSnapDistancePx: 8,
      lockedAnchorId: null,
    })
    expect(snapped?.side).toBe('top')
    expect(snapped?.hardSnapped).toBe(false)
    expect(snapped?.anchorId).toBe(buildEdgeAnchorId('conn-1', 'start', 'top'))
    expect(snapped?.x).toBeGreaterThanOrEqual(115)
    expect(snapped?.x).toBeLessThanOrEqual(118)
    expect(snapped?.y).toBeGreaterThan(68)
    expect(snapped?.y).toBeLessThan(80)
  })

  it('should_edge_hard_snap_when_very_close_to_edge', () => {
    const snapped = resolveEdgeMagneticSnap({
      connectionId: 'conn-1',
      shape: shapeRect,
      x: 118,
      y: 79,
      kind: 'start',
      snapDistancePx: 28,
      releaseDistancePx: 36,
      hardSnapDistancePx: 8,
      lockedAnchorId: null,
    })
    expect(snapped?.hardSnapped).toBe(true)
    expect(snapped?.x).toBe(118)
    expect(snapped?.y).toBe(80)
  })

  it('should_keep_locked_edge_side_until_release', () => {
    const lockedId = buildEdgeAnchorId('conn-1', 'start', 'right')
    const snapped = resolveEdgeMagneticSnap({
      connectionId: 'conn-1',
      shape: shapeRect,
      x: 155,
      y: 100,
      kind: 'start',
      snapDistancePx: 8,
      releaseDistancePx: 24,
      hardSnapDistancePx: 4,
      lockedAnchorId: lockedId,
    })
    expect(snapped?.side).toBe('right')
    expect(snapped?.x).toBeLessThan(155)
    expect(snapped?.x).toBeGreaterThanOrEqual(140)
  })

  it('should_return_null_edge_snap_outside_radius', () => {
    const snapped = resolveEdgeMagneticSnap({
      connectionId: 'conn-1',
      shape: shapeRect,
      x: 200,
      y: 200,
      kind: 'start',
      snapDistancePx: 28,
      releaseDistancePx: 36,
      hardSnapDistancePx: 8,
      lockedAnchorId: null,
    })
    expect(snapped).toBeNull()
  })

  it('should_constrained_snap_from_center_of_shape_to_nearest_edge', () => {
    const snapped = resolveConstrainedEdgeSnap({
      connectionId: 'conn-1',
      shape: shapeRect,
      x: 120,
      y: 100,
      kind: 'start',
      releaseDistancePx: 48,
      lockedAnchorId: null,
    })
    expect(snapped).not.toBeNull()
    expect(snapped?.hardSnapped).toBe(true)
    expect(['top', 'bottom', 'left', 'right']).toContain(snapped?.side)
    expect(snapped?.x).toBeGreaterThanOrEqual(100)
    expect(snapped?.x).toBeLessThanOrEqual(140)
    expect(snapped?.y).toBeGreaterThanOrEqual(80)
    expect(snapped?.y).toBeLessThanOrEqual(120)
  })

  it('should_constrained_snap_slide_anywhere_on_perimeter', () => {
    const left = resolveConstrainedEdgeSnap({
      connectionId: 'conn-1',
      shape: shapeRect,
      x: 90,
      y: 95,
      kind: 'start',
      releaseDistancePx: 48,
      lockedAnchorId: null,
    })
    expect(left?.side).toBe('left')
    expect(left?.x).toBe(100)

    const top = resolveConstrainedEdgeSnap({
      connectionId: 'conn-1',
      shape: wideSwimlaneRect,
      x: 170,
      y: 150,
      kind: 'end',
      releaseDistancePx: 48,
      lockedAnchorId: null,
      oppositePoint: { x: 200, y: 80 },
    })
    expect(top?.side).toBe('top')
    expect(top?.y).toBe(200)
    expect(top?.x).toBe(170)
  })

  const wideSwimlaneRect = { left: 100, top: 200, width: 200, height: 40 }

  it('should_pick_left_side_when_pointer_above_left_zone_on_wide_shape', () => {
    expect(pickSnapSideForPointer(wideSwimlaneRect, 105, 150)).toBe('left')
    const snapped = resolveConstrainedEdgeSnap({
      connectionId: 'conn-1',
      shape: wideSwimlaneRect,
      x: 105,
      y: 150,
      kind: 'end',
      releaseDistancePx: 48,
      lockedAnchorId: null,
      oppositePoint: { x: 120, y: 80 },
    })
    expect(snapped?.side).toBe('left')
    expect(snapped?.x).toBe(100)
    expect(snapped?.y).toBeGreaterThanOrEqual(200)
    expect(snapped?.y).toBeLessThanOrEqual(240)
  })

  it('should_pick_right_side_when_pointer_in_right_zone', () => {
    expect(pickSnapSideForPointer(wideSwimlaneRect, 285, 220)).toBe('right')
    const snapped = resolveConstrainedEdgeSnap({
      connectionId: 'conn-1',
      shape: wideSwimlaneRect,
      x: 285,
      y: 220,
      kind: 'end',
      releaseDistancePx: 48,
      lockedAnchorId: null,
    })
    expect(snapped?.side).toBe('right')
    expect(snapped?.x).toBe(300)
  })

  it('should_face_opposite_point_for_side_when_outside_zones', () => {
    expect(
      pickSnapSideForPointer(wideSwimlaneRect, 170, 150, {
        oppositePoint: { x: 200, y: 80 },
      }),
    ).toBe('top')
    expect(
      pickSnapSideForPointer(wideSwimlaneRect, 50, 220, {
        oppositePoint: { x: 250, y: 220 },
      }),
    ).toBe('right')
  })

  it('should_switch_from_bottom_to_left_when_pointer_enters_left_zone', () => {
    const lockedId = buildEdgeAnchorId('conn-1', 'end', 'bottom')
    const snapped = resolveConstrainedEdgeSnap({
      connectionId: 'conn-1',
      shape: wideSwimlaneRect,
      x: 108,
      y: 170,
      kind: 'end',
      releaseDistancePx: 48,
      lockedAnchorId: lockedId,
    })
    expect(snapped?.side).toBe('left')
  })

  it('should_allow_switching_regular_shape_side_even_when_previous_side_was_locked', () => {
    const snapped = resolveConstrainedEdgeSnap({
      connectionId: 'conn-1',
      shape: wideSwimlaneRect,
      x: 100,
      y: 220,
      kind: 'end',
      releaseDistancePx: 48,
      lockedAnchorId: buildEdgeAnchorId('conn-1', 'end', 'right'),
    })
    expect(snapped?.side).toBe('left')
    expect(snapped?.x).toBe(100)
    expect(snapped?.y).toBe(220)
  })

  it('should_build_only_four_visual_anchors_per_diamond_shape', () => {
    const diamond = { left: 100, top: 100, width: 80, height: 80 }
    const process = { left: 300, top: 100, width: 120, height: 50 }
    const anchors = buildVisualConnectorAnchors('conn-1', diamond, process, {
      fromIsDiamond: true,
      toIsDiamond: false,
    })
    const startAnchors = filterAnchorsForEndpoint(anchors, 'start')
    const endAnchors = filterAnchorsForEndpoint(anchors, 'end')
    expect(startAnchors).toHaveLength(4)
    expect(endAnchors).toHaveLength(12)
  })

  it('should_snap_diamond_to_vertex_not_along_edge', () => {
    const diamond = { left: 100, top: 100, width: 80, height: 80 }
    expect(pickDiamondSideFromPointer(diamond, 90, 120)).toBe('left')
    const snapped = resolveConstrainedEdgeSnap({
      connectionId: 'conn-1',
      shape: diamond,
      x: 95,
      y: 130,
      kind: 'start',
      releaseDistancePx: 48,
      lockedAnchorId: null,
      shapeIsDiamond: true,
    })
    expect(snapped?.side).toBe('left')
    expect(snapped?.x).toBe(100)
    expect(snapped?.y).toBe(140)
    expect(snapped?.distance).toBe(0.5)
  })

  it('should_allow_switching_diamond_vertex_even_when_previous_vertex_was_locked', () => {
    const diamond = { left: 100, top: 100, width: 80, height: 80 }
    const snapped = resolveConstrainedEdgeSnap({
      connectionId: 'conn-1',
      shape: diamond,
      x: 100,
      y: 140,
      kind: 'start',
      releaseDistancePx: 48,
      lockedAnchorId: buildEdgeAnchorId('conn-1', 'start', 'right'),
      shapeIsDiamond: true,
    })
    expect(snapped?.side).toBe('left')
    expect(snapped?.x).toBe(100)
    expect(snapped?.y).toBe(140)
  })

  it('should_snap_distance_to_center_when_near_midpoint', () => {
    expect(snapDistanceToCenter(0.48, 200, 14)).toBe(0.5)
    expect(snapDistanceToCenter(0.52, 200, 14)).toBe(0.5)
    expect(snapDistanceToCenter(0.2, 200, 14)).toBe(0.2)
  })

  it('should_prefer_center_anchor_on_endpoint_drag_near_midpoint', () => {
    const rect = { left: 100, top: 100, width: 120, height: 50 }
    const anchors = buildVisualConnectorAnchors('conn-1', rect, { left: 300, top: 100, width: 80, height: 40 })
    const snapped = resolvePreferredEndpointSnap({
      connectionId: 'conn-1',
      shape: rect,
      x: 162,
      y: 100,
      kind: 'start',
      releaseDistancePx: 48,
      lockedAnchorId: null,
      anchors,
      snapDistancePx: 24,
      hardSnapDistancePx: 8,
    })
    expect(snapped?.distance).toBe(0.5)
    expect(snapped?.x).toBe(160)
    expect(snapped?.y).toBe(100)
  })

  it('should_not_replace_projected_edge_with_nearer_anchor_from_wrong_side', () => {
    const rect = { left: 100, top: 100, width: 120, height: 50 }
    const snapped = resolvePreferredEndpointSnap({
      connectionId: 'conn-1',
      shape: rect,
      x: 160,
      y: 100,
      kind: 'start',
      releaseDistancePx: 48,
      lockedAnchorId: null,
      anchors: [
        { id: 'wrong-left', x: 160, y: 100, side: 'left', kind: 'start' },
        { id: 'valid-top', x: 160, y: 100, side: 'top', kind: 'start' },
      ],
      snapDistancePx: 24,
      hardSnapDistancePx: 8,
    })
    expect(snapped?.side).toBe('top')
    expect(snapped?.x).toBe(160)
    expect(snapped?.y).toBe(100)
  })

  it('should_get_allowed_shape_only_for_matching_endpoint', () => {
    const targets: DiagramShapeSnapTargets = {
      connectionId: 'conn-1',
      fromNodeId: 'node-a',
      toNodeId: 'node-b',
      start: shapeRect,
      end: { left: 200, top: 80, width: 40, height: 40 },
    }
    expect(getAllowedShapeForEndpoint(targets, 'start')).toBe(shapeRect)
    expect(getAllowedShapeForEndpoint(targets, 'end')?.left).toBe(200)
    expect(filterAnchorsForEndpoint([...anchors], 'start')).toHaveLength(2)
    expect(filterAnchorsForEndpoint([...anchors], 'end')).toHaveLength(1)
  })
})
