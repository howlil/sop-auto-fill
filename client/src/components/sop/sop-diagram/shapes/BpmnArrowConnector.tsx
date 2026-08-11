import { useLayoutEffect, useState, useRef, type MutableRefObject } from 'react'
import type { ArrowConnectionConfig, ArrowPathPoint } from '../core/sopDiagramTypes'
import {
  routeBpmn,
  routeBpmnAllowOccupiedFallback,
  selectBpmnSidePairs,
  scoreBpmnPath,
  scoreBpmnRouteCandidate,
  bpmnPathToSegments,
  translateBpmnLaneLayoutToDom,
  type BpmnConnectionMeta,
  type BpmnLaneLayout,
  type BpmnRouteCandidate,
  type BpmnRouteOptions,
  type UsedSides,
  type Side,
  type OccupiedSegment,
} from '../core/route/bpmn/bpmnRouter'
import { EditableOrthogonalPath } from '../edit/EditableOrthogonalPath'
import { pathToD as pathToDUtil, simplifyOrthogonalPath } from '../edit/orthogonal-path-edit.util'
import {
  buildVisualConnectorAnchors,
  elemPosToShapeRect,
  preferCenterAnchorDistance,
  scoreAnchorOffCenter,
  sideLengthPx,
  type DiagramPathAnchor,
  type DiagramShapeSnapTargets,
} from '../edit/anchor-snap.util'
import type { PathShapeGuardConfig } from '../edit/path-shape-guard.util'
import type { Rect } from '../core/route/shared/orthogonalRouter'
import { buildSideAnchoredFallbackPath } from '../core/route/bpmn/bpmn-fallback-path.util'
import { createPathSafetyOptions, isAcceptableRoutedPath } from '../core/route/quality/path-route-quality.util'
import { placeEdgeLabel } from '../core/route/shared/edge-label-placement.util'
import type { PlannedBpmnPath } from '../core/route/bpmn/global/bpmn-routing-plan'

/* ───────────────────────── Public types ─────────────────────────── */

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

export type RoutedPathsRef = MutableRefObject<Map<string, OccupiedSegment[]>>

/* ───────────────────────── Props ─────────────────────────── */

interface BpmnArrowConnectorProps {
  connection: BpmnConnectionMeta
  idcontainer: string
  idarrow: string | number
  obstacles: Array<{ id: string }>
  usedSides: UsedSides
  laneLayout: BpmnLaneLayout
  /** Index of this connection in the full list; used for deterministic anchor slots (no 2 heads at same point). */
  connectionIndex: number
  /** Full list of connection metas; used with connectionIndex to assign slot by order. */
  allConnectionsMeta: BpmnConnectionMeta[]
  manualConfig?: ArrowConnectionConfig | null
  manualLabelPosition?: { x: number; y: number } | null
  onPathUpdated?: (payload: PathUpdatedPayload) => void
  onManualChange?: (payload: PathUpdatedPayload) => void
  editMode?: boolean
  isSelected?: boolean
  onSelect?: (connectionId: string) => void
  constraintRect?: { left: number; top: number; right: number; bottom: number } | null
  routedSegmentsRef?: RoutedPathsRef
  rerouteVersion?: number
  /** Precomputed obstacle rects from parent (saves DOM reads when set). */
  obstacleRectsRef?: MutableRefObject<Array<{ left: number; top: number; width: number; height: number }> | null>
  /** Parent-level result. Missing value keeps the per-connector fallback available. */
  plannedPath?: PlannedBpmnPath | null
  /** Map logical workflow node IDs to IDs isolated inside this rendered DOM tree. */
  resolveElementId?: (logicalElementId: string) => string
}

/* ───────────────────────── Helpers ─────────────────────────── */

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

type ElemPos = {
  left: number; top: number; width: number; height: number
  right: number; bottom: number
}

function getElementScale(element: HTMLElement): { x: number; y: number } {
  const rect = element.getBoundingClientRect()
  return {
    x: element.offsetWidth > 0 ? rect.width / element.offsetWidth : 1,
    y: element.offsetHeight > 0 ? rect.height / element.offsetHeight : 1,
  }
}

function getElementPosition(
  elementId: string,
  container: HTMLElement,
  resolveElementId: (logicalElementId: string) => string,
): ElemPos | null {
  const el = container.querySelector<SVGElement>(`#${CSS.escape(resolveElementId(elementId))}`)
  if (!el) return null
  const containerRect = container.getBoundingClientRect()
  const scale = getElementScale(container)
  if (el instanceof SVGGraphicsElement) {
    try {
      const bbox = el.getBBox()
      const ctm = el.getScreenCTM()
      if (ctm && bbox.width > 0 && bbox.height > 0) {
        const topLeft = new DOMPoint(bbox.x, bbox.y).matrixTransform(ctm)
        const bottomRight = new DOMPoint(bbox.x + bbox.width, bbox.y + bbox.height).matrixTransform(ctm)
        const left = Math.round((topLeft.x - containerRect.left) / scale.x)
        const top = Math.round((topLeft.y - containerRect.top) / scale.y)
        const right = Math.round((bottomRight.x - containerRect.left) / scale.x)
        const bottom = Math.round((bottomRight.y - containerRect.top) / scale.y)
        const width = Math.max(1, right - left)
        const height = Math.max(1, bottom - top)
        if (width > 0 && height > 0) {
          return { left, top, width, height, right, bottom }
        }
      }
    } catch {
      /* getBBox/CTM gagal — fallback ke getBoundingClientRect */
    }
  }
  const shapeRect = el.getBoundingClientRect()
  return {
    left: Math.round((shapeRect.left - containerRect.left) / scale.x),
    top: Math.round((shapeRect.top - containerRect.top) / scale.y),
    width: Math.round(shapeRect.width / scale.x),
    height: Math.round(shapeRect.height / scale.y),
    right: Math.round((shapeRect.right - containerRect.left) / scale.x),
    bottom: Math.round((shapeRect.bottom - containerRect.top) / scale.y),
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

/**
 * Versi garis lurus (tanpa sudut melengkung) untuk path SVG.
 * Dipakai supaya konektor BPMN tampil sebagai polyline biasa.
 */
function pathToD(points: { x: number; y: number }[]): string {
  if (points.length < 2) return ''
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`
  }
  return d
}

/**
 * Paksa setiap segmen path menjadi ortogonal (hanya 0°, 90°, 180°, 270°).
 * Jika ada segmen miring kecil, disnap ke horizontal/vertikal terdekat.
 */
function snapToOrthogonal(points: { x: number; y: number }[]): { x: number; y: number }[] {
  if (points.length < 2) return points

  const out: { x: number; y: number }[] = []
  out.push({ x: Math.round(points[0].x), y: Math.round(points[0].y) })

  for (let i = 1; i < points.length; i++) {
    const prev = out[out.length - 1]
    const raw = points[i]
    const p = { x: Math.round(raw.x), y: Math.round(raw.y) }

    const dx = p.x - prev.x
    const dy = p.y - prev.y

    if (dx !== 0 && dy !== 0) {
      if (Math.abs(dx) <= Math.abs(dy)) {
        p.x = prev.x
      } else {
        p.y = prev.y
      }
    }

    if (p.x !== prev.x || p.y !== prev.y) {
      out.push(p)
    }
  }

  return simplifyOrthogonalPath(out)
}

function isValidManualConfig(c: ArrowConnectionConfig | null | undefined): boolean {
  if (!c?.startPoint || !c?.endPoint) return false
  const { startPoint: s, endPoint: e } = c
  return [s.x, s.y, e.x, e.y].every(v => typeof v === 'number' && !isNaN(v))
}

/** Kecualikan hanya node ujung koneksi; shape perantara tetap jadi obstacle. */
function filterRoutingObstacles(
  obsRects: Array<{ left: number; top: number; width: number; height: number }>,
  obstacleIds: string[],
  fromNodeId: string,
  toNodeId: string,
): Array<{ left: number; top: number; width: number; height: number }> {
  return obsRects.filter((_, index) => {
    const id = obstacleIds[index]
    return id !== fromNodeId && id !== toNodeId
  })
}

type ShapeRect = { left: number; top: number; width: number; height: number }

function bpmnEdgePoint(
  shape: ShapeRect,
  side: Side,
  distance: number,
  isDiamond?: boolean,
): { x: number; y: number } {
  const t = isDiamond ? 0.5 : distance
  switch (side) {
    case 'top':
      return { x: shape.left + shape.width * t, y: shape.top }
    case 'bottom':
      return { x: shape.left + shape.width * t, y: shape.top + shape.height }
    case 'left':
      return { x: shape.left, y: shape.top + shape.height * t }
    case 'right':
      return { x: shape.left + shape.width, y: shape.top + shape.height * t }
  }
}

function ensureRenderableFallbackPath(
  fromShape: ShapeRect,
  toShape: ShapeRect,
  candidate: BpmnRouteCandidate,
  connection: BpmnConnectionMeta,
): { x: number; y: number }[] {
  const orthogonal = snapToOrthogonal(
    buildSideAnchoredFallbackPath(
      fromShape,
      toShape,
      candidate.sSide,
      candidate.eSide,
      connection.sourceType === 'flowchart-decision',
      connection.targetType === 'flowchart-decision',
    ),
  )
  if (orthogonal.length >= 2) return orthogonal
  const start = bpmnEdgePoint(
    fromShape,
    candidate.sSide,
    0.5,
    connection.sourceType === 'flowchart-decision',
  )
  const end = bpmnEdgePoint(
    toShape,
    candidate.eSide,
    0.5,
    connection.targetType === 'flowchart-decision',
  )
  if (start.x === end.x && start.y === end.y) {
    return [
      start,
      { x: end.x, y: end.y + 1 },
    ]
  }
  return [start, end]
}

/* ───────────────────────── Constants ─────────────────────────── */

// Coba semua side pair yang masuk akal; prioritas path tidak menembus shape, bukan rute terpendek.
const MAX_SIDE_PAIRS = 10

/* ───────────────────────── Component ─────────────────────────── */

export function BpmnArrowConnector({
  connection,
  idcontainer,
  idarrow,
  obstacles,
  usedSides,
  laneLayout,
  connectionIndex,
  allConnectionsMeta,
  manualConfig,
  manualLabelPosition,
  onPathUpdated,
  onManualChange,
  editMode = false,
  isSelected = false,
  onSelect,
  constraintRect = null,
  routedSegmentsRef,
  rerouteVersion = 0,
  obstacleRectsRef,
  plannedPath,
  resolveElementId = (elementId) => elementId,
}: BpmnArrowConnectorProps) {
  const [pathData, setPathData] = useState('')
  const [labelPos, setLabelPos] = useState<{ x: number; y: number } | null>(null)
  const [resolvedSides, setResolvedSides] = useState<[Side, Side]>(['bottom', 'top'])
  const [resolvedPath, setResolvedPath] = useState<ArrowPathPoint[]>([])
  const [editableAnchors, setEditableAnchors] = useState<DiagramPathAnchor[]>([])
  const [shapeSnapTargets, setShapeSnapTargets] = useState<DiagramShapeSnapTargets | null>(null)
  const routingGuardRef = useRef<{
    obsRects: Rect[]
    routingObstacles: Rect[]
    fromShape: Rect
    toShape: Rect
    globalBounds: Rect
    hasDomLayout: boolean
    bpmnRepairBase: BpmnRouteOptions | null
  } | null>(null)
  const emittedRef = useRef(false)
  const lastAutoSigRef = useRef<string | null>(null)

  // Store mutable props in refs so the effect always reads fresh values
  // without needing them as dependencies (prevents infinite setState loops).
  const usedSidesRef = useRef(usedSides)
  usedSidesRef.current = usedSides
  const obstaclesRef = useRef(obstacles)
  obstaclesRef.current = obstacles
  const onPathUpdatedRef = useRef(onPathUpdated)
  onPathUpdatedRef.current = onPathUpdated
  const onManualChangeRef = useRef(onManualChange)
  onManualChangeRef.current = onManualChange
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const laneLayoutRef = useRef(laneLayout)
  laneLayoutRef.current = laneLayout
  const constraintRectRef = useRef(constraintRect)
  constraintRectRef.current = constraintRect
  const routedSegmentsRefRef = useRef(routedSegmentsRef)
  routedSegmentsRefRef.current = routedSegmentsRef

  useLayoutEffect(() => {
    // Capture ref value at effect start so cleanup always uses the right instance
    // even if the routedSegmentsRef prop changes before cleanup is called.
    const capturedRoutedSegs = routedSegmentsRefRef.current
    let retryFrame = 0
    let cancelled = false

    const applyPlannedPath = (routingObstacles: Rect[]): boolean => {
      if (!plannedPath?.path || plannedPath.path.length < 2) return false
      const planned = snapToOrthogonal(plannedPath.path)
      const nextSides: [Side, Side] = [plannedPath.sSide, plannedPath.eSide]
      setPathData(pathToD(planned))
      setResolvedPath((prev) => (samePath(prev, planned) ? prev : planned.map((p) => ({ ...p }))))
      setResolvedSides((prev) => (sameSides(prev, nextSides) ? prev : nextSides))

      const lp = resolveConnectorLabelPosition(
        planned,
        connection.label,
        manualLabelPosition,
        routingObstacles,
      )
      setLabelPos((prev) => (sameLabelPosition(prev, lp) ? prev : lp))

      const payload: PathUpdatedPayload = {
        connectionId: connection.id,
        from: connection.from,
        to: connection.to,
        sSide: plannedPath.sSide,
        eSide: plannedPath.eSide,
        startPoint: { ...planned[0]! },
        endPoint: { ...planned[planned.length - 1]! },
        bendPoints: planned.slice(1, -1).map((point) => ({ ...point })),
        label: connection.label ?? undefined,
        labelPosition: lp ?? undefined,
      }
      const pathSig = planned.map((point) => `${point.x | 0},${point.y | 0}`).join(';')
      const sig = `${connection.id}:${plannedPath.sSide}:${plannedPath.eSide}:${pathSig}`
      if (onPathUpdatedRef.current && lastAutoSigRef.current !== sig) {
        lastAutoSigRef.current = sig
        onPathUpdatedRef.current(payload)
      }
      return true
    }

    const runRoute = (): void => {
      if (cancelled) return
      if (!editMode && !isValidManualConfig(manualConfig)) {
        const precomputed = obstacleRectsRef?.current ?? []
        const obstacleIds = obstaclesRef.current.map((obstacle) => obstacle.id)
        const routingObstacles = filterRoutingObstacles(
          precomputed,
          obstacleIds,
          connection.from,
          connection.to,
        )
        if (applyPlannedPath(routingObstacles)) {
          routingGuardRef.current = null
          setEditableAnchors((prev) => (prev.length === 0 ? prev : []))
          setShapeSnapTargets((prev) => (prev == null ? prev : null))
          return
        }
      }
      const container = document.getElementById(idcontainer)
      if (!container) {
        setPathData('')
        setLabelPos(null)
        setEditableAnchors([])
        setShapeSnapTargets(null)
        routingGuardRef.current = null
        return
      }
      const fromPos = getElementPosition(connection.from, container, resolveElementId)
      const toPos = getElementPosition(connection.to, container, resolveElementId)
      if (!fromPos || !toPos) {
        if (retryFrame < 4) {
          retryFrame += 1
          requestAnimationFrame(runRoute)
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

    const OBSTACLE_MARGIN = 10
    const curObstacles = obstaclesRef.current
    let obsRects: Rect[]
    const precomputed = obstacleRectsRef?.current
    if (precomputed != null && precomputed.length > 0) {
      obsRects = precomputed
    } else {
      obsRects = curObstacles
        .map(o => o.id)
        .map(id => getElementPosition(id, container, resolveElementId))
        .filter((r): r is ElemPos => r != null)
        .map(r => ({
          left: r.left - OBSTACLE_MARGIN,
          top: r.top - OBSTACLE_MARGIN,
          width: r.width + OBSTACLE_MARGIN * 2,
          height: r.height + OBSTACLE_MARGIN * 2,
        }))
    }
    const curConstraint = constraintRectRef.current
    const globalBounds = curConstraint
      ? {
          left: Math.round(curConstraint.left),
          top: Math.round(curConstraint.top),
          width: Math.round(curConstraint.right - curConstraint.left),
          height: Math.round(curConstraint.bottom - curConstraint.top),
        }
      : { left: 0, top: 0, width: container.scrollWidth, height: container.scrollHeight }
    const fromShape = { left: fromPos.left, top: fromPos.top, width: fromPos.width, height: fromPos.height }
    const toShape = { left: toPos.left, top: toPos.top, width: toPos.width, height: toPos.height }
    const obstacleIds = curObstacles.map((o) => o.id)
    const routingObstacles = filterRoutingObstacles(
      obsRects,
      obstacleIds,
      connection.from,
      connection.to,
    )
    const curLayout = laneLayoutRef.current
    const domLayout =
      curLayout?.lanes != null && curLayout.lanes.length > 0
        ? translateBpmnLaneLayoutToDom(curLayout)
        : null
    routingGuardRef.current = {
      obsRects,
      routingObstacles,
      fromShape,
      toShape,
      globalBounds,
      hasDomLayout: domLayout != null,
      bpmnRepairBase: domLayout
        ? {
            fromShape,
            toShape,
            fromSide: 'bottom',
            toSide: 'top',
            fromDistance: 0.5,
            toDistance: 0.5,
            fromIsDiamond: connection.sourceType === 'flowchart-decision',
            toIsDiamond: connection.targetType === 'flowchart-decision',
            layout: domLayout,
            fromLane: connection.fromLane,
            toLane: connection.toLane,
            fromCol: connection.fromCol,
            toCol: connection.toCol,
            obstacles: routingObstacles,
            occupiedSegments: [],
            globalBounds,
          }
        : null,
    }

    /* ── Manual path ─────────────────────────────────────── */
    if (isValidManualConfig(manualConfig) && manualConfig!.startPoint && manualConfig!.endPoint) {
      const { startPoint, endPoint, bendPoints = [] } = manualConfig!
      const snapped = snapToOrthogonal([startPoint, ...bendPoints, endPoint])
      setPathData(pathToD(snapped))
      setResolvedPath((prev) => (samePath(prev, snapped) ? prev : snapped.map((p) => ({ ...p }))))
      setResolvedSides((prev) => {
        const next: [Side, Side] = [manualConfig!.sSide, manualConfig!.eSide]
        return sameSides(prev, next) ? prev : next
      })

      const lp = resolveConnectorLabelPosition(
        snapped,
        connection.label,
        manualLabelPosition,
        routingObstacles,
      )
      setLabelPos((prev) => (sameLabelPosition(prev, lp) ? prev : lp))

      if (onPathUpdatedRef.current && !emittedRef.current) {
        onPathUpdatedRef.current({
          connectionId: connection.id, from: connection.from, to: connection.to,
          sSide: manualConfig!.sSide, eSide: manualConfig!.eSide,
          startPoint: { ...startPoint }, endPoint: { ...endPoint },
          bendPoints: bendPoints.map(p => ({ ...p })),
          label: connection.label ?? undefined,
          labelPosition: lp ?? undefined,
        })
        emittedRef.current = true
      }
      return
    }

    emittedRef.current = false

    /* ── Parent-level global routing plan ─────────────────── */
    if (applyPlannedPath(routingObstacles)) return

    if (editMode && isValidManualConfig(manualConfig)) {
      return
    }

    /* ── Auto-routing (BPMN lane-aware) ──────────────────── */
    const sidePairs = selectBpmnSidePairs(
      connection,
      fromShape,
      toShape,
      usedSidesRef.current,
    )

    const curRoutedSegs = capturedRoutedSegs
    const occupied: OccupiedSegment[] = []
    if (curRoutedSegs) {
      for (const [id, segs] of curRoutedSegs.current) {
        if (id !== connection.id) occupied.push(...segs)
      }
    }

    const allMeta = allConnectionsMeta

    const anchorDistance = (shapeId: string, side: Side, count: number): number => {
      const shape =
        shapeId === connection.from
          ? fromShape
          : shapeId === connection.to
            ? toShape
            : fromShape
      return preferCenterAnchorDistance(count, sideLengthPx(shape, side))
    }
    const usedAnchorCount = (shapeId: string, side: Side) => {
      const sideUsage = usedSidesRef.current[shapeId]
      const incoming = (sideUsage?.in?.[side] ?? []).filter((id) => id !== connection.id).length
      const outgoing = (sideUsage?.out?.[side] ?? []).filter((id) => id !== connection.id).length
      return incoming + outgoing
    }
    const priorShapeUseCount = (shapeId: string) =>
      allMeta.filter((m, j) =>
        j < connectionIndex &&
        m.id !== connection.id &&
        (m.from === shapeId || m.to === shapeId)
      ).length

    let bestPath: { x: number; y: number }[] | null = null
    let bestCandidate: BpmnRouteCandidate | null = null
    let bestScore = Infinity

    const pathSafetyOpts = createPathSafetyOptions('bpmn', {
      obstacles: routingObstacles,
      occupied,
      fromShape,
      toShape,
      clearancePx: 6,
      allowCrossings: true,
    })
    const isSafePath = (path: { x: number; y: number }[]) =>
      isAcceptableRoutedPath(path, pathSafetyOpts)
    const isShapeSafePath = (path: { x: number; y: number }[]) =>
      isAcceptableRoutedPath(path, { ...pathSafetyOpts, occupied: [] })

    const tryRouteCandidates = (obstacleSet: typeof routingObstacles): void => {
      if (!domLayout) return
      for (const candidate of sidePairs.slice(0, MAX_SIDE_PAIRS)) {
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
        const path = routeBpmn({
          fromShape,
          toShape,
          fromSide: sSide,
          toSide: eSide,
          fromDistance: distA,
          toDistance: distB,
          fromIsDiamond: connection.sourceType === 'flowchart-decision',
          toIsDiamond: connection.targetType === 'flowchart-decision',
          layout: domLayout,
          fromLane: connection.fromLane,
          toLane: connection.toLane,
          fromCol: connection.fromCol,
          toCol: connection.toCol,
          obstacles: obstacleSet,
          occupiedSegments: occupied,
          globalBounds,
          sourceJettySize: candidate.sourceJettySize,
          targetJettySize: candidate.targetJettySize,
          allowCrossings: true,
        })
        if (path.length < 2) continue
        const orthoPath = snapToOrthogonal(path)
        if (!isSafePath(orthoPath)) continue
        const score =
          scoreBpmnRouteCandidate(candidate) +
          scoreBpmnPath(orthoPath, occupied) +
          scoreAnchorOffCenter(distA) +
          scoreAnchorOffCenter(distB)
        if (score < bestScore) {
          bestPath = orthoPath
          bestCandidate = candidate
          bestScore = score
        }
      }
    }

    tryRouteCandidates(routingObstacles)

    const pickFallbackCandidate = (): BpmnRouteCandidate =>
      bestCandidate ?? sidePairs[0] ?? { sSide: 'right', eSide: 'left' }

    const pickSafeFallback = (): { path: { x: number; y: number }[]; candidate: BpmnRouteCandidate } | null => {
      const ordered = [
        bestCandidate,
        ...sidePairs.slice(0, MAX_SIDE_PAIRS),
        { sSide: 'right' as Side, eSide: 'left' as Side },
        { sSide: 'bottom' as Side, eSide: 'top' as Side },
      ].filter((c): c is BpmnRouteCandidate => c != null)
      const seen = new Set<string>()
      for (const fc of ordered) {
        const key = `${fc.sSide}-${fc.eSide}`
        if (seen.has(key)) continue
        seen.add(key)
        if (domLayout) {
          const repaired = routeBpmn({
            fromShape,
            toShape,
            fromSide: fc.sSide,
            toSide: fc.eSide,
            fromDistance: 0.5,
            toDistance: 0.5,
            fromIsDiamond: connection.sourceType === 'flowchart-decision',
            toIsDiamond: connection.targetType === 'flowchart-decision',
            layout: domLayout,
            fromLane: connection.fromLane,
            toLane: connection.toLane,
            fromCol: connection.fromCol,
            toCol: connection.toCol,
            obstacles: routingObstacles,
            occupiedSegments: occupied,
            globalBounds,
            sourceJettySize: fc.sourceJettySize,
            targetJettySize: fc.targetJettySize,
            allowCrossings: true,
          })
          const repairedOrtho = snapToOrthogonal(repaired)
          if (repairedOrtho.length >= 2 && isSafePath(repairedOrtho)) {
            return { path: repairedOrtho, candidate: fc }
          }
        }
        const candidatePath = snapToOrthogonal(
          ensureRenderableFallbackPath(fromShape, toShape, fc, connection),
        )
        if (candidatePath.length >= 2 && isSafePath(candidatePath)) {
          return { path: candidatePath, candidate: fc }
        }
      }
      // Do not drop a workflow edge when all strict tracks are occupied.
      // The parent reconcile pass sees the overlap and gets another chance
      // to reroute it after every connector remains visible.
      if (!domLayout) return null
      for (const fc of ordered) {
        const relaxed = routeBpmnAllowOccupiedFallback({
          fromShape,
          toShape,
          fromSide: fc.sSide,
          toSide: fc.eSide,
          fromDistance: 0.5,
          toDistance: 0.5,
          fromIsDiamond: connection.sourceType === 'flowchart-decision',
          toIsDiamond: connection.targetType === 'flowchart-decision',
          layout: domLayout,
          fromLane: connection.fromLane,
          toLane: connection.toLane,
          fromCol: connection.fromCol,
          toCol: connection.toCol,
          obstacles: routingObstacles,
          occupiedSegments: occupied,
          globalBounds,
          sourceJettySize: fc.sourceJettySize,
          targetJettySize: fc.targetJettySize,
          allowCrossings: true,
        })
        const relaxedOrtho = snapToOrthogonal(relaxed.path)
        if (
          relaxed.usedOccupiedFallback &&
          relaxedOrtho.length >= 2 &&
          isShapeSafePath(relaxedOrtho)
        ) {
          return { path: relaxedOrtho, candidate: fc }
        }
      }
      return null
    }

    if (!bestPath || !bestCandidate) {
      const safe = pickSafeFallback()
      if (safe) {
        bestPath = safe.path
        bestCandidate = safe.candidate
      }
    }

    const finalPath = snapToOrthogonal(bestPath ?? [])
    if (finalPath.length < 2) {
      const safe = pickSafeFallback()
      if (!safe) {
        capturedRoutedSegs?.current.delete(connection.id)
        setPathData('')
        setResolvedPath((prev) => (prev.length === 0 ? prev : []))
        setLabelPos((prev) => (prev === null ? prev : null))
        return
      }
      bestPath = safe.path
      bestCandidate = safe.candidate
    }
    let resolvedPathFinal = snapToOrthogonal(bestPath!)
    if (!isSafePath(resolvedPathFinal)) {
      const safe = pickSafeFallback()
      if (safe) {
        resolvedPathFinal = safe.path
        bestCandidate = safe.candidate
      } else {
        capturedRoutedSegs?.current.delete(connection.id)
        setPathData('')
        setResolvedPath((prev) => (prev.length === 0 ? prev : []))
        setLabelPos((prev) => (prev === null ? prev : null))
        return
      }
    }

    if (capturedRoutedSegs) {
      capturedRoutedSegs.current.set(connection.id, bpmnPathToSegments(resolvedPathFinal))
    }

    const resolvedCandidate = bestCandidate ?? pickFallbackCandidate()
    setPathData(pathToD(resolvedPathFinal))
    setResolvedPath((prev) => (
      samePath(prev, resolvedPathFinal) ? prev : resolvedPathFinal.map((p) => ({ ...p }))
    ))
    setResolvedSides((prev) => {
      const next: [Side, Side] = [resolvedCandidate.sSide, resolvedCandidate.eSide]
      return sameSides(prev, next) ? prev : next
    })

    let lp: { x: number; y: number } | null = null
    if (connection.label && resolvedPathFinal.length >= 2) {
      lp = resolveConnectorLabelPosition(
        resolvedPathFinal,
        connection.label,
        manualLabelPosition,
        routingObstacles,
      )
    }
    setLabelPos((prev) => (sameLabelPosition(prev, lp) ? prev : lp))

    const { sSide, eSide } = resolvedCandidate
    const payload: PathUpdatedPayload = {
      connectionId: connection.id, from: connection.from, to: connection.to,
      sSide, eSide,
      startPoint: { ...resolvedPathFinal[0] },
      endPoint: { ...resolvedPathFinal[resolvedPathFinal.length - 1] },
      bendPoints: resolvedPathFinal.slice(1, -1).map(p => ({ ...p })),
      label: connection.label ?? undefined,
      labelPosition: lp ?? undefined,
    }
    const pathSig = resolvedPathFinal.map(p => `${p.x|0},${p.y|0}`).join(';')
    const sig = `${connection.id}:${sSide}:${eSide}:${pathSig}`
    if (onPathUpdatedRef.current && lastAutoSigRef.current !== sig) {
      lastAutoSigRef.current = sig
      onPathUpdatedRef.current(payload)
    }

    }

    runRoute()

    return () => {
      cancelled = true
      capturedRoutedSegs?.current.delete(connection.id)
    }
  // Only re-run when the connection identity or manual config changes.
  // Mutable props (usedSides, obstacles, laneLayout, etc.) are read via
  // refs to avoid cascading re-renders when onPathUpdated updates parent state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    idcontainer, connection.id, connection.from, connection.to,
    connection.label, connection.sourceType, connection.targetType,
    connection.fromLane, connection.toLane, connection.fromCol, connection.toCol,
    connectionIndex, allConnectionsMeta,
    manualConfig, manualLabelPosition, plannedPath, resolveElementId, rerouteVersion, editMode,
  ])

  if (!pathData) return null
  const effectiveLabelPos = manualLabelPosition ?? labelPos
  const markerId = `arrowhead-bpmn-${idarrow}`

  if (editMode && isSelected && resolvedPath.length >= 2) {
    const guardCtx = routingGuardRef.current
    const shapeGuard: PathShapeGuardConfig | null =
      guardCtx && guardCtx.bpmnRepairBase
        ? {
            collisionPolicy: 'warn',
            check: {
              kind: 'bpmn',
              path: resolvedPath,
              obstacles: guardCtx.obsRects,
              fromShape: guardCtx.fromShape,
              toShape: guardCtx.toShape,
            },
            repair: {
              kind: 'bpmn',
              startPoint: { ...resolvedPath[0]! },
              endPoint: { ...resolvedPath[resolvedPath.length - 1]! },
              sSide: resolvedSides[0],
              eSide: resolvedSides[1],
              fromShape: guardCtx.fromShape,
              toShape: guardCtx.toShape,
              obstacles: guardCtx.obsRects,
              bpmn: {
                ...guardCtx.bpmnRepairBase,
                fromSide: resolvedSides[0],
                toSide: resolvedSides[1],
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
          strokeWidth={1.5}
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
            setPathData(pathToDUtil(nextPath))
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
        strokeWidth={editMode ? 14 : 1.5}
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
        strokeWidth={1.5}
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
