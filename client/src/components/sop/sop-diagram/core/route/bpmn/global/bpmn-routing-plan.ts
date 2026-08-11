import type { ArrowConfig, ArrowConnectionConfig } from '../../../sopDiagramTypes'
import { scoreAnchorOffCenter } from '../../shared/connector-anchor.util'
import { createPathSafetyOptions, isAcceptableRoutedPath } from '../../quality/path-route-quality.util'
import {
  isOrthogonalPath,
  normalizeOrthogonalPath,
  pathOverlapsSegments,
  pathToSegments,
  type OccupiedSegment,
  type Point,
  type Rect,
} from '../../shared/orthogonalRouter'
import {
  routeBpmn,
  scoreBpmnPath,
  scoreBpmnRouteCandidate,
  selectBpmnSidePairs,
  type BpmnConnectionMeta,
  type BpmnLaneLayout,
  type BpmnRouteCandidate,
  type Side,
} from '../bpmnRouter'
import {
  buildFeedbackCorridorCandidates,
  buildInternalFeedbackCorridorCandidates,
  type BpmnFeedbackCorridorScope,
} from './bpmn-feedback-corridor'
import {
  bpmnPortDistance,
  countReservedBpmnPorts,
  createBpmnPortLedger,
  reserveBpmnPortPair,
  type BpmnPortLedger,
} from './bpmn-port-assignment'
import {
  classifyBpmnEdge,
  rotateBpmnRoutingOrder,
  sortBpmnEdgesForGlobalRouting,
} from './bpmn-routing-model'
import { routeBpmnOnChannelGraph } from './bpmn-channel-pathfinder'
import {
  compareBpmnRoutingDiagnostics,
  computeBpmnRoutingDiagnostics,
  type BpmnQualityPath,
  type BpmnRoutingDiagnostics,
} from './bpmn-routing-quality'

const OBSTACLE_MARGIN = 10
const MAX_SLOT_VARIANTS = 3
const DEFAULT_MAX_REROUTE_PASSES = 4
const MAX_ACCEPTABLE_BENDS_PER_EDGE = 3

export interface BpmnRoutingNode {
  id: string
  type: string
  lane: number
  columnIndex: number
  rect: Rect
}

export interface PlannedBpmnPath extends BpmnQualityPath {
  from: string
  to: string
  sSide: Side
  eSide: Side
  locked: boolean
  feedbackCorridorScope?: BpmnFeedbackCorridorScope
}

export interface BpmnRoutingPlan {
  pathsByConnection: Record<string, PlannedBpmnPath>
  segmentsByConnection: Map<string, OccupiedSegment[]>
  diagnostics: BpmnRoutingDiagnostics
}

export interface ComputeBpmnRoutingPlanInput {
  nodes: BpmnRoutingNode[]
  edges: BpmnConnectionMeta[]
  laneLayout: BpmnLaneLayout
  bounds: Rect
  manualLocks?: ArrowConfig
  pathLayoutSeed?: number
  maxReroutePasses?: number
}

interface PlannerContext extends ComputeBpmnRoutingPlanInput {
  nodeById: Map<string, BpmnRoutingNode>
  obstaclesByEdgeId: Map<string, Rect[]>
}

interface PlannerState {
  paths: Map<string, PlannedBpmnPath>
  diagnostics: BpmnRoutingDiagnostics
}

interface AutoRouteCandidate {
  path: Point[]
  sSide: Side
  eSide: Side
  usesFeedbackCorridor: boolean
  feedbackCorridorScope?: BpmnFeedbackCorridorScope
  score: number
}

function inflateRect(rect: Rect, margin: number): Rect {
  return {
    left: rect.left - margin,
    top: rect.top - margin,
    width: rect.width + margin * 2,
    height: rect.height + margin * 2,
  }
}

function normalizePath(path: Point[]): Point[] {
  return normalizeOrthogonalPath(path)
}

function segmentsForPath(path: Point[]): OccupiedSegment[] {
  if (path.length < 2 || !isOrthogonalPath(path)) return []
  return pathToSegments(path)
}

function validManualConfig(
  config: ArrowConnectionConfig | null | undefined,
): config is ArrowConnectionConfig {
  if (!config?.startPoint || !config?.endPoint) return false
  const points = [config.startPoint, ...(config.bendPoints ?? []), config.endPoint]
  return points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
}

function buildContext(input: ComputeBpmnRoutingPlanInput): PlannerContext {
  const obstacleById = new Map(
    input.nodes.map((node) => [node.id, inflateRect(node.rect, OBSTACLE_MARGIN)]),
  )
  return {
    ...input,
    nodeById: new Map(input.nodes.map((node) => [node.id, node])),
    obstaclesByEdgeId: new Map(
      input.edges.map((edge) => [
        edge.id,
        [...obstacleById]
          .filter(([nodeId]) => nodeId !== edge.from && nodeId !== edge.to)
          .map(([, rect]) => rect),
      ]),
    ),
  }
}

function routingObstacles(context: PlannerContext, edge: BpmnConnectionMeta): Rect[] {
  return context.obstaclesByEdgeId.get(edge.id) ?? []
}

function occupiedSegments(
  paths: Map<string, PlannedBpmnPath>,
  excludedConnectionId?: string,
): OccupiedSegment[] {
  const segments: OccupiedSegment[] = []
  for (const [connectionId, path] of paths) {
    if (connectionId !== excludedConnectionId) segments.push(...path.segments)
  }
  return segments
}

function buildLedger(
  paths: Map<string, PlannedBpmnPath>,
  excludedConnectionId?: string,
): BpmnPortLedger {
  const ledger = createBpmnPortLedger()
  for (const [connectionId, path] of paths) {
    if (connectionId === excludedConnectionId) continue
    reserveBpmnPortPair(
      ledger,
      path.connectionId,
      path.from,
      path.to,
      path.sSide,
      path.eSide,
    )
  }
  return ledger
}

function createPlannedPath(input: {
  edge: BpmnConnectionMeta
  path: Point[]
  sSide: Side
  eSide: Side
  locked: boolean
  usesFeedbackCorridor: boolean
  feedbackCorridorScope?: BpmnFeedbackCorridorScope
}): PlannedBpmnPath {
  const path = normalizePath(input.path)
  return {
    connectionId: input.edge.id,
    from: input.edge.from,
    to: input.edge.to,
    path,
    sSide: input.sSide,
    eSide: input.eSide,
    locked: input.locked,
    kind: classifyBpmnEdge(input.edge),
    usesFeedbackCorridor: input.usesFeedbackCorridor,
    feedbackCorridorScope: input.feedbackCorridorScope,
    segments: segmentsForPath(path),
  }
}

function initialLockedPaths(context: PlannerContext): Map<string, PlannedBpmnPath> {
  const paths = new Map<string, PlannedBpmnPath>()
  for (const edge of context.edges) {
    const config = context.manualLocks?.[edge.id]
    if (!validManualConfig(config)) continue
    paths.set(edge.id, createPlannedPath({
      edge,
      path: [config.startPoint, ...(config.bendPoints ?? []), config.endPoint],
      sSide: config.sSide,
      eSide: config.eSide,
      locked: true,
      usesFeedbackCorridor: false,
    }))
  }
  return paths
}

function isSafePath(input: {
  path: Point[]
  edge: BpmnConnectionMeta
  context: PlannerContext
  occupied: OccupiedSegment[]
  obstacles?: Rect[]
}): boolean {
  const { path, edge, context, occupied, obstacles = routingObstacles(context, edge) } = input
  const from = context.nodeById.get(edge.from)
  const to = context.nodeById.get(edge.to)
  if (!from || !to || path.length < 2 || !isOrthogonalPath(path)) return false
  return isAcceptableRoutedPath(
    path,
    createPathSafetyOptions('bpmn', {
      obstacles,
      occupied,
      fromShape: from.rect,
      toShape: to.rect,
      clearancePx: 0,
      allowCrossings: true,
    }),
  )
}

function semanticPairPenalty(
  edge: BpmnConnectionMeta,
  ledger: BpmnPortLedger,
  sSide: Side,
): number {
  if (edge.sourceType !== 'flowchart-decision') return 0
  const branchSideUse = countReservedBpmnPorts(ledger, edge.from, 'out', sSide)
  return branchSideUse * 6_000
}

function portDistancesForSides(input: {
  ledger: BpmnPortLedger
  nodeId: string
  direction: 'in' | 'out'
  shape: Rect
  slotOffset: number
  isDiamond: boolean
}): Record<Side, number> {
  const { ledger, nodeId, direction, shape, slotOffset, isDiamond } = input
  return {
    top: bpmnPortDistance(ledger, nodeId, direction, 'top', shape, slotOffset, isDiamond),
    right: bpmnPortDistance(ledger, nodeId, direction, 'right', shape, slotOffset, isDiamond),
    bottom: bpmnPortDistance(ledger, nodeId, direction, 'bottom', shape, slotOffset, isDiamond),
    left: bpmnPortDistance(ledger, nodeId, direction, 'left', shape, slotOffset, isDiamond),
  }
}

function candidatePairs(
  edge: BpmnConnectionMeta,
  fromShape: Rect,
  toShape: Rect,
  ledger: BpmnPortLedger,
): BpmnRouteCandidate[] {
  const pairs = selectBpmnSidePairs(edge, fromShape, toShape, ledger.usedSides)
  const seen = new Set<string>()
  return pairs.filter((pair) => {
    const key = `${pair.sSide}:${pair.eSide}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function standardRouteCandidates(input: {
  edge: BpmnConnectionMeta
  context: PlannerContext
  ledger: BpmnPortLedger
  occupied: OccupiedSegment[]
}): AutoRouteCandidate[] {
  const { edge, context, ledger, occupied } = input
  const from = context.nodeById.get(edge.from)
  const to = context.nodeById.get(edge.to)
  if (!from || !to) return []
  const fromIsDiamond = edge.sourceType === 'flowchart-decision'
  const toIsDiamond = edge.targetType === 'flowchart-decision'
  const candidates: AutoRouteCandidate[] = []
  const obstacles = routingObstacles(context, edge)
  const appendCandidate = (
    path: Point[],
    pair: BpmnRouteCandidate,
    fromDistance: number,
    toDistance: number,
  ) => {
    candidates.push({
      path,
      sSide: pair.sSide,
      eSide: pair.eSide,
      usesFeedbackCorridor: false,
      score:
        scoreBpmnRouteCandidate(pair) +
        scoreBpmnPath(path, occupied) +
        scoreAnchorOffCenter(fromDistance) +
        scoreAnchorOffCenter(toDistance) +
        semanticPairPenalty(edge, ledger, pair.sSide),
    })
  }

  for (const pair of candidatePairs(edge, from.rect, to.rect, ledger)) {
    for (let slotOffset = 0; slotOffset < MAX_SLOT_VARIANTS; slotOffset += 1) {
      const fromDistance = bpmnPortDistance(
        ledger,
        edge.from,
        'out',
        pair.sSide,
        from.rect,
        slotOffset,
        fromIsDiamond,
      )
      const toDistance = bpmnPortDistance(
        ledger,
        edge.to,
        'in',
        pair.eSide,
        to.rect,
        slotOffset,
        toIsDiamond,
      )
      const directPath = routeBpmn({
        fromShape: from.rect,
        toShape: to.rect,
        fromSide: pair.sSide,
        toSide: pair.eSide,
        fromDistance,
        toDistance,
        fromIsDiamond,
        toIsDiamond,
        layout: context.laneLayout,
        fromLane: edge.fromLane,
        toLane: edge.toLane,
        fromCol: edge.fromCol,
        toCol: edge.toCol,
        obstacles,
        occupiedSegments: occupied,
        globalBounds: context.bounds,
        sourceJettySize: pair.sourceJettySize,
        targetJettySize: pair.targetJettySize,
        allowCrossings: true,
      })
      const normalizedDirectPath = normalizePath(directPath)
      const directSafe = isSafePath({
        path: normalizedDirectPath,
        edge,
        context,
        occupied,
        obstacles,
      })
      if (directSafe) appendCandidate(normalizedDirectPath, pair, fromDistance, toDistance)
      const directNeedsChannel =
        !directSafe ||
        pathOverlapsSegments(normalizedDirectPath, occupied, { includeCross: true })
      if (slotOffset === 0 && directNeedsChannel) {
        const channelPath = normalizePath(routeBpmnOnChannelGraph({
          fromShape: from.rect,
          toShape: to.rect,
          fromSide: pair.sSide,
          toSide: pair.eSide,
          fromDistance,
          toDistance,
          fromIsDiamond,
          toIsDiamond,
          layout: context.laneLayout,
          bounds: context.bounds,
          obstacles,
          occupied,
          sourceJettySize: pair.sourceJettySize,
          targetJettySize: pair.targetJettySize,
        }))
        if (isSafePath({ path: channelPath, edge, context, occupied, obstacles })) {
          appendCandidate(channelPath, pair, fromDistance, toDistance)
        }
      }
    }
  }
  return candidates
}

function feedbackCorridorCandidates(input: {
  edge: BpmnConnectionMeta
  context: PlannerContext
  ledger: BpmnPortLedger
  occupied: OccupiedSegment[]
  feedback: boolean
  scope: BpmnFeedbackCorridorScope
}): AutoRouteCandidate[] {
  const { edge, context, ledger, occupied, feedback, scope } = input
  const from = context.nodeById.get(edge.from)
  const to = context.nodeById.get(edge.to)
  if (!from || !to) return []
  const fromIsDiamond = edge.sourceType === 'flowchart-decision'
  const toIsDiamond = edge.targetType === 'flowchart-decision'
  const candidates: AutoRouteCandidate[] = []
  const obstacles = routingObstacles(context, edge)

  for (let trackOffset = 0; trackOffset < MAX_SLOT_VARIANTS; trackOffset += 1) {
    const corridorInput = {
      fromShape: from.rect,
      toShape: to.rect,
      fromDistances: portDistancesForSides({
        ledger,
        nodeId: edge.from,
        direction: 'out' as const,
        shape: from.rect,
        slotOffset: trackOffset,
        isDiamond: fromIsDiamond,
      }),
      toDistances: portDistancesForSides({
        ledger,
        nodeId: edge.to,
        direction: 'in' as const,
        shape: to.rect,
        slotOffset: trackOffset,
        isDiamond: toIsDiamond,
      }),
      fromIsDiamond,
      toIsDiamond,
      layout: context.laneLayout,
      trackOffset,
    }
    const corridorCandidates = scope === 'internal'
      ? buildInternalFeedbackCorridorCandidates(corridorInput)
      : buildFeedbackCorridorCandidates({ ...corridorInput, bounds: context.bounds })
    for (const corridor of corridorCandidates) {
      const path = normalizePath(corridor.path)
      if (!isSafePath({ path, edge, context, occupied, obstacles })) continue
      candidates.push({
        path,
        sSide: corridor.sSide,
        eSide: corridor.eSide,
        usesFeedbackCorridor: true,
        feedbackCorridorScope: corridor.scope,
        score:
          scoreBpmnPath(path, occupied) +
          scoreAnchorOffCenter(corridor.fromDistance) +
          scoreAnchorOffCenter(corridor.toDistance) +
          semanticPairPenalty(edge, ledger, corridor.sSide) +
          (feedback || scope === 'internal' ? 0 : 20_000),
      })
    }
  }
  return candidates
}

function bestCandidate(candidates: AutoRouteCandidate[]): AutoRouteCandidate | null {
  let best: AutoRouteCandidate | null = null
  for (const candidate of candidates) {
    if (!best || candidate.score < best.score) best = candidate
  }
  return best
}

function staysInsideSwimlanePool(path: Point[], layout: BpmnLaneLayout): boolean {
  if (layout.lanes.length === 0) return false
  const top = Math.min(...layout.lanes.map((lane) => lane.top))
  const bottom = Math.max(...layout.lanes.map((lane) => lane.top + lane.height))
  return path.every((point) => point.y >= top && point.y <= bottom)
}

function routeAutoEdge(input: {
  edge: BpmnConnectionMeta
  context: PlannerContext
  paths: Map<string, PlannedBpmnPath>
}): PlannedBpmnPath | null {
  const { edge, context, paths } = input
  const occupied = occupiedSegments(paths, edge.id)
  const ledger = buildLedger(paths, edge.id)
  const kind = classifyBpmnEdge(edge)
  const feedback = kind === 'feedback'
  const standardCandidates = standardRouteCandidates({ edge, context, ledger, occupied })
  const internalFeedbackCandidates = feedback
    ? feedbackCorridorCandidates({ edge, context, ledger, occupied, feedback: true, scope: 'internal' })
    : []
  const primaryCandidates = feedback
    ? [
        ...standardCandidates
          .filter((candidate) => staysInsideSwimlanePool(candidate.path, context.laneLayout))
          .map((candidate) => ({
            ...candidate,
            usesFeedbackCorridor: true,
            feedbackCorridorScope: 'internal' as const,
          })),
        ...internalFeedbackCandidates,
      ]
    : standardCandidates
  let routed = bestCandidate(primaryCandidates)
  if (!routed) {
    routed = bestCandidate(feedbackCorridorCandidates({
      edge,
      context,
      ledger,
      occupied,
      feedback,
      scope: 'outer',
    }))
  }
  if (!routed && feedback) routed = bestCandidate(standardCandidates)
  if (!routed) return null
  return createPlannedPath({
    edge,
    path: routed.path,
    sSide: routed.sSide,
    eSide: routed.eSide,
    locked: false,
    usesFeedbackCorridor: routed.usesFeedbackCorridor,
    feedbackCorridorScope: routed.feedbackCorridorScope,
  })
}

function diagnosticsFor(
  context: PlannerContext,
  paths: Map<string, PlannedBpmnPath>,
  reroutePasses = 0,
): BpmnRoutingDiagnostics {
  return computeBpmnRoutingDiagnostics({
    edges: context.edges,
    paths,
    nodes: context.nodes,
    reroutePasses,
  })
}

function routeInOrder(
  context: PlannerContext,
  order: BpmnConnectionMeta[],
): PlannerState {
  const paths = initialLockedPaths(context)
  for (const edge of order) {
    if (paths.has(edge.id)) continue
    const planned = routeAutoEdge({ edge, context, paths })
    if (planned) paths.set(edge.id, planned)
  }
  return { paths, diagnostics: diagnosticsFor(context, paths) }
}

function improvePlan(
  context: PlannerContext,
  initial: PlannerState,
  maxPasses: number,
): PlannerState {
  let best = initial
  let completedPasses = 0

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const candidateIds = [
      ...new Set([
        ...best.diagnostics.unroutedConnectionIds,
        ...best.diagnostics.conflictConnectionIds,
      ]),
    ].sort()
    if (candidateIds.length === 0) break

    let improved = false
    for (const connectionId of candidateIds) {
      const edge = context.edges.find((item) => item.id === connectionId)
      if (!edge || best.paths.get(connectionId)?.locked) continue
      const trialPaths = new Map(best.paths)
      trialPaths.delete(connectionId)
      const rerouted = routeAutoEdge({ edge, context, paths: trialPaths })
      if (!rerouted) continue
      trialPaths.set(connectionId, rerouted)
      const diagnostics = diagnosticsFor(context, trialPaths, pass + 1)
      if (compareBpmnRoutingDiagnostics(diagnostics, best.diagnostics) < 0) {
        best = { paths: trialPaths, diagnostics }
        improved = true
      }
    }
    completedPasses = pass + 1
    if (!improved) break
  }

  if (best.diagnostics.reroutePasses === completedPasses) return best
  return {
    ...best,
    diagnostics: { ...best.diagnostics, reroutePasses: completedPasses },
  }
}

function distinctOrders(
  edges: BpmnConnectionMeta[],
  pathLayoutSeed: number,
): BpmnConnectionMeta[][] {
  const primary = sortBpmnEdgesForGlobalRouting(edges)
  const orders = [
    primary,
    [...primary].reverse(),
    rotateBpmnRoutingOrder(primary, pathLayoutSeed + 1),
    rotateBpmnRoutingOrder(primary, Math.max(1, Math.floor(primary.length / 2))),
  ]
  const seen = new Set<string>()
  return orders.filter((order) => {
    const signature = order.map((edge) => edge.id).join('|')
    if (seen.has(signature)) return false
    seen.add(signature)
    return true
  })
}

function hasRoutingConflicts(diagnostics: BpmnRoutingDiagnostics): boolean {
  return (
    diagnostics.unroutedConnectionIds.length > 0 ||
    diagnostics.obstacleHits > 0 ||
    diagnostics.overlaps > 0 ||
    diagnostics.crossings > 0 ||
    diagnostics.feedbackCorridorMisuse > 0
  )
}

function isGoodEnoughRoutingPlan(
  diagnostics: BpmnRoutingDiagnostics,
  edgeCount: number,
): boolean {
  return (
    !hasRoutingConflicts(diagnostics) &&
    diagnostics.bends <= edgeCount * MAX_ACCEPTABLE_BENDS_PER_EDGE
  )
}

function toRoutingPlan(state: PlannerState): BpmnRoutingPlan {
  const pathsByConnection: Record<string, PlannedBpmnPath> = {}
  const segmentsByConnection = new Map<string, OccupiedSegment[]>()
  for (const [connectionId, path] of state.paths) {
    pathsByConnection[connectionId] = path
    segmentsByConnection.set(connectionId, path.segments)
  }
  return {
    pathsByConnection,
    segmentsByConnection,
    diagnostics: state.diagnostics,
  }
}

export function computeBpmnRoutingPlan(
  input: ComputeBpmnRoutingPlanInput,
): BpmnRoutingPlan {
  if (input.nodes.length === 0 || input.edges.length === 0) {
    return {
      pathsByConnection: {},
      segmentsByConnection: new Map(),
      diagnostics: computeBpmnRoutingDiagnostics({
        edges: input.edges,
        paths: new Map(),
        nodes: input.nodes,
      }),
    }
  }

  const context = buildContext(input)
  const maxPasses = input.maxReroutePasses ?? DEFAULT_MAX_REROUTE_PASSES
  const orders = distinctOrders(context.edges, input.pathLayoutSeed ?? 0)
  let best = improvePlan(context, routeInOrder(context, orders[0] ?? context.edges), maxPasses)
  if (isGoodEnoughRoutingPlan(best.diagnostics, context.edges.length)) return toRoutingPlan(best)
  for (const order of orders.slice(1)) {
    const candidate = improvePlan(context, routeInOrder(context, order), maxPasses)
    if (compareBpmnRoutingDiagnostics(candidate.diagnostics, best.diagnostics) < 0) {
      best = candidate
    }
  }
  return toRoutingPlan(best)
}
