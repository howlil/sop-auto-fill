import {
  normalizeOrthogonalPath,
  assertOrthogonalPath,
} from '../core/route/shared/orthogonalRouter'
import { clampPathToPelaksanaBounds } from '../core/route/flowchart/flowchart-path-bounds.util'
import { simplifyOrthogonalPath } from '../edit/orthogonal-path-edit.util'

export type FlowchartBoundsRect = {
  left: number
  top: number
  right: number
  bottom: number
}

export type FlowchartElemPos = {
  left: number
  top: number
  width: number
  height: number
  right: number
  bottom: number
}

function toRouterBounds(bounds: FlowchartBoundsRect | null | undefined) {
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
  bounds: FlowchartBoundsRect | null | undefined,
): { x: number; y: number }[] {
  if (!bounds) return points.map((point) => ({ x: Math.round(point.x), y: Math.round(point.y) }))
  return points.map((point) => ({
    x: Math.round(Math.max(bounds.left, Math.min(bounds.right, point.x))),
    y: Math.round(Math.max(bounds.top, Math.min(bounds.bottom, point.y))),
  }))
}

export function normalizeConnectorPath(
  points: { x: number; y: number }[],
  bounds: FlowchartBoundsRect | null | undefined,
): { x: number; y: number }[] {
  const normalized = normalizeOrthogonalPath(clampPathToBounds(points, bounds), {
    bounds: toRouterBounds(bounds),
  })
  const simplified = simplifyOrthogonalPath(normalized)
  return assertOrthogonalPath(simplified, 'FlowchartArrowConnector path')
}

export function tryNormalizeConnectorPath(
  points: { x: number; y: number }[],
  bounds: FlowchartBoundsRect | null | undefined,
): { x: number; y: number }[] | null {
  try {
    return normalizeConnectorPath(points, bounds)
  } catch {
    return null
  }
}

/** Path ortogonal minimal bottom→top antara dua shape; tidak throw. */
export function buildMinimalOrthogonalPath(
  fromPos: FlowchartElemPos,
  toPos: FlowchartElemPos,
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
  fromPos: FlowchartElemPos,
  toPos: FlowchartElemPos,
  bounds: FlowchartBoundsRect | null | undefined,
): { x: number; y: number }[] {
  const clampedInput = bounds ? clampPathToPelaksanaBounds(points, bounds) : points
  const normalized = tryNormalizeConnectorPath(clampedInput, bounds)
  if (normalized && normalized.length >= 2) {
    return bounds ? clampPathToPelaksanaBounds(normalized, bounds) : normalized
  }
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
    bounds,
  )
  if (emergency && emergency.length >= 2) {
    return bounds ? clampPathToPelaksanaBounds(emergency, bounds) : emergency
  }
  const minimal = buildMinimalOrthogonalPath(fromPos, toPos)
  return bounds ? clampPathToPelaksanaBounds(minimal, bounds) : minimal
}

export function buildUltimateOrthogonalFallback(
  fromPos: FlowchartElemPos,
  toPos: FlowchartElemPos,
  bounds: FlowchartBoundsRect | null | undefined,
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
