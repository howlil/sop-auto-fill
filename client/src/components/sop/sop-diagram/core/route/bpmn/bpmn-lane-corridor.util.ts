import type { LaneInfo } from './bpmnRouter'

const TRACK_SHIFTS = [0, -4, 4]
const MIN_TRACK_INSET = 4
const LANE_RAIL_INSET = 16

/**
 * Tabel swimlane tidak memiliki gap fisik antar-baris. Saat dua lane menempel,
 * sediakan rail di dalam padding lane agar path tidak menimpa border tabel.
 */
export function bpmnLaneBoundaryTrackYs(
  above: LaneInfo,
  below: LaneInfo,
  trackOffset = 0,
): number[] {
  const aboveBottom = above.top + above.height
  const gap = below.top - aboveBottom
  const shift = TRACK_SHIFTS[trackOffset] ?? trackOffset * MIN_TRACK_INSET

  if (gap >= MIN_TRACK_INSET * 2) {
    const min = aboveBottom + MIN_TRACK_INSET
    const max = below.top - MIN_TRACK_INSET
    return [Math.round(Math.max(min, Math.min(max, (aboveBottom + below.top) / 2 + shift)))]
  }

  const railInset = LANE_RAIL_INSET + Math.max(0, trackOffset) * MIN_TRACK_INSET
  const aboveRail = Math.max(above.top + MIN_TRACK_INSET, aboveBottom - railInset)
  const belowRail = Math.min(below.top + below.height - MIN_TRACK_INSET, below.top + railInset)
  return [...new Set([Math.round(aboveRail), Math.round(belowRail)])]
}

export function preferredBpmnLaneBoundaryTrackY(
  above: LaneInfo,
  below: LaneInfo,
): number {
  return bpmnLaneBoundaryTrackYs(above, below)[0]!
}
