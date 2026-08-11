import { describe, expect, it } from 'vitest'
import {
  buildCorridorGraph,
  routeOrthogonal,
  normalizeOrthogonalPath,
  pathIntersectsRectangles,
  pathOverlapsSegments,
  scorePath,
} from '../../shared/orthogonalRouter'
import { selectSidePairs, type ElemPos, type FlowchartConnectionForSidePairs } from '../selectSidePairs'
import {
  buildUltimateOrthogonalFallback,
  normalizeConnectorPath,
} from '../../../../shapes/FlowchartArrowConnector'
import { buildSideAnchoredFallbackPath } from '../../bpmn/bpmn-fallback-path.util'

function rect(left: number, top: number, width: number, height: number): ElemPos {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  }
}

function conn(overrides: Partial<FlowchartConnectionForSidePairs> = {}): FlowchartConnectionForSidePairs {
  return {
    id: 'c1',
    from: 'a',
    to: 'b',
    label: null,
    sourceType: 'flowchart-process',
    targetType: 'flowchart-process',
    ...overrides,
  }
}

/** Corridor graph — flowchart kini memakai routeOrthogonal langsung. */
describe.skip('buildCorridorGraph', () => {
  it('places corridor graph points 4px from horizontal cell boundaries', () => {
    const graph = buildCorridorGraph([[
      {
        row: 0,
        col: 0,
        rect: { left: 0, top: 0, width: 100, height: 80 },
        center: { x: 50, y: 40 },
        occupied: false,
      },
      {
        row: 0,
        col: 1,
        rect: { left: 100, top: 0, width: 100, height: 80 },
        center: { x: 150, y: 40 },
        occupied: false,
      },
    ]])

    expect(graph.spots).toContainEqual({ x: 96, y: 40 })
    expect(graph.spots).toContainEqual({ x: 104, y: 40 })
  })

  it('places corridor graph points 4px from vertical cell boundaries', () => {
    const graph = buildCorridorGraph([
      [{
        row: 0,
        col: 0,
        rect: { left: 0, top: 0, width: 100, height: 80 },
        center: { x: 50, y: 40 },
        occupied: false,
      }],
      [{
        row: 1,
        col: 0,
        rect: { left: 0, top: 80, width: 100, height: 80 },
        center: { x: 50, y: 120 },
        occupied: false,
      }],
    ])

    expect(graph.spots).toContainEqual({ x: 50, y: 76 })
    expect(graph.spots).toContainEqual({ x: 50, y: 84 })
  })
})

function expectOrthogonal(path: { x: number; y: number }[]) {
  expect(path.length).toBeGreaterThanOrEqual(2)
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    expect(a.x === b.x || a.y === b.y).toBe(true)
  }
}

describe('flowchart route candidate selection', () => {
  it('prefers bottom-to-top for same-column process below target', () => {
    const candidates = selectSidePairs(
      conn(),
      rect(100, 100, 80, 40),
      rect(100, 240, 80, 40),
      {},
      undefined,
      'b',
      'c1',
    )

    expect(candidates[0]).toMatchObject({
      sSide: 'bottom',
      eSide: 'top',
      preferSimple: true,
      sourcePort: { portConstraint: 'south', exitX: 0.5 },
      targetPort: { portConstraint: 'north', entryX: 0.5 },
    })
  })

  it('prefers a lateral exit for Tidak same-column below non-decision target', () => {
    const candidates = selectSidePairs(
      conn({ sourceType: 'flowchart-decision', label: 'Tidak', targetType: 'flowchart-process' }),
      rect(100, 100, 80, 80),
      rect(100, 260, 80, 80),
      {},
      undefined,
      'b',
      'c1',
    )

    expect(candidates[0]).toMatchObject({
      sSide: 'right',
      eSide: 'top',
      preferSimple: false,
    })
    expect(candidates).toContainEqual(expect.objectContaining({
      sSide: 'bottom',
      eSide: 'top',
    }))
  })

  it('prefers bottom-to-top for Ya branch below with south/north constraints', () => {
    const candidates = selectSidePairs(
      conn({ sourceType: 'flowchart-decision', label: 'Ya' }),
      rect(100, 100, 80, 80),
      rect(100, 260, 80, 80),
      {},
      undefined,
      'b',
      'c1',
    )

    expect(candidates[0]).toMatchObject({
      sSide: 'bottom',
      eSide: 'top',
      sourcePort: { portConstraint: 'south', exitX: 0.5 },
      targetPort: { portConstraint: 'north', entryX: 0.5 },
      preferSimple: true,
    })
  })

  it('prefers left-left loop-back when Tidak target is above and to the left', () => {
    const candidates = selectSidePairs(
      conn({ sourceType: 'flowchart-decision', label: 'Tidak' }),
      rect(220, 220, 80, 80),
      rect(100, 40, 80, 80),
      {},
      undefined,
      'b',
      'c1',
    )

    expect(candidates[0]).toMatchObject({
      sSide: 'left',
      eSide: 'left',
      preferSimple: false,
    })
    expect(candidates[0]?.jettySize).toBeGreaterThan(16)
  })

  it('keeps the incoming top port free when a Ya branch loops back upward', () => {
    const candidates = selectSidePairs(
      conn({ sourceType: 'flowchart-decision', label: 'Ya' }),
      rect(220, 220, 80, 80),
      rect(100, 40, 80, 80),
      {},
      undefined,
      'b',
      'c1',
    )

    expect(candidates[0]).toMatchObject({
      sSide: 'left',
      eSide: 'left',
      preferSimple: false,
    })
    expect(candidates[0]!.sSide).not.toBe('top')
  })

  it('prefers right-right loop-back when Tidak target is above and to the right', () => {
    const candidates = selectSidePairs(
      conn({ sourceType: 'flowchart-decision', label: 'Tidak' }),
      rect(100, 220, 80, 80),
      rect(220, 40, 80, 80),
      {},
      undefined,
      'b',
      'c1',
    )

    expect(candidates[0]).toMatchObject({
      sSide: 'right',
      eSide: 'right',
      preferSimple: false,
    })
  })

  it('prefers bottom-right for Ya when target is below and to the left', () => {
    const candidates = selectSidePairs(
      conn({ sourceType: 'flowchart-decision', label: 'Ya' }),
      rect(220, 100, 80, 80),
      rect(100, 260, 80, 80),
      {},
      undefined,
      'b',
      'c1',
    )

    expect(candidates[0]).toMatchObject({
      sSide: 'bottom',
      eSide: 'right',
    })
  })

  it('assigns opc routes a larger jetty', () => {
    const candidates = selectSidePairs(
      conn({ targetType: 'flowchart-opc' }),
      rect(100, 100, 80, 60),
      rect(100, 260, 80, 60),
      {},
      undefined,
      'b',
      'c1',
    )

    expect(candidates[0]).toMatchObject({
      sSide: 'bottom',
      eSide: 'top',
      jettySize: 18,
    })
  })
})

describe('routeOrthogonal', () => {
  it('preserves jetty segments on simple same-column routing', () => {
    const path = routeOrthogonal({
      pointA: { shape: { left: 100, top: 100, width: 80, height: 40 }, side: 'bottom', distance: 0.5 },
      pointB: { shape: { left: 100, top: 240, width: 80, height: 40 }, side: 'top', distance: 0.5 },
      jettySize: 20,
      preferSimple: true,
      globalBounds: { left: 0, top: 0, width: 400, height: 400 },
    })

    expect(path[0]).toEqual({ x: 140, y: 140 })
    expect(path[path.length - 1]).toEqual({ x: 140, y: 240 })
    expect(path.every((p) => p.x === 140)).toBe(true)
    expectOrthogonal(path)
  })

  it('keeps same-row routing purely horizontal at endpoints', () => {
    const path = routeOrthogonal({
      pointA: { shape: { left: 40, top: 80, width: 60, height: 40 }, side: 'right', distance: 0.5 },
      pointB: { shape: { left: 220, top: 80, width: 60, height: 40 }, side: 'left', distance: 0.5 },
      jettySize: 16,
      preferSimple: true,
      globalBounds: { left: 0, top: 0, width: 360, height: 220 },
    })

    expect(path[0].y).toBe(path[path.length - 1].y)
    expectOrthogonal(path)
  })

  it('keeps below-right flowchart routing inside the local corridor', () => {
    const path = routeOrthogonal({
      pointA: { shape: { left: 100, top: 100, width: 80, height: 40 }, side: 'bottom', distance: 0.5 },
      pointB: { shape: { left: 260, top: 240, width: 80, height: 40 }, side: 'left', distance: 0.5 },
      jettySize: 16,
      preferSimple: true,
      globalBounds: { left: 0, top: 0, width: 460, height: 380 },
    })

    expectOrthogonal(path)
    expect(Math.min(...path.map((point) => point.y))).toBeGreaterThanOrEqual(100)
    expect(Math.max(...path.map((point) => point.x))).toBeLessThanOrEqual(340)
  })

  it('scores local direct routing better than perimeter detours', () => {
    const localPath = [
      { x: 140, y: 140 },
      { x: 140, y: 180 },
      { x: 244, y: 180 },
      { x: 244, y: 260 },
      { x: 260, y: 260 },
    ]
    const detourPath = [
      { x: 140, y: 140 },
      { x: 140, y: 40 },
      { x: 360, y: 40 },
      { x: 360, y: 260 },
      { x: 260, y: 260 },
    ]

    expect(scorePath(detourPath, [])).toBeGreaterThan(scorePath(localPath, []))
  })

  it('normalizes any diagonal simple candidate into elbows', () => {
    const path = normalizeOrthogonalPath([
      { x: 10, y: 10 },
      { x: 60, y: 60 },
      { x: 100, y: 60 },
    ])

    expect(path).toEqual([
      { x: 10, y: 10 },
      { x: 10, y: 60 },
      { x: 100, y: 60 },
    ])
    expectOrthogonal(path)
  })

  it('falls back to multi-bend routing when the direct simple elbow is blocked', () => {
    const obstacle = { left: 145, top: 60, width: 40, height: 80 }
    const path = routeOrthogonal({
      pointA: { shape: { left: 40, top: 80, width: 60, height: 40 }, side: 'right', distance: 0.5 },
      pointB: { shape: { left: 240, top: 80, width: 60, height: 40 }, side: 'left', distance: 0.5 },
      jettySize: 16,
      preferSimple: true,
      obstacles: [obstacle],
      globalBounds: { left: 0, top: 0, width: 360, height: 220 },
    })

    expect(path.length).toBeGreaterThanOrEqual(2)
    expect(path[0]).toEqual({ x: 100, y: 100 })
    expect(path[path.length - 1]).toEqual({ x: 240, y: 100 })
    expectOrthogonal(path)
    expect(pathIntersectsRectangles(path, [obstacle], 2)).toBe(false)
  })

  it('returns_no_path_in_l_shape_only_mode_when_the_direct_elbow_is_blocked', () => {
    const path = routeOrthogonal({
      pointA: { shape: { left: 40, top: 80, width: 60, height: 40 }, side: 'right', distance: 0.5 },
      pointB: { shape: { left: 240, top: 80, width: 60, height: 40 }, side: 'left', distance: 0.5 },
      jettySize: 16,
      lShapeOnly: true,
      obstacles: [{ left: 145, top: 60, width: 40, height: 80 }],
      globalBounds: { left: 0, top: 0, width: 360, height: 220 },
    })

    expect(path).toEqual([])
  })

  it('keeps a Tidak decision loop-back orthogonal', () => {
    const path = routeOrthogonal({
      pointA: { shape: { left: 100, top: 220, width: 80, height: 80 }, side: 'right', distance: 0.5 },
      pointB: { shape: { left: 100, top: 40, width: 80, height: 80 }, side: 'right', distance: 0.5 },
      jettySize: 22,
      preferSimple: false,
      globalBounds: { left: 0, top: 0, width: 320, height: 360 },
    })

    expect(path[0]).toEqual({ x: 180, y: 260 })
    expect(path[path.length - 1]).toEqual({ x: 180, y: 80 })
    expectOrthogonal(path)
  })

  it('keeps OPC routing orthogonal', () => {
    const path = routeOrthogonal({
      pointA: { shape: { left: 100, top: 100, width: 80, height: 60 }, side: 'bottom', distance: 0.5 },
      pointB: { shape: { left: 100, top: 260, width: 80, height: 60 }, side: 'top', distance: 0.5 },
      jettySize: 18,
      preferSimple: true,
      globalBounds: { left: 0, top: 0, width: 360, height: 420 },
    })

    expectOrthogonal(path)
  })

  it('should_return_path_when_global_bounds_intersection_is_invalid', () => {
    const path = routeOrthogonal({
      pointA: { shape: { left: 100, top: 100, width: 80, height: 40 }, side: 'bottom', distance: 0.5 },
      pointB: { shape: { left: 260, top: 240, width: 80, height: 40 }, side: 'top', distance: 0.5 },
      jettySize: 16,
      preferSimple: true,
      globalBounds: { left: 500, top: 500, width: 10, height: 10 },
    })

    expect(path.length).toBeGreaterThanOrEqual(2)
    expectOrthogonal(path)
  })
})

describe('flowchart path safety', () => {
  it('detects occupied segment overlap and crossing', () => {
    const occupied = [{ x1: 20, y1: 40, x2: 120, y2: 40 }]

    expect(pathOverlapsSegments([
      { x: 10, y: 40 },
      { x: 80, y: 40 },
    ], occupied)).toBe(true)

    expect(pathOverlapsSegments([
      { x: 60, y: 10 },
      { x: 60, y: 80 },
    ], occupied, { includeCross: true })).toBe(true)
  })

  it('detects path intersection with shape rectangles using clearance', () => {
    expect(pathIntersectsRectangles([
      { x: 10, y: 50 },
      { x: 120, y: 50 },
    ], [{ left: 40, top: 30, width: 40, height: 40 }], 2)).toBe(true)
  })
})

describe('connector path normalization', () => {
  it('normalizes a manual diagonal path into elbows', () => {
    const path = normalizeConnectorPath([
      { x: 10, y: 10 },
      { x: 50, y: 50 },
      { x: 90, y: 50 },
    ], null)

    expect(path).toEqual([
      { x: 10, y: 10 },
      { x: 10, y: 50 },
      { x: 90, y: 50 },
    ])
    expectOrthogonal(path)
  })

  it('normalizes cached diagonal points before render', () => {
    const path = normalizeConnectorPath([
      { x: 120, y: 90 },
      { x: 180, y: 140 },
      { x: 220, y: 140 },
    ], {
      left: 80,
      top: 40,
      right: 260,
      bottom: 240,
    })

    expect(path[0]).toEqual({ x: 120, y: 90 })
    expect(path[path.length - 1]).toEqual({ x: 220, y: 140 })
    expectOrthogonal(path)
  })
})

describe('manual path override priority', () => {
  it('preserves stored bend points when normalizing manual orthogonal path', () => {
    const path = normalizeConnectorPath(
      [
        { x: 100, y: 200 },
        { x: 150, y: 300 },
        { x: 100, y: 400 },
      ],
      null,
    )
    expect(path.length).toBeGreaterThanOrEqual(3)
    expectOrthogonal(path)
    expect(path.some((p) => p.x === 150 && p.y === 300)).toBe(true)
  })
})

describe('connector emergency fallbacks', () => {
  it('builds a visible orthogonal fallback path for flowchart connector', () => {
    const path = buildUltimateOrthogonalFallback(
      rect(120, 80, 60, 40),
      rect(120, 220, 60, 40),
      { left: 80, top: 40, right: 260, bottom: 320 },
    )

    expect(path.length).toBeGreaterThanOrEqual(2)
    expectOrthogonal(path)
  })

  it('builds a visible orthogonal fallback path for bpmn connector', () => {
    const path = buildSideAnchoredFallbackPath(
      { left: 100, top: 80, width: 80, height: 40 },
      { left: 260, top: 220, width: 80, height: 40 },
      'right',
      'left',
      false,
      false,
    )

    expect(path.length).toBeGreaterThanOrEqual(2)
    expectOrthogonal(path)
  })
})

