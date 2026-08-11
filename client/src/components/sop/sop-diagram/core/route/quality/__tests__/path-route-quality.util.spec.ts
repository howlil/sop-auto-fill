import { describe, expect, it } from 'vitest'
import {
  countPathQualityViolations,
  createPathSafetyOptions,
  isAcceptableRoutedPath,
  pathQualityScore,
} from '../path-route-quality.util'

describe('path-route-quality.util', () => {
  const obstacle = { left: 90, top: 90, width: 40, height: 40 }

  it('should_accept_clean_vertical_path', () => {
    const path = [
      { x: 50, y: 50 },
      { x: 50, y: 200 },
    ]
    expect(
      isAcceptableRoutedPath(path, { obstacles: [obstacle], occupied: [] }),
    ).toBe(true)
  })

  it('should_reject_path_through_obstacle', () => {
    const path = [
      { x: 100, y: 50 },
      { x: 100, y: 120 },
      { x: 100, y: 200 },
    ]
    expect(
      isAcceptableRoutedPath(path, { obstacles: [obstacle], occupied: [] }),
    ).toBe(false)
    expect(countPathQualityViolations(path, { obstacles: [obstacle], occupied: [] }).obstacleHits).toBe(1)
  })

  it('should_accept_perpendicular_crossing_but_still_count_for_scoring', () => {
    const path = [
      { x: 50, y: 100 },
      { x: 150, y: 100 },
    ]
    const occupied = [{ x1: 100, y1: 50, x2: 100, y2: 150 }]
    expect(
      isAcceptableRoutedPath(path, { obstacles: [], occupied }),
    ).toBe(true)
    expect(countPathQualityViolations(path, { obstacles: [], occupied }).crosses).toBeGreaterThan(0)
  })

  it('should_allow_scored_bpmn_crossing_for_auto_layout', () => {
    const path = [
      { x: 50, y: 100 },
      { x: 150, y: 100 },
    ]
    const occupied = [{ x1: 100, y1: 50, x2: 100, y2: 150 }]
    expect(
      isAcceptableRoutedPath(path, {
        obstacles: [],
        occupied,
        kind: 'bpmn',
        allowCrossings: true,
      }),
    ).toBe(true)
  })

  it('should_reject_collinear_overlap_with_occupied_segment', () => {
    const path = [
      { x: 10, y: 40 },
      { x: 120, y: 40 },
    ]
    const occupied = [{ x1: 20, y1: 40, x2: 120, y2: 40 }]
    expect(
      isAcceptableRoutedPath(path, { obstacles: [], occupied }),
    ).toBe(false)
  })

  it('should_score_worse_when_more_violations', () => {
    const clean = [
      { x: 10, y: 10 },
      { x: 10, y: 200 },
    ]
    const dirty = [
      { x: 10, y: 10 },
      { x: 110, y: 110 },
      { x: 10, y: 200 },
    ]
    const occupied = [{ x1: 60, y1: 10, x2: 60, y2: 200 }]
    const cleanScore = pathQualityScore(clean, { obstacles: [], occupied })
    const dirtyScore = pathQualityScore(dirty, { obstacles: [obstacle], occupied })
    expect(dirtyScore).toBeGreaterThan(cleanScore)
  })

  it('should_score_detours_worse_than_direct_local_paths', () => {
    const direct = [
      { x: 100, y: 100 },
      { x: 100, y: 180 },
      { x: 220, y: 180 },
      { x: 220, y: 260 },
    ]
    const detour = [
      { x: 100, y: 100 },
      { x: 100, y: 40 },
      { x: 300, y: 40 },
      { x: 300, y: 260 },
      { x: 220, y: 260 },
    ]

    expect(pathQualityScore(detour, { obstacles: [], occupied: [] })).toBeGreaterThan(
      pathQualityScore(direct, { obstacles: [], occupied: [] }),
    )
  })

  it('should_create_shared_safety_policy_for_flowchart_and_bpmn', () => {
    const fromShape = { left: 0, top: 0, width: 40, height: 40 }
    const toShape = { left: 100, top: 0, width: 40, height: 40 }
    const flowchart = createPathSafetyOptions('flowchart', {
      obstacles: [],
      occupied: [],
      fromShape,
      toShape,
    })
    const bpmn = createPathSafetyOptions('bpmn', {
      obstacles: [],
      occupied: [],
      fromShape,
      toShape,
    })

    expect(flowchart.checkShapeBodies).toBe(true)
    expect(bpmn.checkShapeBodies).toBe(true)
    expect(flowchart.clearancePx).toBe(2)
    expect(bpmn.clearancePx).toBe(3)
  })
})
