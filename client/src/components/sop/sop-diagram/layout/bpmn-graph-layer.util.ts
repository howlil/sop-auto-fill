import {
  transitionBpmnLaneRun,
  type BpmnLaneRunDirection,
} from './bpmn-lane-run.util'

export interface BpmnLayoutStepInput {
  id_step: string
  seq_number: number
  name?: string
  id_implementer?: string | null
  type: string
}

export interface BpmnLayoutConnectionInput {
  from: string
  to: string
}

function parseBpmnStepSeq(nodeId: string): number | null {
  const match = nodeId.match(/^bpmn-step-(\d+)$/)
  if (!match) return null
  return Number(match[1])
}

function laneIndexForStep(
  step: BpmnLayoutStepInput,
  implementerIds: string[],
): number {
  if (!step.id_implementer) return 0
  const idx = implementerIds.findIndex((id) => id === step.id_implementer)
  return idx === -1 ? 0 : idx
}

function minimumForwardColumnAdvance(
  fromStep: BpmnLayoutStepInput,
  toStep: BpmnLayoutStepInput,
  implementerIds: string[],
): number {
  if (fromStep.type === 'decision') return 1
  return laneIndexForStep(fromStep, implementerIds) === laneIndexForStep(toStep, implementerIds)
    ? 1
    : 0
}

function edgeKey(fromId: string, toId: string): string {
  return `${fromId}->${toId}`
}

function buildLaneRunAdvances(
  sortedSteps: BpmnLayoutStepInput[],
  predsByIdStep: Map<string, string[]>,
  stepById: Map<string, BpmnLayoutStepInput>,
  implementerIds: string[],
): Map<string, 0 | 1> {
  const directionById = new Map<string, BpmnLaneRunDirection>()
  const advances = new Map<string, 0 | 1>()
  for (const step of sortedSteps) {
    const incomingDirections: BpmnLaneRunDirection[] = []
    for (const predId of predsByIdStep.get(step.id_step) ?? []) {
      const pred = stepById.get(predId)
      if (!pred) continue
      const transition = transitionBpmnLaneRun(
        laneIndexForStep(pred, implementerIds),
        laneIndexForStep(step, implementerIds),
        directionById.get(predId) ?? 0,
        pred.type === 'decision',
      )
      advances.set(edgeKey(predId, step.id_step), transition.columnAdvance)
      incomingDirections.push(transition.direction)
    }
    const distinctDirections = new Set(incomingDirections)
    directionById.set(
      step.id_step,
      distinctDirections.size === 1 ? incomingDirections[0]! : 0,
    )
  }
  return advances
}

function columnFromPredecessors(
  preds: string[],
  step: BpmnLayoutStepInput,
  rawColumns: Map<string, number>,
  laneRunAdvances: Map<string, 0 | 1>,
): number {
  if (preds.length === 0) return 0
  let columnIndex = 0
  for (const predId of preds) {
    const predCol = rawColumns.get(predId) ?? 0
    columnIndex = Math.max(
      columnIndex,
      predCol + (laneRunAdvances.get(edgeKey(predId, step.id_step)) ?? 0),
    )
  }
  return columnIndex
}

/**
 * Assign rank global workflow (alur kiri → kanan pada swimlane horizontal).
 * Handoff lintas swimlane biasa boleh berbagi kolom agar alur vertikal tetap ringkas.
 * Alur satu lane dan cabang decision tetap maju agar arah baca tidak ambigu.
 * Loopback dikeluarkan dari rank DAG dan ditangani router melalui corridor khusus.
 */
export function assignStepColumns(
  steps: BpmnLayoutStepInput[],
  connections: BpmnLayoutConnectionInput[],
  implementerIds: string[],
): Map<string, number> {
  const seqToIdStep = new Map<number, string>()
  for (const step of steps) {
    seqToIdStep.set(step.seq_number, step.id_step)
  }
  const predsByIdStep = new Map<string, string[]>()
  for (const step of steps) {
    predsByIdStep.set(step.id_step, [])
  }
  for (const conn of connections) {
    const fromSeq = parseBpmnStepSeq(conn.from)
    const toSeq = parseBpmnStepSeq(conn.to)
    if (fromSeq === null || toSeq === null) continue
    if (fromSeq >= toSeq) continue
    const fromId = seqToIdStep.get(fromSeq)
    const toId = seqToIdStep.get(toSeq)
    if (!fromId || !toId) continue
    const list = predsByIdStep.get(toId) ?? []
    list.push(fromId)
    predsByIdStep.set(toId, list)
  }
  const sorted = [...steps].sort((a, b) => a.seq_number - b.seq_number)
  const stepById = new Map(steps.map((step) => [step.id_step, step]))
  const laneRunAdvances = buildLaneRunAdvances(
    sorted,
    predsByIdStep,
    stepById,
    implementerIds,
  )
  const rawColumns = new Map<string, number>()
  let previousSequentialColumn = -1
  let previousSequentialLane = -1
  for (const step of sorted) {
    const preds = predsByIdStep.get(step.id_step) ?? []
    const stepLane = laneIndexForStep(step, implementerIds)
    let columnIndex = columnFromPredecessors(preds, step, rawColumns, laneRunAdvances)
    if (
      preds.length === 0 &&
      previousSequentialLane === stepLane &&
      previousSequentialColumn >= 0
    ) {
      columnIndex = Math.max(columnIndex, previousSequentialColumn + 1)
    }
    if (step.type === 'decision') {
      columnIndex = Math.max(columnIndex, 0)
    }
    rawColumns.set(step.id_step, columnIndex)
    previousSequentialColumn = columnIndex
    previousSequentialLane = stepLane
  }
  bumpDecisionBranchColumns(steps, connections, rawColumns, implementerIds)
  enforceForwardMonotonicColumns(
    steps,
    connections,
    rawColumns,
    implementerIds,
    laneRunAdvances,
  )
  return rawColumns
}

/**
 * Langkah pada alur utama (spine): ikuti rantai dari Mulai, prioritaskan edge ke seq+1.
 * Dipakai agar handoff lintas swimlane tetap di kolom kiri; cabang decision yang digeser.
 */
export function buildMainSpineStepIds(
  steps: BpmnLayoutStepInput[],
  connections: BpmnLayoutConnectionInput[],
): Set<string> {
  const spine = new Set<string>()
  if (steps.length === 0) return spine
  const seqToId = new Map<number, string>()
  for (const step of steps) {
    seqToId.set(step.seq_number, step.id_step)
  }
  const start =
    steps.find((s) => s.type === 'terminator') ??
    [...steps].sort((a, b) => a.seq_number - b.seq_number)[0]
  if (!start) return spine
  let currentId = start.id_step
  spine.add(currentId)
  const visited = new Set<string>([currentId])
  for (let guard = 0; guard < steps.length + 2; guard += 1) {
    const current = steps.find((s) => s.id_step === currentId)
    if (!current) break
    const fromNode = `bpmn-step-${current.seq_number}`
    const outs = connections
      .map((c) => {
        if (c.from !== fromNode) return null
        const toSeq = parseBpmnStepSeq(c.to)
        if (toSeq === null) return null
        const toId = seqToId.get(toSeq)
        if (!toId) return null
        return { toSeq, toId }
      })
      .filter((x): x is { toSeq: number; toId: string } => x != null)
    if (outs.length === 0) break
    const preferred =
      outs.find((o) => o.toSeq === current.seq_number + 1) ??
      [...outs].sort((a, b) => a.toSeq - b.toSeq)[0]
    if (!preferred || visited.has(preferred.toId)) break
    spine.add(preferred.toId)
    visited.add(preferred.toId)
    currentId = preferred.toId
  }
  return spine
}

/**
 * Propagasi rank setelah cabang decision digeser. Handoff lintas lane biasa dapat
 * tetap pada kolom yang sama; feedback edge tidak ikut agar loop tidak merusak DAG.
 */
function enforceForwardMonotonicColumns(
  steps: BpmnLayoutStepInput[],
  connections: BpmnLayoutConnectionInput[],
  rawColumns: Map<string, number>,
  implementerIds: string[],
  laneRunAdvances: Map<string, 0 | 1>,
): void {
  const stepBySeq = new Map(steps.map((step) => [step.seq_number, step]))
  for (let pass = 0; pass < steps.length; pass += 1) {
    let changed = false
    for (const conn of connections) {
      const fromSeq = parseBpmnStepSeq(conn.from)
      const toSeq = parseBpmnStepSeq(conn.to)
      if (fromSeq === null || toSeq === null || fromSeq >= toSeq) continue
      const fromStep = stepBySeq.get(fromSeq)
      const toStep = stepBySeq.get(toSeq)
      if (!fromStep || !toStep) continue
      const nextCol =
        (rawColumns.get(fromStep.id_step) ?? 0) +
        (laneRunAdvances.get(edgeKey(fromStep.id_step, toStep.id_step)) ??
          minimumForwardColumnAdvance(fromStep, toStep, implementerIds))
      if (nextCol <= (rawColumns.get(toStep.id_step) ?? 0)) continue
      rawColumns.set(toStep.id_step, nextCol)
      changed = true
    }
    if (!changed) break
  }
}

/** Cabang Ya/Tidak: target selalu maju; cabang satu lane dipisah lagi bila perlu. */
function bumpDecisionBranchColumns(
  steps: BpmnLayoutStepInput[],
  connections: BpmnLayoutConnectionInput[],
  rawColumns: Map<string, number>,
  implementerIds: string[],
): void {
  for (const step of steps) {
    if (step.type !== 'decision') continue
    const fromNode = `bpmn-step-${step.seq_number}`
    const outs = connections.filter((c) => c.from === fromNode)
    if (outs.length === 0) continue
    const baseCol = rawColumns.get(step.id_step) ?? 0
    const decisionLane = laneIndexForStep(step, implementerIds)
    let sameLaneBranch = 0
    for (const conn of outs) {
      const toSeq = parseBpmnStepSeq(conn.to)
      if (toSeq === null) continue
      const toStep = steps.find((s) => s.seq_number === toSeq)
      if (!toStep) continue
      const toLane = laneIndexForStep(toStep, implementerIds)
      if (toLane === decisionLane) {
        const minCol = baseCol + 1 + sameLaneBranch
        sameLaneBranch += 1
        rawColumns.set(toStep.id_step, Math.max(rawColumns.get(toStep.id_step) ?? 0, minCol))
      } else {
        rawColumns.set(toStep.id_step, Math.max(rawColumns.get(toStep.id_step) ?? 0, baseCol + 1))
      }
    }
  }
}
