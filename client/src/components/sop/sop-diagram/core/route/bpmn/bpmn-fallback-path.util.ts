import type { Side } from './bpmnRouter'

export interface ShapeRect {
  left: number
  top: number
  width: number
  height: number
}

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

/** Path ortogonal L sederhana yang menempel di tengah tepi sisi (distance 0.5). */
export function buildSideAnchoredFallbackPath(
  fromShape: ShapeRect,
  toShape: ShapeRect,
  sSide: Side,
  eSide: Side,
  fromIsDiamond: boolean,
  toIsDiamond: boolean,
): { x: number; y: number }[] {
  const start = bpmnEdgePoint(fromShape, sSide, 0.5, fromIsDiamond)
  const end = bpmnEdgePoint(toShape, eSide, 0.5, toIsDiamond)
  if (Math.abs(start.x - end.x) > 8) {
    return [start, { x: end.x, y: start.y }, end]
  }
  return [start, { x: start.x, y: end.y }, end]
}
