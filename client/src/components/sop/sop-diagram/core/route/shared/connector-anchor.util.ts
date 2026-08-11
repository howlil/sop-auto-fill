import type { Side } from './connector-side.types'

export type DiagramAnchorSide = Side
export type DiagramAnchorKind = 'start' | 'end'

export interface DiagramPathAnchor {
  id: string
  x: number
  y: number
  side: DiagramAnchorSide
  kind: DiagramAnchorKind
}

export interface DiagramShapeRect {
  left: number
  top: number
  width: number
  height: number
}

/** Jarak pointer dari tengah tepi (px) untuk snap ke distance 0.5. */
export const CENTER_SNAP_THRESHOLD_PX = 14
/** Jarak minimum antar channel anchor pada satu sisi (px). */
export const ANCHOR_CHANNEL_SPACING_PX = 14
/** Penalti skor routing per 0.1 offset dari tengah (0.5). */
export const ANCHOR_OFF_CENTER_PENALTY_PER_TENTH = 150

const AUTO_ANCHOR_SLOT_DISTANCES = [0.5, 0.28, 0.72, 0.18, 0.82, 0.4, 0.6] as const

export function snapDistanceToCenter(
  distance: number,
  sideLengthPx: number,
  thresholdPx = CENTER_SNAP_THRESHOLD_PX,
): number {
  if (sideLengthPx <= 0) return 0.5
  const offsetPx = Math.abs(distance - 0.5) * sideLengthPx
  return offsetPx <= thresholdPx ? 0.5 : distance
}

export function sideLengthPx(rect: DiagramShapeRect, side: DiagramAnchorSide): number {
  return side === 'top' || side === 'bottom' ? rect.width : rect.height
}

/** Slot anchor untuk auto-route: 0.5 dulu, lalu alternatif bila sisi padat. */
export function getAutoRouteAnchorSlot(slotIndex: number): number {
  return AUTO_ANCHOR_SLOT_DISTANCES[slotIndex % AUTO_ANCHOR_SLOT_DISTANCES.length]!
}

/** Channel di sekitar tengah: jarak 0.5, lalu +/-14px, +/-28px, ... */
export function channelAnchorDistance(
  channelIndex: number,
  sideLengthPx: number,
): number {
  if (sideLengthPx <= 0 || channelIndex <= 0) return 0.5
  const step = ANCHOR_CHANNEL_SPACING_PX / sideLengthPx
  const half = Math.ceil(channelIndex / 2)
  const sign = channelIndex % 2 === 1 ? -1 : 1
  const offset = sign * half * step
  return Math.max(0.08, Math.min(0.92, 0.5 + offset))
}

export function preferCenterAnchorDistance(usedCount: number, sideLengthPx: number): number {
  if (usedCount <= 0) return 0.5
  return channelAnchorDistance(usedCount, sideLengthPx)
}

export function scoreAnchorOffCenter(distance: number): number {
  return Math.abs(distance - 0.5) * 10 * ANCHOR_OFF_CENTER_PENALTY_PER_TENTH
}
