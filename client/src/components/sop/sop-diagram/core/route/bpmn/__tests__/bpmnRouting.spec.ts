import { describe, expect, it } from 'vitest'
import {
  bpmnPathHitsObstacle,
  routeBpmn,
  routeBpmnAllowOccupiedFallback,
  scoreBpmnPath,
  scoreBpmnRouteCandidate,
  selectBpmnSidePairs,
  type BpmnConnectionMeta,
  type BpmnLaneLayout,
  type UsedSides,
} from '../bpmnRouter'

function layout(): BpmnLaneLayout {
  return {
    lanes: [
      { index: 0, top: 40, height: 140 },
      { index: 1, top: 220, height: 140 },
      { index: 2, top: 400, height: 140 },
    ],
    columnStartXs: [80, 280, 480],
    columnWidths: [120, 120, 120],
  }
}

function rect(left: number, top: number, width = 80, height = 60) {
  return { left, top, width, height }
}

function conn(overrides: Partial<BpmnConnectionMeta> = {}): BpmnConnectionMeta {
  return {
    id: 'c1',
    from: 'a',
    to: 'b',
    fromLane: 0,
    toLane: 0,
    fromCol: 0,
    toCol: 1,
    sourceType: 'flowchart-process',
    targetType: 'flowchart-process',
    label: null,
    ...overrides,
  }
}

function expectOrthogonal(path: { x: number; y: number }[]) {
  expect(path.length).toBeGreaterThanOrEqual(2)
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    expect(a.x === b.x || a.y === b.y).toBe(true)
  }
}

describe('selectBpmnSidePairs', () => {
  it('prefers simple right-to-left on same-lane forward routing', () => {
    const candidates = selectBpmnSidePairs(
      conn(),
      rect(80, 80),
      rect(280, 80),
      {} as UsedSides,
    )

    expect(candidates[0]).toMatchObject({
      sSide: 'right',
      eSide: 'left',
      preferSimple: true,
    })
    expect(scoreBpmnRouteCandidate(candidates[0]!)).toBe(0)
  })

  it('prefers top loop-back for Tidak branch', () => {
    const candidates = selectBpmnSidePairs(
      conn({
        sourceType: 'flowchart-decision',
        label: 'Tidak',
        fromLane: 1,
        toLane: 0,
        fromCol: 1,
        toCol: 1,
      }),
      rect(280, 260, 80, 80),
      rect(280, 80),
      {} as UsedSides,
    )

    expect(candidates[0]).toMatchObject({
      sSide: 'right',
      eSide: 'right',
      preferSimple: false,
    })
    expect(candidates[0]!.sourceJettySize).toBeGreaterThan(20)
  })

  it('keeps Ya branch orthogonal without using a forbidden vertical-through-diamond pair', () => {
    const candidates = selectBpmnSidePairs(
      conn({
        sourceType: 'flowchart-decision',
        label: 'Ya',
        fromLane: 0,
        toLane: 1,
        fromCol: 1,
        toCol: 1,
      }),
      rect(280, 80, 80, 80),
      rect(280, 260),
      {} as UsedSides,
    )

    expect(candidates.some((candidate) => (
      candidate.sSide === 'bottom' && candidate.eSide === 'top'
    ))).toBe(false)
    expect(candidates.some((candidate) => (
      candidate.sSide === 'right' && candidate.eSide === 'left'
    ))).toBe(true)
  })
})

describe('routeBpmn', () => {
  it('keeps same-lane forward routes horizontal-first', () => {
    const path = routeBpmn({
      fromShape: rect(80, 80),
      toShape: rect(280, 80),
      fromSide: 'right',
      toSide: 'left',
      fromDistance: 0.5,
      toDistance: 0.5,
      layout: layout(),
      fromLane: 0,
      toLane: 0,
      fromCol: 0,
      toCol: 1,
      obstacles: [],
      occupiedSegments: [],
      globalBounds: { left: 0, top: 0, width: 800, height: 700 },
    })

    expect(path[0]).toEqual({ x: 160, y: 110 })
    expect(path[path.length - 1]).toEqual({ x: 280, y: 110 })
    expect(path.every((p) => p.y === 110)).toBe(true)
    expectOrthogonal(path)
  })

  it('uses lane-pipe routing for cross-lane same-column paths', () => {
    const path = routeBpmn({
      fromShape: rect(280, 80),
      toShape: rect(280, 260),
      fromSide: 'bottom',
      toSide: 'top',
      fromDistance: 0.5,
      toDistance: 0.5,
      layout: layout(),
      fromLane: 0,
      toLane: 1,
      fromCol: 1,
      toCol: 1,
      obstacles: [],
      occupiedSegments: [],
      globalBounds: { left: 0, top: 0, width: 800, height: 700 },
      sourceJettySize: 18,
      targetJettySize: 18,
    })

    expect(path).toEqual([
      { x: 320, y: 140 },
      { x: 320, y: 158 },
      { x: 320, y: 242 },
      { x: 320, y: 260 },
    ])
    expectOrthogonal(path)
  })

  it('respects custom jetty sizes for cross-lane vertical routing', () => {
    const path = routeBpmn({
      fromShape: rect(280, 80),
      toShape: rect(280, 260),
      fromSide: 'bottom',
      toSide: 'top',
      fromDistance: 0.5,
      toDistance: 0.5,
      layout: layout(),
      fromLane: 0,
      toLane: 1,
      fromCol: 1,
      toCol: 1,
      obstacles: [],
      occupiedSegments: [],
      globalBounds: { left: 0, top: 0, width: 800, height: 700 },
      sourceJettySize: 30,
      targetJettySize: 26,
    })

    expect(path[1]).toEqual({ x: 320, y: 170 })
    expect(path[path.length - 2]).toEqual({ x: 320, y: 234 })
    expectOrthogonal(path)
  })

  it('rejects paths that run along a BPMN grid line', () => {
    const path = routeBpmn({
      fromShape: rect(80, 10),
      toShape: rect(280, 10),
      fromSide: 'right',
      toSide: 'left',
      fromDistance: 0.5,
      toDistance: 0.5,
      layout: layout(),
      fromLane: 0,
      toLane: 0,
      fromCol: 0,
      toCol: 1,
      obstacles: [],
      occupiedSegments: [],
      globalBounds: { left: 0, top: 0, width: 800, height: 700 },
    })

    expect(path).toEqual([])
  })

  it('relaxes occupied tracks as a last resort instead of dropping the edge', () => {
    const result = routeBpmnAllowOccupiedFallback({
      fromShape: rect(80, 80),
      toShape: rect(280, 80),
      fromSide: 'right',
      toSide: 'left',
      fromDistance: 0.5,
      toDistance: 0.5,
      layout: {
        lanes: [{ index: 0, top: 40, height: 140 }],
        columnStartXs: [80, 280],
        columnWidths: [120, 120],
      },
      fromLane: 0,
      toLane: 0,
      fromCol: 0,
      toCol: 1,
      obstacles: [],
      occupiedSegments: [
        { x1: 160, y1: 110, x2: 280, y2: 110 },
        { x1: 160, y1: -32, x2: 280, y2: -32 },
        { x1: 160, y1: 252, x2: 280, y2: 252 },
      ],
      globalBounds: { left: 0, top: 0, width: 800, height: 700 },
    })

    expect(result.usedOccupiedFallback).toBe(true)
    expect(result.path.length).toBeGreaterThanOrEqual(2)
    expectOrthogonal(result.path)
  })

  it('keeps a short local path when auto-layout allows a scored crossing', () => {
    const path = routeBpmn({
      fromShape: rect(80, 80),
      toShape: rect(280, 80),
      fromSide: 'right',
      toSide: 'left',
      fromDistance: 0.5,
      toDistance: 0.5,
      layout: layout(),
      fromLane: 0,
      toLane: 0,
      fromCol: 0,
      toCol: 1,
      obstacles: [],
      occupiedSegments: [{ x1: 220, y1: 40, x2: 220, y2: 180 }],
      globalBounds: { left: 0, top: 0, width: 800, height: 700 },
      allowCrossings: true,
    })

    expect(path.every((point) => point.y === 110)).toBe(true)
    expectOrthogonal(path)
  })
})

describe('scoreBpmnPath', () => {
  it('prefers one local crossing over a large remote detour', () => {
    const occupied = [{ x1: 220, y1: 40, x2: 220, y2: 180 }]
    const local = [
      { x: 160, y: 110 },
      { x: 280, y: 110 },
    ]
    const remote = [
      { x: 160, y: 110 },
      { x: 160, y: -120 },
      { x: 280, y: -120 },
      { x: 280, y: 110 },
    ]

    expect(scoreBpmnPath(local, occupied)).toBeLessThan(
      scoreBpmnPath(remote, occupied),
    )
  })
})

describe('bpmnPathHitsObstacle', () => {
  it('rejects paths that go through another BPMN shape', () => {
    const hit = bpmnPathHitsObstacle(
      [
        { x: 160, y: 110 },
        { x: 320, y: 110 },
      ],
      [rect(200, 80, 80, 60)],
      rect(80, 80),
      rect(320, 80),
    )

    expect(hit).toBe(true)
  })

  it('routes cross-lane vertical paths through column-pipe when a same-column obstacle blocks the lane', () => {
    const blocker = rect(260, 180, 120, 60)
    const path = routeBpmn({
      fromShape: rect(280, 80),
      toShape: rect(280, 400),
      fromSide: 'bottom',
      toSide: 'top',
      fromDistance: 0.5,
      toDistance: 0.5,
      layout: layout(),
      fromLane: 0,
      toLane: 2,
      fromCol: 1,
      toCol: 1,
      obstacles: [blocker],
      occupiedSegments: [],
      globalBounds: { left: 0, top: 0, width: 800, height: 700 },
      sourceJettySize: 18,
      targetJettySize: 18,
    })

    expect(path.length).toBeGreaterThanOrEqual(2)
    expectOrthogonal(path)
    expect(bpmnPathHitsObstacle(path, [blocker], rect(280, 80), rect(280, 400))).toBe(false)
    const verticalXs = new Set<number>()
    for (let i = 0; i < path.length - 1; i += 1) {
      const a = path[i]!
      const b = path[i + 1]!
      if (a.x === b.x) verticalXs.add(a.x)
    }
    expect(verticalXs.size).toBeGreaterThan(0)
    expect([...verticalXs].some((x) => x < blocker.left || x > blocker.left + blocker.width)).toBe(true)
  })

  it('still treats a diamond-edge path inside the source obstacle margin as a hit', () => {
    const hit = bpmnPathHitsObstacle(
      [
        { x: 320, y: 80 },
        { x: 320, y: 62 },
        { x: 360, y: 62 },
      ],
      [rect(280, 80, 80, 80)],
      rect(280, 80, 80, 80),
      rect(360, 40, 80, 60),
    )

    expect(hit).toBe(true)
  })
})
