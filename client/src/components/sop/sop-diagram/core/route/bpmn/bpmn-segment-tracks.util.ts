import {
  segmentsCross,
  segmentsNearby,
  segmentsOverlap,
  type OccupiedSegment,
} from '../shared/orthogonalRouter'

const TRACK_SPACING = 12
const NEARBY_THRESHOLD = 8

export function segmentConflictsWithOccupied(
  seg: OccupiedSegment,
  occupied: OccupiedSegment[],
): boolean {
  return occupied.some(
    (occ) =>
      segmentsOverlap(seg, occ) ||
      segmentsCross(seg, occ) ||
      segmentsNearby(seg, occ, NEARBY_THRESHOLD),
  )
}

export function occupancyPenalty(seg: OccupiedSegment, occupied: OccupiedSegment[]): number {
  let penalty = 0
  for (const occ of occupied) {
    if (segmentsOverlap(seg, occ)) penalty += 5000
    else if (segmentsNearby(seg, occ, NEARBY_THRESHOLD)) penalty += 300
  }
  return penalty
}

/** Cari Y horizontal bebas tabrakan/silangan di sekitar baseY. */
export function resolveHorizontalTrackY(
  baseY: number,
  x1: number,
  x2: number,
  occupied: OccupiedSegment[],
): number {
  const left = Math.min(x1, x2)
  const right = Math.max(x1, x2)
  if (right - left < 1) return baseY
  const offsets = [0]
  for (let i = 1; i <= 10; i += 1) {
    offsets.push(i * TRACK_SPACING, -i * TRACK_SPACING)
  }
  let bestY = baseY
  let bestPenalty = Infinity
  for (const offset of offsets) {
    const y = baseY + offset
    const seg: OccupiedSegment = { x1: left, y1: y, x2: right, y2: y }
    const penalty = occupancyPenalty(seg, occupied)
    if (penalty === 0) return y
    if (penalty < bestPenalty) {
      bestPenalty = penalty
      bestY = y
    }
  }
  return bestY
}

/** Cari X vertikal bebas tabrakan/silangan di sekitar baseX. */
export function resolveVerticalTrackX(
  baseX: number,
  y1: number,
  y2: number,
  occupied: OccupiedSegment[],
): number {
  const top = Math.min(y1, y2)
  const bottom = Math.max(y1, y2)
  if (bottom - top < 1) return baseX
  const offsets = [0]
  for (let i = 1; i <= 10; i += 1) {
    offsets.push(i * TRACK_SPACING, -i * TRACK_SPACING)
  }
  let bestX = baseX
  let bestPenalty = Infinity
  for (const offset of offsets) {
    const x = baseX + offset
    const seg: OccupiedSegment = { x1: x, y1: top, x2: x, y2: bottom }
    const penalty = occupancyPenalty(seg, occupied)
    if (penalty === 0) return x
    if (penalty < bestPenalty) {
      bestPenalty = penalty
      bestX = x
    }
  }
  return bestX
}
