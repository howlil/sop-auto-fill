import { memo, useCallback, useEffect, useRef, useState } from 'react'
import type { Side } from '@/components/sop/sop-diagram/core/route/shared/connector-side.types'
import type { ArrowPathPoint } from '@/components/sop/sop-diagram/core/sopDiagramTypes'
import {
  alignEndpointSegmentPreservingEndpoint,
  clientToSvgPoint,
  dragSegmentFromOrigin,
  dragWaypointFromOrigin,
  endpointIndexForKind,
  forkStraightPathForEndpointDrag,
  findNearestSegmentIndex,
  getDraggedEndpointKind,
  insertWaypointAtSegmentMidpoint,
  pathToD,
  removeWaypoint,
} from './orthogonal-path-edit.util'
import {
  distanceOnShapeEdge,
  edgeHighlightLine,
  filterAnchorsForEndpoint,
  getAllowedShapeForEndpoint,
  isDiamondSnapEndpoint,
  isEndpointIndex,
  pointOnShapeEdge,
  resolveAnchorSnap,
  snapDistanceToCenter,
  sideLengthPx,
  buildVisualConnectorAnchors,
  resolvePreferredEndpointSnap,
  type ActiveEdgeSnapHighlight,
  type DiagramAnchorKind,
  type DiagramPathAnchor,
  type DiagramShapeSnapTargets,
} from './anchor-snap.util'
import {
  finalizeManualOrthogonalPath,
  isPathBlockingShapes,
  pathCrossesShapeBodies,
  rebuildPathForAnchorSides,
  type PathShapeGuardConfig,
} from './path-shape-guard.util'

export interface EditablePathChangePayload {
  startPoint: ArrowPathPoint
  endPoint: ArrowPathPoint
  bendPoints: ArrowPathPoint[]
  sSide: Side
  eSide: Side
}

interface EditableOrthogonalPathProps {
  path: ArrowPathPoint[]
  sSide: Side
  eSide: Side
  anchors?: DiagramPathAnchor[]
  shapeSnapTargets?: DiagramShapeSnapTargets | null
  shapeGuard?: PathShapeGuardConfig | null
  connectionId: string
  isSelected: boolean
  markerEndId: string
  strokeWidth?: number
  onSelect: (connectionId: string) => void
  onChange: (payload: EditablePathChangePayload) => void
  onDeleteSelected?: () => void
}

const ANCHOR_SNAP_DISTANCE_PX = 24
const ANCHOR_HARD_SNAP_DISTANCE_PX = 8
const ROUTE_PREVIEW_MS = 32
const DRAG_START_THRESHOLD_PX = 3

type DragMode = 'waypoint' | 'segment'

interface DragSession {
  mode: DragMode
  pointerId: number
  index: number
  originPath: ArrowPathPoint[]
  originClientX: number
  originClientY: number
  originSvgX: number
  originSvgY: number
  svg: SVGSVGElement
  moved: boolean
}

function clonePath(path: ArrowPathPoint[]): ArrowPathPoint[] {
  return path.map((p) => ({ ...p }))
}

function EditableOrthogonalPathInner({
  path,
  sSide,
  eSide,
  anchors = [],
  shapeSnapTargets = null,
  shapeGuard = null,
  connectionId,
  isSelected,
  markerEndId,
  strokeWidth = 2,
  onSelect,
  onChange,
  onDeleteSelected,
}: EditableOrthogonalPathProps) {
  const [localPath, setLocalPath] = useState(path)
  const [localSides, setLocalSides] = useState<{ sSide: Side; eSide: Side }>({ sSide, eSide })
  const [activeAnchorId, setActiveAnchorId] = useState<string | null>(null)
  const [activeEdgeHighlight, setActiveEdgeHighlight] = useState<ActiveEdgeSnapHighlight | null>(
    null,
  )
  const [isPathInvalid, setIsPathInvalid] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [draggingEndpointKind, setDraggingEndpointKind] = useState<DiagramAnchorKind | null>(
    null,
  )
  const activeAnchorIdRef = useRef<string | null>(null)
  const lastValidPathRef = useRef<ArrowPathPoint[]>(path.map((p) => ({ ...p })))
  const dragSessionRef = useRef<DragSession | null>(null)
  const pendingPathRef = useRef<ArrowPathPoint[] | null>(null)
  const pathRafRef = useRef<number | null>(null)
  const invalidPreviewFrameRef = useRef<number | null>(null)
  const lastRouteTimeRef = useRef(0)
  const shapeGuardRef = useRef(shapeGuard)
  shapeGuardRef.current = shapeGuard
  const shapeSnapTargetsRef = useRef(shapeSnapTargets)
  shapeSnapTargetsRef.current = shapeSnapTargets
  const localSidesRef = useRef(localSides)
  localSidesRef.current = localSides

  useEffect(() => {
    if (dragSessionRef.current) return
    setLocalPath(path)
    lastValidPathRef.current = path.map((p) => ({ ...p }))
    setIsPathInvalid(false)
  }, [path])

  useEffect(() => {
    setLocalSides({ sSide, eSide })
  }, [eSide, sSide])

  useEffect(() => {
    if (!isSelected) {
      setActiveAnchorId(null)
      activeAnchorIdRef.current = null
      setActiveEdgeHighlight(null)
    }
  }, [isSelected])

  useEffect(() => {
    return () => {
      if (pathRafRef.current !== null) cancelAnimationFrame(pathRafRef.current)
      if (invalidPreviewFrameRef.current !== null) cancelAnimationFrame(invalidPreviewFrameRef.current)
    }
  }, [])

  const updateInvalidPreview = useCallback((candidatePath: ArrowPathPoint[]) => {
    if (invalidPreviewFrameRef.current !== null) {
      cancelAnimationFrame(invalidPreviewFrameRef.current)
    }
    invalidPreviewFrameRef.current = requestAnimationFrame(() => {
      invalidPreviewFrameRef.current = null
      const guard = shapeGuardRef.current
      if (!guard) {
        setIsPathInvalid(false)
        return
      }
      const { kind, obstacles, fromShape, toShape, clearance } = guard.check
      if (kind === 'flowchart') {
        setIsPathInvalid(
          pathCrossesShapeBodies(candidatePath, fromShape, toShape, obstacles, clearance),
        )
        return
      }
      setIsPathInvalid(isPathBlockingShapes({ ...guard.check, path: candidatePath }))
    })
  }, [])

  const schedulePathUpdate = useCallback((nextPath: ArrowPathPoint[]) => {
    pendingPathRef.current = nextPath
    if (pathRafRef.current !== null) return
    pathRafRef.current = requestAnimationFrame(() => {
      pathRafRef.current = null
      const pending = pendingPathRef.current
      if (pending) setLocalPath(pending)
    })
  }, [])

  const alignEndpointSegment = useCallback(
    (nextPath: ArrowPathPoint[], index: number): ArrowPathPoint[] =>
      isEndpointIndex(index, nextPath.length)
        ? alignEndpointSegmentPreservingEndpoint(nextPath, index)
        : nextPath,
    [],
  )

  const pinOppositeEndpoint = useCallback(
    (
      nextPath: ArrowPathPoint[],
      draggedKind: 'start' | 'end',
      sides: { sSide: Side; eSide: Side },
    ): ArrowPathPoint[] => {
      const targets = shapeSnapTargetsRef.current
      if (!targets) return nextPath
      const pinned = nextPath.map((point) => ({ ...point }))
      if (draggedKind === 'end' && targets.start) {
        const startPoint = pinned[0]
        if (!startPoint) return pinned
        const rawDist = distanceOnShapeEdge(targets.start, sides.sSide, startPoint)
        const dist = targets.startIsDiamond
          ? 0.5
          : snapDistanceToCenter(rawDist, sideLengthPx(targets.start, sides.sSide))
        pinned[0] = pointOnShapeEdge(targets.start, sides.sSide, dist)
      } else if (draggedKind === 'start' && targets.end) {
        const endPoint = pinned[pinned.length - 1]
        if (!endPoint) return pinned
        const rawEndDist = distanceOnShapeEdge(targets.end, sides.eSide, endPoint)
        const dist = targets.endIsDiamond
          ? 0.5
          : snapDistanceToCenter(rawEndDist, sideLengthPx(targets.end, sides.eSide))
        pinned[pinned.length - 1] = pointOnShapeEdge(targets.end, sides.eSide, dist)
      }
      return pinned
    },
    [],
  )

  const tryLiveReroute = useCallback(
    (
      nextPath: ArrowPathPoint[],
      sides: { sSide: Side; eSide: Side },
      force = false,
    ): ArrowPathPoint[] => {
      const guard = shapeGuardRef.current
      if (!guard || nextPath.length < 2) return nextPath
      const now = performance.now()
      if (!force && now - lastRouteTimeRef.current < ROUTE_PREVIEW_MS) {
        return nextPath
      }
      lastRouteTimeRef.current = now
      const rebuilt = rebuildPathForAnchorSides(
        {
          ...guard.repair,
          startPoint: { ...nextPath[0]! },
          endPoint: { ...nextPath[nextPath.length - 1]! },
          sSide: sides.sSide,
          eSide: sides.eSide,
        },
        { fallbackPath: nextPath },
      )
      if (rebuilt && rebuilt.length >= 2) {
        return rebuilt.map((p) => ({ ...p }))
      }
      return nextPath
    },
    [],
  )

  const emitChange = useCallback(
    (nextPath: ArrowPathPoint[], nextSides?: { sSide?: Side; eSide?: Side }) => {
      if (nextPath.length < 2) return
      const mergedSides = {
        sSide: nextSides?.sSide ?? localSidesRef.current.sSide,
        eSide: nextSides?.eSide ?? localSidesRef.current.eSide,
      }
      setLocalSides(mergedSides)
      onChange({
        sSide: mergedSides.sSide,
        eSide: mergedSides.eSide,
        startPoint: { ...nextPath[0]! },
        endPoint: { ...nextPath[nextPath.length - 1]! },
        bendPoints: nextPath.slice(1, -1).map((p) => ({ ...p })),
      })
    },
    [onChange],
  )

  const commitPath = useCallback(
    (rawPath: ArrowPathPoint[], nextSides?: { sSide?: Side; eSide?: Side }) => {
      const guard = shapeGuardRef.current
      const mergedSides = {
        sSide: nextSides?.sSide ?? localSidesRef.current.sSide,
        eSide: nextSides?.eSide ?? localSidesRef.current.eSide,
      }
      if (!guard) {
        setLocalPath(rawPath)
        lastValidPathRef.current = rawPath.map((p) => ({ ...p }))
        setIsPathInvalid(false)
        emitChange(rawPath, mergedSides)
        return rawPath
      }
      const repairInput = {
        ...guard.repair,
        startPoint: { ...rawPath[0]! },
        endPoint: { ...rawPath[rawPath.length - 1]! },
        sSide: mergedSides.sSide,
        eSide: mergedSides.eSide,
      }
      const finalized = finalizeManualOrthogonalPath(
        rawPath,
        { check: guard.check, repair: repairInput },
        lastValidPathRef.current,
      )
      const invalid = isPathBlockingShapes({ ...guard.check, path: finalized })
      setIsPathInvalid(invalid)
      if (invalid && guard.collisionPolicy !== 'warn') {
        const revert = lastValidPathRef.current.map((p) => ({ ...p }))
        setLocalPath(revert)
        return revert
      }
      lastValidPathRef.current = finalized.map((p) => ({ ...p }))
      setLocalPath(finalized)
      setIsPathInvalid(false)
      emitChange(finalized, mergedSides)
      return finalized
    },
    [emitChange],
  )

  const applyDragDelta = useCallback(
    (session: DragSession, svgX: number, svgY: number): ArrowPathPoint[] => {
      const dx = svgX - session.originSvgX
      const dy = svgY - session.originSvgY
      if (session.mode === 'segment') {
        return dragSegmentFromOrigin(session.originPath, session.index, dx, dy, {
          normalize: false,
        })
      }
      let moved = dragWaypointFromOrigin(session.originPath, session.index, dx, dy, {
        normalize: false,
      })
      const pointKind = getDraggedEndpointKind(session.originPath, session.index)
      if (!pointKind) return moved
      if (session.originPath.length === 2) {
        const forked = forkStraightPathForEndpointDrag(
          session.originPath,
          session.index,
          dx,
          dy,
        )
        if (forked) moved = forked
      }
      const endpointIndex = endpointIndexForKind(moved, pointKind)
      const targets = shapeSnapTargetsRef.current
      const connId = targets?.connectionId ?? connectionId
      let nextSides = { ...localSidesRef.current }
      let edgeHighlight: ActiveEdgeSnapHighlight | null = null
      const endpoint = moved[endpointIndex]
      if (!endpoint) return moved
      const shapeRect = getAllowedShapeForEndpoint(targets, pointKind)
      if (shapeRect) {
        const oppositeIndex =
          endpointIndex === 0 ? moved.length - 1 : 0
        const oppositePoint = moved[oppositeIndex]
        const visualAnchors =
          anchors.length > 0
            ? anchors
            : targets?.start && targets.end
              ? buildVisualConnectorAnchors(connId, targets.start, targets.end, {
                  fromIsDiamond: targets.startIsDiamond,
                  toIsDiamond: targets.endIsDiamond,
                })
              : []
        const edgeSnap = resolvePreferredEndpointSnap({
          connectionId: connId,
          shape: shapeRect,
          x: endpoint.x,
          y: endpoint.y,
          kind: pointKind,
          oppositePoint: oppositePoint ? { x: oppositePoint.x, y: oppositePoint.y } : null,
          shapeIsDiamond: isDiamondSnapEndpoint(targets, pointKind),
          anchors: visualAnchors,
          snapDistancePx: ANCHOR_SNAP_DISTANCE_PX,
          hardSnapDistancePx: ANCHOR_HARD_SNAP_DISTANCE_PX,
        })
        if (edgeSnap) {
          const snappedPath = moved.map((point) => ({ ...point }))
          snappedPath[endpointIndex] = { x: edgeSnap.x, y: edgeSnap.y }
          activeAnchorIdRef.current = edgeSnap.anchorId
          if (pointKind === 'start') {
            nextSides = { ...nextSides, sSide: edgeSnap.side }
          } else {
            nextSides = { ...nextSides, eSide: edgeSnap.side }
          }
          edgeHighlight = { kind: pointKind, side: edgeSnap.side, rect: shapeRect }
          moved = alignEndpointSegment(snappedPath, endpointIndex)
        } else {
          const fallbackIndex = pointKind === 'start' ? 0 : lastValidPathRef.current.length - 1
          const fallback = lastValidPathRef.current[fallbackIndex]
          if (fallback) {
            const snappedPath = moved.map((point) => ({ ...point }))
            snappedPath[endpointIndex] = { ...fallback }
            moved = alignEndpointSegment(snappedPath, endpointIndex)
          }
        }
      } else if (targets) {
        const fallbackIndex = pointKind === 'start' ? 0 : lastValidPathRef.current.length - 1
        const fallback = lastValidPathRef.current[fallbackIndex]
        if (fallback) {
          const snappedPath = moved.map((point) => ({ ...point }))
          snappedPath[endpointIndex] = { ...fallback }
          moved = alignEndpointSegment(snappedPath, endpointIndex)
        }
      } else {
        const kindAnchors = filterAnchorsForEndpoint(anchors, pointKind)
        const snappedAnchor = resolveAnchorSnap({
          anchors: kindAnchors,
          x: endpoint.x,
          y: endpoint.y,
          kind: pointKind,
          snapDistancePx: ANCHOR_SNAP_DISTANCE_PX,
          releaseDistancePx: ANCHOR_SNAP_DISTANCE_PX * 1.5,
          lockedAnchorId: activeAnchorIdRef.current,
        })
        if (snappedAnchor) {
          const snappedPath = moved.map((point) => ({ ...point }))
          snappedPath[endpointIndex] = { x: snappedAnchor.x, y: snappedAnchor.y }
          activeAnchorIdRef.current = snappedAnchor.id
          if (pointKind === 'start') {
            nextSides = { ...nextSides, sSide: snappedAnchor.side }
          } else {
            nextSides = { ...nextSides, eSide: snappedAnchor.side }
          }
          moved = alignEndpointSegment(snappedPath, endpointIndex)
        } else {
          activeAnchorIdRef.current = null
        }
      }
      localSidesRef.current = nextSides
      setLocalSides(nextSides)
      setActiveEdgeHighlight(edgeHighlight)
      moved = pinOppositeEndpoint(moved, pointKind, nextSides)
      moved = tryLiveReroute(moved, nextSides)
      return moved
    },
    [alignEndpointSegment, anchors, connectionId, pinOppositeEndpoint, tryLiveReroute],
  )

  const finishDragSession = useCallback(() => {
    const session = dragSessionRef.current
    dragSessionRef.current = null
    setIsDragging(false)
    setDraggingEndpointKind(null)
    if (!session?.moved) return
    if (pathRafRef.current !== null) {
      cancelAnimationFrame(pathRafRef.current)
      pathRafRef.current = null
    }
    const current = pendingPathRef.current ?? localPath
    pendingPathRef.current = null
    const isEndpointDrag =
      session.mode === 'waypoint' &&
      getDraggedEndpointKind(session.originPath, session.index) !== null
    const finalPath = isEndpointDrag
      ? tryLiveReroute(current, localSidesRef.current, true)
      : session.mode === 'waypoint'
        ? alignEndpointSegment(current, session.index)
        : current
    const committed = commitPath(finalPath, localSidesRef.current)
    setLocalPath(committed)
    setActiveAnchorId(activeAnchorIdRef.current)
  }, [alignEndpointSegment, commitPath, localPath, tryLiveReroute])

  const handlePointerMove = useCallback(
    (ev: PointerEvent) => {
      const session = dragSessionRef.current
      if (!session || ev.pointerId !== session.pointerId) return
      const svgPoint = clientToSvgPoint(session.svg, ev.clientX, ev.clientY)
      if (!svgPoint) return
      if (!session.moved) {
        const dist = Math.hypot(
          ev.clientX - session.originClientX,
          ev.clientY - session.originClientY,
        )
        if (dist < DRAG_START_THRESHOLD_PX) return
        session.moved = true
      }
      const nextPath = applyDragDelta(session, svgPoint.x, svgPoint.y)
      schedulePathUpdate(nextPath)
      updateInvalidPreview(nextPath)
    },
    [applyDragDelta, schedulePathUpdate, updateInvalidPreview],
  )

  const handlePointerUp = useCallback(
    (ev: PointerEvent) => {
      const session = dragSessionRef.current
      if (!session || ev.pointerId !== session.pointerId) return
      try {
        session.svg.releasePointerCapture(ev.pointerId)
      } catch {
        /* ignore */
      }
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
      finishDragSession()
    },
    [finishDragSession, handlePointerMove],
  )

  const startDragSession = useCallback(
    (
      e: React.PointerEvent,
      mode: DragMode,
      index: number,
      originPath: ArrowPathPoint[],
    ) => {
      e.stopPropagation()
      e.preventDefault()
      onSelect(connectionId)
      const target = e.currentTarget as SVGElement
      const svg = target.ownerSVGElement
      if (!svg) return
      const svgPoint = clientToSvgPoint(svg, e.clientX, e.clientY)
      if (!svgPoint) return
      try {
        target.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      lastRouteTimeRef.current = 0
      dragSessionRef.current = {
        mode,
        pointerId: e.pointerId,
        index,
        originPath: clonePath(originPath),
        originClientX: e.clientX,
        originClientY: e.clientY,
        originSvgX: svgPoint.x,
        originSvgY: svgPoint.y,
        svg,
        moved: false,
      }
      setIsDragging(true)
      setDraggingEndpointKind(
        mode === 'waypoint' && (index === 0 || index === originPath.length - 1)
          ? index === 0
            ? 'start'
            : 'end'
          : null,
      )
      setIsPathInvalid(false)
      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
      window.addEventListener('pointercancel', handlePointerUp)
    },
    [connectionId, handlePointerMove, handlePointerUp, onSelect],
  )

  useEffect(() => {
    if (!isSelected) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        onDeleteSelected?.()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isSelected, onDeleteSelected])

  const handlePathClick = (e: React.MouseEvent<SVGPathElement>) => {
    e.stopPropagation()
    onSelect(connectionId)
    if (e.detail < 2) return
    const svg = e.currentTarget.ownerSVGElement
    if (!svg) return
    const local = clientToSvgPoint(svg, e.clientX, e.clientY)
    if (!local) return
    const segIdx = findNearestSegmentIndex(localPath, local.x, local.y)
    if (segIdx >= 0) {
      const inserted = insertWaypointAtSegmentMidpoint(localPath, segIdx)
      const committed = commitPath(inserted)
      setLocalPath(committed)
    }
  }

  const handlePathPointerDown = (e: React.PointerEvent<SVGPathElement>) => {
    if (e.button !== 0) return
    const svg = e.currentTarget.ownerSVGElement
    if (!svg) return
    const local = clientToSvgPoint(svg, e.clientX, e.clientY)
    if (!local) return
    const segIdx = findNearestSegmentIndex(localPath, local.x, local.y)
    if (segIdx < 0) return
    startDragSession(e, 'segment', segIdx, localPath)
  }

  const handleHandlePointerDown = (index: number, e: React.PointerEvent<SVGCircleElement>) => {
    if (e.button !== 0) return
    startDragSession(e, 'waypoint', index, localPath)
  }

  const handleHandleContextMenu = (index: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const removed = removeWaypoint(localPath, index)
    const committed = commitPath(removed)
    setLocalPath(committed)
  }

  const strokeColor = isSelected
    ? isPathInvalid
      ? '#ea580c'
      : '#2563eb'
    : 'black'

  const isSnapping = activeAnchorId !== null || activeEdgeHighlight !== null
  const highlightLine = activeEdgeHighlight
    ? edgeHighlightLine(activeEdgeHighlight.rect, activeEdgeHighlight.side)
    : null

  return (
    <g>
      <path
        className="print:hidden"
        d={pathToD(localPath)}
        fill="none"
        stroke="transparent"
        strokeWidth={isSelected ? strokeWidth + 12 : strokeWidth + 10}
        style={{
          pointerEvents: 'stroke',
          cursor: isSelected ? 'grab' : 'pointer',
          touchAction: 'none',
        }}
        onClick={handlePathClick}
        onPointerDown={isSelected ? handlePathPointerDown : undefined}
      />
      <path
        className="sop-connector-stroke"
        d={pathToD(localPath)}
        fill="none"
        stroke={strokeColor}
        strokeWidth={isSelected ? strokeWidth + 1 : strokeWidth}
        markerEnd={`url(#${markerEndId})`}
        style={{ pointerEvents: 'none' }}
      />
      {isSelected && highlightLine && (
        <line
          className="print:hidden"
          x1={highlightLine.x1}
          y1={highlightLine.y1}
          x2={highlightLine.x2}
          y2={highlightLine.y2}
          stroke="#2563eb"
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.9}
          style={{ pointerEvents: 'none' }}
        />
      )}
      {isSelected &&
        anchors.map((anchor) => {
          if (draggingEndpointKind !== null && anchor.kind !== draggingEndpointKind) {
            return null
          }
          const isActive =
            anchor.id === activeAnchorId ||
            (activeEdgeHighlight?.kind === anchor.kind &&
              activeEdgeHighlight.side === anchor.side)
          const isStart = anchor.kind === 'start'
          const isInactiveKind =
            draggingEndpointKind === null &&
            activeEdgeHighlight !== null &&
            anchor.kind !== activeEdgeHighlight.kind
          return (
            <circle
              className="print:hidden"
              key={`${connectionId}-anchor-${anchor.id}`}
              cx={anchor.x}
              cy={anchor.y}
              r={isActive ? 5 : 3}
              fill={isActive ? '#2563eb' : isStart ? '#bfdbfe' : '#dbeafe'}
              stroke={isActive ? '#1d4ed8' : '#60a5fa'}
              strokeWidth={isActive ? 2 : 1}
              opacity={isInactiveKind ? 0.25 : isActive ? 1 : 0.55}
              style={{ pointerEvents: 'none' }}
            />
          )
        })}
      {isSelected &&
        localPath.map((p, idx) => {
          const isEndpoint = idx === 0 || idx === localPath.length - 1
          const endpointSnapping = isEndpoint && isSnapping
          return (
            <circle
              className="print:hidden"
              key={`${connectionId}-wp-${idx}`}
              cx={p.x}
              cy={p.y}
              r={isEndpoint ? (endpointSnapping ? 8 : 6) : 6}
              fill={isEndpoint ? '#1d4ed8' : '#ffffff'}
              stroke={isPathInvalid ? '#ea580c' : '#2563eb'}
              strokeWidth={endpointSnapping ? 2.5 : 2}
              style={{
                pointerEvents: 'all',
                cursor: isDragging ? 'grabbing' : 'grab',
                touchAction: 'none',
              }}
              onPointerDown={(e) => handleHandlePointerDown(idx, e)}
              onContextMenu={(e) => handleHandleContextMenu(idx, e)}
            />
          )
        })}
    </g>
  )
}

export const EditableOrthogonalPath = memo(EditableOrthogonalPathInner)
