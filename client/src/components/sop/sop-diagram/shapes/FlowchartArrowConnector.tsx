import { useLayoutEffect, useState, useRef, type MutableRefObject } from 'react'
import type { ArrowConnectionConfig, ArrowPathPoint, FlowchartConnection } from '../core/sopDiagramTypes'
import {
  routeOrthogonal,
  scorePath,
  pathToSegments,
  normalizeOrthogonalPath,
  assertOrthogonalPath,
  type OccupiedSegment,
} from '../core/route/shared/orthogonalRouter'
import { selectSidePairs as selectFlowchartRouteCandidates } from '../core/route/flowchart/selectSidePairs'
import type { Side, UsedSides } from '../core/route/shared/connector-side.types'
import { EditableOrthogonalPath } from '../edit/EditableOrthogonalPath'
import {
  buildVisualConnectorAnchors,
  elemPosToShapeRect,
  preferCenterAnchorDistance,
  scoreAnchorOffCenter,
  sideLengthPx,
  type DiagramPathAnchor,
  type DiagramShapeSnapTargets,
} from '../edit/anchor-snap.util'
import { createPathSafetyOptions, isAcceptableRoutedPath } from '../core/route/quality/path-route-quality.util'
import { placeEdgeLabel } from '../core/route/shared/edge-label-placement.util'
import type { PathShapeGuardConfig } from '../edit/path-shape-guard.util'
import type { Rect } from '../core/route/shared/orthogonalRouter'
import type { ImplementerColumnBoundsMap } from '../core/route/flowchart/flowchart-column-bounds.util'
import type { FlowchartGridLayout } from '../core/route/flowchart/flowchart-grid-layout.util'
import { tryBuildDedicatedFlowchartPath } from '../core/route/flowchart/flowchart-dedicated-route.util'
import {
  computeConnectionRoutingBounds,
  resolveColumnForConnection,
} from '../core/route/flowchart/flowchart-routing-bounds.util'

/* ───────────────────────── Public types (re-export for consumers) ─────────────────────────── */

export type { FlowchartConnection } from '../core/sopDiagramTypes'
export type { UsedSides } from '../core/route/shared/connector-side.types'

export interface ArrowObstacle { id: string }

/**
 * Konvensi arah panah:
 * - Tail (pangkal) selalu di start: dari connection.from, pakai sSide & startPoint.
 * - Head (mata panah ">") selalu di end: ke connection.to, pakai eSide & endPoint.
 */
export interface PathUpdatedPayload {
  connectionId: string
  from: string
  to: string
  sSide: Side
  eSide: Side
  startPoint: ArrowPathPoint
  endPoint: ArrowPathPoint
  bendPoints: ArrowPathPoint[]
  label?: string | null
  labelPosition?: { x: number; y: number }
}

type BoundsRect = { left: number; top: number; right: number; bottom: number }

/**
 * Shared mutable ref holding segments of all already-routed arrows.
 * Each connector reads others' segments as penalties and writes its own after routing.
 * Using a ref avoids re-render loops while allowing cross-connector coordination.
 */
export type RoutedPathsRef = MutableRefObject<Map<string, OccupiedSegment[]>>

/** Clear path cache — no-op stub, kept for API compat. */
export function clearPathCache(_connectionId?: string): void {
  // no-op: module-level pathCache removed
}




function samePoint(a: ArrowPathPoint | null | undefined, b: ArrowPathPoint | null | undefined): boolean {
  if (a == null || b == null) return a === b
  return a.x === b.x && a.y === b.y
}

function samePath(a: ArrowPathPoint[], b: ArrowPathPoint[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (!samePoint(a[i], b[i])) return false
  }
  return true
}

function sameSides(a: [Side, Side], b: [Side, Side]): boolean {
  return a[0] === b[0] && a[1] === b[1]
}

function sameLabelPosition(
  a: { x: number; y: number } | null,
  b: { x: number; y: number } | null,
): boolean {
  if (a == null || b == null) return a === b
  return a.x === b.x && a.y === b.y
}


/* ───────────────────────── Props ─────────────────────────── */

interface FlowchartArrowConnectorProps {
  connection: FlowchartConnection
  idcontainer: string
  idarrow: string | number
  obstacles?: ArrowObstacle[]
  usedSides?: UsedSides
  manualConfig?: ArrowConnectionConfig | null
  manualLabelPosition?: { x: number; y: number } | null
  onPathUpdated?: (payload: PathUpdatedPayload) => void
  onManualChange?: (payload: PathUpdatedPayload) => void
  editMode?: boolean
  isSelected?: boolean
  onSelect?: (connectionId: string) => void
  constraintRect?: BoundsRect | null
  columnBounds?: ImplementerColumnBoundsMap | null
  gridLayout?: FlowchartGridLayout | null
  loopbackCorridorIndex?: number
  crossColumnGutterSlot?: number
  columnTrunkSlot?: number
  /** Shared ref for cross-arrow overlap avoidance */
  routedSegmentsRef?: RoutedPathsRef
  /** From scan phase: Map of `${targetShapeId}-${side}` → Set of connectionIds. */
  reservedSidesRef?: MutableRefObject<Map<string, Set<string>>>

  connectionIndex?: number
  allConnections?: FlowchartConnection[]
  rerouteVersion?: number
}

/* ───────────────────────── Helpers ─────────────────────────── */

type ElemPos = {
  left: number; top: number; width: number; height: number
  right: number; bottom: number
}

function getElementPosition(elementId: string, container: HTMLElement): ElemPos | null {
  const escapedId =
    typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(elementId)
      : elementId.replace(/([^a-zA-Z0-9_-])/g, '\\$1')
  const el = container.id === elementId
    ? container
    : container.querySelector<HTMLElement>(`#${escapedId}`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  const c = container.getBoundingClientRect()
  return {
    left: Math.round(r.left - c.left),
    top: Math.round(r.top - c.top),
    width: Math.round(r.width),
    height: Math.round(r.height),
    right: Math.round(r.right - c.left),
    bottom: Math.round(r.bottom - c.top),
  }
}

function resolveConnectorLabelPosition(
  path: { x: number; y: number }[],
  label: string | null | undefined,
  manualLabelPosition: { x: number; y: number } | null | undefined,
  obstacles: Rect[],
): { x: number; y: number } | null {
  if (!label) return null
  if (manualLabelPosition) return manualLabelPosition
  return placeEdgeLabel({ path, label, obstacles })
}

function pathToD(points: { x: number; y: number }[]): string {
  if (points.length < 2) return ''
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length; i++) d += ` L ${points[i].x} ${points[i].y}`
  return d
}

function toRouterBounds(bounds: BoundsRect | null | undefined) {
  if (!bounds) return null
  return {
    left: bounds.left,
    top: bounds.top,
    width: Math.max(0, bounds.right - bounds.left),
    height: Math.max(0, bounds.bottom - bounds.top),
  }
}

function clampPathToBounds(
  points: { x: number; y: number }[],
  bounds: BoundsRect | null | undefined,
): { x: number; y: number }[] {
  if (!bounds) return points.map((point) => ({ x: Math.round(point.x), y: Math.round(point.y) }))
  return points.map((point) => ({
    x: Math.round(Math.max(bounds.left, Math.min(bounds.right, point.x))),
    y: Math.round(Math.max(bounds.top, Math.min(bounds.bottom, point.y))),
  }))
}

export function normalizeConnectorPath(
  points: { x: number; y: number }[],
  bounds: BoundsRect | null | undefined,
): { x: number; y: number }[] {
  const normalized = normalizeOrthogonalPath(clampPathToBounds(points, bounds), {
    bounds: toRouterBounds(bounds),
  })
  return assertOrthogonalPath(normalized, 'FlowchartArrowConnector path')
}

function tryNormalizeConnectorPath(
  points: { x: number; y: number }[],
  bounds: BoundsRect | null | undefined,
): { x: number; y: number }[] | null {
  try {
    return normalizeConnectorPath(points, bounds)
  } catch {
    return null
  }
}

/** Path ortogonal minimal bottom→top antara dua shape; tidak throw. */
export function buildMinimalOrthogonalPath(
  fromPos: ElemPos,
  toPos: ElemPos,
): { x: number; y: number }[] {
  const x1 = Math.round(fromPos.left + fromPos.width / 2)
  const x2 = Math.round(toPos.left + toPos.width / 2)
  const y1 = Math.round(fromPos.bottom)
  const y2 = Math.round(toPos.top)
  if (x1 === x2) return [{ x: x1, y: y1 }, { x: x2, y: y2 }]
  const xMid = Math.round((x1 + x2) / 2)
  return [
    { x: x1, y: y1 },
    { x: xMid, y: y1 },
    { x: xMid, y: y2 },
    { x: x2, y: y2 },
  ]
}

/** Pastikan path siap render: normalisasi aman lalu fallback berlapis. */
export function finalizeRenderablePath(
  points: { x: number; y: number }[],
  fromPos: ElemPos,
  toPos: ElemPos,
  bounds: BoundsRect | null | undefined,
): { x: number; y: number }[] {
  const normalized = tryNormalizeConnectorPath(points, bounds)
  if (normalized && normalized.length >= 2) return normalized
  const ultimate = tryNormalizeConnectorPath(
    buildMinimalOrthogonalPath(fromPos, toPos),
    bounds,
  )
  if (ultimate && ultimate.length >= 2) return ultimate
  const emergency = tryNormalizeConnectorPath(
    [
      { x: Math.round(fromPos.left + fromPos.width / 2), y: Math.round(fromPos.bottom) },
      { x: Math.round(toPos.left + toPos.width / 2), y: Math.round(toPos.top) },
    ],
    null,
  )
  if (emergency && emergency.length >= 2) return emergency
  return buildMinimalOrthogonalPath(fromPos, toPos)
}

export function buildUltimateOrthogonalFallback(
  fromPos: ElemPos,
  toPos: ElemPos,
  bounds: BoundsRect | null | undefined,
): { x: number; y: number }[] {
  const left = bounds?.left ?? 0
  const right = bounds?.right ?? Math.max(fromPos.right, toPos.right)
  const top = bounds?.top ?? 0
  const bottom = bounds?.bottom ?? Math.max(fromPos.bottom, toPos.bottom)
  const clampX = (x: number) => Math.round(Math.max(left, Math.min(right, x)))
  const clampY = (y: number) => Math.round(Math.max(top, Math.min(bottom, y)))
  const x1 = clampX(fromPos.left + fromPos.width / 2)
  const x2 = clampX(toPos.left + toPos.width / 2)
  const y1 = clampY(fromPos.bottom)
  const y2 = clampY(toPos.top)
  const xMid = clampX((x1 + x2) / 2)
  const candidate = [
    { x: x1, y: y1 },
    { x: xMid, y: y1 },
    { x: xMid, y: y2 },
    { x: x2, y: y2 },
  ]
  const normalized = tryNormalizeConnectorPath(candidate, bounds)
  if (normalized && normalized.length >= 2) return normalized
  return buildMinimalOrthogonalPath(fromPos, toPos)
}

function isValidManualConfig(c: ArrowConnectionConfig | null | undefined): boolean {
  if (!c?.startPoint || !c?.endPoint) return false
  const { startPoint: s, endPoint: e } = c
  return [s.x, s.y, e.x, e.y].every(v => typeof v === 'number' && !isNaN(v))
}

/* ─────────────────────────────────────────────────────────────────
 *  Side-pair selection — implements the arrow connector algorithm:
 *
 *  Case 0: Start (terminator) → next task: head selalu top; tail
 *          menurut posisi: start kiri → right→top, sejajar → bottom→top,
 *          start kanan → left→top.
 *  Case 1: Same column → tail=bottom, head=top (straight vertical)
 *  Case 2: Different columns →
 *          dest RIGHT: P1 bottom→left,  P2 right→top
 *          dest LEFT:  P1 bottom→right, P2 left→top
 *  Case 3: Decision branching →
 *    3.1  Ya/Tidak "next-to" outputs: follow Case 1/2, but Tidak
 *         always uses horizontal exit to avoid overlap with Ya.
 *    3.2  Loop-back (dest above src): use horizontal U-turn
 *         (right→right or left→left), checking usedSides.
 *
 *  Overlap prevention: before choosing a route, check usedSides to
 *  see if the anchor is already occupied. If so, switch to the
 *  alternative pair.
 * ─────────────────────────────────────────────────────────────── */

function isYaLabel(lbl: string): boolean {
  return /^(ya|yes|y)$/.test((lbl ?? '').trim().toLowerCase())
}

function isTidakLabel(lbl: string): boolean {
  return /^(tidak|no|n)$/.test((lbl ?? '').trim().toLowerCase())
}

/* ───────────────────────── Constants ─────────────────────────── */

const SHAPE_MARGIN = 16
const BOUNDS_MARGIN = 15
/** Inset from pelaksana column left/right so path never touches vertical cell borders. */
const PATH_COLUMN_INSET = 24
/** Extra inset on right to avoid path crossing into Mutu Baku. */
const PATH_COLUMN_INSET_RIGHT_EXTRA = 12
/** Inset from container top/bottom so path does not sit on horizontal border. */
const PATH_VERTICAL_INSET = 12
/** Penalty per pixel of horizontal span to prefer less "ruwet" paths. */
const HORIZONTAL_SPAN_PENALTY_PER_PX = 0.55
/** Inset applied to globalBounds when passing to router. */
const ROUTER_INTERNAL_INSET = 4
/** Max candidates to try per routing attempt. */
const MAX_TRIES = 4
/** Score threshold: if score <= this, skip remaining candidates. */
const GOOD_SCORE_LIMIT = 480

/* ───────────────────────── Component ─────────────────────────── */

export function FlowchartArrowConnector({
  connection,
  idcontainer,
  idarrow,
  obstacles = [],
  usedSides = {},
  manualConfig,
  manualLabelPosition,
  onPathUpdated,
  onManualChange,
  editMode = false,
  isSelected = false,
  onSelect,
  constraintRect = null,
  columnBounds = null,
  gridLayout = null,
  loopbackCorridorIndex = 0,
  crossColumnGutterSlot = 0,
  columnTrunkSlot = 0,
  routedSegmentsRef,
  reservedSidesRef,
  connectionIndex = 0,
  allConnections = [],
  rerouteVersion = 0,
}: FlowchartArrowConnectorProps) {
  const [pathData, setPathData] = useState('')
  const [labelPos, setLabelPos] = useState<{ x: number; y: number } | null>(null)
  const [resolvedSides, setResolvedSides] = useState<[Side, Side]>(['bottom', 'top'])
  const [resolvedPath, setResolvedPath] = useState<ArrowPathPoint[]>([])
  const [editableAnchors, setEditableAnchors] = useState<DiagramPathAnchor[]>([])
  const [shapeSnapTargets, setShapeSnapTargets] = useState<DiagramShapeSnapTargets | null>(null)
  const routingGuardRef = useRef<{
    obsRects: Rect[]
    fromShape: Rect
    toShape: Rect
    globalBounds: Rect
    boundsMargin: number
  } | null>(null)
  const emittedRef = useRef(false)
  const lastAutoSigRef = useRef<string | null>(null)

  // Store mutable props in refs so the effect always reads fresh values
  // without needing them as dependencies (prevents cascade re-routing).
  const usedSidesRef = useRef(usedSides)
  usedSidesRef.current = usedSides
  const onPathUpdatedRef = useRef(onPathUpdated)
  onPathUpdatedRef.current = onPathUpdated
  const onManualChangeRef = useRef(onManualChange)
  onManualChangeRef.current = onManualChange
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useLayoutEffect(() => {
    let cancelled = false
    let positionRetryCount = 0
    const MAX_POSITION_RETRIES = 3

    const applyLayout = () => {
    if (cancelled) return
    const container = document.getElementById(idcontainer)
    if (!container) {
      setPathData('')
      setLabelPos(null)
      setEditableAnchors([])
      setShapeSnapTargets(null)
      routingGuardRef.current = null
      return
    }
    const fromPos = getElementPosition(connection.from, container)
    const toPos = getElementPosition(connection.to, container)
    if (!fromPos || !toPos) {
      if (positionRetryCount < MAX_POSITION_RETRIES) {
        positionRetryCount += 1
        requestAnimationFrame(applyLayout)
        return
      }
      setPathData('')
      setLabelPos(null)
      setEditableAnchors([])
      setShapeSnapTargets(null)
      routingGuardRef.current = null
      return
    }
    const fromRect = elemPosToShapeRect(fromPos)
    const toRect = elemPosToShapeRect(toPos)
    const fromIsDiamond = connection.sourceType === 'flowchart-decision'
    const toIsDiamond = connection.targetType === 'flowchart-decision'
    setEditableAnchors(
      buildVisualConnectorAnchors(connection.id, fromRect, toRect, { fromIsDiamond, toIsDiamond }),
    )
    setShapeSnapTargets({
      connectionId: connection.id,
      fromNodeId: connection.from,
      toNodeId: connection.to,
      start: fromRect,
      end: toRect,
      startIsDiamond: fromIsDiamond,
      endIsDiamond: toIsDiamond,
    })

    const isOpcConnection =
      connection.sourceType === 'flowchart-opc' || connection.targetType === 'flowchart-opc'
    const HEADER_OBSTACLE_PREFIX = 'sop-page-'
    const HEADER_OBSTACLE_SUFFIX = 'table-header'
    const obsRects = obstacles
      .map(o => o.id)
      .filter(id => id !== connection.from && id !== connection.to)
      .map(id => {
        const r = getElementPosition(id, container)
        if (!r) return null
        const rect = { left: r.left, top: r.top, width: r.width, height: r.height }
        if (isOpcConnection && id.startsWith(HEADER_OBSTACLE_PREFIX) && id.endsWith(HEADER_OBSTACLE_SUFFIX)) {
          const pad = 18
          return {
            left: Math.max(0, rect.left - pad),
            top: Math.max(0, rect.top - pad),
            width: rect.width + 2 * pad,
            height: rect.height + 2 * pad,
          }
        }
        return rect
      })
      .filter((r): r is Rect => r != null)
    const pathAllowedBounds = constraintRect
      ? (() => {
          const left = Math.round(constraintRect.left + PATH_COLUMN_INSET)
          const right = Math.round(constraintRect.right - PATH_COLUMN_INSET - PATH_COLUMN_INSET_RIGHT_EXTRA)
          const w = Math.max(20, right - left)
          const top = Math.round(constraintRect.top + PATH_VERTICAL_INSET)
          const bottom = Math.round(constraintRect.bottom - PATH_VERTICAL_INSET)
          const height = Math.max(40, bottom - top)
          return { left, top, width: w, height }
        })()
      : null
    const globalBounds = pathAllowedBounds
      ? {
          left: pathAllowedBounds.left + ROUTER_INTERNAL_INSET,
          top: pathAllowedBounds.top + ROUTER_INTERNAL_INSET,
          width: Math.max(12, pathAllowedBounds.width - 2 * ROUTER_INTERNAL_INSET),
          height: Math.max(40, pathAllowedBounds.height - 2 * ROUTER_INTERNAL_INSET),
        }
      : {
          left: 0,
          top: 0,
          width: container.scrollWidth,
          height: container.scrollHeight,
        }
    const fromShape = { left: fromPos.left, top: fromPos.top, width: fromPos.width, height: fromPos.height }
    const toShape = { left: toPos.left, top: toPos.top, width: toPos.width, height: toPos.height }
    const canvasW = pathAllowedBounds ? pathAllowedBounds.width : (constraintRect ? constraintRect.right - constraintRect.left : 0)
    const boundsMargin = canvasW > 0 ? Math.min(28, Math.max(18, Math.round(canvasW * 0.022))) : BOUNDS_MARGIN
    routingGuardRef.current = {
      obsRects,
      fromShape,
      toShape,
      globalBounds,
      boundsMargin,
    }

    /* ── Manual path ─────────────────────────────────────────── */
    if (isValidManualConfig(manualConfig) && manualConfig!.startPoint && manualConfig!.endPoint) {
      const { startPoint, endPoint, bendPoints = [] } = manualConfig!
      const manualPath = tryNormalizeConnectorPath([startPoint, ...bendPoints, endPoint], constraintRect)
      if (manualPath) {
        setPathData(pathToD(manualPath))
        setResolvedPath((prev) => (samePath(prev, manualPath) ? prev : manualPath.map((p) => ({ ...p }))))
        setResolvedSides((prev) => {
          const next: [Side, Side] = [manualConfig!.sSide, manualConfig!.eSide]
          return sameSides(prev, next) ? prev : next
        })

        const lp = resolveConnectorLabelPosition(
          manualPath,
          connection.label,
          manualLabelPosition,
          obsRects,
        )
        setLabelPos((prev) => (sameLabelPosition(prev, lp) ? prev : lp))

        if (onPathUpdatedRef.current && !emittedRef.current) {
          onPathUpdatedRef.current({
            connectionId: connection.id, from: connection.from, to: connection.to,
            sSide: manualConfig!.sSide, eSide: manualConfig!.eSide,
            startPoint: { ...manualPath[0] }, endPoint: { ...manualPath[manualPath.length - 1] },
            bendPoints: manualPath.slice(1, -1).map(p => ({ ...p })),
            label: connection.label ?? undefined,
            labelPosition: lp ?? undefined,
          })
          emittedRef.current = true
        }
        return
      }
    }

    emittedRef.current = false

    /* ── Auto-routing (Grid + Dijkstra) ──────────────────────── */
    const effectiveBounds: BoundsRect | null = pathAllowedBounds
      ? {
          left: pathAllowedBounds.left,
          top: pathAllowedBounds.top,
          right: pathAllowedBounds.left + pathAllowedBounds.width,
          bottom: pathAllowedBounds.top + pathAllowedBounds.height,
        }
      : constraintRect
    const corridorGraph = false // corridor graph no longer used; kept for type compat
    void corridorGraph

    const dy = (toPos.top + toPos.height / 2) - (fromPos.top + fromPos.height / 2)
    const dx = (toPos.left + toPos.width / 2) - (fromPos.left + fromPos.width / 2)
    const destAbove = dy < -10
    const destBelow = dy > 10
    const colThreshold = Math.max(fromPos.width, toPos.width) * 0.5
    const sameCol = Math.abs(dx) < colThreshold
    const isSameColumnLoopBack = destAbove && sameCol
    const isLoopBack = destAbove && connection.sourceType === 'flowchart-decision'
    const loopbackBoundsMargin = isLoopBack
      ? (canvasW > 0 ? Math.min(60, Math.max(32, Math.round(canvasW * 0.05))) : 36)
      : boundsMargin
    if (routingGuardRef.current) {
      routingGuardRef.current.boundsMargin = loopbackBoundsMargin
    }

    const reservedSides = reservedSidesRef?.current
    const routeCandidates = selectFlowchartRouteCandidates(
      connection,
      fromPos,
      toPos,
      usedSidesRef.current,
      reservedSides,
      connection.to,
      connection.id,
    )
    const sourceColumn = resolveColumnForConnection(
      connection.fromImplementerId,
      fromPos.left + fromPos.width / 2,
      fromPos.left,
      fromPos.right,
      columnBounds,
      constraintRect,
    )
    const targetColumn = resolveColumnForConnection(
      connection.toImplementerId,
      toPos.left + toPos.width / 2,
      toPos.left,
      toPos.right,
      columnBounds,
      constraintRect,
    )
    const isCrossColumn =
      sourceColumn != null &&
      targetColumn != null &&
      (
        Math.abs(sourceColumn.left - targetColumn.left) >= 4 ||
        Math.abs(sourceColumn.right - targetColumn.right) >= 4
      )
    const connectionRoutingBounds = computeConnectionRoutingBounds({
      pelaksana: constraintRect,
      sourceColumn,
      targetColumn,
      isCrossColumn,
    })

    // Collect occupied segments from other already-routed arrows
    const occupied: OccupiedSegment[] = []
    if (routedSegmentsRef) {
      for (const [id, segs] of routedSegmentsRef.current) {
        if (id !== connection.id) occupied.push(...segs)
      }
    }

    const used = usedSidesRef.current
    const anchorDistance = (shapeId: string, side: Side, count: number) => {
      const shape =
        shapeId === connection.from
          ? fromShape
          : shapeId === connection.to
            ? toShape
            : fromShape
      return preferCenterAnchorDistance(count, sideLengthPx(shape, side))
    }
    const usedAnchorCount = (shapeId: string, side: Side) => {
      const sideUsage = used[shapeId]
      const incoming = (sideUsage?.in?.[side] ?? []).filter((id) => id !== connection.id).length
      const outgoing = (sideUsage?.out?.[side] ?? []).filter((id) => id !== connection.id).length
      return incoming + outgoing
    }
    const priorShapeUseCount = (shapeId: string) =>
      allConnections.filter((item, index) =>
        index < connectionIndex &&
        item.id !== connection.id &&
        (item.from === shapeId || item.to === shapeId)
      ).length

    const isSafePath = (path: { x: number; y: number }[]) =>
      isAcceptableRoutedPath(path, createPathSafetyOptions('flowchart', {
        obstacles: obsRects,
        occupied,
        fromShape,
        toShape,
      }))
    const isShapeSafePath = (path: { x: number; y: number }[]) =>
      isAcceptableRoutedPath(path, createPathSafetyOptions('flowchart', {
        obstacles: obsRects,
        occupied: [],
        fromShape,
        toShape,
      }))



    const runRouting = () => {
    let bestPath: { x: number; y: number }[] | null = null
    let bestSides: [Side, Side] | null = null
    let bestScore = Infinity

    const preferHorizontalLoopback =
      isLoopBack && isTidakLabel(connection.label ?? '')
    const preferYaBottomTail =
      destBelow && connection.sourceType === 'flowchart-decision' && isYaLabel(connection.label ?? '')
    const preferOpcStraight =
      destBelow && (connection.targetType === 'flowchart-opc' || connection.sourceType === 'flowchart-opc')
    const preferredCandidate = routeCandidates[0]
    const sourceJetty =
      preferredCandidate?.sourceJettySize ??
      preferredCandidate?.jettySize ??
      SHAPE_MARGIN
    const targetJetty =
      preferredCandidate?.targetJettySize ??
      preferredCandidate?.jettySize ??
      SHAPE_MARGIN

    // First pass: cari L-shape aman pada seluruh pasangan port. Jalur channel
    // dan multi-bend hanya dipakai bila tidak ada L yang valid.
    for (const [candidateIndex, candidate] of routeCandidates.slice(0, MAX_TRIES).entries()) {
      const { sSide, eSide } = candidate
      const usageA = Math.max(
        usedAnchorCount(connection.from, sSide),
        priorShapeUseCount(connection.from),
      )
      const usageB = Math.max(
        usedAnchorCount(connection.to, eSide),
        priorShapeUseCount(connection.to),
      )
      const distA = anchorDistance(connection.from, sSide, usageA)
      const distB = anchorDistance(connection.to, eSide, usageB)
      const path = routeOrthogonal({
        pointA: { shape: fromShape, side: sSide, distance: distA },
        pointB: { shape: toShape, side: eSide, distance: distB },
        obstacles: obsRects,
        shapeMargin: SHAPE_MARGIN,
        globalBounds,
        globalBoundsMargin: loopbackBoundsMargin,
        occupiedSegments: occupied,
        sourcePort: candidate.sourcePort,
        targetPort: candidate.targetPort,
        jettySize: candidate.jettySize,
        sourceJettySize: candidate.sourceJettySize,
        targetJettySize: candidate.targetJettySize,
        preferSimple: true,
        lShapeOnly: true,
      })
      if (path.length < 2) continue
      const normalizedPath = tryNormalizeConnectorPath(path, effectiveBounds)
      if (!normalizedPath || !isSafePath(normalizedPath)) continue
      const score =
        scorePath(normalizedPath, occupied) +
        scoreAnchorOffCenter(distA) +
        scoreAnchorOffCenter(distB) +
        candidateIndex * 120
      if (score < bestScore) {
        bestPath = normalizedPath
        bestSides = [sSide, eSide]
        bestScore = score
      }
    }

    if (!bestPath) {
      const dedicated = tryBuildDedicatedFlowchartPath({
        fromShape,
        toShape,
        fromIsDiamond,
        toIsDiamond,
        sourceColumn,
        targetColumn,
        routingBounds: connectionRoutingBounds ?? constraintRect,
        columns: columnBounds,
        pelaksana: constraintRect,
        gridLayout,
        obstacles: obsRects,
        occupied,
        destAbove,
        destBelow,
        sameCol,
        isCrossColumn,
        isLinearDown: destBelow && !destAbove && !isCrossColumn,
        sourceType: connection.sourceType,
        targetType: connection.targetType,
        fromId: connection.from,
        toId: connection.to,
        loopbackCorridorIndex,
        crossColumnGutterSlot,
        columnTrunkSlot,
        sourceJetty,
        targetJetty,
      })
      if (dedicated) {
        const normalized = tryNormalizeConnectorPath(dedicated.path, effectiveBounds)
        if (normalized && isSafePath(normalized)) {
          bestPath = normalized
          bestSides = [dedicated.sSide, dedicated.eSide]
        }
      }
    }

    for (const candidate of bestPath ? [] : routeCandidates.slice(0, MAX_TRIES)) {
      const { sSide, eSide } = candidate
      const usageA = Math.max(
        usedAnchorCount(connection.from, sSide),
        priorShapeUseCount(connection.from),
      )
      const usageB = Math.max(
        usedAnchorCount(connection.to, eSide),
        priorShapeUseCount(connection.to),
      )
      const distA = anchorDistance(connection.from, sSide, usageA)
      const distB = anchorDistance(connection.to, eSide, usageB)

      const pointA = { shape: fromShape, side: sSide, distance: distA }
      const pointB = { shape: toShape, side: eSide, distance: distB }
      // Always use routeOrthogonal (corridor graph no longer needed)
      const path = routeOrthogonal({
        pointA,
        pointB,
        obstacles: obsRects,
        shapeMargin: SHAPE_MARGIN,
        globalBounds,
        globalBoundsMargin: loopbackBoundsMargin,
        occupiedSegments: occupied,
        sourcePort: candidate.sourcePort,
        targetPort: candidate.targetPort,
        jettySize: candidate.jettySize,
        sourceJettySize: candidate.sourceJettySize,
        targetJettySize: candidate.targetJettySize,
        preferSimple: candidate.preferSimple,
      })

      if (path.length < 2) continue
      const normalizedPath = tryNormalizeConnectorPath(path, effectiveBounds)
      if (!normalizedPath) continue
      if (!isSafePath(normalizedPath)) continue
      let score = scorePath(normalizedPath, occupied)
      score += scoreAnchorOffCenter(distA) + scoreAnchorOffCenter(distB)
      score += Math.max(0, normalizedPath.length - 2) * 40

      // Kurangi path "ruwet": penalisasi rentang horizontal lebar agar path tidak memanjang ke samping tidak perlu
      const pathMinX = Math.min(...normalizedPath.map((p) => p.x))
      const pathMaxX = Math.max(...normalizedPath.map((p) => p.x))
      score += (pathMaxX - pathMinX) * HORIZONTAL_SPAN_PENALTY_PER_PX

      // Untuk decision Tidak loop-back, paksa prioritas tinggi ke anchor horizontal (right→right / left→left)
      // dibanding kombinasi lain (mis. right→top) meskipun path-nya sedikit lebih panjang.
      if (preferHorizontalLoopback) {
        const isHorizontal = (sSide === eSide) && (sSide === 'left' || sSide === 'right')
        if (!isHorizontal) score += 10_000
        const fromCx = fromPos.left + fromPos.width / 2
        const toCx = toPos.left + toPos.width / 2
        if (toCx < fromCx - 8) {
          if (sSide !== 'left' || eSide !== 'left') score += 4_000
        } else if (toCx > fromCx + 8) {
          if (sSide !== 'right' || eSide !== 'right') score += 4_000
        }
      }

      // Untuk decision Ya ke bawah: tail harus dari bottom agar tidak bersilangan dengan
      // linear atau branch lain. Contoh: 8 Ya → 9, tail dari bottom 8.
      if (preferYaBottomTail) {
        if (sSide !== 'bottom') score += 8_000
        const fromCx = fromPos.left + fromPos.width / 2
        const toCx = toPos.left + toPos.width / 2
        if (toCx < fromCx - 8 && eSide !== 'right') score += 3_000
        if (toCx > fromCx + 8 && eSide !== 'left') score += 3_000
      }

      // OPC: Step → OPC-out lurus ke bawah (tail bottom, head top); OPC-in → Step keluar bottom.
      if (preferOpcStraight) {
        if (connection.targetType === 'flowchart-opc' && eSide !== 'top') score += 6_000
        if (connection.sourceType === 'flowchart-opc' && sSide !== 'bottom') score += 6_000
      }

      if (sameCol && destBelow && !isSameColumnLoopBack) {
        if (sSide === 'bottom' && eSide === 'top') score -= 6_000
        else score += 8_000
      }
      if (sameCol && destAbove && !isSameColumnLoopBack) {
        if (sSide === 'top' && eSide === 'bottom') score -= 6_000
        else score += 8_000
      }

      if (score < bestScore) {
        bestPath = normalizedPath; bestSides = [sSide, eSide]; bestScore = score
        if (score <= GOOD_SCORE_LIMIT) break
      }
    }

    if (!bestPath || !bestSides) {
      const fallbackCandidate = routeCandidates[0]
      const sSide = fallbackCandidate?.sSide ?? 'bottom'
      const eSide = fallbackCandidate?.eSide ?? 'top'
      const fallbackPath = routeOrthogonal({
        pointA: { shape: fromShape, side: sSide, distance: 0.5 },
        pointB: { shape: toShape, side: eSide, distance: 0.5 },
        obstacles: obsRects,
        shapeMargin: SHAPE_MARGIN,
        globalBounds,
        globalBoundsMargin: loopbackBoundsMargin,
        occupiedSegments: occupied,
        sourcePort: fallbackCandidate?.sourcePort,
        targetPort: fallbackCandidate?.targetPort,
        jettySize: fallbackCandidate?.jettySize,
        sourceJettySize: fallbackCandidate?.sourceJettySize,
        targetJettySize: fallbackCandidate?.targetJettySize,
        preferSimple: fallbackCandidate?.preferSimple ?? true,
      })
      if (fallbackPath.length >= 2) {
        const normalizedFallback = tryNormalizeConnectorPath(fallbackPath, effectiveBounds)
        if (normalizedFallback && isSafePath(normalizedFallback)) {
          bestPath = normalizedFallback
          bestSides = [sSide, eSide]
        }
      }
      if (!bestPath) {
        // Konflik connector boleh dilonggarkan sebagai fallback, tetapi shape
        // tetap hard constraint. Nilai dengan occupied asli agar jalur dengan
        // crossing/overlap paling kecil yang dipilih.
        let softFallbackScore = Infinity
        for (const candidate of routeCandidates.slice(0, MAX_TRIES)) {
          const softFallback = routeOrthogonal({
            pointA: { shape: fromShape, side: candidate.sSide, distance: 0.5 },
            pointB: { shape: toShape, side: candidate.eSide, distance: 0.5 },
            obstacles: obsRects,
            shapeMargin: SHAPE_MARGIN,
            globalBounds,
            globalBoundsMargin: loopbackBoundsMargin,
            occupiedSegments: [],
            sourcePort: candidate.sourcePort,
            targetPort: candidate.targetPort,
            jettySize: candidate.jettySize,
            sourceJettySize: candidate.sourceJettySize,
            targetJettySize: candidate.targetJettySize,
            preferSimple: candidate.preferSimple ?? true,
          })
          const normalizedFallback = tryNormalizeConnectorPath(softFallback, effectiveBounds)
          if (!normalizedFallback || !isShapeSafePath(normalizedFallback)) continue
          const fallbackScore = scorePath(normalizedFallback, occupied)
          if (fallbackScore < softFallbackScore) {
            bestPath = normalizedFallback
            bestSides = [candidate.sSide, candidate.eSide]
            softFallbackScore = fallbackScore
          }
        }
      }
      if (!bestPath) {
        bestPath = buildUltimateOrthogonalFallback(fromPos, toPos, effectiveBounds)
        bestSides = ['bottom', 'top']
      }
    }

    const pathForRender = bestPath ?? buildUltimateOrthogonalFallback(fromPos, toPos, effectiveBounds)
    bestPath = finalizeRenderablePath(pathForRender, fromPos, toPos, effectiveBounds)
    bestSides = bestSides ?? ['bottom', 'top']
    const resolvedSidesFinal: [Side, Side] = bestSides ?? ['bottom', 'top']
    setResolvedSides((prev) => (sameSides(prev, resolvedSidesFinal) ? prev : resolvedSidesFinal))
    setResolvedPath((prev) => (samePath(prev, bestPath) ? prev : bestPath.map((p) => ({ ...p }))))

    // Register this arrow's segments for other arrows to avoid
    if (routedSegmentsRef) {
      try {
        routedSegmentsRef.current.set(connection.id, pathToSegments(bestPath))
      } catch {
        routedSegmentsRef.current.delete(connection.id)
      }
    }

    setPathData(pathToD(bestPath))

    let lp: { x: number; y: number } | null = null
    if (connection.label && bestPath.length >= 2) {
      lp = resolveConnectorLabelPosition(
        bestPath,
        connection.label,
        manualLabelPosition,
        obsRects,
      )
    }
    setLabelPos((prev) => (sameLabelPosition(prev, lp) ? prev : lp))

    const [sSide, eSide] = resolvedSidesFinal
    const payload: PathUpdatedPayload = {
      connectionId: connection.id, from: connection.from, to: connection.to,
      sSide, eSide,
      startPoint: { ...bestPath[0] },
      endPoint: { ...bestPath[bestPath.length - 1] },
      bendPoints: bestPath.slice(1, -1).map(p => ({ ...p })),
      label: connection.label ?? undefined,
      labelPosition: lp ?? undefined,
    }
    const sig = `${connection.id}:${sSide}:${eSide}:${JSON.stringify(bestPath)}`
    if (onPathUpdatedRef.current && lastAutoSigRef.current !== sig) {
      lastAutoSigRef.current = sig
      onPathUpdatedRef.current(payload)
    }
    }

    if (editMode && isValidManualConfig(manualConfig)) {
      return
    }

    // Routing sinkron dalam useLayoutEffect agar urutan connectionIndex terjaga
    // dan occupiedSegments dari koneksi sebelumnya sudah terdaftar.
    try {
      runRouting()
    } catch {
      const emergency = finalizeRenderablePath(
        buildMinimalOrthogonalPath(fromPos, toPos),
        fromPos,
        toPos,
        effectiveBounds,
      )
      setResolvedSides(['bottom', 'top'])
      setResolvedPath(emergency.map((p) => ({ ...p })))
      if (routedSegmentsRef) {
        routedSegmentsRef.current.set(connection.id, pathToSegments(emergency))
      }
      setPathData(pathToD(emergency))
    }
    }

    applyLayout()
    const capturedRoutedSegments = routedSegmentsRef?.current
    return () => {
      cancelled = true
      capturedRoutedSegments?.delete(connection.id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- callbacks via refs; obstacles via layout reads
  }, [
    idcontainer, connection.id, connection.from, connection.to,
    connection.label, connection.sourceType, connection.targetType,
    connectionIndex, allConnections,
    manualConfig, manualLabelPosition, obstacles, constraintRect, editMode,
    columnBounds, gridLayout, loopbackCorridorIndex, crossColumnGutterSlot, columnTrunkSlot,
    routedSegmentsRef, reservedSidesRef,
    rerouteVersion,
  ])

  if (!pathData) return null
  const effectiveLabelPos = manualLabelPosition ?? labelPos
  const markerId = `arrowhead-flow-${idarrow}`

  if (editMode && isSelected && resolvedPath.length >= 2) {
    const guardCtx = routingGuardRef.current
    const shapeGuard: PathShapeGuardConfig | null = guardCtx
      ? {
          check: {
            kind: 'flowchart',
            path: resolvedPath,
            obstacles: guardCtx.obsRects,
            fromShape: guardCtx.fromShape,
            toShape: guardCtx.toShape,
          },
          repair: {
            kind: 'flowchart',
            startPoint: { ...resolvedPath[0]! },
            endPoint: { ...resolvedPath[resolvedPath.length - 1]! },
            sSide: resolvedSides[0],
            eSide: resolvedSides[1],
            fromShape: guardCtx.fromShape,
            toShape: guardCtx.toShape,
            obstacles: guardCtx.obsRects,
            flowchart: {
              globalBounds: guardCtx.globalBounds,
              globalBoundsMargin: guardCtx.boundsMargin,
              corridorGraph: null,
            },
          },
        }
      : null
    return (
      <g>
        <defs>
          <marker id={markerId} markerWidth="10" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 L2,4 Z" fill="black" />
          </marker>
        </defs>
        <EditableOrthogonalPath
          path={resolvedPath}
          sSide={resolvedSides[0]}
          eSide={resolvedSides[1]}
          anchors={editableAnchors}
          shapeSnapTargets={shapeSnapTargets}
          shapeGuard={shapeGuard}
          connectionId={connection.id}
          isSelected={isSelected}
          markerEndId={markerId}
          onSelect={onSelectRef.current ?? (() => {})}
          onChange={(payload) => {
            const nextPath = [payload.startPoint, ...payload.bendPoints, payload.endPoint]
            const updatedPayload = {
              connectionId: connection.id,
              from: connection.from,
              to: connection.to,
              ...payload,
              label: connection.label ?? undefined,
              labelPosition: effectiveLabelPos ?? undefined,
            }
            setResolvedPath((prev) => (samePath(prev, nextPath) ? prev : nextPath))
            setResolvedSides((prev) => {
              const next: [Side, Side] = [payload.sSide, payload.eSide]
              return sameSides(prev, next) ? prev : next
            })
            setPathData(pathToD(nextPath))
            onPathUpdatedRef.current?.(updatedPayload)
            onManualChangeRef.current?.(updatedPayload)
          }}
          onDeleteSelected={() => onManualChangeRef.current?.({
            connectionId: connection.id,
            from: connection.from,
            to: connection.to,
            sSide: resolvedSides[0],
            eSide: resolvedSides[1],
            startPoint: resolvedPath[0]!,
            endPoint: resolvedPath[resolvedPath.length - 1]!,
            bendPoints: [],
            label: connection.label ?? undefined,
          })}
        />
        {connection.label && effectiveLabelPos && (
          <text
            x={effectiveLabelPos.x} y={effectiveLabelPos.y}
            textAnchor="middle" dominantBaseline="middle"
            fontSize="11" fontFamily="Arial" fill="black"
            style={{ pointerEvents: 'none' }}
          >
            {connection.label}
          </text>
        )}
      </g>
    )
  }

  return (
    <g>
      <defs>
        <marker
          id={markerId}
          markerWidth="10" markerHeight="8" refX="7" refY="4" orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 L2,4 Z" fill="black" />
        </marker>
      </defs>
      <path
        d={pathData}
        fill="none"
        stroke="transparent"
        strokeWidth={editMode ? 14 : 2}
        style={editMode ? { pointerEvents: 'stroke', cursor: 'pointer' } : { pointerEvents: 'none' }}
        onClick={
          editMode
            ? (e) => {
                e.stopPropagation()
                onSelectRef.current?.(connection.id)
              }
            : undefined
        }
      />
      <path
        className="sop-connector-stroke"
        d={pathData}
        fill="none"
        stroke="black"
        strokeWidth={2}
        markerEnd={`url(#${markerId})`}
        style={{ pointerEvents: 'none' }}
      />
      {connection.label && effectiveLabelPos && (
        <text
          x={effectiveLabelPos.x} y={effectiveLabelPos.y}
          textAnchor="middle" dominantBaseline="middle"
          fontSize="11" fontFamily="Arial" fill="black"
          style={{ pointerEvents: 'none' }}
        >
          {connection.label}
        </text>
      )}
    </g>
  )
}
