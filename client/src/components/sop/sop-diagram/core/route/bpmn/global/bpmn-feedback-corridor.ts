import type { Point, Rect } from '../../shared/orthogonalRouter'
import type { BpmnLaneLayout, Side } from '../bpmnRouter'
import { bpmnLaneBoundaryTrackYs } from '../bpmn-lane-corridor.util'

export type BpmnFeedbackCorridorScope = 'internal' | 'outer'

export interface BpmnFeedbackCorridorCandidate {
  path: Point[]
  sSide: Side
  eSide: Side
  fromDistance: number
  toDistance: number
  scope: BpmnFeedbackCorridorScope
  corridor: 'top' | 'right' | 'bottom' | 'left' | 'lane-gap' | 'column-gap'
}

type BpmnPortDistances = Partial<Record<Side, number>>

interface FeedbackCorridorInput {
  fromShape: Rect
  toShape: Rect
  fromDistances: BpmnPortDistances
  toDistances: BpmnPortDistances
  fromIsDiamond: boolean
  toIsDiamond: boolean
  layout: BpmnLaneLayout
  trackOffset?: number
}

const TRACK_SHIFTS = [0, -4, 4]
const TRACK_INSET = 4

function distanceForSide(distances: BpmnPortDistances, side: Side): number {
  return distances[side] ?? 0.5
}

function edgePoint(shape: Rect, side: Side, distance: number, isDiamond: boolean): Point {
  const ratio = isDiamond ? 0.5 : distance
  switch (side) {
    case 'top':
      return { x: shape.left + shape.width * ratio, y: shape.top }
    case 'right':
      return { x: shape.left + shape.width, y: shape.top + shape.height * ratio }
    case 'bottom':
      return { x: shape.left + shape.width * ratio, y: shape.top + shape.height }
    case 'left':
      return { x: shape.left, y: shape.top + shape.height * ratio }
  }
}

function extrude(point: Point, side: Side, distance: number): Point {
  switch (side) {
    case 'top':
      return { x: point.x, y: point.y - distance }
    case 'right':
      return { x: point.x + distance, y: point.y }
    case 'bottom':
      return { x: point.x, y: point.y + distance }
    case 'left':
      return { x: point.x - distance, y: point.y }
  }
}

function laneBounds(layout: BpmnLaneLayout): { top: number; bottom: number } {
  if (layout.lanes.length === 0) return { top: 0, bottom: 0 }
  return {
    top: Math.min(...layout.lanes.map((lane) => lane.top)),
    bottom: Math.max(...layout.lanes.map((lane) => lane.top + lane.height)),
  }
}

function horizontalSideFacingTrack(shape: Rect, y: number): 'top' | 'bottom' | null {
  if (y <= shape.top) return 'top'
  if (y >= shape.top + shape.height) return 'bottom'
  return null
}

function verticalSideFacingTrack(shape: Rect, x: number): 'left' | 'right' | null {
  if (x <= shape.left) return 'left'
  if (x >= shape.left + shape.width) return 'right'
  return null
}

function shiftedGapTrack(start: number, end: number, trackOffset: number): number | null {
  const min = start + TRACK_INSET
  const max = end - TRACK_INSET
  if (min > max) return null
  const shift = TRACK_SHIFTS[trackOffset] ?? trackOffset * TRACK_INSET
  return Math.max(min, Math.min(max, (start + end) / 2 + shift))
}

function addHorizontalCandidate(input: {
  candidates: BpmnFeedbackCorridorCandidate[]
  fromShape: Rect
  toShape: Rect
  fromDistances: BpmnPortDistances
  toDistances: BpmnPortDistances
  fromIsDiamond: boolean
  toIsDiamond: boolean
  sSide: 'top' | 'bottom'
  eSide: 'top' | 'bottom'
  y: number
  jetty: number
  scope: BpmnFeedbackCorridorScope
  corridor: BpmnFeedbackCorridorCandidate['corridor']
}): void {
  const fromDistance = distanceForSide(input.fromDistances, input.sSide)
  const toDistance = distanceForSide(input.toDistances, input.eSide)
  const start = edgePoint(input.fromShape, input.sSide, fromDistance, input.fromIsDiamond)
  const end = edgePoint(input.toShape, input.eSide, toDistance, input.toIsDiamond)
  const extStart = extrude(start, input.sSide, input.jetty)
  const extEnd = extrude(end, input.eSide, input.jetty)
  input.candidates.push({
    sSide: input.sSide,
    eSide: input.eSide,
    fromDistance,
    toDistance,
    scope: input.scope,
    corridor: input.corridor,
    path: [start, extStart, { x: extStart.x, y: input.y }, { x: extEnd.x, y: input.y }, extEnd, end],
  })
}

function addVerticalCandidate(input: {
  candidates: BpmnFeedbackCorridorCandidate[]
  fromShape: Rect
  toShape: Rect
  fromDistances: BpmnPortDistances
  toDistances: BpmnPortDistances
  fromIsDiamond: boolean
  toIsDiamond: boolean
  sSide: 'left' | 'right'
  eSide: 'left' | 'right'
  x: number
  jetty: number
  scope: BpmnFeedbackCorridorScope
  corridor: BpmnFeedbackCorridorCandidate['corridor']
}): void {
  const fromDistance = distanceForSide(input.fromDistances, input.sSide)
  const toDistance = distanceForSide(input.toDistances, input.eSide)
  const start = edgePoint(input.fromShape, input.sSide, fromDistance, input.fromIsDiamond)
  const end = edgePoint(input.toShape, input.eSide, toDistance, input.toIsDiamond)
  const extStart = extrude(start, input.sSide, input.jetty)
  const extEnd = extrude(end, input.eSide, input.jetty)
  input.candidates.push({
    sSide: input.sSide,
    eSide: input.eSide,
    fromDistance,
    toDistance,
    scope: input.scope,
    corridor: input.corridor,
    path: [start, extStart, { x: input.x, y: extStart.y }, { x: input.x, y: extEnd.y }, extEnd, end],
  })
}

export function buildInternalFeedbackCorridorCandidates(
  input: FeedbackCorridorInput,
): BpmnFeedbackCorridorCandidate[] {
  const {
    fromShape,
    toShape,
    fromDistances,
    toDistances,
    fromIsDiamond,
    toIsDiamond,
    layout,
    trackOffset = 0,
  } = input
  const candidates: BpmnFeedbackCorridorCandidate[] = []
  const jetty = 20 + trackOffset * 4
  const lanes = [...layout.lanes].sort((left, right) => left.top - right.top)

  for (let index = 0; index < lanes.length - 1; index += 1) {
    const current = lanes[index]!
    const next = lanes[index + 1]!
    for (const y of bpmnLaneBoundaryTrackYs(current, next, trackOffset)) {
      const sSide = horizontalSideFacingTrack(fromShape, y)
      const eSide = horizontalSideFacingTrack(toShape, y)
      if (!sSide || !eSide) continue
      addHorizontalCandidate({
        candidates,
        fromShape,
        toShape,
        fromDistances,
        toDistances,
        fromIsDiamond,
        toIsDiamond,
        sSide,
        eSide,
        y,
        jetty,
        scope: 'internal',
        corridor: 'lane-gap',
      })
    }
  }

  for (let index = 0; index < layout.columnStartXs.length - 1; index += 1) {
    const columnEnd = layout.columnStartXs[index]! + layout.columnWidths[index]!
    const nextColumnStart = layout.columnStartXs[index + 1]!
    const x = shiftedGapTrack(columnEnd, nextColumnStart, trackOffset)
    if (x == null) continue
    const sSide = verticalSideFacingTrack(fromShape, x)
    const eSide = verticalSideFacingTrack(toShape, x)
    if (!sSide || !eSide) continue
    addVerticalCandidate({
      candidates,
      fromShape,
      toShape,
      fromDistances,
      toDistances,
      fromIsDiamond,
      toIsDiamond,
      sSide,
      eSide,
      x,
      jetty,
      scope: 'internal',
      corridor: 'column-gap',
    })
  }

  return candidates
}

export function buildFeedbackCorridorCandidates(
  input: FeedbackCorridorInput & { bounds: Rect },
): BpmnFeedbackCorridorCandidate[] {
  const {
    fromShape,
    toShape,
    fromDistances,
    toDistances,
    fromIsDiamond,
    toIsDiamond,
    layout,
    bounds,
    trackOffset = 0,
  } = input
  const lanes = laneBounds(layout)
  const jetty = 24 + trackOffset * 12
  const top = Math.max(bounds.top + TRACK_INSET, lanes.top - jetty)
  const bottom = Math.min(bounds.top + bounds.height - TRACK_INSET, lanes.bottom + jetty)
  const left = bounds.left + TRACK_INSET
  const right = bounds.left + bounds.width - TRACK_INSET
  const candidates: BpmnFeedbackCorridorCandidate[] = []
  const common = {
    candidates,
    fromShape,
    toShape,
    fromDistances,
    toDistances,
    fromIsDiamond,
    toIsDiamond,
    jetty,
    scope: 'outer' as const,
  }

  addHorizontalCandidate({ ...common, sSide: 'bottom', eSide: 'bottom', y: bottom, corridor: 'bottom' })
  addHorizontalCandidate({ ...common, sSide: 'top', eSide: 'top', y: top, corridor: 'top' })
  addVerticalCandidate({ ...common, sSide: 'right', eSide: 'right', x: right, corridor: 'right' })
  addVerticalCandidate({ ...common, sSide: 'left', eSide: 'left', x: left, corridor: 'left' })
  return candidates
}
