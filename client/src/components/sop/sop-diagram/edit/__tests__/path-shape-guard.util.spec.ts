import { describe, expect, it } from 'vitest'
import {
  finalizeManualOrthogonalPath,
  isPathBlockingShapes,
  pathCrossesShapeBodies,
  rebuildPathForAnchorSides,
  repairPathAroundShapes,
} from '../path-shape-guard.util'

const obstacle = { left: 90, top: 90, width: 40, height: 40 }
const fromShape = { left: 20, top: 20, width: 40, height: 40 }
const toShape = { left: 200, top: 200, width: 40, height: 40 }

describe('path-shape-guard.util', () => {
  it('should_detect_flowchart_path_crossing_obstacle', () => {
    const blocking = isPathBlockingShapes({
      kind: 'flowchart',
      path: [
        { x: 40, y: 40 },
        { x: 110, y: 110 },
        { x: 220, y: 220 },
      ],
      obstacles: [obstacle],
      fromShape,
      toShape,
    })
    expect(blocking).toBe(true)
  })

  it('should_detect_vertical_path_crossing_from_shape_interior', () => {
    const throughSource = [
      { x: 40, y: 20 },
      { x: 40, y: 60 },
    ]
    expect(
      pathCrossesShapeBodies(throughSource, fromShape, toShape, []),
    ).toBe(true)
    expect(
      isPathBlockingShapes({
        kind: 'flowchart',
        path: throughSource,
        obstacles: [],
        fromShape,
        toShape,
      }),
    ).toBe(true)
  })

  it('should_allow_path_exiting_bottom_of_from_shape', () => {
    const exitingDown = [
      { x: 40, y: 60 },
      { x: 40, y: 120 },
      { x: 220, y: 220 },
    ]
    expect(
      pathCrossesShapeBodies(exitingDown, fromShape, toShape, []),
    ).toBe(false)
  })

  it('should_allow_bpmn_path_that_routes_around_obstacle', () => {
    const allowed = isPathBlockingShapes({
      kind: 'bpmn',
      path: [
        { x: 60, y: 60 },
        { x: 60, y: 150 },
        { x: 210, y: 210 },
      ],
      obstacles: [obstacle],
      fromShape,
      toShape,
    })
    expect(allowed).toBe(false)
  })

  it('should_repair_flowchart_path_without_crossing_obstacle', () => {
    const repaired = repairPathAroundShapes({
      kind: 'flowchart',
      startPoint: { x: 40, y: 60 },
      endPoint: { x: 220, y: 220 },
      sSide: 'bottom',
      eSide: 'top',
      fromShape,
      toShape,
      obstacles: [obstacle],
      flowchart: {
        globalBounds: { left: 0, top: 0, width: 300, height: 300 },
      },
    })
    expect(repaired).not.toBeNull()
    expect(repaired!.length).toBeGreaterThanOrEqual(2)
    expect(
      isPathBlockingShapes({
        kind: 'flowchart',
        path: repaired!,
        obstacles: [obstacle],
        fromShape,
        toShape,
      }),
    ).toBe(false)
  })

  it('should_rebuild_path_when_start_side_changes_to_left', () => {
    const rebuilt = rebuildPathForAnchorSides({
      kind: 'flowchart',
      startPoint: { x: 20, y: 40 },
      endPoint: { x: 220, y: 200 },
      sSide: 'left',
      eSide: 'top',
      fromShape,
      toShape,
      obstacles: [],
      flowchart: {
        globalBounds: { left: 0, top: 0, width: 400, height: 400 },
      },
    })
    expect(rebuilt).not.toBeNull()
    expect(rebuilt!.length).toBeGreaterThanOrEqual(2)
    expect(
      pathCrossesShapeBodies(rebuilt!, fromShape, toShape, []),
    ).toBe(false)
    expect(rebuilt![0]).toEqual({ x: 20, y: 40 })
    expect(rebuilt![rebuilt!.length - 1]).toEqual({ x: 220, y: 200 })
  })

  it('should_keep_manual_path_with_collision_when_policy_is_warn', () => {
    const manualPath = [
      { x: 40, y: 60 },
      { x: 110, y: 60 },
      { x: 110, y: 200 },
      { x: 220, y: 200 },
    ]
    const finalized = finalizeManualOrthogonalPath(
      manualPath,
      {
        collisionPolicy: 'warn',
        check: {
          kind: 'flowchart',
          path: manualPath,
          obstacles: [obstacle],
          fromShape,
          toShape,
        },
        repair: {
          kind: 'flowchart',
          startPoint: manualPath[0]!,
          endPoint: manualPath[manualPath.length - 1]!,
          sSide: 'bottom',
          eSide: 'top',
          fromShape,
          toShape,
          obstacles: [obstacle],
          flowchart: {
            globalBounds: { left: 0, top: 0, width: 300, height: 300 },
          },
        },
      },
    )
    expect(finalized).toEqual(manualPath)
    expect(
      isPathBlockingShapes({
        kind: 'flowchart',
        path: finalized,
        obstacles: [obstacle],
        fromShape,
        toShape,
      }),
    ).toBe(true)
  })
})
