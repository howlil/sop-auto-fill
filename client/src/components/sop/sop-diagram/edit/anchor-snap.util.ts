import {
  sideLengthPx,
  snapDistanceToCenter,
  type DiagramAnchorKind,
  type DiagramAnchorSide,
  type DiagramPathAnchor,
  type DiagramShapeRect,
} from '../core/route/shared/connector-anchor.util'

export {
  ANCHOR_CHANNEL_SPACING_PX,
  ANCHOR_OFF_CENTER_PENALTY_PER_TENTH,
  CENTER_SNAP_THRESHOLD_PX,
  channelAnchorDistance,
  getAutoRouteAnchorSlot,
  preferCenterAnchorDistance,
  scoreAnchorOffCenter,
  sideLengthPx,
  snapDistanceToCenter,
} from '../core/route/shared/connector-anchor.util'
export type {
  DiagramAnchorKind,
  DiagramAnchorSide,
  DiagramPathAnchor,
  DiagramShapeRect,
} from '../core/route/shared/connector-anchor.util'

export interface DiagramShapeSnapTargets {
  connectionId: string
  fromNodeId: string
  toNodeId: string
  start: DiagramShapeRect | null
  end: DiagramShapeRect | null
  /** Decision diamond: hanya 4 vertex (top/right/bottom/left), bukan slide sepanjang tepi. */
  startIsDiamond?: boolean
  endIsDiamond?: boolean
}

export interface BuildVisualConnectorAnchorsOptions {
  fromIsDiamond?: boolean
  toIsDiamond?: boolean
}

export interface PickSnapSideOptions {
  oppositePoint?: { x: number; y: number } | null
  lockedSide?: DiagramAnchorSide | null
}

export interface ResolveConstrainedEdgeSnapOptions {
  connectionId: string
  shape: DiagramShapeRect
  x: number
  y: number
  kind: DiagramAnchorKind
  releaseDistancePx?: number
  lockedAnchorId?: string | null
  oppositePoint?: { x: number; y: number } | null
  shapeIsDiamond?: boolean
}

const EDGE_ZONE_RATIO = 0.32
const EDGE_ZONE_MARGIN_PX = 36

export interface ShapeEdgeProjection {
  side: DiagramAnchorSide
  x: number
  y: number
  distance: number
  distanceToEdge: number
}

export interface ResolveAnchorSnapOptions {
  anchors: DiagramPathAnchor[]
  x: number
  y: number
  kind: DiagramAnchorKind
  snapDistancePx: number
  releaseDistancePx: number
  lockedAnchorId?: string | null
}

export interface ResolveMagneticAnchorSnapOptions extends ResolveAnchorSnapOptions {
  hardSnapDistancePx: number
}

export interface MagneticAnchorSnapResult {
  anchor: DiagramPathAnchor
  distance: number
  ratio: number
  x: number
  y: number
  hardSnapped: boolean
}

export interface ResolveEdgeMagneticSnapOptions {
  connectionId: string
  shape: DiagramShapeRect
  x: number
  y: number
  kind: DiagramAnchorKind
  snapDistancePx: number
  releaseDistancePx: number
  hardSnapDistancePx: number
  lockedAnchorId?: string | null
}

export interface EdgeMagneticSnapResult {
  anchorId: string
  side: DiagramAnchorSide
  distance: number
  distanceToEdge: number
  ratio: number
  x: number
  y: number
  hardSnapped: boolean
}

export interface ActiveEdgeSnapHighlight {
  kind: DiagramAnchorKind
  side: DiagramAnchorSide
  rect: DiagramShapeRect
}

const ANCHOR_SLOT_DISTANCES = [0.5, 0.28, 0.72] as const
const DIAMOND_VERTEX_DISTANCE = 0.5

export interface ResolvePreferredEndpointSnapOptions extends ResolveConstrainedEdgeSnapOptions {
  anchors: DiagramPathAnchor[]
  snapDistancePx?: number
  hardSnapDistancePx?: number
}

/**
 * Snap endpoint: pilih sisi dari pointer → magnet ke anchor utama → slide di tepi dengan prefer tengah.
 */
export function resolvePreferredEndpointSnap(
  options: ResolvePreferredEndpointSnapOptions,
): EdgeMagneticSnapResult | null {
  const {
    anchors,
    snapDistancePx = 24,
    hardSnapDistancePx = 8,
    ...edgeOptions
  } = options
  const edgeSnap = resolveConstrainedEdgeSnap(edgeOptions)
  if (!edgeSnap) return null
  if (edgeOptions.shapeIsDiamond) return edgeSnap
  // The pointer projection owns the selected shape side. Magnetic anchors
  // may refine the position along that edge, but must not switch edges.
  const sideAnchors = filterAnchorsForEndpoint(anchors, edgeOptions.kind).filter(
    (anchor) => anchor.side === edgeSnap.side,
  )
  const centerAnchors = sideAnchors.filter((a) => {
    const dist = distanceOnShapeEdge(edgeOptions.shape, a.side, a)
    return Math.abs(dist - 0.5) < 0.02
  })
  const magnetic = resolveMagneticAnchorSnap({
    anchors: [
      ...centerAnchors,
      ...sideAnchors.filter((a) => !centerAnchors.some((c) => c.id === a.id)),
    ],
    x: edgeOptions.x,
    y: edgeOptions.y,
    kind: edgeOptions.kind,
    snapDistancePx,
    releaseDistancePx: snapDistancePx,
    hardSnapDistancePx,
    lockedAnchorId: null,
  })
  if (magnetic) {
    const side = magnetic.anchor.side
    const centerPt = pointOnShapeEdge(edgeOptions.shape, side, 0.5)
    const distToCenterPx = Math.hypot(edgeOptions.x - centerPt.x, edgeOptions.y - centerPt.y)
    const preferCenter = distToCenterPx <= snapDistancePx
    const anchorDist = distanceOnShapeEdge(edgeOptions.shape, side, magnetic.anchor)
    const pointerDist = distanceOnShapeEdge(edgeOptions.shape, side, {
      x: magnetic.x,
      y: magnetic.y,
    })
    const dist = preferCenter
      ? 0.5
      : Math.abs(anchorDist - 0.5) < 0.02
        ? 0.5
        : pointerDist
    const sideLen = sideLengthPx(edgeOptions.shape, side)
    const snappedDist = preferCenter ? 0.5 : snapDistanceToCenter(dist, sideLen)
    const pt = pointOnShapeEdge(edgeOptions.shape, side, snappedDist)
    return {
      anchorId: buildEdgeAnchorId(edgeOptions.connectionId, edgeOptions.kind, side),
      side,
      distance: snappedDist,
      distanceToEdge: magnetic.distance,
      ratio: magnetic.ratio,
      x: pt.x,
      y: pt.y,
      hardSnapped: magnetic.hardSnapped || preferCenter || Math.abs(snappedDist - 0.5) < 0.02,
    }
  }
  const side = edgeSnap.side
  const sideLen = sideLengthPx(edgeOptions.shape, side)
  const centerPt = pointOnShapeEdge(edgeOptions.shape, side, 0.5)
  const distToCenterPx = Math.hypot(edgeOptions.x - centerPt.x, edgeOptions.y - centerPt.y)
  const preferCenter = distToCenterPx <= snapDistancePx
  const snappedDist = preferCenter
    ? 0.5
    : snapDistanceToCenter(edgeSnap.distance, sideLen)
  const pt = pointOnShapeEdge(edgeOptions.shape, side, snappedDist)
  return {
    ...edgeSnap,
    side,
    distance: snappedDist,
    x: pt.x,
    y: pt.y,
    hardSnapped: edgeSnap.hardSnapped || preferCenter || Math.abs(snappedDist - 0.5) < 0.02,
  }
}

export function isDiamondSnapEndpoint(
  targets: DiagramShapeSnapTargets | null,
  kind: DiagramAnchorKind,
): boolean {
  if (!targets) return false
  return kind === 'start' ? targets.startIsDiamond === true : targets.endIsDiamond === true
}

export function isEndpointIndex(index: number, pathLength: number): boolean {
  return index === 0 || index === pathLength - 1
}

export function elemPosToShapeRect(pos: {
  left: number
  top: number
  width: number
  height: number
}): DiagramShapeRect {
  return { left: pos.left, top: pos.top, width: pos.width, height: pos.height }
}

export function distanceOnShapeEdge(
  rect: DiagramShapeRect,
  side: DiagramAnchorSide,
  point: { x: number; y: number },
): number {
  if (side === 'top' || side === 'bottom') {
    if (rect.width <= 0) return 0.5
    return Math.max(0, Math.min(1, (point.x - rect.left) / rect.width))
  }
  if (rect.height <= 0) return 0.5
  return Math.max(0, Math.min(1, (point.y - rect.top) / rect.height))
}

export function pointOnShapeEdge(
  rect: DiagramShapeRect,
  side: DiagramAnchorSide,
  distance: number,
): { x: number; y: number } {
  const dist = Math.max(0, Math.min(1, distance))
  const right = rect.left + rect.width
  const bottom = rect.top + rect.height
  switch (side) {
    case 'top':
      return { x: Math.round(rect.left + rect.width * dist), y: rect.top }
    case 'bottom':
      return { x: Math.round(rect.left + rect.width * dist), y: bottom }
    case 'left':
      return { x: rect.left, y: Math.round(rect.top + rect.height * dist) }
    case 'right':
      return { x: right, y: Math.round(rect.top + rect.height * dist) }
  }
}

export function buildEdgeAnchorId(
  connectionId: string,
  kind: DiagramAnchorKind,
  side: DiagramAnchorSide,
): string {
  return `${connectionId}-${kind}-${side}`
}

export function parseLockedSideFromAnchorId(
  anchorId: string | null | undefined,
  kind: DiagramAnchorKind,
): DiagramAnchorSide | null {
  if (!anchorId) return null
  const suffix = `-${kind}-`
  const idx = anchorId.indexOf(suffix)
  if (idx < 0) return null
  const side = anchorId.slice(idx + suffix.length).split('-')[0]
  if (side === 'top' || side === 'right' || side === 'bottom' || side === 'left') {
    return side
  }
  return null
}

export function projectPointerToShapeEdge(
  rect: DiagramShapeRect,
  x: number,
  y: number,
  lockedSide?: DiagramAnchorSide | null,
): ShapeEdgeProjection | null {
  const right = rect.left + rect.width
  const bottom = rect.top + rect.height
  if (rect.width <= 0 || rect.height <= 0) return null
  const projectSide = (side: DiagramAnchorSide): ShapeEdgeProjection => {
    switch (side) {
      case 'top': {
        const px = Math.max(rect.left, Math.min(right, x))
        return {
          side,
          x: px,
          y: rect.top,
          distance: rect.width > 0 ? (px - rect.left) / rect.width : 0.5,
          distanceToEdge: Math.abs(y - rect.top),
        }
      }
      case 'bottom': {
        const px = Math.max(rect.left, Math.min(right, x))
        return {
          side,
          x: px,
          y: bottom,
          distance: rect.width > 0 ? (px - rect.left) / rect.width : 0.5,
          distanceToEdge: Math.abs(y - bottom),
        }
      }
      case 'left': {
        const py = Math.max(rect.top, Math.min(bottom, y))
        return {
          side,
          x: rect.left,
          y: py,
          distance: rect.height > 0 ? (py - rect.top) / rect.height : 0.5,
          distanceToEdge: Math.abs(x - rect.left),
        }
      }
      case 'right': {
        const py = Math.max(rect.top, Math.min(bottom, y))
        return {
          side,
          x: right,
          y: py,
          distance: rect.height > 0 ? (py - rect.top) / rect.height : 0.5,
          distanceToEdge: Math.abs(x - right),
        }
      }
    }
  }
  if (lockedSide) return projectSide(lockedSide)
  const sides: DiagramAnchorSide[] = ['top', 'right', 'bottom', 'left']
  let best: ShapeEdgeProjection | null = null
  for (const side of sides) {
    const candidate = projectSide(side)
    if (!best || candidate.distanceToEdge < best.distanceToEdge) {
      best = candidate
    }
  }
  return best
}

export function getAllowedShapeForEndpoint(
  targets: DiagramShapeSnapTargets | null,
  kind: DiagramAnchorKind,
): DiagramShapeRect | null {
  if (!targets) return null
  return kind === 'start' ? targets.start : targets.end
}

export function filterAnchorsForEndpoint(
  anchors: DiagramPathAnchor[],
  kind: DiagramAnchorKind,
): DiagramPathAnchor[] {
  return anchors.filter((anchor) => anchor.kind === kind)
}

function isPointerInSideZone(
  rect: DiagramShapeRect,
  x: number,
  y: number,
  side: DiagramAnchorSide,
): boolean {
  const right = rect.left + rect.width
  const bottom = rect.top + rect.height
  const margin = EDGE_ZONE_MARGIN_PX
  const zoneW = Math.min(rect.width * EDGE_ZONE_RATIO, rect.height * 0.75)
  const zoneH = Math.min(rect.height * EDGE_ZONE_RATIO, rect.width * 0.75)
  switch (side) {
    case 'left':
      return (
        x >= rect.left - margin &&
        x <= rect.left + zoneW + margin &&
        y >= rect.top - margin &&
        y <= bottom + margin
      )
    case 'right':
      return (
        x >= right - zoneW - margin &&
        x <= right + margin &&
        y >= rect.top - margin &&
        y <= bottom + margin
      )
    case 'top':
      return (
        y >= rect.top - margin &&
        y <= rect.top + zoneH + margin &&
        x >= rect.left - margin &&
        x <= right + margin
      )
    case 'bottom':
      return (
        y >= bottom - zoneH - margin &&
        y <= bottom + margin &&
        x >= rect.left - margin &&
        x <= right + margin
      )
  }
}

function sideFacingOppositePoint(
  rect: DiagramShapeRect,
  oppositePoint: { x: number; y: number },
): DiagramAnchorSide {
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const dx = oppositePoint.x - cx
  const dy = oppositePoint.y - cy
  const halfW = rect.width / 2 || 1
  const halfH = rect.height / 2 || 1
  if (Math.abs(dx) / halfW >= Math.abs(dy) / halfH) {
    return dx > 0 ? 'right' : 'left'
  }
  return dy > 0 ? 'bottom' : 'top'
}

function isPointerNearHorizontalSide(
  rect: DiagramShapeRect,
  x: number,
  side: 'left' | 'right',
): boolean {
  const right = rect.left + rect.width
  const zoneW = Math.min(rect.width * EDGE_ZONE_RATIO, rect.height * 0.75)
  return side === 'left' ? x <= rect.left + zoneW : x >= right - zoneW
}

function pickSideByQuadrant(rect: DiagramShapeRect, x: number, y: number): DiagramAnchorSide {
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const dx = x - cx
  const dy = y - cy
  const halfW = rect.width / 2 || 1
  const halfH = rect.height / 2 || 1
  if (Math.abs(dx) / halfW >= Math.abs(dy) / halfH) {
    return dx < 0 ? 'left' : 'right'
  }
  return dy < 0 ? 'top' : 'bottom'
}

function resolveZoneSideOverlap(
  zones: DiagramAnchorSide[],
  rect: DiagramShapeRect,
  x: number,
  y: number,
): DiagramAnchorSide {
  const ranked = zones
    .map((side) => ({
      side,
      distance: projectPointerToShapeEdge(rect, x, y, side)?.distanceToEdge ?? Infinity,
    }))
    .sort((a, b) => a.distance - b.distance)
  if (ranked.length === 0) return 'top'
  return ranked[0]!.side
}

export function pickDiamondSideFromPointer(
  rect: DiagramShapeRect,
  x: number,
  y: number,
): DiagramAnchorSide {
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const dx = x - cx
  const dy = y - cy
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left'
  }
  return dy > 0 ? 'bottom' : 'top'
}

export function pickSnapSideForPointer(
  rect: DiagramShapeRect,
  x: number,
  y: number,
  options?: PickSnapSideOptions & { shapeIsDiamond?: boolean },
): DiagramAnchorSide {
  if (options?.shapeIsDiamond) {
    return pickDiamondSideFromPointer(rect, x, y)
  }
  const right = rect.left + rect.width
  const bottom = rect.top + rect.height
  const withinHorizontalSpan = x >= rect.left && x <= right
  if (withinHorizontalSpan && y < rect.top) {
    if (isPointerNearHorizontalSide(rect, x, 'left')) return 'left'
    if (isPointerNearHorizontalSide(rect, x, 'right')) return 'right'
    return 'top'
  }
  if (withinHorizontalSpan && y > bottom) {
    if (isPointerNearHorizontalSide(rect, x, 'left')) return 'left'
    if (isPointerNearHorizontalSide(rect, x, 'right')) return 'right'
    return 'bottom'
  }
  const sides: DiagramAnchorSide[] = ['left', 'right', 'top', 'bottom']
  const activeZones = sides.filter((side) => isPointerInSideZone(rect, x, y, side))
  if (activeZones.length === 1) return activeZones[0]!
  if (activeZones.length > 1) return resolveZoneSideOverlap(activeZones, rect, x, y)
  if (options?.oppositePoint) {
    return sideFacingOppositePoint(rect, options.oppositePoint)
  }
  return pickSideByQuadrant(rect, x, y)
}

/**
 * Slide-only: proyeksikan pointer ke tepi shape yang diizinkan (zona sisi + arah ujung lawan).
 */
export function resolveConstrainedEdgeSnap(
  options: ResolveConstrainedEdgeSnapOptions,
): EdgeMagneticSnapResult | null {
  const {
    connectionId,
    shape,
    x,
    y,
    kind,
    oppositePoint,
    shapeIsDiamond,
  } = options
  const targetSide = pickSnapSideForPointer(shape, x, y, { oppositePoint, shapeIsDiamond })
  if (shapeIsDiamond) {
    const vertex = pointOnShapeEdge(shape, targetSide, DIAMOND_VERTEX_DISTANCE)
    return {
      anchorId: buildEdgeAnchorId(connectionId, kind, targetSide),
      side: targetSide,
      distance: DIAMOND_VERTEX_DISTANCE,
      distanceToEdge: Math.hypot(vertex.x - x, vertex.y - y),
      ratio: 1,
      x: vertex.x,
      y: vertex.y,
      hardSnapped: true,
    }
  }
  const projection = projectPointerToShapeEdge(shape, x, y, targetSide)
  if (!projection) return null
  return {
    anchorId: buildEdgeAnchorId(connectionId, kind, projection.side),
    side: projection.side,
    distance: projection.distance,
    distanceToEdge: projection.distanceToEdge,
    ratio: 1,
    x: projection.x,
    y: projection.y,
    hardSnapped: true,
  }
}

function slotDistancesForShape(isDiamond: boolean): readonly number[] {
  return isDiamond ? [DIAMOND_VERTEX_DISTANCE] : ANCHOR_SLOT_DISTANCES
}

export function buildVisualConnectorAnchors(
  connectionId: string,
  fromRect: DiagramShapeRect,
  toRect: DiagramShapeRect,
  options?: BuildVisualConnectorAnchorsOptions,
): DiagramPathAnchor[] {
  const sides: DiagramAnchorSide[] = ['top', 'right', 'bottom', 'left']
  const anchors: DiagramPathAnchor[] = []
  const startSlots = slotDistancesForShape(options?.fromIsDiamond === true)
  const endSlots = slotDistancesForShape(options?.toIsDiamond === true)
  for (const side of sides) {
    for (const distance of startSlots) {
      const startPoint = pointOnShapeEdge(fromRect, side, distance)
      anchors.push({
        id: `${connectionId}-start-${side}${options?.fromIsDiamond ? '' : `-${distance}`}`,
        x: startPoint.x,
        y: startPoint.y,
        side,
        kind: 'start',
      })
    }
    for (const distance of endSlots) {
      const endPoint = pointOnShapeEdge(toRect, side, distance)
      anchors.push({
        id: `${connectionId}-end-${side}${options?.toIsDiamond ? '' : `-${distance}`}`,
        x: endPoint.x,
        y: endPoint.y,
        side,
        kind: 'end',
      })
    }
  }
  return anchors
}

export function findNearestAnchor(
  anchors: DiagramPathAnchor[],
  x: number,
  y: number,
  kind: DiagramAnchorKind,
): { anchor: DiagramPathAnchor; distance: number } | null {
  let nearest: DiagramPathAnchor | null = null
  let nearestDistance = Infinity
  for (const anchor of anchors) {
    if (anchor.kind !== kind) continue
    const distance = Math.hypot(anchor.x - x, anchor.y - y)
    if (distance < nearestDistance) {
      nearest = anchor
      nearestDistance = distance
    }
  }
  if (!nearest) return null
  return { anchor: nearest, distance: nearestDistance }
}

export function resolveAnchorSnap(
  options: ResolveAnchorSnapOptions,
): DiagramPathAnchor | null {
  const {
    anchors,
    x,
    y,
    kind,
    snapDistancePx,
    releaseDistancePx,
    lockedAnchorId,
  } = options
  const nearest = findNearestAnchor(anchors, x, y, kind)
  if (!nearest) return null
  if (lockedAnchorId) {
    const locked = anchors.find((anchor) => anchor.id === lockedAnchorId && anchor.kind === kind)
    if (!locked) return null
    const lockedDistance = Math.hypot(locked.x - x, locked.y - y)
    if (lockedDistance <= releaseDistancePx) {
      return locked
    }
    return nearest.distance <= snapDistancePx ? nearest.anchor : null
  }
  return nearest.distance <= snapDistancePx ? nearest.anchor : null
}

function smoothstep(t: number): number {
  const clamped = Math.max(0, Math.min(1, t))
  return clamped * clamped * (3 - 2 * clamped)
}

function interpolate(from: number, to: number, ratio: number): number {
  return from + (to - from) * ratio
}

export function resolveMagneticAnchorSnap(
  options: ResolveMagneticAnchorSnapOptions,
): MagneticAnchorSnapResult | null {
  const {
    anchors,
    x,
    y,
    kind,
    snapDistancePx,
    releaseDistancePx,
    hardSnapDistancePx,
    lockedAnchorId,
  } = options
  const nearest = findNearestAnchor(anchors, x, y, kind)
  if (!nearest) return null
  let target = nearest.anchor
  let distance = nearest.distance
  let activeSnapDistance = snapDistancePx
  if (lockedAnchorId) {
    const locked = anchors.find((anchor) => anchor.id === lockedAnchorId && anchor.kind === kind)
    if (locked) {
      const lockedDistance = Math.hypot(locked.x - x, locked.y - y)
      if (lockedDistance <= releaseDistancePx) {
        target = locked
        distance = lockedDistance
        activeSnapDistance = releaseDistancePx
      } else if (nearest.distance > snapDistancePx) {
        return null
      }
    } else if (nearest.distance > snapDistancePx) {
      return null
    }
  } else if (nearest.distance > snapDistancePx) {
    return null
  }
  if (distance <= hardSnapDistancePx) {
    return {
      anchor: target,
      distance,
      ratio: 1,
      x: target.x,
      y: target.y,
      hardSnapped: true,
    }
  }
  const magneticRange = Math.max(1, activeSnapDistance - hardSnapDistancePx)
  const ratio = smoothstep((activeSnapDistance - distance) / magneticRange)
  return {
    anchor: target,
    distance,
    ratio,
    x: interpolate(x, target.x, ratio),
    y: interpolate(y, target.y, ratio),
    hardSnapped: false,
  }
}

export function resolveEdgeMagneticSnap(
  options: ResolveEdgeMagneticSnapOptions,
): EdgeMagneticSnapResult | null {
  const {
    connectionId,
    shape,
    x,
    y,
    kind,
    snapDistancePx,
    releaseDistancePx,
    hardSnapDistancePx,
    lockedAnchorId,
  } = options
  const lockedSide = parseLockedSideFromAnchorId(lockedAnchorId, kind)
  const projection = projectPointerToShapeEdge(shape, x, y, lockedSide)
  if (!projection) return null
  const target = projection
  const distance = projection.distanceToEdge
  let activeSnapDistance = snapDistancePx
  if (lockedAnchorId && lockedSide) {
    if (distance <= releaseDistancePx) {
      activeSnapDistance = releaseDistancePx
    } else if (distance > snapDistancePx) {
      return null
    }
  } else if (distance > snapDistancePx) {
    return null
  }
  const anchorId = buildEdgeAnchorId(connectionId, kind, target.side)
  if (distance <= hardSnapDistancePx) {
    return {
      anchorId,
      side: target.side,
      distance: target.distance,
      distanceToEdge: distance,
      ratio: 1,
      x: target.x,
      y: target.y,
      hardSnapped: true,
    }
  }
  const magneticRange = Math.max(1, activeSnapDistance - hardSnapDistancePx)
  const ratio = smoothstep((activeSnapDistance - distance) / magneticRange)
  return {
    anchorId,
    side: target.side,
    distance: target.distance,
    distanceToEdge: distance,
    ratio,
    x: interpolate(x, target.x, ratio),
    y: interpolate(y, target.y, ratio),
    hardSnapped: false,
  }
}

export function edgeHighlightLine(
  rect: DiagramShapeRect,
  side: DiagramAnchorSide,
): { x1: number; y1: number; x2: number; y2: number } {
  const right = rect.left + rect.width
  const bottom = rect.top + rect.height
  switch (side) {
    case 'top':
      return { x1: rect.left, y1: rect.top, x2: right, y2: rect.top }
    case 'bottom':
      return { x1: rect.left, y1: bottom, x2: right, y2: bottom }
    case 'left':
      return { x1: rect.left, y1: rect.top, x2: rect.left, y2: bottom }
    case 'right':
      return { x1: right, y1: rect.top, x2: right, y2: bottom }
  }
}
