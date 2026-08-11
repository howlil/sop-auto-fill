import type { Point } from '@/components/sop/sop-diagram/core/route/shared/orthogonalRouter'
import { normalizeOrthogonalPath } from '@/components/sop/sop-diagram/core/route/shared/orthogonal-path-normalization.util'

export {
  simplifyOrthogonalPath,
} from '@/components/sop/sop-diagram/core/route/shared/orthogonal-path-normalization.util'
export type {
  PathObstacleCheck,
} from '@/components/sop/sop-diagram/core/route/shared/orthogonal-path-normalization.util'

const GRID_SNAP = 4

export function snapToGrid(value: number, grid = GRID_SNAP): number {
  return Math.round(value / grid) * grid
}

export function pathToD(points: Point[]): string {
  if (points.length === 0) return ''
  const [first, ...rest] = points
  return `M ${first.x} ${first.y}${rest.map((p) => ` L ${p.x} ${p.y}`).join('')}`
}

/** Sisipkan waypoint di tengah segment terdekat (index segment = titik awal segment). */
export function insertWaypointAtSegmentMidpoint(path: Point[], segmentIndex: number): Point[] {
  if (path.length < 2 || segmentIndex < 0 || segmentIndex >= path.length - 1) return path
  const a = path[segmentIndex]!
  const b = path[segmentIndex + 1]!
  const mid: Point = {
    x: snapToGrid((a.x + b.x) / 2),
    y: snapToGrid((a.y + b.y) / 2),
  }
  const next = [...path]
  next.splice(segmentIndex + 1, 0, mid)
  return normalizeOrthogonalPath(next)
}

export function removeWaypoint(path: Point[], index: number): Point[] {
  if (path.length <= 2 || index <= 0 || index >= path.length - 1) return path
  const next = path.filter((_, i) => i !== index)
  return normalizeOrthogonalPath(next)
}

export function clientToSvgPoint(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): Point | null {
  const ctm = svg.getScreenCTM()
  if (!ctm) return null
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const mapped = pt.matrixTransform(ctm.inverse())
  return { x: mapped.x, y: mapped.y }
}

function applyWaypointDragDelta(
  path: Point[],
  index: number,
  dx: number,
  dy: number,
): Point[] {
  if (index < 0 || index >= path.length) return path
  const next = path.map((p) => ({ ...p }))
  const prev = next[index - 1]
  const nextPt = next[index + 1]
  let nx = next[index]!.x + dx
  let ny = next[index]!.y + dy
  if (prev && nextPt) {
    const vertPrev = Math.abs(prev.x - next[index]!.x) < 1
    const vertNext = Math.abs(nextPt.x - next[index]!.x) < 1
    const horizPrev = Math.abs(prev.y - next[index]!.y) < 1
    const horizNext = Math.abs(nextPt.y - next[index]!.y) < 1
    if (vertPrev && vertNext) {
      // Both neighbors are on a vertical line — only allow vertical movement
      nx = prev.x
      ny = snapToGrid(ny)
    } else if (horizPrev && horizNext) {
      // Both neighbors are on a horizontal line — only allow horizontal movement
      nx = snapToGrid(nx)
      ny = next[index]!.y
    } else if ((horizPrev && vertNext) || (vertPrev && horizNext)) {
      // Corner waypoint: one horizontal segment, one vertical segment.
      // Allow movement along the dominant drag direction and adjust the
      // appropriate neighbor axis to keep the path orthogonal.
      if (Math.abs(dx) >= Math.abs(dy)) {
        nx = snapToGrid(nx)
        ny = next[index]!.y
        if (vertPrev && prev) prev.x = nx
        if (vertNext && nextPt) nextPt.x = nx
      } else {
        ny = snapToGrid(ny)
        nx = next[index]!.x
        if (horizPrev && prev) prev.y = ny
        if (horizNext && nextPt) nextPt.y = ny
      }
    } else if (horizPrev || horizNext) {
      // One horizontal neighbor, other is diagonal/degenerate — allow horizontal movement
      nx = snapToGrid(nx)
      ny = next[index]!.y
    } else {
      // One or both vertical neighbors — allow vertical movement
      nx = next[index]!.x
      ny = snapToGrid(ny)
    }
  } else {
    nx = snapToGrid(nx)
    ny = snapToGrid(ny)
  }
  next[index] = { x: nx, y: ny }
  return next
}

/** Drag waypoint dari path asal + delta SVG (stabil, tanpa akumulasi error). */
export function dragWaypointFromOrigin(
  originPath: Point[],
  index: number,
  dx: number,
  dy: number,
  options?: { normalize?: boolean },
): Point[] {
  const moved = applyWaypointDragDelta(originPath, index, dx, dy)
  if (options?.normalize === false) return moved
  return normalizeOrthogonalPath(moved)
}

/** Geser satu segmen ortogonal (horizontal naik/turun, vertikal kiri/kanan) — mirip draw.io. */
export function dragSegmentFromOrigin(
  originPath: Point[],
  segmentIndex: number,
  dx: number,
  dy: number,
  options?: { normalize?: boolean },
): Point[] {
  if (segmentIndex < 0 || segmentIndex >= originPath.length - 1) return originPath
  const a = originPath[segmentIndex]!
  const b = originPath[segmentIndex + 1]!
  const isHorizontal = a.y === b.y && a.x !== b.x
  const isVertical = a.x === b.x && a.y !== b.y
  if (!isHorizontal && !isVertical) return originPath
  const next = originPath.map((p) => ({ ...p }))
  if (isHorizontal) {
    const newY = snapToGrid(a.y + dy)
    next[segmentIndex] = { x: a.x, y: newY }
    next[segmentIndex + 1] = { x: b.x, y: newY }
  } else {
    const newX = snapToGrid(a.x + dx)
    next[segmentIndex] = { x: newX, y: a.y }
    next[segmentIndex + 1] = { x: newX, y: b.y }
  }
  if (options?.normalize === false) return next
  return normalizeOrthogonalPath(next)
}

/** Drag waypoint dengan constraint axis-lock orthogonal. */
export function dragWaypointOrthogonal(
  path: Point[],
  index: number,
  dx: number,
  dy: number,
): Point[] {
  return dragWaypointFromOrigin(path, index, dx, dy, { normalize: true })
}

const STRAIGHT_EPS = 1
const PERPENDICULAR_DRAG_RATIO = 0.55
const FORK_MIN_DRAG_PX = GRID_SNAP * 2

export type PathEndpointKind = 'start' | 'end'

export function getDraggedEndpointKind(
  originPath: Point[],
  index: number,
): PathEndpointKind | null {
  if (index === 0) return 'start'
  return index === originPath.length - 1 ? 'end' : null
}

export function endpointIndexForKind(path: Point[], kind: PathEndpointKind): number {
  return kind === 'start' ? 0 : path.length - 1
}

export function alignEndpointSegmentPreservingEndpoint(
  path: Point[],
  index: number,
): Point[] {
  if (index !== 0 && index !== path.length - 1) return path
  const target = path[index]
  const neighborIndex = index === 0 ? 1 : path.length - 2
  const neighbor = path[neighborIndex]
  if (!target || !neighbor) return path
  const aligned = path.map((point) => ({ ...point }))
  if (target.x !== neighbor.x && target.y !== neighbor.y) {
    if (Math.abs(target.x - neighbor.x) <= Math.abs(target.y - neighbor.y)) {
      aligned[neighborIndex] = { ...neighbor, x: target.x }
    } else {
      aligned[neighborIndex] = { ...neighbor, y: target.y }
    }
  }
  return aligned
}

/** Path hanya start + end pada satu garis horizontal atau vertikal. */
export function isStraightTwoPointPath(path: Point[]): boolean {
  if (path.length !== 2) return false
  const a = path[0]!
  const b = path[1]!
  return (
    Math.abs(a.y - b.y) <= STRAIGHT_EPS || Math.abs(a.x - b.x) <= STRAIGHT_EPS
  )
}

/** Drag endpoint cukup tegak lurus terhadap segmen lurus agar membentuk siku. */
export function isPerpendicularEndpointDrag(
  path: Point[],
  dx: number,
  dy: number,
): boolean {
  if (!isStraightTwoPointPath(path)) return false
  const a = path[0]!
  const b = path[1]!
  const horizontal = Math.abs(a.y - b.y) <= STRAIGHT_EPS
  if (horizontal) {
    return (
      Math.abs(dy) > Math.abs(dx) * PERPENDICULAR_DRAG_RATIO &&
      Math.abs(dy) >= FORK_MIN_DRAG_PX
    )
  }
  return (
    Math.abs(dx) > Math.abs(dy) * PERPENDICULAR_DRAG_RATIO &&
    Math.abs(dx) >= FORK_MIN_DRAG_PX
  )
}

/**
 * Ubah path 2 titik lurus menjadi L ortogonal saat ujung ditarik tegak lurus.
 * Menggunakan originPath + delta agar sudut stabil selama drag.
 */
export function forkStraightPathForEndpointDrag(
  originPath: Point[],
  index: number,
  dx: number,
  dy: number,
): Point[] | null {
  if (originPath.length !== 2 || index < 0 || index > 1) return null
  if (!isPerpendicularEndpointDrag(originPath, dx, dy)) return null
  const a = originPath[0]!
  const b = originPath[1]!
  const horizontal = Math.abs(a.y - b.y) <= STRAIGHT_EPS
  const dragged =
    index === 0
      ? { x: snapToGrid(a.x + dx), y: snapToGrid(a.y + dy) }
      : { x: snapToGrid(b.x + dx), y: snapToGrid(b.y + dy) }
  const fixed = index === 0 ? b : a
  const corner = horizontal
    ? { x: dragged.x, y: snapToGrid(fixed.y) }
    : { x: snapToGrid(fixed.x), y: dragged.y }
  if (index === 0) {
    return [{ ...dragged }, { ...corner }, { ...fixed }]
  }
  return [{ ...fixed }, { ...corner }, { ...dragged }]
}

export function findNearestSegmentIndex(path: Point[], x: number, y: number): number {
  if (path.length < 2) return -1
  let bestIdx = 0
  let bestDist = Infinity
  for (let i = 0; i < path.length - 1; i += 1) {
    const a = path[i]!
    const b = path[i + 1]!
    const dist = pointToSegmentDistance(x, y, a.x, a.y, b.x, b.y)
    if (dist < bestDist) {
      bestDist = dist
      bestIdx = i
    }
  }
  return bestIdx
}

function pointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  if (dx === 0 && dy === 0) {
    return Math.hypot(px - x1, py - y1)
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
  const cx = x1 + t * dx
  const cy = y1 + t * dy
  return Math.hypot(px - cx, py - cy)
}
