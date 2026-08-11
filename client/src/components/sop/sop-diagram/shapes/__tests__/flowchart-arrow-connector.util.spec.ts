import { describe, expect, it } from 'vitest'
import {
  buildMinimalOrthogonalPath,
  buildUltimateOrthogonalFallback,
  finalizeRenderablePath,
} from '../FlowchartArrowConnector'

function elemPos(
  left: number,
  top: number,
  width: number,
  height: number,
): {
  left: number
  top: number
  width: number
  height: number
  right: number
  bottom: number
} {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  }
}

function expectOrthogonal(path: { x: number; y: number }[]): void {
  expect(path.length).toBeGreaterThanOrEqual(2)
  for (let i = 0; i < path.length - 1; i += 1) {
    const a = path[i]!
    const b = path[i + 1]!
    expect(a.x === b.x || a.y === b.y).toBe(true)
  }
}

describe('finalizeRenderablePath', () => {
  it('should_return_at_least_two_points_when_normalization_fails_on_tight_bounds', () => {
    const from = elemPos(100, 80, 60, 36)
    const to = elemPos(280, 220, 60, 36)
    const tightBounds = { left: 120, top: 100, right: 140, bottom: 120 }
    const degenerate = [
      { x: 100, y: 100 },
      { x: 100, y: 100 },
      { x: 130, y: 115 },
    ]
    const actual = finalizeRenderablePath(degenerate, from, to, tightBounds)
    expectOrthogonal(actual)
  })

  it('should_produce_visible_path_from_ultimate_fallback', () => {
    const from = elemPos(40, 20, 50, 30)
    const to = elemPos(200, 180, 50, 30)
    const tightBounds = { left: 50, top: 30, right: 55, bottom: 35 }
    const actual = buildUltimateOrthogonalFallback(from, to, tightBounds)
    expectOrthogonal(actual)
    expect(actual.length).toBeGreaterThanOrEqual(2)
  })

  it('should_build_minimal_orthogonal_path_between_columns', () => {
    const from = elemPos(50, 10, 40, 24)
    const to = elemPos(180, 90, 40, 24)
    const actual = buildMinimalOrthogonalPath(from, to)
    expectOrthogonal(actual)
    expect(actual[0]!.y).toBe(from.bottom)
    expect(actual[actual.length - 1]!.y).toBe(to.top)
  })
})
