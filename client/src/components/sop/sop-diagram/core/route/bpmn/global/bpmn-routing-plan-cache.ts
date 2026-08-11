import {
  computeBpmnRoutingPlan,
  type BpmnRoutingPlan,
  type ComputeBpmnRoutingPlanInput,
} from './bpmn-routing-plan'

const MAX_CACHED_PLANS = 8
const routingPlanCache = new Map<string, BpmnRoutingPlan>()

function routingPlanCacheKey(input: ComputeBpmnRoutingPlanInput): string {
  const manualLocks = Object.entries(input.manualLocks ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
  return JSON.stringify({
    nodes: [...input.nodes]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((node) => [node.id, node.type, node.lane, node.columnIndex, node.rect]),
    edges: [...input.edges]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((edge) => [
        edge.id,
        edge.from,
        edge.to,
        edge.label,
        edge.sourceType,
        edge.targetType,
        edge.fromLane,
        edge.toLane,
        edge.fromCol,
        edge.toCol,
      ]),
    laneLayout: input.laneLayout,
    bounds: input.bounds,
    manualLocks,
    pathLayoutSeed: input.pathLayoutSeed ?? 0,
    maxReroutePasses: input.maxReroutePasses,
  })
}

export function computeCachedBpmnRoutingPlan(
  input: ComputeBpmnRoutingPlanInput,
): BpmnRoutingPlan {
  const key = routingPlanCacheKey(input)
  const cached = routingPlanCache.get(key)
  if (cached) {
    routingPlanCache.delete(key)
    routingPlanCache.set(key, cached)
    return cached
  }

  const plan = computeBpmnRoutingPlan(input)
  routingPlanCache.set(key, plan)
  if (routingPlanCache.size > MAX_CACHED_PLANS) {
    routingPlanCache.delete(routingPlanCache.keys().next().value!)
  }
  return plan
}

export function clearBpmnRoutingPlanCache(): void {
  routingPlanCache.clear()
}
