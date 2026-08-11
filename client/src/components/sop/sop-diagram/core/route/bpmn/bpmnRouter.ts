/**
 * BPMN Router — Lane-aware pipe-and-track routing for BPMN swim-lane diagrams.
 *
 * Key design: routes arrows through column-pipe (vertical gaps between columns)
 * and lane-pipe (horizontal gaps between swim lanes) corridors, ensuring
 * segments never cross through shape interiors.
 *
 * Aturan: path tidak boleh berada di dalam shape (task/diamond/lane). Semua path
 * yang memotong obstacle (shape lain) ditolak oleh pathHitsObstacle; caller
 * wajib mengirim daftar obstacle rect (shape selain from/to) agar rule ini berlaku.
 */

import {
  type OccupiedSegment,
  scorePath,
  pathOverlapsSegments,
} from '../shared/orthogonalRouter'
import type { Side, UsedSides } from '../shared/connector-side.types'
import { simplifyOrthogonalPath } from '../shared/orthogonal-path-normalization.util'
import {
  occupancyPenalty,
  resolveHorizontalTrackY,
  resolveVerticalTrackX,
} from './bpmn-segment-tracks.util'
import { preferredBpmnLaneBoundaryTrackY } from './bpmn-lane-corridor.util'

export type { Side, UsedSides } from '../shared/connector-side.types'

interface Point { x: number; y: number }
interface Rect { left: number; top: number; width: number; height: number }

/* ── Lane layout descriptor ───────────────────────────────────── */

export interface LaneInfo {
  index: number
  top: number
  height: number
}

export interface BpmnLaneLayout {
  lanes: LaneInfo[]
  columnStartXs: number[]
  columnWidths: number[]
  /** Offset DOM kolom konten (judul SOP + aktor) terhadap koordinat layout. */
  originX?: number
  originY?: number
}

/** Geser layout kolom/lane ke ruang koordinat DOM `#bpmn-container`. */
export function translateBpmnLaneLayoutToDom(
  layout: BpmnLaneLayout,
): BpmnLaneLayout {
  const originX = layout.originX ?? 0
  const originY = layout.originY ?? 0
  if (originX === 0 && originY === 0) return layout
  return {
    ...layout,
    columnStartXs: layout.columnStartXs.map((x) => x + originX),
    lanes: layout.lanes.map((lane) => ({ ...lane, top: lane.top + originY })),
  }
}

/* ── Connection metadata ──────────────────────────────────────── */

export interface BpmnConnectionMeta {
  id: string
  from: string
  to: string
  label?: string | null
  sourceType?: string
  targetType?: string
  fromLane: number
  toLane: number
  fromCol: number
  toCol: number
}

export interface BpmnRouteCandidate {
  sSide: Side
  eSide: Side
  sourceJettySize?: number
  targetJettySize?: number
  preferSimple?: boolean
}

/* ═══════════════════════════════════════════════════════════════════
 *  selectBpmnSidePairs — simplified, max 4 candidates
 *
 *  BPMN flow: horizontal (left → right) with vertical swim lanes.
 *  Logic: flat positional — same-lane/cross-lane × left/right/above/below.
 * ═══════════════════════════════════════════════════════════════════ */

function isYaLabel(label: string | null | undefined): boolean {
  return /^(ya|yes|y)$/.test((label ?? '').trim().toLowerCase())
}

function isTidakLabel(label: string | null | undefined): boolean {
  return /^(tidak|no|n)$/.test((label ?? '').trim().toLowerCase())
}

export function selectBpmnSidePairs(
  conn: BpmnConnectionMeta,
  _fromRect: Rect,
  _toRect: Rect,
  usedSides: UsedSides,
): BpmnRouteCandidate[] {
  const sameLane = conn.fromLane === conn.toLane
  const targetRight = conn.toCol > conn.fromCol
  const targetLeft = conn.toCol < conn.fromCol
  const sameCol = conn.toCol === conn.fromCol
  const targetBelow = conn.toLane > conn.fromLane
  const targetAbove = conn.toLane < conn.fromLane

  const isDecSrc = conn.sourceType === 'flowchart-decision'
  const isDecDst = conn.targetType === 'flowchart-decision'
  const isYa = isYaLabel(conn.label)
  const isTidak = isTidakLabel(conn.label)
  const isStartTerm = conn.sourceType === 'flowchart-terminator'

  const srcBusy = (s: Side) =>
    (usedSides[conn.from]?.out?.[s] ?? []).some(id => id !== conn.id)
  const dstBusy = (s: Side) =>
    (usedSides[conn.to]?.in?.[s] ?? []).some(id => id !== conn.id)

  const pairs: BpmnRouteCandidate[] = []
  const push = (sSide: Side, eSide: Side, overrides: Partial<BpmnRouteCandidate> = {}) => {
    pairs.push({ sSide, eSide, sourceJettySize: SHAPE_MARGIN, targetJettySize: SHAPE_MARGIN, preferSimple: true, ...overrides })
  }

  /* ── Start terminator: always right→left or bottom/top ──── */
  if (isStartTerm) {
    if (sameLane) push('right', 'left', { sourceJettySize: 28 })
    else if (targetBelow) push('bottom', 'top', { sourceJettySize: 28 })
    else if (targetAbove) push('top', 'bottom', { sourceJettySize: 28 })
    else push('right', 'left', { sourceJettySize: 28 })
    // Fallback
    push('right', 'left', { sourceJettySize: 24 })
    push('bottom', 'top', { sourceJettySize: 20 })
    return bpmnDedup(pairs, isDecSrc, isDecDst, sameLane)
  }

  /* ── Decision Ya: bottom exit preferred ──────────────────── */
  if (isDecSrc && isYa) {
    if (targetBelow || (sameLane && sameCol)) {
      push('bottom', 'top', { sourceJettySize: 18, targetJettySize: 18 })
      if (targetRight) push('right', 'left')
      if (targetLeft) push('bottom', 'right', { sourceJettySize: 18, preferSimple: false })
    } else if (targetAbove) {
      push('top', 'bottom', { sourceJettySize: 18, targetJettySize: 18, preferSimple: false })
      if (targetRight) push('right', 'left')
    } else if (sameLane && targetRight) {
      push('right', 'left', { sourceJettySize: 20 })
      push('bottom', 'left', { sourceJettySize: 18, preferSimple: false })
    } else if (sameLane && targetLeft) {
      push('bottom', 'right', { sourceJettySize: 18, preferSimple: false })
      push('left', 'right', { preferSimple: false })
    } else {
      push('bottom', 'top', { sourceJettySize: 18, targetJettySize: 18 })
      push('right', 'left')
    }
    push('bottom', 'top', { sourceJettySize: 18, targetJettySize: 18 })
    push('right', 'left')
    return bpmnDedup(pairs, isDecSrc, isDecDst, sameLane)
  }

  /* ── Decision Tidak: top exit (above) or side exit ───────── */
  if (isDecSrc && isTidak) {
    if (targetAbove || (sameLane && sameCol)) {
      if (!srcBusy('right') && !dstBusy('right'))
        push('right', 'right', { sourceJettySize: 22, targetJettySize: 22, preferSimple: false })
      if (!srcBusy('left') && !dstBusy('left'))
        push('left', 'left', { sourceJettySize: 22, targetJettySize: 22, preferSimple: false })
      push('top', 'bottom', { sourceJettySize: 22, targetJettySize: 18, preferSimple: false })
    } else if (targetBelow) {
      push('bottom', 'top', { sourceJettySize: 18, targetJettySize: 18 })
      if (targetRight) push('right', 'top', { preferSimple: false })
      else push('left', 'top', { preferSimple: false })
    } else if (sameLane && targetRight) {
      push('top', 'left', { sourceJettySize: 20, preferSimple: false })
      push('right', 'left')
    } else if (sameLane && targetLeft) {
      if (!srcBusy('top') && !dstBusy('top'))
        push('top', 'top', { sourceJettySize: 22, targetJettySize: 22, preferSimple: false })
      push('top', 'right', { sourceJettySize: 22, preferSimple: false })
    } else {
      push('top', 'bottom', { sourceJettySize: 22, targetJettySize: 18, preferSimple: false })
      push('top', 'left', { sourceJettySize: 22, preferSimple: false })
    }
    push('bottom', 'top', { sourceJettySize: 18, targetJettySize: 18 })
    push('right', 'left')
    return bpmnDedup(pairs, isDecSrc, isDecDst, sameLane)
  }

  /* ── Normal flow: positional logic ───────────────────────── */
  if (sameLane && targetRight) {
    push('right', 'left')
    if (srcBusy('right') || dstBusy('left')) push('bottom', 'left', { preferSimple: false })
  } else if (sameLane && targetLeft) {
    if (!srcBusy('top') && !dstBusy('top')) push('top', 'top', { sourceJettySize: 20, targetJettySize: 20, preferSimple: false })
    else push('bottom', 'bottom', { sourceJettySize: 20, targetJettySize: 20, preferSimple: false })
    push('left', 'right', { preferSimple: false })
  } else if (sameLane && sameCol) {
    push('bottom', 'top', { sourceJettySize: 18, targetJettySize: 18 })
    push('right', 'left')
  } else if (targetBelow && (targetRight || sameCol)) {
    push('bottom', 'top', { sourceJettySize: 18, targetJettySize: 18 })
    if (targetRight) push('right', 'left')
  } else if (targetAbove && (targetRight || sameCol)) {
    push('top', 'bottom', { sourceJettySize: 18, targetJettySize: 18, preferSimple: false })
    if (targetRight) push('right', 'left')
  } else if (targetBelow && targetLeft) {
    push('bottom', 'top', { sourceJettySize: 18, targetJettySize: 18 })
    push('bottom', 'right', { preferSimple: false })
  } else if (targetAbove && targetLeft) {
    push('top', 'bottom', { sourceJettySize: 18, targetJettySize: 18, preferSimple: false })
    push('top', 'right', { preferSimple: false })
  } else {
    push('right', 'left')
    push('bottom', 'top', { sourceJettySize: 18, targetJettySize: 18 })
  }

  // Universal fallbacks (max 4 total after dedup)
  push('right', 'left')
  push('bottom', 'top', { sourceJettySize: 18, targetJettySize: 18 })
  push('left', 'right', { preferSimple: false })
  push('top', 'bottom', { sourceJettySize: 18, targetJettySize: 18, preferSimple: false })

  return bpmnDedup(pairs, isDecSrc, isDecDst, sameLane)
}

/** Dedup + apply gateway constraints. */
function bpmnDedup(
  pairs: BpmnRouteCandidate[],
  isDecSrc: boolean,
  isDecDst: boolean,
  sameLane: boolean,
): BpmnRouteCandidate[] {
  const seen = new Set<string>()
  return pairs.filter(({ sSide: s, eSide: e }) => {
    // Gateway source: block vertical through-path
    if (isDecSrc && ((s === 'top' && e === 'bottom') || (s === 'bottom' && e === 'top'))) return false
    // Gateway target same-lane: block top/bottom entry
    if (isDecDst && sameLane && (e === 'top' || e === 'bottom')) return false
    const k = `${s}-${e}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/* ═══════════════════════════════════════════════════════════════════
 *  Routing engine
 * ═══════════════════════════════════════════════════════════════════ */

const SHAPE_MARGIN = 24

export interface BpmnRouteOptions {
  fromShape: Rect
  toShape: Rect
  fromSide: Side
  toSide: Side
  fromDistance: number
  toDistance: number
  /** True jika shape sumber decision (diamond); titik sambung harus di vertex agar tidak melayang. */
  fromIsDiamond?: boolean
  /** True jika shape target decision (diamond); titik sambung harus di vertex. */
  toIsDiamond?: boolean
  layout: BpmnLaneLayout
  fromLane: number
  toLane: number
  fromCol: number
  toCol: number
  obstacles: Rect[]
  occupiedSegments: OccupiedSegment[]
  globalBounds?: Rect
  sourceJettySize?: number
  targetJettySize?: number
  gridClearance?: number
  /**
   * Auto-layout may keep a local crossing as a scored candidate. Overlap,
   * shape, and grid conflicts remain hard failures.
   */
  allowCrossings?: boolean
}

/** Diamond hanya punya 4 vertex; pakai 0.5 agar titik selalu di vertex, bukan di tepi rect. */
function connPoint(shape: Rect, side: Side, distance: number, isDiamond?: boolean): Point {
  const t = isDiamond ? 0.5 : distance
  switch (side) {
    case 'top': return { x: shape.left + shape.width * t, y: shape.top }
    case 'bottom': return { x: shape.left + shape.width * t, y: shape.top + shape.height }
    case 'left': return { x: shape.left, y: shape.top + shape.height * t }
    case 'right': return { x: shape.left + shape.width, y: shape.top + shape.height * t }
  }
}

function extrudePoint(shape: Rect, side: Side, distance: number, margin: number, isDiamond?: boolean): Point {
  const p = connPoint(shape, side, distance, isDiamond)
  switch (side) {
    case 'top': return { x: p.x, y: p.y - margin }
    case 'bottom': return { x: p.x, y: p.y + margin }
    case 'left': return { x: p.x - margin, y: p.y }
    case 'right': return { x: p.x + margin, y: p.y }
  }
}

function rectContainsSegment(obs: Rect, x1: number, y1: number, x2: number, y2: number): boolean {
  const margin = 4
  const oL = obs.left - margin, oR = obs.left + obs.width + margin
  const oT = obs.top - margin, oB = obs.top + obs.height + margin

  // Treat near-horizontal as horizontal
  if (Math.abs(y1 - y2) < 3) {
    const y = (y1 + y2) / 2
    if (y <= oT || y >= oB) return false
    const segL = Math.min(x1, x2), segR = Math.max(x1, x2)
    return segL < oR && segR > oL
  }
  // Treat near-vertical as vertical
  if (Math.abs(x1 - x2) < 3) {
    const x = (x1 + x2) / 2
    if (x <= oL || x >= oR) return false
    const segT = Math.min(y1, y2), segB = Math.max(y1, y2)
    return segT < oB && segB > oT
  }
  // Diagonal: check if either endpoint is inside the obstacle
  const inRect = (px: number, py: number) => px >= oL && px <= oR && py >= oT && py <= oB
  return inRect(x1, y1) || inRect(x2, y2)
}

/** Overlap between two rects (with small tolerance). */
function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.left < b.left + b.width + 5 && a.left + a.width + 5 > b.left &&
    a.top < b.top + b.height + 5 && a.top + a.height + 5 > b.top
  )
}

/** Shape perantara saja — ujung koneksi dikecualikan (dicek terpisah di pathHitsObstacle). */
function filterObstacles(obstacles: Rect[], fromShape: Rect, toShape: Rect): Rect[] {
  return obstacles.filter((obs) => !rectsOverlap(obs, fromShape) && !rectsOverlap(obs, toShape))
}

/** Inset (shrink) rect so we can detect segment going through shape interior. */
const SEGMENT_BOUNDARY_INSET = 10

function pathHitsObstacle(
  path: Point[],
  filteredObs: Rect[],
  fromShape: Rect,
  toShape: Rect,
): boolean {
  // Diamond shapes have connection points at their vertices — use a smaller inset
  // so that a segment touching the vertex is not incorrectly flagged as interior hit.
  const isDiamond = (r: Rect) => Math.abs(r.width - r.height) < 20
  const fromInsetSize = isDiamond(fromShape) ? 2 : SEGMENT_BOUNDARY_INSET
  const toInsetSize = isDiamond(toShape) ? 2 : SEGMENT_BOUNDARY_INSET
  const fromInset: Rect = {
    left: fromShape.left + fromInsetSize,
    top: fromShape.top + fromInsetSize,
    width: Math.max(0, fromShape.width - 2 * fromInsetSize),
    height: Math.max(0, fromShape.height - 2 * fromInsetSize),
  }
  const toInset: Rect = {
    left: toShape.left + toInsetSize,
    top: toShape.top + toInsetSize,
    width: Math.max(0, toShape.width - 2 * toInsetSize),
    height: Math.max(0, toShape.height - 2 * toInsetSize),
  }
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1]
    const isFirstSeg = i === 0
    const isLastSeg = i === path.length - 2
    for (let j = 0; j < filteredObs.length; j++) {
      const obs = filteredObs[j]
      if (isFirstSeg && rectsOverlap(obs, fromShape)) {
        // Segmen pertama tidak boleh menembus interior shape sumber (mis. diamond).
        if (fromInset.width > 0 && fromInset.height > 0 && rectContainsSegment(fromInset, a.x, a.y, b.x, b.y)) return true
        continue
      }
      if (isLastSeg && rectsOverlap(obs, toShape)) {
        if (toInset.width > 0 && toInset.height > 0 && rectContainsSegment(toInset, a.x, a.y, b.x, b.y)) return true
        continue
      }
      if (rectContainsSegment(obs, a.x, a.y, b.x, b.y)) return true
    }
  }
  return false
}

/** Lintasan vertikal antar-lane lewat lane-pipe tiap batas lane (satu sumbu X). */
function buildMultiLanePipePath(
  start: Point,
  extStart: Point,
  extEnd: Point,
  end: Point,
  layout: BpmnLaneLayout,
  fromLane: number,
  toLane: number,
  occupied: OccupiedSegment[],
): Point[] {
  const path: Point[] = [start, extStart]
  const cx = resolveVerticalTrackX(extStart.x, extStart.y, extEnd.y, occupied)
  if (toLane > fromLane) {
    for (let lane = fromLane; lane < toLane; lane += 1) {
      const pipeY = findLanePipeY(layout, lane, lane + 1)
      path.push({ x: cx, y: pipeY })
    }
  } else if (toLane < fromLane) {
    for (let lane = fromLane; lane > toLane; lane -= 1) {
      const pipeY = findLanePipeY(layout, lane - 1, lane)
      path.push({ x: cx, y: pipeY })
    }
  }
  const last = path[path.length - 1]!
  if (Math.abs(last.x - extEnd.x) > 2) {
    const hy = resolveHorizontalTrackY(last.y, last.x, extEnd.x, occupied)
    path.push({ x: extEnd.x, y: hy })
  }
  path.push(extEnd, end)
  return path
}

/* ── Find a clear vertical X in a column-pipe gap ────────────── */

function findColumnPipeX(
  layout: BpmnLaneLayout,
  preferredColGap: number,
  extStartY: number,
  extEndY: number,
  obstacles: Rect[],
  occupied: OccupiedSegment[],
): number {
  const { columnStartXs: cs, columnWidths: cw } = layout
  const candidates: Array<{ x: number; penalty: number }> = []

  for (let i = 0; i < cs.length - 1; i++) {
    const gapLeft = cs[i] + cw[i]
    const gapRight = cs[i + 1]
    if (gapRight <= gapLeft) continue
    const mid = Math.round((gapLeft + gapRight) / 2)
    const distFromPreferred = Math.abs(i - preferredColGap)
    let penalty = distFromPreferred * 50

    const seg: OccupiedSegment = {
      x1: mid, y1: Math.min(extStartY, extEndY),
      x2: mid, y2: Math.max(extStartY, extEndY),
    }
    for (const obs of obstacles) {
      if (rectContainsSegment(obs, seg.x1, seg.y1, seg.x2, seg.y2)) penalty += 8000
    }
    penalty += occupancyPenalty(seg, occupied)
    candidates.push({ x: mid, penalty })
  }

  // Also add a channel to the left of column 0 and right of last column
  if (cs.length > 0) {
    const leftEdge = cs[0] - 30
    if (leftEdge > 0) candidates.push({ x: Math.round(leftEdge), penalty: cs.length * 50 + 100 })

    const rightEdge = cs[cs.length - 1] + cw[cs.length - 1] + 30
    candidates.push({ x: Math.round(rightEdge), penalty: cs.length * 50 + 100 })
  }

  if (candidates.length === 0) return 50

  let bestX = candidates[0].x
  let bestPen = candidates[0].penalty
  for (let i = 1; i < candidates.length; i++) {
    if (candidates[i].penalty < bestPen) {
      bestPen = candidates[i].penalty
      bestX = candidates[i].x
    }
  }
  return resolveVerticalTrackX(bestX, extStartY, extEndY, occupied)
}

/* ── Find the lane-pipe Y between two lanes ──────────────────── */

const BPMN_GRID_CLEARANCE = 6

function findLanePipeY(
  layout: BpmnLaneLayout,
  aboveLane: number,
  belowLane: number,
): number {
  if (aboveLane < 0 || belowLane >= layout.lanes.length) {
    if (aboveLane < 0 && layout.lanes.length > 0) return layout.lanes[0].top - 24
    if (belowLane >= layout.lanes.length && layout.lanes.length > 0) {
      const last = layout.lanes[layout.lanes.length - 1]
      return last.top + last.height + 24
    }
    return 0
  }
  const above = layout.lanes[aboveLane]
  const below = layout.lanes[belowLane]
  return preferredBpmnLaneBoundaryTrackY(above, below)
}

function rangesIntersect(a1: number, a2: number, b1: number, b2: number): boolean {
  const aMin = Math.min(a1, a2)
  const aMax = Math.max(a1, a2)
  const bMin = Math.min(b1, b2)
  const bMax = Math.max(b1, b2)
  return aMin < bMax && bMin < aMax
}

function pathRunsAlongBpmnGrid(
  path: Point[],
  layout: BpmnLaneLayout,
  clearance = BPMN_GRID_CLEARANCE,
): boolean {
  if (path.length < 2) return false

  const verticalGridLines = new Set<number>()
  layout.columnStartXs.forEach((x, index) => {
    verticalGridLines.add(Math.round(x))
    const width = layout.columnWidths[index]
    if (width != null) verticalGridLines.add(Math.round(x + width))
  })

  const horizontalGridLines = new Set<number>()
  layout.lanes.forEach((lane) => {
    horizontalGridLines.add(Math.round(lane.top))
    horizontalGridLines.add(Math.round(lane.top + lane.height))
  })
  if (verticalGridLines.size === 0 || horizontalGridLines.size === 0) return false

  const minGridX = Math.min(...layout.columnStartXs)
  const maxGridX = Math.max(...layout.columnStartXs.map((x, index) => x + (layout.columnWidths[index] ?? 0)))
  const minGridY = Math.min(...layout.lanes.map((lane) => lane.top))
  const maxGridY = Math.max(...layout.lanes.map((lane) => lane.top + lane.height))

  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    if (a.y === b.y && a.x !== b.x) {
      for (const y of horizontalGridLines) {
        if (Math.abs(a.y - y) <= clearance && rangesIntersect(a.x, b.x, minGridX, maxGridX)) return true
      }
    }
    if (a.x === b.x && a.y !== b.y) {
      for (const x of verticalGridLines) {
        if (Math.abs(a.x - x) <= clearance && rangesIntersect(a.y, b.y, minGridY, maxGridY)) return true
      }
    }
  }

  return false
}

/* ═══════════════════════════════════════════════════════════════════
 *  buildBpmnWaypoints — the main routing logic
 * ═══════════════════════════════════════════════════════════════════ */

function buildBpmnWaypoints(opts: BpmnRouteOptions): Point[] {
  const {
    fromShape, toShape, fromSide, toSide,
    fromDistance, toDistance, fromIsDiamond, toIsDiamond,
    layout, fromLane, toLane,
    obstacles, occupiedSegments,
  } = opts

  const sourceJetty = opts.sourceJettySize ?? SHAPE_MARGIN
  const targetJetty = opts.targetJettySize ?? SHAPE_MARGIN
  const start = connPoint(fromShape, fromSide, fromDistance, fromIsDiamond)
  const end = connPoint(toShape, toSide, toDistance, toIsDiamond)
  const extStart = extrudePoint(fromShape, fromSide, fromDistance, sourceJetty, fromIsDiamond)
  const extEnd = extrudePoint(toShape, toSide, toDistance, targetJetty, toIsDiamond)

  // Pre-filter obstacles once — O(N) instead of O(P*N) per pathHitsObstacle call
  const fObs = filterObstacles(obstacles, fromShape, toShape)
  const isUsablePath = (path: Point[]) =>
    !pathHitsObstacle(path, fObs, fromShape, toShape) &&
    !pathOverlapsSegments(path, occupiedSegments, { includeCross: !opts.allowCrossings }) &&
    !pathRunsAlongBpmnGrid(path, layout, opts.gridClearance)

  const sameLane = fromLane === toLane
  const isHorizExit = fromSide === 'left' || fromSide === 'right'
  const isHorizEntry = toSide === 'left' || toSide === 'right'
  const isVertExit = fromSide === 'top' || fromSide === 'bottom'
  const isVertEntry = toSide === 'top' || toSide === 'bottom'

  /* ── Case 1: Same lane, right→left (orthogonal: horizontal lalu vertikal, bukan diagonal) ── */
  if (sameLane && fromSide === 'right' && toSide === 'left' && extStart.x < extEnd.x) {
    const orthogonalL = [start, extStart, { x: extEnd.x, y: extStart.y }, extEnd, end]
    if (isUsablePath(orthogonalL)) {
      return orthogonalL
    }
    const lane = layout.lanes[fromLane]
    if (lane) {
      const aboveY = lane.top - SHAPE_MARGIN * 2
      const belowY = lane.top + lane.height + SHAPE_MARGIN * 2
      const abovePipe = fromLane > 0 ? findLanePipeY(layout, fromLane - 1, fromLane) : aboveY
      const belowPipe = fromLane < layout.lanes.length - 1 ? findLanePipeY(layout, fromLane, fromLane + 1) : belowY
      for (const baseY of [abovePipe, belowPipe, aboveY, belowY]) {
        const uY = resolveHorizontalTrackY(baseY, extStart.x, extEnd.x, occupiedSegments)
        const path = [start, extStart, { x: extStart.x, y: uY }, { x: extEnd.x, y: uY }, extEnd, end]
        if (isUsablePath(path)) return path
      }
    }
  }

  /* ── Case 2: Same lane, same-side U-turn (loop-back) ───── */
  if (sameLane && fromSide === toSide && (fromSide === 'top' || fromSide === 'bottom')) {
    const lane = layout.lanes[fromLane]
    if (lane) {
      const goUp = fromSide === 'top'
      // Route outside the lane via the lane-pipe
      const baseY = goUp
        ? (fromLane > 0 ? findLanePipeY(layout, fromLane - 1, fromLane) : lane.top - SHAPE_MARGIN * 3)
        : (fromLane < layout.lanes.length - 1 ? findLanePipeY(layout, fromLane, fromLane + 1) : lane.top + lane.height + SHAPE_MARGIN * 3)

      const trackY = resolveHorizontalTrackY(baseY, extStart.x, extEnd.x, occupiedSegments)
      const path = [
        start, extStart,
        { x: extStart.x, y: trackY },
        { x: extEnd.x, y: trackY },
        extEnd, end,
      ]
      if (isUsablePath(path)) return path
    }
  }

  /* ── Case 3: Cross-lane, vert exit + vert entry ─────────── */
  if (!sameLane && isVertExit && isVertEntry) {
    const fromCenterCol = findColumnForX(extStart.x, layout)
    const toCenterCol = findColumnForX(extEnd.x, layout)
    const preferredGap = Math.max(0, Math.min(fromCenterCol, toCenterCol, layout.columnStartXs.length - 2))

    const multiPipe = buildMultiLanePipePath(
      start, extStart, extEnd, end, layout, fromLane, toLane, occupiedSegments,
    )
    if (isUsablePath(multiPipe)) return multiPipe

    const vX = findColumnPipeX(layout, preferredGap, extStart.y, extEnd.y, fObs, occupiedSegments)
    const colPipePath = [
      start, extStart,
      { x: vX, y: extStart.y },
      { x: vX, y: extEnd.y },
      extEnd, end,
    ]
    if (isUsablePath(colPipePath)) return colPipePath

    const goingDown = toLane > fromLane
    const laneGapIdx = goingDown ? fromLane : toLane - 1
    const basePipeY = findLanePipeY(
      layout,
      Math.max(0, laneGapIdx),
      Math.min(layout.lanes.length - 1, laneGapIdx + 1),
    )
    const lanePipeY = resolveHorizontalTrackY(basePipeY, extStart.x, extEnd.x, occupiedSegments)
    const lanePipeZ = [
      start, extStart,
      { x: extStart.x, y: lanePipeY },
      { x: extEnd.x, y: lanePipeY },
      extEnd, end,
    ]
    if (isUsablePath(lanePipeZ)) return lanePipeZ
  }

  /* ── Case 4: Cross-lane, horiz exit + vert entry ────────── */
  if (!sameLane && isHorizExit && isVertEntry) {
    const preferredGap = Math.max(0, Math.min(opts.fromCol, opts.toCol))
    const vX = findColumnPipeX(layout, preferredGap, extStart.y, extEnd.y, fObs, occupiedSegments)
    const colPath = [
      start, extStart,
      { x: vX, y: extStart.y },
      { x: vX, y: extEnd.y },
      extEnd, end,
    ]
    if (isUsablePath(colPath)) return colPath

    const elbowY = resolveHorizontalTrackY(extStart.y, extStart.x, extEnd.x, occupiedSegments)
    const lPath = [start, extStart, { x: extEnd.x, y: elbowY }, extEnd, end]
    if (isUsablePath(lPath)) return lPath
  }

  /* ── Case 5: Cross-lane, vert exit + horiz entry ────────── */
  if (!sameLane && isVertExit && isHorizEntry) {
    const elbowY = resolveHorizontalTrackY(extEnd.y, extStart.x, extEnd.x, occupiedSegments)
    const lPath = [start, extStart, { x: extStart.x, y: elbowY }, extEnd, end]
    if (isUsablePath(lPath)) return lPath

    const goingDown = toLane > fromLane
    const laneGapIdx = goingDown ? fromLane : toLane
    const basePipeY = findLanePipeY(layout, laneGapIdx, laneGapIdx + 1)
    const lanePipeY = resolveHorizontalTrackY(basePipeY, extStart.x, extEnd.x, occupiedSegments)

    if (opts.toCol < opts.fromCol) {
      const preferredGap = Math.max(0, opts.toCol)
      const vX = findColumnPipeX(layout, preferredGap, extStart.y, lanePipeY, fObs, occupiedSegments)
      const path = [
        start, extStart,
        { x: extStart.x, y: lanePipeY },
        { x: vX, y: lanePipeY },
        { x: vX, y: extEnd.y },
        extEnd, end,
      ]
      if (isUsablePath(path)) return path
    }

    const fallback = [
      start, extStart,
      { x: extStart.x, y: lanePipeY },
      { x: extEnd.x, y: lanePipeY },
      extEnd, end,
    ]
    if (isUsablePath(fallback)) return fallback
    // lPath mungkin menembus shape; jangan return tanpa cek. Fall through ke fallback umum.
  }

  /* ── Case 6: Same lane, horiz exit + horiz entry, loop-back */
  if (sameLane && isHorizExit && isHorizEntry && extStart.x > extEnd.x) {
    const lane = layout.lanes[fromLane]
    if (lane) {
      // U-turn above or below the lane
      for (const goUp of [true, false]) {
        const baseY = goUp
          ? (fromLane > 0 ? findLanePipeY(layout, fromLane - 1, fromLane) : lane.top - SHAPE_MARGIN * 3)
          : (fromLane < layout.lanes.length - 1 ? findLanePipeY(layout, fromLane, fromLane + 1) : lane.top + lane.height + SHAPE_MARGIN * 3)
        const uY = resolveHorizontalTrackY(baseY, extStart.x, extEnd.x, occupiedSegments)
        const path = [
          start, extStart,
          { x: extStart.x, y: uY },
          { x: extEnd.x, y: uY },
          extEnd, end,
        ]
        if (isUsablePath(path)) return path
      }
    }
  }

  /* ── Case 7: Same lane, horiz→horiz forward but with obstacle */
  if (sameLane && isHorizExit && isHorizEntry && extStart.x <= extEnd.x) {
    const direct = [start, extStart, { x: extEnd.x, y: extStart.y }, extEnd, end]
    if (Math.abs(extStart.y - extEnd.y) < 3) {
      const simpleDirect = [start, extStart, extEnd, end]
      if (isUsablePath(simpleDirect)) return simpleDirect
    }
    if (isUsablePath(direct)) return direct
  }

  /* ── Case 8: Horiz exit + horiz entry, cross-lane ──────── */
  if (!sameLane && isHorizExit && isHorizEntry) {
    const preferredGap = Math.max(0, Math.min(opts.fromCol, opts.toCol))
    const vX = findColumnPipeX(layout, preferredGap, extStart.y, extEnd.y, fObs, occupiedSegments)
    const path = [
      start, extStart,
      { x: vX, y: extStart.y },
      { x: vX, y: extEnd.y },
      extEnd, end,
    ]
    if (isUsablePath(path)) return path
  }

  /* ── Fallback: L-shape or Z-shape — hanya return jika tidak menembus shape ── */
  if (isVertExit && isVertEntry) {
    const midY = resolveHorizontalTrackY(
      (extStart.y + extEnd.y) / 2,
      extStart.x,
      extEnd.x,
      occupiedSegments,
    )
    const p = [start, extStart, { x: extStart.x, y: midY }, { x: extEnd.x, y: midY }, extEnd, end]
    if (isUsablePath(p)) return p
  }
  if (isVertExit) {
    const p = [start, extStart, { x: extStart.x, y: extEnd.y }, extEnd, end]
    if (isUsablePath(p)) return p
  }
  if (isVertEntry) {
    const p = [start, extStart, { x: extEnd.x, y: extStart.y }, extEnd, end]
    if (isUsablePath(p)) return p
  }
  // Both horizontal
  const midX = resolveVerticalTrackX(
    (extStart.x + extEnd.x) / 2,
    extStart.y,
    extEnd.y,
    occupiedSegments,
  )
  const p = [start, extStart, { x: midX, y: extStart.y }, { x: midX, y: extEnd.y }, extEnd, end]
  if (isUsablePath(p)) return p

  // Semua kandidat menembus shape; kembalikan kosong agar connector coba side pair lain.
  return []
}

/* ── Helpers ──────────────────────────────────────────────────── */

function findColumnForX(x: number, layout: BpmnLaneLayout): number {
  for (let i = 0; i < layout.columnStartXs.length; i++) {
    const cs = layout.columnStartXs[i]
    const cw = layout.columnWidths[i]
    if (x >= cs && x <= cs + cw) return i
  }
  return 0
}

/* ── Simplify collinear and zero-length points ──────────────────
 * Jangan hapus titik ke-2 (extStart) dan kedua-dari-akhir (extEnd), agar segmen
 * dari/tujuan shape tetap pendek dan path tidak terlihat menembus/membelah shape.
 */

function simplifyPath(pts: Point[]): Point[] {
  if (pts.length <= 2) return pts
  const KEEP_FIRST_ATTACH = 1
  const KEEP_LAST_ATTACH = pts.length - 2

  const out = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) {
    const cur = pts[i]
    const keepAsAttachment = i === KEEP_FIRST_ATTACH || i === KEEP_LAST_ATTACH
    if (keepAsAttachment) {
      out.push(cur)
      continue
    }
    const prev = out[out.length - 1]
    const next = pts[i + 1]
    const sameX = prev.x === cur.x && cur.x === next.x
    const sameY = prev.y === cur.y && cur.y === next.y
    if (!sameX && !sameY) out.push(cur)
  }
  out.push(pts[pts.length - 1])

  const filtered = [out[0]]
  for (let i = 1; i < out.length; i++) {
    const prev = filtered[filtered.length - 1]
    if (Math.abs(out[i].x - prev.x) > 1 || Math.abs(out[i].y - prev.y) > 1) {
      filtered.push(out[i])
    }
  }
  return filtered.length >= 2 ? filtered : out
}

/* ═══════════════════════════════════════════════════════════════════
 *  Main export
 * ═══════════════════════════════════════════════════════════════════ */

function nudgePathFromOccupied(path: Point[], occupied: OccupiedSegment[]): Point[] {
  if (path.length < 3 || occupied.length === 0) return path
  const clearance = 12
  const nudged = path.map((p) => ({ ...p }))
  for (let i = 1; i < nudged.length - 1; i++) {
    const prev = nudged[i - 1]!
    const cur = nudged[i]!
    const next = nudged[i + 1]!
    const horiz = prev.y === cur.y && cur.y === next.y
    const vert = prev.x === cur.x && cur.x === next.x
    if (!horiz && !vert) continue
    if (horiz) {
      const y = resolveHorizontalTrackY(cur.y, Math.min(prev.x, next.x), Math.max(prev.x, next.x), occupied)
      nudged[i] = { x: cur.x, y }
      if (i > 1) nudged[i - 1] = { x: nudged[i - 1]!.x, y }
    } else {
      const x = resolveVerticalTrackX(cur.x, Math.min(prev.y, next.y), Math.max(prev.y, next.y), occupied)
      nudged[i] = { x, y: cur.y }
      if (i > 1) nudged[i - 1] = { x, y: nudged[i - 1]!.y }
    }
  }
  return simplifyOrthogonalPath(simplifyPath(nudged), clearance)
}

function validateBpmnPath(path: Point[], opts: BpmnRouteOptions): boolean {
  if (path.length < 2) return false
  const fObs = filterObstacles(opts.obstacles, opts.fromShape, opts.toShape)
  if (pathHitsObstacle(path, fObs, opts.fromShape, opts.toShape)) return false
  if (pathOverlapsSegments(path, opts.occupiedSegments, { includeCross: !opts.allowCrossings })) return false
  if (pathRunsAlongBpmnGrid(path, opts.layout, opts.gridClearance)) return false
  return true
}

export function routeBpmn(opts: BpmnRouteOptions): Point[] {
  let path = buildBpmnWaypoints(opts)
  path = simplifyPath(path)
  if (!validateBpmnPath(path, opts)) {
    const nudged = nudgePathFromOccupied(path, opts.occupiedSegments)
    if (validateBpmnPath(nudged, opts)) return nudged
    return []
  }
  return path
}

export interface BpmnRouteFallbackResult {
  path: Point[]
  usedOccupiedFallback: boolean
}

/**
 * Keep the connector visible when every collision-free track is already
 * reserved. Shape and grid validation still apply; only arrow-to-arrow
 * occupancy is relaxed so the parent reconcile pass can reroute crossings.
 */
export function routeBpmnAllowOccupiedFallback(
  opts: BpmnRouteOptions,
): BpmnRouteFallbackResult {
  const path = routeBpmn(opts)
  if (path.length >= 2 || opts.occupiedSegments.length === 0) {
    return { path, usedOccupiedFallback: false }
  }
  return {
    path: routeBpmn({ ...opts, occupiedSegments: [] }),
    usedOccupiedFallback: true,
  }
}

export function scoreBpmnRouteCandidate(candidate: BpmnRouteCandidate): number {
  let score = 0
  if (candidate.preferSimple === false) score += 200
  if (candidate.sSide === 'top' || candidate.sSide === 'bottom') score += 25
  if (candidate.eSide === 'top' || candidate.eSide === 'bottom') score += 25
  return score
}

/**
 * Crossing is undesirable but cheaper than sending a BPMN connector through
 * several remote pipes. Reconciliation can still try to remove it later.
 */
export function scoreBpmnPath(path: Point[], occupied: OccupiedSegment[]): number {
  return scorePath(path, occupied, { crossPenalty: 900 })
}

export { scorePath, pathOverlapsSegments, type OccupiedSegment }

/** Untuk connector: pastikan path tidak menembus shape. Prioritas di atas rute terpendek. */
export function bpmnPathHitsObstacle(
  path: Point[],
  obstacles: Rect[],
  fromShape: Rect,
  toShape: Rect,
): boolean {
  return pathHitsObstacle(path, obstacles, fromShape, toShape)
}

export function bpmnPathToSegments(path: Point[]): OccupiedSegment[] {
  const segs: OccupiedSegment[] = []
  for (let i = 0; i < path.length - 1; i++) {
    segs.push({ x1: path[i].x, y1: path[i].y, x2: path[i + 1].x, y2: path[i + 1].y })
  }
  return segs
}
