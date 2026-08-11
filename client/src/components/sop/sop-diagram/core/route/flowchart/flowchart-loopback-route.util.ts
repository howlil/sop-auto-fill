import { pointOnFlowchartDecisionVertex } from './flowchart-decision-geometry.util'
import { pickColumnPipeX } from './flowchart-column-bounds.util'
import type { FlowchartGridLayout } from './flowchart-grid-layout.util'
import { findFlowchartRowPipeY } from './flowchart-grid-layout.util'
import type { Point, Rect, Side } from '../shared/orthogonalRouter'

export const FLOWCHART_LOOPBACK_CORRIDOR_STEP_PX = 18

export interface FlowchartElemPos {
  left: number
  top: number
  width: number
  height: number
  right: number
  bottom: number
}

export interface PelaksanaCorridorBounds {
  left: number
  top: number
  right: number
  bottom: number
}

export interface BuildFlowchartLoopbackPathInput {
  fromPos: FlowchartElemPos
  toPos: FlowchartElemPos
  fromShape: Rect
  toShape: Rect
  sSide: Side
  eSide: Side
  fromIsDiamond: boolean
  toIsDiamond: boolean
  sourceJetty: number
  targetJetty: number
  corridorBounds: PelaksanaCorridorBounds
  gridLayout: FlowchartGridLayout | null
  corridorIndex: number
  fromRow: number
  toRow: number
}

function anchorOnShape(
  shape: Rect,
  side: Side,
  isDiamond: boolean,
): Point {
  if (isDiamond) return pointOnFlowchartDecisionVertex(shape, side)
  switch (side) {
    case 'top':
      return { x: Math.round(shape.left + shape.width / 2), y: shape.top }
    case 'bottom':
      return { x: Math.round(shape.left + shape.width / 2), y: shape.top + shape.height }
    case 'left':
      return { x: shape.left, y: Math.round(shape.top + shape.height / 2) }
    case 'right':
      return { x: shape.left + shape.width, y: Math.round(shape.top + shape.height / 2) }
  }
}

function extrude(shape: Rect, side: Side, isDiamond: boolean, margin: number): Point {
  const p = anchorOnShape(shape, side, isDiamond)
  switch (side) {
    case 'top':
      return { x: p.x, y: p.y - margin }
    case 'bottom':
      return { x: p.x, y: p.y + margin }
    case 'left':
      return { x: p.x - margin, y: p.y }
    case 'right':
      return { x: p.x + margin, y: p.y }
  }
}

function pickCorridorPipeX(
  side: Side,
  bounds: PelaksanaCorridorBounds,
  corridorIndex: number,
): number {
  const column = {
    left: bounds.left,
    top: bounds.top,
    right: bounds.right,
    bottom: bounds.bottom,
  }
  if (side === 'left' || side === 'right') {
    return pickColumnPipeX(side, column, corridorIndex, FLOWCHART_LOOPBACK_CORRIDOR_STEP_PX)
  }
  return Math.round((bounds.left + bounds.right) / 2)
}

function buildVerticalWaypoints(
  pipeX: number,
  yStart: number,
  yEnd: number,
  gridLayout: FlowchartGridLayout | null,
  fromRow: number,
  toRow: number,
): Point[] {
  const yMin = Math.min(yStart, yEnd)
  const yMax = Math.max(yStart, yEnd)
  if (!gridLayout || fromRow <= toRow + 1) {
    return [{ x: pipeX, y: yStart }, { x: pipeX, y: yEnd }]
  }
  const points: Point[] = [{ x: pipeX, y: yStart }]
  const lowRow = Math.min(fromRow, toRow)
  const highRow = Math.max(fromRow, toRow)
  for (let row = lowRow; row < highRow; row += 1) {
    if (row >= 0 && row < gridLayout.rowGutters.length) {
      const gutterY = gridLayout.rowGutters[row]!
      if (gutterY > yMin + 8 && gutterY < yMax - 8) {
        points.push({ x: pipeX, y: gutterY })
      }
    } else if (gridLayout.horizontalLines.length > 0) {
      const gutterY = findFlowchartRowPipeY(gridLayout, row, row + 1)
      if (gutterY > yMin + 8 && gutterY < yMax - 8) {
        points.push({ x: pipeX, y: gutterY })
      }
    }
  }
  points.push({ x: pipeX, y: yEnd })
  return points
}

export function seqFromFlowchartShapeId(id: string): number {
  const m = id.match(/(\d+)/)
  return m ? Number(m[1]) : -1
}

export interface LoopbackRoutableMeta {
  id: string
  from: string
  to: string
  sourceType?: string
  fromImplementerId?: string
}

/** Indeks koridor unik per loop-back **per kolom pelaksana** (0, 1, 2, …). */
export function assignLoopbackCorridorIndices(
  connections: ReadonlyArray<LoopbackRoutableMeta>,
): Map<string, number> {
  const loopbacks = connections
    .filter((c) => {
      const fromSeq = seqFromFlowchartShapeId(c.from)
      const toSeq = seqFromFlowchartShapeId(c.to)
      return fromSeq >= 0 && toSeq >= 0 && toSeq < fromSeq
    })
    .sort((a, b) => a.id.localeCompare(b.id))
  const perColumn = new Map<string, number>()
  const map = new Map<string, number>()
  for (const c of loopbacks) {
    const colKey = c.fromImplementerId ?? `shape:${c.from}`
    const slot = perColumn.get(colKey) ?? 0
    map.set(c.id, slot)
    perColumn.set(colKey, slot + 1)
  }
  return map
}

export function isHorizontalLoopbackSides(sSide: Side, eSide: Side): boolean {
  return sSide === eSide && (sSide === 'left' || sSide === 'right')
}

/**
 * Path U-turn horizontal di koridor teralokasi (untuk decision loop-back ke atas).
 */
export function buildFlowchartLoopbackPath(input: BuildFlowchartLoopbackPathInput): Point[] | null {
  const {
    fromShape,
    toShape,
    sSide,
    eSide,
    fromIsDiamond,
    toIsDiamond,
    sourceJetty,
    targetJetty,
    corridorBounds,
    gridLayout,
    corridorIndex,
    fromRow,
    toRow,
  } = input
  if (!isHorizontalLoopbackSides(sSide, eSide)) return null
  const oA = anchorOnShape(fromShape, sSide, fromIsDiamond)
  const oB = anchorOnShape(toShape, eSide, toIsDiamond)
  const extA = extrude(fromShape, sSide, fromIsDiamond, sourceJetty)
  const extB = extrude(toShape, eSide, toIsDiamond, targetJetty)
  const pipeX = pickCorridorPipeX(sSide, corridorBounds, corridorIndex)
  const clampedPipeX = Math.max(
    corridorBounds.left + 8,
    Math.min(corridorBounds.right - 8, pipeX),
  )
  const clampX = (x: number) =>
    Math.max(corridorBounds.left + 4, Math.min(corridorBounds.right - 4, x))
  const verticalPts = buildVerticalWaypoints(
    clampedPipeX,
    extA.y,
    extB.y,
    gridLayout,
    fromRow,
    toRow,
  )
  const path: Point[] = [oA, extA]
  for (const pt of verticalPts) {
    const last = path[path.length - 1]!
    const next = { x: clampX(pt.x), y: pt.y }
    if (last.x !== next.x || last.y !== next.y) path.push(next)
  }
  const last = path[path.length - 1]!
  const extBClamped = { x: clampX(extB.x), y: extB.y }
  if (last.x !== extBClamped.x || last.y !== extBClamped.y) path.push(extBClamped)
  if (path[path.length - 1]!.x !== oB.x || path[path.length - 1]!.y !== oB.y) path.push(oB)
  return path.length >= 2 ? path : null
}
