import type { BpmnLaneLayout } from '../core/route/bpmn/bpmnRouter'
import type { FlowchartConnection } from '../shapes/FlowchartArrowConnector'
import {
  assignStepColumns,
  buildMainSpineStepIds,
  type BpmnLayoutStepInput,
} from './bpmn-graph-layer.util'
import {
  transitionBpmnLaneRun,
  type BpmnLaneRunDirection,
} from './bpmn-lane-run.util'
import {
  BPMN_BASE_ROW_HEIGHT,
  BPMN_BASE_X,
  BPMN_COLLISION_PADDING,
  BPMN_COLUMN_INNER_PADDING,
  BPMN_COLUMN_MIN_WIDTH,
  BPMN_COLUMN_SPACING,
  BPMN_DECISION_TEXT_OFFSET_Y,
  BPMN_GATEWAY_EXTRA_GAP,
  BPMN_LANE_MIN_STEP_GAP,
  BPMN_LANE_STEP_PADDING,
  BPMN_RIGHT_MARGIN,
  BPMN_SOP_CONTENT_MAX_WIDTH_PX,
  BPMN_TASK_MIN_HEIGHT,
  BPMN_TASK_MIN_WIDTH,
  BPMN_TASK_PREFERRED_MAX_WIDTH,
  getBpmnStepLayoutDimensions,
} from './bpmnDiagramMetrics'

export interface BpmnLayoutGlobalStep {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  name: string
  seq: number
  lane: number
  columnIndex: number
  laneHeight: number
  decisionTextGlobalY?: number
}

export interface BpmnLaneLayoutEntry {
  impId: string
  height: number
  steps: Array<
    BpmnLayoutGlobalStep & {
      id: string
    }
  >
}

export interface BpmnLayoutResult {
  globalSteps: BpmnLayoutGlobalStep[]
  columnStartXs: number[]
  maxColumnWidths: number[]
  laneLayouts: BpmnLaneLayoutEntry[]
  bpmnLaneLayoutForRouter: BpmnLaneLayout | null
  diagramContentWidth: number
}

export interface ComputeBpmnLayoutInput {
  steps: BpmnLayoutStepInput[]
  connections: FlowchartConnection[]
  implementerIds: string[]
  /** Lebar area diagram setelah kolom judul SOP (px). */
  contentMaxWidthPx?: number
}

function laneIndexForStep(step: BpmnLayoutStepInput, implementerIds: string[]): number {
  if (!step.id_implementer) return 0
  const idx = implementerIds.findIndex((id) => id === step.id_implementer)
  return idx === -1 ? 0 : idx
}

function stepRect(
  x: number,
  y: number,
  width: number,
  height: number,
  pad: number,
): { left: number; top: number; right: number; bottom: number } {
  return {
    left: x - width / 2 - pad,
    top: y - height / 2 - pad,
    right: x + width / 2 + pad,
    bottom: y + height / 2 + pad,
  }
}

function rectsOverlap(
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number },
): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}

/** Satu swimlane tidak boleh punya dua langkah di kolom yang sama (posisi x belum dihitung). */
function enforceUniqueColumnsPerLane(
  steps: BpmnLayoutGlobalStep[],
  spineIds: Set<string>,
): BpmnLayoutGlobalStep[] {
  const next = steps.map((s) => ({ ...s }))
  const byLane = new Map<number, BpmnLayoutGlobalStep[]>()
  for (const s of next) {
    const list = byLane.get(s.lane) ?? []
    list.push(s)
    byLane.set(s.lane, list)
  }
  for (const list of byLane.values()) {
    list.sort((a, b) => {
      const colDiff = a.columnIndex - b.columnIndex
      if (colDiff !== 0) return colDiff
      const spineA = spineIds.has(a.id) ? 0 : 1
      const spineB = spineIds.has(b.id) ? 0 : 1
      if (spineA !== spineB) return spineA - spineB
      return a.seq - b.seq
    })
    const used = new Set<number>()
    for (const s of list) {
      let col = s.columnIndex
      while (used.has(col)) col += 1
      s.columnIndex = col
      used.add(col)
    }
  }
  return next
}

function pickCollisionPushTarget(
  a: BpmnLayoutGlobalStep,
  b: BpmnLayoutGlobalStep,
  spineIds: Set<string>,
): BpmnLayoutGlobalStep {
  const aSpine = spineIds.has(a.id)
  const bSpine = spineIds.has(b.id)
  if (aSpine && !bSpine) return b
  if (bSpine && !aSpine) return a
  return b.columnIndex >= a.columnIndex && b.seq >= a.seq ? b : a
}

function resolveColumnCollisions(
  steps: BpmnLayoutGlobalStep[],
  spineIds: Set<string>,
  maxIterations = 12,
): BpmnLayoutGlobalStep[] {
  const next = steps.map((s) => ({ ...s }))
  for (let iter = 0; iter < maxIterations; iter += 1) {
    let moved = false
    for (let i = 0; i < next.length; i += 1) {
      for (let j = i + 1; j < next.length; j += 1) {
        const a = next[i]!
        const b = next[j]!
        if (a.lane !== b.lane) continue
        const ra = stepRect(a.x, a.y, a.width, a.height, BPMN_COLLISION_PADDING)
        const rb = stepRect(b.x, b.y, b.width, b.height, BPMN_COLLISION_PADDING)
        if (!rectsOverlap(ra, rb)) continue
        pickCollisionPushTarget(a, b, spineIds).columnIndex += 1
        moved = true
      }
    }
    if (!moved) break
  }
  return next
}

/** Dorong kolom ke kanan bila rect shape dalam lane masih berpotongan setelah posisi dihitung. */
function spreadOverlappingLaneSteps(
  steps: BpmnLayoutGlobalStep[],
  spineIds: Set<string>,
): BpmnLayoutGlobalStep[] {
  const next = steps.map((s) => ({ ...s }))
  const byLane = new Map<number, BpmnLayoutGlobalStep[]>()
  for (const s of next) {
    const list = byLane.get(s.lane) ?? []
    list.push(s)
    byLane.set(s.lane, list)
  }
  for (const list of byLane.values()) {
    list.sort((a, b) => {
      const colDiff = a.columnIndex - b.columnIndex
      if (colDiff !== 0) return colDiff
      const spineA = spineIds.has(a.id) ? 0 : 1
      const spineB = spineIds.has(b.id) ? 0 : 1
      if (spineA !== spineB) return spineA - spineB
      return a.seq - b.seq
    })
    for (let i = 1; i < list.length; i += 1) {
      const prev = list[i - 1]!
      const cur = list[i]!
      const prevRight = prev.x + prev.width / 2 + BPMN_LANE_MIN_STEP_GAP
      const curLeft = cur.x - cur.width / 2
      if (curLeft < prevRight) {
        const pushTarget = pickCollisionPushTarget(prev, cur, spineIds)
        pushTarget.columnIndex = Math.max(pushTarget.columnIndex, prev.columnIndex + 1)
      }
    }
  }
  return next
}

/** Prioritas keterbacaan: jangan mengecilkan kolom di bawah lebar natural (scroll horizontal jika perlu). */
function fitWidthsToBudget(naturalWidths: number[], budget: number, spacing: number): number[] {
  if (naturalWidths.length === 0) return []
  const totalSpacing = spacing * Math.max(0, naturalWidths.length - 1)
  const naturalSum = naturalWidths.reduce((sum, w) => sum + w, 0) + totalSpacing
  if (naturalSum <= budget) return naturalWidths
  return naturalWidths
}

function compactStepColumnIndices(steps: BpmnLayoutGlobalStep[]): BpmnLayoutGlobalStep[] {
  const ordered = [...new Set(steps.map((s) => s.columnIndex))].sort((a, b) => a - b)
  const remap = new Map<number, number>()
  ordered.forEach((col, idx) => remap.set(col, idx))
  return steps.map((s) => ({
    ...s,
    columnIndex: remap.get(s.columnIndex) ?? 0,
  }))
}

function parseBpmnStepSeq(nodeId: string): number | null {
  const match = nodeId.match(/^bpmn-step-(\d+)$/)
  return match ? Number(match[1]) : null
}

/**
 * Luruskan rantai handoff sederhana lintas-lane setelah collision pass.
 * Branch, join, feedback, dan lane yang sudah terisi sengaja tidak disentuh.
 */
export function straightenSimpleCrossLaneTaskChains(
  steps: BpmnLayoutGlobalStep[],
  connections: Array<{ from: string; to: string }>,
): BpmnLayoutGlobalStep[] {
  const next = steps.map((step) => ({ ...step }))
  const stepBySeq = new Map(next.map((step) => [step.seq, step]))
  const inbound = new Map<string, number>()
  const outbound = new Map<string, number>()
  for (const connection of connections) {
    inbound.set(connection.to, (inbound.get(connection.to) ?? 0) + 1)
    outbound.set(connection.from, (outbound.get(connection.from) ?? 0) + 1)
  }
  const orderedConnections = [...connections].sort((left, right) => {
    const leftSeq = parseBpmnStepSeq(left.from) ?? Number.MAX_SAFE_INTEGER
    const rightSeq = parseBpmnStepSeq(right.from) ?? Number.MAX_SAFE_INTEGER
    return leftSeq - rightSeq
  })
  const directionBySeq = new Map<number, BpmnLaneRunDirection>()
  for (const connection of orderedConnections) {
    const fromSeq = parseBpmnStepSeq(connection.from)
    const toSeq = parseBpmnStepSeq(connection.to)
    if (fromSeq == null || toSeq == null || fromSeq >= toSeq) continue
    const from = stepBySeq.get(fromSeq)
    const to = stepBySeq.get(toSeq)
    if (!from || !to) continue
    const isSimpleHandoff =
      (outbound.get(connection.from) ?? 0) === 1 &&
      (inbound.get(connection.to) ?? 0) === 1
    const transition = transitionBpmnLaneRun(
      from.lane,
      to.lane,
      directionBySeq.get(fromSeq) ?? 0,
      from.type === 'decision',
    )
    directionBySeq.set(toSeq, isSimpleHandoff ? transition.direction : 0)
    if (
      from.type !== 'task' ||
      to.type !== 'task' ||
      from.lane === to.lane ||
      !isSimpleHandoff ||
      transition.columnAdvance > 0
    ) {
      continue
    }
    const desiredColumn = from.columnIndex
    if (to.columnIndex <= desiredColumn) continue
    const conflicts = next.some(
      (step) =>
        step.id !== to.id &&
        step.lane === to.lane &&
        step.columnIndex === desiredColumn,
    )
    if (conflicts) continue
    to.columnIndex = desiredColumn
  }
  return next
}

function naturalColumnWidths(
  steps: BpmnLayoutGlobalStep[],
  stepDimensionsCache: Map<string, ReturnType<typeof getBpmnStepLayoutDimensions>>,
): number[] {
  const maxColIdx = Math.max(0, ...steps.map((s) => s.columnIndex))
  const maxColumnWidths = new Array(maxColIdx + 1).fill(BPMN_COLUMN_MIN_WIDTH)
  for (const step of steps) {
    const dims = stepDimensionsCache.get(step.id) ?? {
      width: BPMN_TASK_MIN_WIDTH,
      height: BPMN_TASK_MIN_HEIGHT,
      decisionTextReserve: 0,
    }
    const extra = step.type === 'decision' ? BPMN_GATEWAY_EXTRA_GAP : 0
    const need = dims.width + extra + BPMN_COLUMN_INNER_PADDING * 2 + BPMN_LANE_MIN_STEP_GAP
    maxColumnWidths[step.columnIndex] = Math.max(
      maxColumnWidths[step.columnIndex] ?? BPMN_COLUMN_MIN_WIDTH,
      need,
    )
  }
  return maxColumnWidths
}

/** Lebar SVG = tepi kanan shape terjauh + margin (bukan lebar grid kolom kosong). */
function measureDiagramContentWidth(positioned: BpmnLayoutGlobalStep[]): number {
  if (positioned.length === 0) {
    return BPMN_BASE_X + BPMN_RIGHT_MARGIN + BPMN_TASK_MIN_WIDTH
  }
  const maxRight = Math.max(...positioned.map((s) => s.x + s.width / 2))
  return Math.ceil(maxRight + BPMN_RIGHT_MARGIN)
}

function rebuildColumnGeometry(
  steps: BpmnLayoutGlobalStep[],
  stepDimensionsCache: Map<string, ReturnType<typeof getBpmnStepLayoutDimensions>>,
  columnWidths: number[],
): {
  columnStartXs: number[]
  maxColumnWidths: number[]
  positioned: BpmnLayoutGlobalStep[]
  diagramContentWidth: number
} {
  const maxColIdx = Math.max(0, ...steps.map((s) => s.columnIndex))
  const widths = columnWidths.length > 0 ? columnWidths : [BPMN_TASK_MIN_WIDTH]
  const columnStartXs: number[] = []
  let curX = BPMN_BASE_X
  for (let i = 0; i <= maxColIdx; i += 1) {
    columnStartXs[i] = curX
    const colW = widths[i] ?? BPMN_TASK_MIN_WIDTH
    curX += colW + BPMN_COLUMN_SPACING
  }
  const laneYPositions: number[] = []
  const numLanes = Math.max(1, ...steps.map((s) => s.lane + 1))
  const laneMaxHeights = new Array(numLanes).fill(BPMN_BASE_ROW_HEIGHT)

  /**
   * Perhitungan padding vertikal swimlane (agar "lane-pipe" router selalu punya ruang).
   *
   * Router BPMN:
   * - Di `BpmnPage.tsx` obstacle diperbesar OBSTACLE_MARGIN ~ 10px.
   * - Di `BpmnArrowConnector.tsx` path memiliki clearancePx ~ 6px.
   * - Di `bpmnRouter.ts` jetty size maksimum yang dipakai ~ 28px (terminator start).
   *
   * Jika padding vertikal terlalu kecil, route lintas swimlane sering batal memakai lane-pipe
   * dan fallback ke rute yang lebih "menyamping" (terlihat seperti detour horizontal).
   */
  const ROUTER_OBSTACLE_MARGIN_PX = 10
  const ROUTING_CLEARANCE_PX = 6
  const MAX_JETTY_PX = 28
  const requiredLanePaddingTotalPx = (ROUTER_OBSTACLE_MARGIN_PX + ROUTING_CLEARANCE_PX + MAX_JETTY_PX) * 2
  const effectiveLaneStepPadding = Math.max(BPMN_LANE_STEP_PADDING, requiredLanePaddingTotalPx)

  for (const step of steps) {
    const dims = stepDimensionsCache.get(step.id) ?? {
      width: BPMN_TASK_MIN_WIDTH,
      height: BPMN_TASK_MIN_HEIGHT,
      decisionTextReserve: 0,
    }
    const laneNeed = Math.max(dims.height, dims.decisionTextReserve) + effectiveLaneStepPadding
    laneMaxHeights[step.lane] = Math.max(laneMaxHeights[step.lane] ?? BPMN_BASE_ROW_HEIGHT, laneNeed)
  }
  let cumulativeY = 0
  for (let i = 0; i < numLanes; i += 1) {
    laneYPositions[i] = cumulativeY + (laneMaxHeights[i] ?? BPMN_BASE_ROW_HEIGHT) / 2
    cumulativeY += laneMaxHeights[i] ?? BPMN_BASE_ROW_HEIGHT
  }
  const positioned = steps.map((step) => {
    const dims = stepDimensionsCache.get(step.id) ?? {
      width: BPMN_TASK_MIN_WIDTH,
      height: BPMN_TASK_MIN_HEIGHT,
      decisionTextReserve: 0,
    }
    const colStart = columnStartXs[step.columnIndex] ?? BPMN_BASE_X
    const colWidth = widths[step.columnIndex] ?? dims.width
    const shapeWidth = dims.width
    const x = colStart + colWidth / 2
    const y = laneYPositions[step.lane] ?? 0
    const laneHeight = laneMaxHeights[step.lane] ?? BPMN_BASE_ROW_HEIGHT
    const decisionTextGlobalY =
      step.type === 'decision' ? y + BPMN_DECISION_TEXT_OFFSET_Y : undefined
    return {
      ...step,
      x,
      y,
      width: shapeWidth,
      height: dims.height,
      laneHeight,
      decisionTextGlobalY,
    }
  })
  const diagramContentWidth = measureDiagramContentWidth(positioned)
  return { columnStartXs, maxColumnWidths: widths, positioned, diagramContentWidth }
}

function buildStepDimensionsCache(
  steps: BpmnLayoutStepInput[],
  maxShapeWidth: number,
): Map<string, ReturnType<typeof getBpmnStepLayoutDimensions>> {
  const cache = new Map<string, ReturnType<typeof getBpmnStepLayoutDimensions>>()
  const cappedWidth = Math.max(
    BPMN_TASK_MIN_WIDTH,
    Math.min(BPMN_TASK_PREFERRED_MAX_WIDTH, maxShapeWidth),
  )
  for (const step of steps) {
    cache.set(step.id_step, getBpmnStepLayoutDimensions(step.name, step.type, cappedWidth))
  }
  return cache
}

function rebuildStepDimensionsForColumns(
  steps: BpmnLayoutGlobalStep[],
  stepInputs: BpmnLayoutStepInput[],
  columnWidths: number[],
  cache: Map<string, ReturnType<typeof getBpmnStepLayoutDimensions>>,
): void {
  const inputById = new Map(stepInputs.map((s) => [s.id_step, s]))
  for (const step of steps) {
    const input = inputById.get(step.id)
    if (!input) continue
    const colWidth = columnWidths[step.columnIndex] ?? BPMN_COLUMN_MIN_WIDTH
    const innerMax = Math.max(
      BPMN_TASK_MIN_WIDTH,
      colWidth - BPMN_COLUMN_INNER_PADDING * 2,
    )
    const maxShapeWidth = Math.min(BPMN_TASK_PREFERRED_MAX_WIDTH, innerMax)
    cache.set(step.id, getBpmnStepLayoutDimensions(input.name, input.type, maxShapeWidth))
  }
}

/** Swimlane horizontal: alur kiri → kanan, lebar dibatasi header SOP, tinggi swimlane mengikuti konten. */
export function computeBpmnLayout(input: ComputeBpmnLayoutInput): BpmnLayoutResult | null {
  const { steps, connections, implementerIds, contentMaxWidthPx = BPMN_SOP_CONTENT_MAX_WIDTH_PX } = input
  if (steps.length === 0) return null
  const diagramBudget = Math.max(
    BPMN_TASK_MIN_WIDTH * 2,
    contentMaxWidthPx - BPMN_BASE_X - BPMN_RIGHT_MARGIN,
  )
  const layoutConnections = connections.map((c) => ({ from: c.from, to: c.to }))
  const spineIds = buildMainSpineStepIds(steps, layoutConnections)
  const stepColumnMap = assignStepColumns(steps, layoutConnections, implementerIds)
  const endStepInput = steps.find((s) => s.id_step === 'end-terminator')
  if (endStepInput) {
    const maxAssigned = Math.max(0, ...[...stepColumnMap.values()])
    stepColumnMap.set(endStepInput.id_step, maxAssigned + 1)
  }
  let globalSteps: BpmnLayoutGlobalStep[] = steps.map((step) => {
    const lane = laneIndexForStep(step, implementerIds)
    const columnIndex = stepColumnMap.get(step.id_step) ?? 0
    return {
      id: step.id_step,
      type: step.type,
      x: 0,
      y: 0,
      width: BPMN_TASK_MIN_WIDTH,
      height: BPMN_TASK_MIN_HEIGHT,
      name: step.name ?? '',
      seq: step.seq_number,
      lane,
      columnIndex,
      laneHeight: BPMN_BASE_ROW_HEIGHT,
    }
  })
  const maxColIdx = Math.max(0, ...globalSteps.map((s) => s.columnIndex))
  const columnCount = maxColIdx + 1
  const columnSpacingTotal = BPMN_COLUMN_SPACING * Math.max(0, columnCount - 1)
  const widthPerColumnBudget = Math.floor((diagramBudget - columnSpacingTotal) / Math.max(1, columnCount))
  const initialMaxShapeWidth = Math.max(
    BPMN_TASK_MIN_WIDTH,
    Math.min(BPMN_TASK_PREFERRED_MAX_WIDTH, widthPerColumnBudget),
  )
  const stepDimensionsCache = buildStepDimensionsCache(steps, initialMaxShapeWidth)
  globalSteps = compactStepColumnIndices(
    straightenSimpleCrossLaneTaskChains(
      enforceUniqueColumnsPerLane(globalSteps, spineIds),
      layoutConnections,
    ),
  )
  let naturalWidths = naturalColumnWidths(globalSteps, stepDimensionsCache)
  let fittedWidths = fitWidthsToBudget(naturalWidths, diagramBudget, BPMN_COLUMN_SPACING)
  rebuildStepDimensionsForColumns(globalSteps, steps, fittedWidths, stepDimensionsCache)
  naturalWidths = naturalColumnWidths(globalSteps, stepDimensionsCache)
  fittedWidths = fitWidthsToBudget(naturalWidths, diagramBudget, BPMN_COLUMN_SPACING)
  let geometry = rebuildColumnGeometry(globalSteps, stepDimensionsCache, fittedWidths)
  globalSteps = compactStepColumnIndices(resolveColumnCollisions(geometry.positioned, spineIds))
  globalSteps = straightenSimpleCrossLaneTaskChains(
    spreadOverlappingLaneSteps(globalSteps, spineIds),
    layoutConnections,
  )
  globalSteps = compactStepColumnIndices(globalSteps)
  naturalWidths = naturalColumnWidths(globalSteps, stepDimensionsCache)
  fittedWidths = fitWidthsToBudget(naturalWidths, diagramBudget, BPMN_COLUMN_SPACING)
  rebuildStepDimensionsForColumns(globalSteps, steps, fittedWidths, stepDimensionsCache)
  naturalWidths = naturalColumnWidths(globalSteps, stepDimensionsCache)
  fittedWidths = fitWidthsToBudget(naturalWidths, diagramBudget, BPMN_COLUMN_SPACING)
  geometry = rebuildColumnGeometry(globalSteps, stepDimensionsCache, fittedWidths)
  globalSteps = compactStepColumnIndices(
    straightenSimpleCrossLaneTaskChains(
      resolveColumnCollisions(geometry.positioned, spineIds),
      layoutConnections,
    ),
  )
  rebuildStepDimensionsForColumns(globalSteps, steps, fittedWidths, stepDimensionsCache)
  naturalWidths = naturalColumnWidths(globalSteps, stepDimensionsCache)
  fittedWidths = fitWidthsToBudget(naturalWidths, diagramBudget, BPMN_COLUMN_SPACING)
  geometry = rebuildColumnGeometry(globalSteps, stepDimensionsCache, fittedWidths)
  globalSteps = geometry.positioned
  const { columnStartXs, maxColumnWidths, diagramContentWidth } = geometry
  const laneLayouts: BpmnLaneLayoutEntry[] = implementerIds.map((impId, index) => {
    const stepsInLane = globalSteps.filter((s) => s.lane === index)
    const laneHeight = stepsInLane[0]?.laneHeight ?? BPMN_BASE_ROW_HEIGHT
    return {
      impId,
      height: laneHeight,
      steps: stepsInLane.map((s) => ({
        ...s,
        id: `bpmn-step-${s.seq}`,
        y: laneHeight / 2,
        decisionTextGlobalY: s.decisionTextGlobalY,
      })),
    }
  })
  if (implementerIds.length === 0) {
    const stepsInLane = globalSteps.filter((s) => s.lane === 0)
    const laneHeight = stepsInLane[0]?.laneHeight ?? BPMN_BASE_ROW_HEIGHT
    laneLayouts.push({
      impId: '',
      height: laneHeight,
      steps: stepsInLane.map((s) => ({
        ...s,
        id: `bpmn-step-${s.seq}`,
        y: laneHeight / 2,
        decisionTextGlobalY: s.decisionTextGlobalY,
      })),
    })
  }
  let bpmnLaneLayoutForRouter: BpmnLaneLayout | null = null
  if (laneLayouts.length > 0) {
    let laneTop = 0
    const lanes = laneLayouts.map((l, i) => {
      const info = { index: i, top: laneTop, height: l.height }
      laneTop += l.height
      return info
    })
    bpmnLaneLayoutForRouter = {
      lanes,
      columnStartXs,
      columnWidths: maxColumnWidths,
    }
  }
  return {
    globalSteps,
    columnStartXs,
    maxColumnWidths,
    laneLayouts: laneLayouts.length > 0 ? laneLayouts : [],
    bpmnLaneLayoutForRouter,
    diagramContentWidth,
  }
}
