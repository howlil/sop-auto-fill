export type BpmnLaneRunDirection = -1 | 0 | 1

export interface BpmnLaneRunTransition {
  columnAdvance: 0 | 1
  direction: BpmnLaneRunDirection
}

/**
 * Keep a vertical swimlane sweep in one column until its direction changes.
 * A same-lane transition or an explicit boundary starts a fresh column.
 */
export function transitionBpmnLaneRun(
  fromLane: number,
  toLane: number,
  previousDirection: BpmnLaneRunDirection,
  forceNewColumn = false,
): BpmnLaneRunTransition {
  if (forceNewColumn || fromLane === toLane) {
    return { columnAdvance: 1, direction: 0 }
  }
  const direction: BpmnLaneRunDirection = toLane > fromLane ? 1 : -1
  return {
    columnAdvance:
      previousDirection !== 0 && previousDirection !== direction ? 1 : 0,
    direction,
  }
}
