import type { FlowchartPelaksanaBoundsRect, ImplementerColumnBoundsMap } from './flowchart-column-bounds.util'

/** Jarak aman dari tepi kanan swimlane agar path tidak masuk Mutu Baku. */
export const MUTU_BAKU_RIGHT_GUARD_PX = 28
const ROUTING_INNER_INSET = 8

export function inferTightColumnFromShape(
  shapeLeft: number,
  shapeRight: number,
  pelaksana: FlowchartPelaksanaBoundsRect | null | undefined,
): FlowchartPelaksanaBoundsRect | null {
  if (!pelaksana) return null
  const pad = 16
  return {
    left: Math.max(pelaksana.left + ROUTING_INNER_INSET, shapeLeft - pad),
    top: pelaksana.top + ROUTING_INNER_INSET,
    right: Math.min(
      pelaksana.right - MUTU_BAKU_RIGHT_GUARD_PX,
      shapeRight + pad,
    ),
    bottom: pelaksana.bottom - ROUTING_INNER_INSET,
  }
}

export function resolveColumnForConnection(
  implementerId: string | undefined,
  shapeCenterX: number,
  shapeLeft: number,
  shapeRight: number,
  columns: ImplementerColumnBoundsMap | null | undefined,
  pelaksana: FlowchartPelaksanaBoundsRect | null | undefined,
): FlowchartPelaksanaBoundsRect | null {
  if (implementerId && columns?.[implementerId]) {
    return columns[implementerId]!
  }
  if (columns && Object.keys(columns).length > 0) {
    let best: FlowchartPelaksanaBoundsRect | null = null
    let bestOverlap = -1
    for (const bounds of Object.values(columns)) {
      if (shapeCenterX >= bounds.left && shapeCenterX <= bounds.right) {
        return bounds
      }
      const overlap =
        Math.min(bounds.right, shapeRight) - Math.max(bounds.left, shapeLeft)
      if (overlap > bestOverlap) {
        bestOverlap = overlap
        best = bounds
      }
    }
    if (best) return best
  }
  return inferTightColumnFromShape(shapeLeft, shapeRight, pelaksana)
}

/** Bounds ketat per koneksi — clamp/router tidak memakai swimlane global lebar. */
export function computeConnectionRoutingBounds(input: {
  pelaksana: FlowchartPelaksanaBoundsRect | null | undefined
  sourceColumn: FlowchartPelaksanaBoundsRect | null | undefined
  targetColumn: FlowchartPelaksanaBoundsRect | null | undefined
  isCrossColumn: boolean
}): FlowchartPelaksanaBoundsRect | null {
  const { pelaksana, sourceColumn, targetColumn, isCrossColumn } = input
  const top = pelaksana?.top ?? sourceColumn?.top ?? 0
  const bottom = pelaksana?.bottom ?? sourceColumn?.bottom ?? 9999
  const maxRight = (pelaksana?.right ?? sourceColumn?.right ?? 9999) - MUTU_BAKU_RIGHT_GUARD_PX

  if (sourceColumn && targetColumn && isCrossColumn) {
    const left = Math.min(sourceColumn.left, targetColumn.left) + ROUTING_INNER_INSET
    const right = Math.min(
      maxRight,
      Math.max(sourceColumn.right, targetColumn.right) - ROUTING_INNER_INSET,
    )
    if (right <= left) return null
    return {
      left,
      top: top + ROUTING_INNER_INSET,
      right,
      bottom: bottom - ROUTING_INNER_INSET,
    }
  }
  if (sourceColumn) {
    const left = sourceColumn.left + ROUTING_INNER_INSET
    const right = Math.min(maxRight, sourceColumn.right - ROUTING_INNER_INSET)
    if (right <= left) return null
    return {
      left,
      top: top + ROUTING_INNER_INSET,
      right,
      bottom: bottom - ROUTING_INNER_INSET,
    }
  }
  if (pelaksana) {
    return {
      left: pelaksana.left + ROUTING_INNER_INSET,
      top: pelaksana.top + ROUTING_INNER_INSET,
      right: maxRight,
      bottom: pelaksana.bottom - ROUTING_INNER_INSET,
    }
  }
  return null
}

export function routingBoundsToRouterRect(
  bounds: FlowchartPelaksanaBoundsRect,
): { left: number; top: number; width: number; height: number } {
  return {
    left: bounds.left,
    top: bounds.top,
    width: Math.max(12, bounds.right - bounds.left),
    height: Math.max(40, bounds.bottom - bounds.top),
  }
}
