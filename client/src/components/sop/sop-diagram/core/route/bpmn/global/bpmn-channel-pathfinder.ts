import {
  normalizeOrthogonalPath,
  pathIntersectsRectangles,
  segmentsCross,
  segmentsNearby,
  segmentsOverlap,
  type OccupiedSegment,
  type Point,
  type Rect,
} from '../../shared/orthogonalRouter'
import type { BpmnLaneLayout, Side } from '../bpmnRouter'
import { bpmnLaneBoundaryTrackYs } from '../bpmn-lane-corridor.util'

const CORRIDOR_CLEARANCE = 8
const JETTY_SIZE = 24
const BEND_PENALTY = 280
const OVERLAP_PENALTY = 100_000
const CROSSING_PENALTY = 2_500
const NEARBY_PENALTY = 180

type Direction = 'none' | 'horizontal' | 'vertical'

interface SearchState {
  pointKey: string
  direction: Direction
}

interface HeapEntry extends SearchState {
  score: number
}

interface GraphEdge {
  to: Point
  direction: Exclude<Direction, 'none'>
  segment: OccupiedSegment
  length: number
}

class MinHeap {
  private readonly entries: HeapEntry[] = []

  get size(): number {
    return this.entries.length
  }

  push(entry: HeapEntry): void {
    this.entries.push(entry)
    let index = this.entries.length - 1
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2)
      if (this.entries[parent]!.score <= entry.score) break
      this.entries[index] = this.entries[parent]!
      index = parent
    }
    this.entries[index] = entry
  }

  pop(): HeapEntry | null {
    const first = this.entries[0]
    const last = this.entries.pop()
    if (!first || !last) return first ?? null
    if (this.entries.length === 0) return first

    let index = 0
    while (true) {
      const left = index * 2 + 1
      const right = left + 1
      if (left >= this.entries.length) break
      const next =
        right < this.entries.length && this.entries[right]!.score < this.entries[left]!.score
          ? right
          : left
      if (this.entries[next]!.score >= last.score) break
      this.entries[index] = this.entries[next]!
      index = next
    }
    this.entries[index] = last
    return first
  }
}

function pointKey(point: Point): string {
  return `${point.x}|${point.y}`
}

function stateKey(state: SearchState): string {
  return `${state.pointKey}|${state.direction}`
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

function insideBounds(value: number, min: number, max: number): boolean {
  return value >= min && value <= max
}

function pointInsideRect(point: Point, rect: Rect): boolean {
  return (
    point.x > rect.left &&
    point.x < rect.left + rect.width &&
    point.y > rect.top &&
    point.y < rect.top + rect.height
  )
}

function addCoordinate(values: Set<number>, value: number, min: number, max: number): void {
  const rounded = Math.round(value)
  if (insideBounds(rounded, min, max)) values.add(rounded)
}

function buildCoordinates(input: {
  start: Point
  end: Point
  layout: BpmnLaneLayout
  bounds: Rect
  obstacles: Rect[]
}): { xs: number[]; ys: number[] } {
  const { start, end, layout, bounds, obstacles } = input
  const minX = Math.round(bounds.left + 4)
  const maxX = Math.round(bounds.left + bounds.width - 4)
  const minY = Math.round(bounds.top + 4)
  const maxY = Math.round(bounds.top + bounds.height - 4)
  const xs = new Set<number>()
  const ys = new Set<number>()
  addCoordinate(xs, start.x, minX, maxX)
  addCoordinate(xs, end.x, minX, maxX)
  addCoordinate(xs, minX, minX, maxX)
  addCoordinate(xs, maxX, minX, maxX)
  addCoordinate(ys, start.y, minY, maxY)
  addCoordinate(ys, end.y, minY, maxY)
  addCoordinate(ys, minY, minY, maxY)
  addCoordinate(ys, maxY, minY, maxY)

  for (let index = 0; index < layout.columnStartXs.length - 1; index += 1) {
    const left = layout.columnStartXs[index]! + (layout.columnWidths[index] ?? 0)
    const right = layout.columnStartXs[index + 1]!
    addCoordinate(xs, (left + right) / 2, minX, maxX)
  }
  for (let index = 0; index < layout.lanes.length - 1; index += 1) {
    for (const y of bpmnLaneBoundaryTrackYs(layout.lanes[index]!, layout.lanes[index + 1]!)) {
      addCoordinate(ys, y, minY, maxY)
    }
  }
  if (layout.lanes.length > 0) {
    const top = Math.min(...layout.lanes.map((lane) => lane.top))
    const bottom = Math.max(...layout.lanes.map((lane) => lane.top + lane.height))
    addCoordinate(ys, top - JETTY_SIZE, minY, maxY)
    addCoordinate(ys, bottom + JETTY_SIZE, minY, maxY)
  }

  for (const obstacle of obstacles) {
    addCoordinate(xs, obstacle.left - CORRIDOR_CLEARANCE, minX, maxX)
    addCoordinate(xs, obstacle.left + obstacle.width + CORRIDOR_CLEARANCE, minX, maxX)
    addCoordinate(ys, obstacle.top - CORRIDOR_CLEARANCE, minY, maxY)
    addCoordinate(ys, obstacle.top + obstacle.height + CORRIDOR_CLEARANCE, minY, maxY)
  }
  return {
    xs: [...xs].sort((left, right) => left - right),
    ys: [...ys].sort((left, right) => left - right),
  }
}

function segmentPenalty(segment: OccupiedSegment, occupied: OccupiedSegment[]): number {
  let score = 0
  for (const other of occupied) {
    if (segmentsOverlap(segment, other)) score += OVERLAP_PENALTY
    else if (segmentsCross(segment, other)) score += CROSSING_PENALTY
    else if (segmentsNearby(segment, other, 12)) score += NEARBY_PENALTY
  }
  return score
}

function buildAdjacency(input: {
  xs: number[]
  ys: number[]
  obstacles: Rect[]
}): { points: Map<string, Point>; adjacency: Map<string, GraphEdge[]> } {
  const { xs, ys, obstacles } = input
  const points = new Map<string, Point>()
  const adjacency = new Map<string, GraphEdge[]>()
  for (const x of xs) {
    for (const y of ys) {
      const point = { x, y }
      if (!obstacles.some((obstacle) => pointInsideRect(point, obstacle))) {
        points.set(pointKey(point), point)
      }
    }
  }

  const connect = (from: Point, to: Point) => {
    if (pathIntersectsRectangles([from, to], obstacles)) return
    const segment = { x1: from.x, y1: from.y, x2: to.x, y2: to.y }
    const direction = from.y === to.y ? 'horizontal' : 'vertical'
    const length = Math.abs(to.x - from.x) + Math.abs(to.y - from.y)
    const entries = adjacency.get(pointKey(from)) ?? []
    entries.push({ to, direction, segment, length })
    adjacency.set(pointKey(from), entries)
  }

  for (const x of xs) {
    const column = ys
      .map((y) => points.get(pointKey({ x, y })))
      .filter((point): point is Point => point != null)
    for (let index = 0; index < column.length - 1; index += 1) {
      connect(column[index]!, column[index + 1]!)
      connect(column[index + 1]!, column[index]!)
    }
  }
  for (const y of ys) {
    const row = xs
      .map((x) => points.get(pointKey({ x, y })))
      .filter((point): point is Point => point != null)
    for (let index = 0; index < row.length - 1; index += 1) {
      connect(row[index]!, row[index + 1]!)
      connect(row[index + 1]!, row[index]!)
    }
  }
  return { points, adjacency }
}

function reconstructPath(
  finalState: SearchState,
  previous: Map<string, SearchState>,
  points: Map<string, Point>,
): Point[] {
  const reversed: Point[] = []
  let current: SearchState | undefined = finalState
  while (current) {
    const point = points.get(current.pointKey)
    if (point) reversed.push(point)
    current = previous.get(stateKey(current))
  }
  return reversed.reverse()
}

function findChannelPath(input: {
  start: Point
  end: Point
  xs: number[]
  ys: number[]
  obstacles: Rect[]
  occupied: OccupiedSegment[]
}): Point[] {
  const { start, end, xs, ys, obstacles, occupied } = input
  const { points, adjacency } = buildAdjacency({ xs, ys, obstacles })
  const startPointKey = pointKey(start)
  const endPointKey = pointKey(end)
  if (!points.has(startPointKey) || !points.has(endPointKey)) return []

  const startState: SearchState = { pointKey: startPointKey, direction: 'none' }
  const scores = new Map<string, number>([[stateKey(startState), 0]])
  const previous = new Map<string, SearchState>()
  const heap = new MinHeap()
  heap.push({ ...startState, score: 0 })

  while (heap.size > 0) {
    const current = heap.pop()!
    if (current.score !== scores.get(stateKey(current))) continue
    if (current.pointKey === endPointKey) {
      return reconstructPath(current, previous, points)
    }
    for (const edge of adjacency.get(current.pointKey) ?? []) {
      const next: SearchState = { pointKey: pointKey(edge.to), direction: edge.direction }
      const bend = current.direction !== 'none' && current.direction !== edge.direction
      const nextScore =
        current.score +
        edge.length +
        (bend ? BEND_PENALTY : 0) +
        segmentPenalty(edge.segment, occupied)
      if (nextScore >= (scores.get(stateKey(next)) ?? Infinity)) continue
      scores.set(stateKey(next), nextScore)
      previous.set(stateKey(next), current)
      heap.push({ ...next, score: nextScore })
    }
  }
  return []
}

export function routeBpmnOnChannelGraph(input: {
  fromShape: Rect
  toShape: Rect
  fromSide: Side
  toSide: Side
  fromDistance: number
  toDistance: number
  fromIsDiamond?: boolean
  toIsDiamond?: boolean
  layout: BpmnLaneLayout
  bounds: Rect
  obstacles: Rect[]
  occupied: OccupiedSegment[]
  sourceJettySize?: number
  targetJettySize?: number
}): Point[] {
  const {
    fromShape,
    toShape,
    fromSide,
    toSide,
    fromDistance,
    toDistance,
    fromIsDiamond = false,
    toIsDiamond = false,
    layout,
    bounds,
    obstacles,
    occupied,
    sourceJettySize = JETTY_SIZE,
    targetJettySize = JETTY_SIZE,
  } = input
  const start = edgePoint(fromShape, fromSide, fromDistance, fromIsDiamond)
  const end = edgePoint(toShape, toSide, toDistance, toIsDiamond)
  const extStart = extrude(start, fromSide, sourceJettySize)
  const extEnd = extrude(end, toSide, targetJettySize)
  const coordinates = buildCoordinates({
    start: extStart,
    end: extEnd,
    layout,
    bounds,
    obstacles,
  })
  const channel = findChannelPath({
    start: extStart,
    end: extEnd,
    ...coordinates,
    obstacles,
    occupied,
  })
  if (channel.length < 2) return []
  return normalizeOrthogonalPath([start, ...channel, end])
}
