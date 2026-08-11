import { describe, expect, it } from 'vitest'
import type { ArrowConfig } from '../../../sopDiagramTypes'
import type { BpmnConnectionMeta, BpmnLaneLayout } from '../bpmnRouter'
import {
  computeBpmnRoutingPlan,
  type BpmnRoutingNode,
} from '../global/bpmn-routing-plan'
import {
  clearBpmnRoutingPlanCache,
  computeCachedBpmnRoutingPlan,
} from '../global/bpmn-routing-plan-cache'

function layout(): BpmnLaneLayout {
  return {
    lanes: [
      { index: 0, top: 40, height: 120 },
      { index: 1, top: 180, height: 120 },
      { index: 2, top: 320, height: 120 },
      { index: 3, top: 460, height: 120 },
    ],
    columnStartXs: [80, 280, 480, 680],
    columnWidths: [120, 120, 120, 120],
  }
}

function node(
  seq: number,
  lane: number,
  columnIndex: number,
  type: string,
  width = type === 'terminator' ? 52 : type === 'decision' ? 56 : 100,
  height = type === 'terminator' ? 52 : type === 'decision' ? 56 : 50,
): BpmnRoutingNode {
  const laneInfo = layout().lanes[lane]!
  const columnStart = layout().columnStartXs[columnIndex]!
  const columnWidth = layout().columnWidths[columnIndex]!
  const centerX = columnStart + columnWidth / 2
  const centerY = laneInfo.top + laneInfo.height / 2
  return {
    id: `bpmn-step-${seq}`,
    type,
    lane,
    columnIndex,
    rect: {
      left: centerX - width / 2,
      top: centerY - height / 2,
      width,
      height,
    },
  }
}

function nodeInLayout(
  laneLayout: BpmnLaneLayout,
  seq: number,
  lane: number,
  columnIndex: number,
  type: string,
  width = type === 'terminator' ? 52 : type === 'decision' ? 56 : 100,
  height = type === 'terminator' ? 52 : type === 'decision' ? 56 : 50,
): BpmnRoutingNode {
  const laneInfo = laneLayout.lanes[lane]!
  const centerX = laneLayout.columnStartXs[columnIndex]! + laneLayout.columnWidths[columnIndex]! / 2
  const centerY = laneInfo.top + laneInfo.height / 2
  return {
    id: `bpmn-step-${seq}`,
    type,
    lane,
    columnIndex,
    rect: {
      left: centerX - width / 2,
      top: centerY - height / 2,
      width,
      height,
    },
  }
}

function edge(
  id: string,
  from: BpmnRoutingNode,
  to: BpmnRoutingNode,
  overrides: Partial<BpmnConnectionMeta> = {},
): BpmnConnectionMeta {
  return {
    id,
    from: from.id,
    to: to.id,
    fromLane: from.lane,
    toLane: to.lane,
    fromCol: from.columnIndex,
    toCol: to.columnIndex,
    sourceType: from.type === 'decision'
      ? 'flowchart-decision'
      : from.type === 'terminator'
        ? 'flowchart-terminator'
        : 'flowchart-process',
    targetType: to.type === 'decision'
      ? 'flowchart-decision'
      : to.type === 'terminator'
        ? 'flowchart-terminator'
        : 'flowchart-process',
    ...overrides,
  }
}

function fixture() {
  const start = node(0, 0, 0, 'terminator')
  const receive = node(1, 0, 1, 'task')
  const gateway = node(2, 1, 1, 'decision')
  const process = node(3, 1, 2, 'task')
  const review = node(4, 2, 2, 'task')
  const end = node(5, 2, 3, 'terminator')
  const fallback = node(6, 3, 2, 'task')
  const nodes = [start, receive, gateway, process, review, end, fallback]
  const edges = [
    edge('conn-0-to-1', start, receive),
    edge('conn-1-to-2', receive, gateway),
    edge('conn-2-yes-3', gateway, process, { label: 'Ya' }),
    edge('conn-2-no-6', gateway, fallback, { label: 'Tidak' }),
    edge('conn-3-to-4', process, review),
    edge('conn-4-to-5', review, end),
    edge('conn-6-to-1', fallback, receive),
  ]
  return { nodes, edges }
}

function plan(edges?: BpmnConnectionMeta[], manualLocks?: ArrowConfig) {
  const data = fixture()
  return computeBpmnRoutingPlan({
    nodes: data.nodes,
    edges: edges ?? data.edges,
    laneLayout: layout(),
    bounds: { left: 0, top: 0, width: 920, height: 640 },
    manualLocks,
  })
}

function pathSignature(result: ReturnType<typeof plan>): string {
  return Object.values(result.pathsByConnection)
    .sort((left, right) => left.connectionId.localeCompare(right.connectionId))
    .map((path) => (
      `${path.connectionId}:${path.sSide}:${path.eSide}:` +
      path.path.map((point) => `${point.x},${point.y}`).join(';')
    ))
    .join('|')
}

describe('computeBpmnRoutingPlan', () => {
  it('routes the complete fixture without shape collisions', () => {
    const result = plan()

    expect(result.diagnostics.unroutedConnectionIds).toEqual([])
    expect(result.diagnostics.obstacleHits).toBe(0)
  })

  it('is deterministic regardless of connector render order', () => {
    const { edges } = fixture()
    const normal = plan(edges)
    const reversed = plan([...edges].reverse())

    expect(pathSignature(normal)).toBe(pathSignature(reversed))
  })

  it('keeps feedback edges inside the swimlane pool when an internal corridor is available', () => {
    const result = plan()
    const feedback = result.pathsByConnection['conn-6-to-1']
    const laneLayout = layout()
    const laneTop = Math.min(...laneLayout.lanes.map((lane) => lane.top))
    const laneBottom = Math.max(...laneLayout.lanes.map((lane) => lane.top + lane.height))

    expect(feedback).toBeDefined()
    expect(feedback?.kind).toBe('feedback')
    expect(feedback?.usesFeedbackCorridor).toBe(true)
    expect(feedback?.feedbackCorridorScope).toBe('internal')
    expect(feedback?.path.every((point) => point.y >= laneTop && point.y <= laneBottom)).toBe(true)
    expect(result.diagnostics.feedbackCorridorMisuse).toBe(0)
  })

  it('keeps feedback edges internal when rendered swimlane rows are contiguous', () => {
    const laneLayout: BpmnLaneLayout = {
      lanes: [
        { index: 0, top: 40, height: 120 },
        { index: 1, top: 160, height: 120 },
        { index: 2, top: 280, height: 120 },
      ],
      columnStartXs: [80, 280, 480],
      columnWidths: [120, 120, 120],
    }
    const target = nodeInLayout(laneLayout, 1, 0, 1, 'task')
    const source = nodeInLayout(laneLayout, 3, 2, 2, 'task')
    const result = computeBpmnRoutingPlan({
      nodes: [target, source],
      edges: [edge('conn-3-to-1', source, target)],
      laneLayout,
      bounds: { left: 0, top: 0, width: 760, height: 440 },
    })
    const feedback = result.pathsByConnection['conn-3-to-1']

    expect(feedback).toBeDefined()
    expect(feedback?.kind).toBe('feedback')
    expect(feedback?.feedbackCorridorScope).toBe('internal')
    expect(feedback?.path.every((point) => point.y >= 40 && point.y <= 400)).toBe(true)
    expect(result.diagnostics.unroutedConnectionIds).toEqual([])
  })

  it('uses separate gateway ports for Ya and Tidak branches', () => {
    const result = plan()
    const yes = result.pathsByConnection['conn-2-yes-3']
    const no = result.pathsByConnection['conn-2-no-6']

    expect(yes).toBeDefined()
    expect(no).toBeDefined()
    expect(yes?.sSide).not.toBe(no?.sSide)
  })

  it('keeps persisted manual paths locked while routing other edges', () => {
    const manualLocks: ArrowConfig = {
      'conn-0-to-1': {
        sSide: 'right',
        eSide: 'left',
        startPoint: { x: 166, y: 100 },
        endPoint: { x: 290, y: 100 },
        bendPoints: [],
      },
    }
    const result = plan(undefined, manualLocks)
    const locked = result.pathsByConnection['conn-0-to-1']

    expect(locked?.locked).toBe(true)
    expect(locked?.path).toEqual([
      { x: 166, y: 100 },
      { x: 290, y: 100 },
    ])
  })

  it('reuses a cached plan when reopening an equivalent BPMN tab', () => {
    clearBpmnRoutingPlanCache()
    const data = fixture()
    const input = {
      nodes: data.nodes,
      edges: data.edges,
      laneLayout: layout(),
      bounds: { left: 0, top: 0, width: 920, height: 640 },
    }

    const first = computeCachedBpmnRoutingPlan(input)
    const reopened = computeCachedBpmnRoutingPlan({
      ...input,
      nodes: [...input.nodes],
      edges: [...input.edges].reverse(),
      laneLayout: {
        ...input.laneLayout,
        lanes: input.laneLayout.lanes.map((lane) => ({ ...lane })),
      },
    })
    const rerouted = computeCachedBpmnRoutingPlan({ ...input, pathLayoutSeed: 1 })

    expect(reopened).toBe(first)
    expect(rerouted).not.toBe(first)
    clearBpmnRoutingPlanCache()
  })
})
