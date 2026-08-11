import {
  pathIntersectsRectangles,
  segmentsCross,
  segmentsOverlap,
  type OccupiedSegment,
  type Point,
  type Rect,
} from '../../shared/orthogonalRouter'
import type { BpmnConnectionMeta } from '../bpmnRouter'
import type { BpmnEdgeKind } from './bpmn-routing-model'

export interface BpmnQualityPath {
  connectionId: string
  path: Point[]
  kind: BpmnEdgeKind
  usesFeedbackCorridor: boolean
  segments: OccupiedSegment[]
  locked?: boolean
}

export interface BpmnQualityNode {
  id: string
  rect: Rect
}

export interface BpmnRoutingDiagnostics {
  unroutedConnectionIds: string[]
  conflictConnectionIds: string[]
  obstacleHits: number
  overlaps: number
  crossings: number
  feedbackCorridorMisuse: number
  bends: number
  pathLength: number
  reroutePasses: number
}

function countBends(path: Point[]): number {
  let bends = 0
  let previous: 'horizontal' | 'vertical' | null = null
  for (let index = 0; index < path.length - 1; index += 1) {
    const from = path[index]!
    const to = path[index + 1]!
    const current = from.y === to.y ? 'horizontal' : 'vertical'
    if (previous != null && previous !== current) bends += 1
    previous = current
  }
  return bends
}

function pathLength(path: Point[]): number {
  let total = 0
  for (let index = 0; index < path.length - 1; index += 1) {
    const from = path[index]!
    const to = path[index + 1]!
    total += Math.abs(to.x - from.x) + Math.abs(to.y - from.y)
  }
  return total
}

export function computeBpmnRoutingDiagnostics(input: {
  edges: BpmnConnectionMeta[]
  paths: Map<string, BpmnQualityPath>
  nodes: BpmnQualityNode[]
  reroutePasses?: number
}): BpmnRoutingDiagnostics {
  const { edges, paths, nodes, reroutePasses = 0 } = input
  const conflicts = new Set<string>()
  let overlaps = 0
  let crossings = 0
  let obstacleHits = 0
  let feedbackCorridorMisuse = 0
  let bends = 0
  let totalLength = 0
  const routed = [...paths.values()]

  for (let leftIndex = 0; leftIndex < routed.length; leftIndex += 1) {
    const left = routed[leftIndex]!
    bends += countBends(left.path)
    totalLength += pathLength(left.path)
    if (left.kind === 'feedback' && !left.usesFeedbackCorridor && !left.locked) {
      feedbackCorridorMisuse += 1
      conflicts.add(left.connectionId)
    }

    const edge = edges.find((item) => item.id === left.connectionId)
    const obstacles = nodes
      .filter((node) => node.id !== edge?.from && node.id !== edge?.to)
      .map((node) => node.rect)
    if (pathIntersectsRectangles(left.path, obstacles, 4)) {
      obstacleHits += 1
      conflicts.add(left.connectionId)
    }

    for (let rightIndex = leftIndex + 1; rightIndex < routed.length; rightIndex += 1) {
      const right = routed[rightIndex]!
      for (const leftSegment of left.segments) {
        for (const rightSegment of right.segments) {
          if (segmentsOverlap(leftSegment, rightSegment)) {
            overlaps += 1
            conflicts.add(left.connectionId)
            conflicts.add(right.connectionId)
          } else if (segmentsCross(leftSegment, rightSegment)) {
            crossings += 1
            conflicts.add(left.connectionId)
            conflicts.add(right.connectionId)
          }
        }
      }
    }
  }

  return {
    unroutedConnectionIds: edges
      .filter((edge) => !paths.has(edge.id))
      .map((edge) => edge.id)
      .sort(),
    conflictConnectionIds: [...conflicts].sort(),
    obstacleHits,
    overlaps,
    crossings,
    feedbackCorridorMisuse,
    bends,
    pathLength: totalLength,
    reroutePasses,
  }
}

export function compareBpmnRoutingDiagnostics(
  left: BpmnRoutingDiagnostics,
  right: BpmnRoutingDiagnostics,
): number {
  const leftScore = [
    left.unroutedConnectionIds.length,
    left.obstacleHits,
    left.overlaps,
    left.feedbackCorridorMisuse,
    left.crossings,
    left.bends,
    left.pathLength,
  ]
  const rightScore = [
    right.unroutedConnectionIds.length,
    right.obstacleHits,
    right.overlaps,
    right.feedbackCorridorMisuse,
    right.crossings,
    right.bends,
    right.pathLength,
  ]
  for (let index = 0; index < leftScore.length; index += 1) {
    const diff = leftScore[index]! - rightScore[index]!
    if (diff !== 0) return diff
  }
  return 0
}
