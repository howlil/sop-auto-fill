import type { BpmnConnectionMeta } from '../bpmnRouter'

export type BpmnEdgeKind =
  | 'forward'
  | 'handoff'
  | 'branch-yes'
  | 'branch-no'
  | 'feedback'

function sequenceFromShapeId(shapeId: string): number | null {
  const match = /(?:^|-)step-(\d+)$/.exec(shapeId)
  return match ? Number(match[1]) : null
}

export function classifyBpmnEdge(connection: BpmnConnectionMeta): BpmnEdgeKind {
  const fromSeq = sequenceFromShapeId(connection.from)
  const toSeq = sequenceFromShapeId(connection.to)
  const isFeedback =
    (fromSeq != null && toSeq != null && toSeq <= fromSeq) ||
    connection.toCol < connection.fromCol
  if (isFeedback) return 'feedback'

  const label = (connection.label ?? '').trim().toLowerCase()
  if (/^(ya|yes|y)$/.test(label)) return 'branch-yes'
  if (/^(tidak|no|n)$/.test(label)) return 'branch-no'
  if (connection.fromLane !== connection.toLane) return 'handoff'
  return 'forward'
}

function edgePriority(kind: BpmnEdgeKind): number {
  switch (kind) {
    case 'forward':
      return 0
    case 'handoff':
      return 1
    case 'branch-yes':
      return 2
    case 'branch-no':
      return 3
    case 'feedback':
      return 4
  }
}

function edgeSpan(connection: BpmnConnectionMeta): number {
  return (
    Math.abs(connection.toCol - connection.fromCol) +
    Math.abs(connection.toLane - connection.fromLane)
  )
}

export function sortBpmnEdgesForGlobalRouting(
  connections: BpmnConnectionMeta[],
): BpmnConnectionMeta[] {
  return [...connections].sort((left, right) => {
    const priorityDiff =
      edgePriority(classifyBpmnEdge(left)) - edgePriority(classifyBpmnEdge(right))
    if (priorityDiff !== 0) return priorityDiff

    const spanDiff = edgeSpan(left) - edgeSpan(right)
    if (spanDiff !== 0) return spanDiff
    return left.id.localeCompare(right.id)
  })
}

export function rotateBpmnRoutingOrder(
  connections: BpmnConnectionMeta[],
  offset: number,
): BpmnConnectionMeta[] {
  if (connections.length < 2) return [...connections]
  const normalized = ((offset % connections.length) + connections.length) % connections.length
  return [...connections.slice(normalized), ...connections.slice(0, normalized)]
}
