import {
  pathIntersectsRectangles,
  pathOverlapsSegments,
  segmentsCross,
  segmentsOverlap,
  type OccupiedSegment,
  type Point,
  type Rect,
} from '../shared/orthogonalRouter'
import { pathCrossesShapeBodies } from '../shared/shape-body-path.util'
import { bpmnPathHitsObstacle } from '../bpmn/bpmnRouter'

export interface PathQualityOptions {
  obstacles: Rect[]
  occupied: OccupiedSegment[]
  fromShape?: Rect
  toShape?: Rect
  clearancePx?: number
  /** Flowchart: cek segmen memotong interior shape. */
  checkShapeBodies?: boolean
  kind?: PathSafetyKind
  /** BPMN auto-layout may score a crossing instead of rejecting it outright. */
  allowCrossings?: boolean
}

export type PathSafetyKind = 'flowchart' | 'bpmn'

export function createPathSafetyOptions(
  kind: PathSafetyKind,
  opts: Omit<PathQualityOptions, 'clearancePx' | 'checkShapeBodies' | 'kind'> & Partial<Pick<PathQualityOptions, 'clearancePx'>>,
): PathQualityOptions {
  return {
    ...opts,
    kind,
    clearancePx: opts.clearancePx ?? (kind === 'flowchart' ? 2 : 3),
    checkShapeBodies: true,
  }
}

export interface PathQualityViolations {
  overlaps: number
  crosses: number
  obstacleHits: number
  shapeBodyHits: number
}

function manhattanDistance(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

function distanceOutsideRange(value: number, a: number, b: number): number {
  const min = Math.min(a, b)
  const max = Math.max(a, b)
  if (value < min) return min - value
  if (value > max) return value - max
  return 0
}

function direction(a: Point, b: Point): 0 | 1 | -1 {
  if (a.y === b.y && a.x !== b.x) return 1
  if (a.x === b.x && a.y !== b.y) return -1
  return 0
}

function pathComplexityScore(path: Point[]): number {
  if (path.length < 2) return 0
  const start = path[0]!
  const end = path[path.length - 1]!
  const directDx = end.x - start.x
  const directDy = end.y - start.y
  let score = Math.max(0, path.length - 2) * 180
  let previousDirection: 0 | 1 | -1 = 0

  for (let i = 0; i < path.length - 1; i += 1) {
    const from = path[i]!
    const to = path[i + 1]!
    const segmentDirection = direction(from, to)
    const segmentLength = manhattanDistance(from, to)
    if (segmentDirection !== 0 && previousDirection !== 0 && segmentDirection !== previousDirection) {
      score += 360
    }
    if (segmentDirection !== 0) previousDirection = segmentDirection

    if (segmentLength > 0) {
      if (to.x !== from.x && directDx !== 0 && Math.sign(to.x - from.x) !== Math.sign(directDx)) {
        score += segmentLength * 2
      }
      if (to.y !== from.y && directDy !== 0 && Math.sign(to.y - from.y) !== Math.sign(directDy)) {
        score += segmentLength * 2
      }
    }
    score += (
      distanceOutsideRange(to.x, start.x, end.x) +
      distanceOutsideRange(to.y, start.y, end.y)
    ) * 2
  }

  return score
}

function countSegmentViolations(
  path: Point[],
  occupied: OccupiedSegment[],
): { overlaps: number; crosses: number } {
  if (path.length < 2) return { overlaps: 0, crosses: 0 }
  let overlaps = 0
  let crosses = 0
  for (let i = 0; i < path.length - 1; i++) {
    const seg = {
      x1: path[i]!.x,
      y1: path[i]!.y,
      x2: path[i + 1]!.x,
      y2: path[i + 1]!.y,
    }
    for (const occ of occupied) {
      if (segmentsOverlap(seg, occ)) overlaps += 1
      else if (segmentsCross(seg, occ)) crosses += 1
    }
  }
  return { overlaps, crosses }
}

export function countPathQualityViolations(
  path: Point[],
  opts: PathQualityOptions,
): PathQualityViolations {
  const clearance = opts.clearancePx ?? 2
  const overlapsCross = countSegmentViolations(path, opts.occupied)
  const obstacleHits = pathIntersectsRectangles(path, opts.obstacles, clearance) ? 1 : 0
  let shapeBodyHits = 0
  if (opts.checkShapeBodies && opts.fromShape && opts.toShape) {
    const blocksShapes = opts.kind === 'bpmn'
      ? bpmnPathHitsObstacle(path, opts.obstacles, opts.fromShape, opts.toShape)
      : pathCrossesShapeBodies(path, opts.fromShape, opts.toShape, opts.obstacles, clearance)
    if (blocksShapes) shapeBodyHits = 1
  }
  return {
    overlaps: overlapsCross.overlaps,
    crosses: overlapsCross.crosses,
    obstacleHits,
    shapeBodyHits,
  }
}

export function isAcceptableRoutedPath(path: Point[], opts: PathQualityOptions): boolean {
  if (path.length < 2) return false
  const clearance = opts.clearancePx ?? 2
  if (pathIntersectsRectangles(path, opts.obstacles, clearance)) return false
  const rejectCrossings = opts.kind === 'bpmn' && !opts.allowCrossings
  if (pathOverlapsSegments(path, opts.occupied, { includeCross: rejectCrossings })) return false
  if (opts.checkShapeBodies && opts.fromShape && opts.toShape) {
    if (opts.kind === 'bpmn') {
      if (bpmnPathHitsObstacle(path, opts.obstacles, opts.fromShape, opts.toShape)) return false
    } else if (pathCrossesShapeBodies(path, opts.fromShape, opts.toShape, opts.obstacles, clearance)) {
      return false
    }
  }
  return true
}

export function pathQualityScore(path: Point[], opts: PathQualityOptions): number {
  const v = countPathQualityViolations(path, opts)
  return (
    v.obstacleHits * 50_000 +
    v.shapeBodyHits * 40_000 +
    v.overlaps * 8_000 +
    v.crosses * 12_000 +
    pathComplexityScore(path)
  )
}
