import type {
  ArrowConfig,
  ArrowConnectionConfig,
  LabelConfig,
  LabelPositions,
  ProsedurRow,
  SOPStep,
} from '@/components/sop/sop-diagram/core/sopDiagramTypes'
import { isYaLabel, isTidakLabel, rowsToSteps } from '@/components/sop/sop-diagram/core/sopDiagramTypes'

export type CabangDiagram = 'UTAMA' | 'YA' | 'TIDAK'
export type JenisDiagramClient = 'FLOWCHART' | 'BPMN'

export interface DiagramPathOverrides {
  edges?: Record<string, ArrowConnectionConfig>
  labels?: LabelPositions
}

export interface DiagramConfigSlice {
  layoutSeed: number
  pathOverrides: DiagramPathOverrides | null
}

export interface DiagramKonfigurasiState {
  flowchart: DiagramConfigSlice
  bpmn: DiagramConfigSlice
}

export function buildDiagramEdgeKey(
  dariLangkahId: string,
  keLangkahId: string,
  cabang: CabangDiagram,
): string {
  return `${dariLangkahId}|${keLangkahId}|${cabang}`
}

export function parseDiagramEdgeKey(key: string): {
  dariLangkahId: string
  keLangkahId: string
  cabang: CabangDiagram
} | null {
  const parts = key.split('|')
  if (parts.length !== 3) return null
  const cabang = parts[2]
  if (cabang !== 'UTAMA' && cabang !== 'YA' && cabang !== 'TIDAK') return null
  return { dariLangkahId: parts[0]!, keLangkahId: parts[1]!, cabang }
}

export function createEmptyDiagramConfigSlice(): DiagramConfigSlice {
  return { layoutSeed: 0, pathOverrides: null }
}

export function resetDiagramSlicePaths(slice: DiagramConfigSlice): DiagramConfigSlice {
  const labels = slice.pathOverrides?.labels ?? {}
  return {
    layoutSeed: slice.layoutSeed + 1,
    pathOverrides: Object.keys(labels).length > 0 ? { labels } : null,
  }
}

export function createEmptyDiagramKonfigurasi(): DiagramKonfigurasiState {
  return {
    flowchart: createEmptyDiagramConfigSlice(),
    bpmn: createEmptyDiagramConfigSlice(),
  }
}

export function diagramKonfigurasiFromWorkbench(
  input?: {
    flowchart?: DiagramConfigSlice
    bpmn?: DiagramConfigSlice
  } | null,
): DiagramKonfigurasiState {
  const base = createEmptyDiagramKonfigurasi()
  if (!input) return base
  if (input.flowchart) {
    base.flowchart = {
      layoutSeed: input.flowchart.layoutSeed ?? 0,
      pathOverrides: input.flowchart.pathOverrides ?? null,
    }
  }
  if (input.bpmn) {
    base.bpmn = {
      layoutSeed: input.bpmn.layoutSeed ?? 0,
      pathOverrides: input.bpmn.pathOverrides ?? null,
    }
  }
  return base
}

interface ConnectionEdgeMeta {
  connectionId: string
  dariLangkahId: string
  keLangkahId: string
  cabang: CabangDiagram
}

function resolveCabangFromConnection(
  conn: { label?: string | null },
  defaultCabang: CabangDiagram = 'UTAMA',
): CabangDiagram {
  if (conn.label && isYaLabel(conn.label)) return 'YA'
  if (conn.label && isTidakLabel(conn.label)) return 'TIDAK'
  return defaultCabang
}

/** Bangun meta edge dari koneksi flowchart/BPMN + rows/steps. */
export function buildConnectionEdgeMetas(
  connections: Array<{ id: string; from: string; to: string; label?: string | null }>,
  rows: ProsedurRow[],
  steps: SOPStep[],
): ConnectionEdgeMeta[] {
  const seqToRowId = new Map<number, string>()
  for (const row of rows) {
    if (row.id && row.no != null) seqToRowId.set(row.no, row.id)
  }
  const shapePrefixPatterns = [/^sop-step-(\d+)$/, /^bpmn-step-(\d+)$/]
  const opcOutPattern = /^opc-out-step-(\d+)-to-step-(\d+)$/
  const opcInPattern = /^opc-in-step-(\d+)-to-step-(\d+)$/

  function seqFromShape(shapeId: string): number | null {
    for (const re of shapePrefixPatterns) {
      const m = shapeId.match(re)
      if (m) return Number(m[1])
    }
    const out = shapeId.match(opcOutPattern)
    if (out) return Number(out[1])
    const inn = shapeId.match(opcInPattern)
    if (inn) return Number(inn[2])
    return null
  }

  const sortedRowIds = rows
    .filter((row) => row.id && row.no != null)
    .sort((a, b) => (a.no ?? 0) - (b.no ?? 0))
    .map((row) => row.id as string)
  const firstLangkahId =
    sortedRowIds[0] ??
    [...steps]
      .sort((a, b) => a.seq_number - b.seq_number)
      .find((step) => step.seq_number > 0)?.id_step ??
    null
  const lastLangkahId =
    sortedRowIds[sortedRowIds.length - 1] ??
    (steps.length > 0
      ? steps.find((step) => step.seq_number === Math.max(...steps.map((s) => s.seq_number)))
          ?.id_step
      : null) ??
    null

  function langkahIdFromShape(shapeId: string): string | null {
    const seq = seqFromShape(shapeId)
    if (seq == null) return null
    if (shapeId.startsWith('bpmn-step-')) {
      if (seq === 0) return firstLangkahId
      const maxSeq = steps.length > 0 ? Math.max(...steps.map((s) => s.seq_number)) : 0
      if (seq === maxSeq + 1) return lastLangkahId
    }
    return seqToRowId.get(seq) ?? steps.find((s) => s.seq_number === seq)?.id_step ?? null
  }

  const metas: ConnectionEdgeMeta[] = []
  for (const conn of connections) {
    if (conn.id.includes('__out') || conn.id.includes('__in')) continue
    const fromId = langkahIdFromShape(conn.from)
    const toId = langkahIdFromShape(conn.to)
    if (!fromId || !toId) continue
    metas.push({
      connectionId: conn.id,
      dariLangkahId: fromId,
      keLangkahId: toId,
      cabang: resolveCabangFromConnection(conn),
    })
  }
  return metas
}

export function pathOverridesToArrowConfig(
  pathOverrides: DiagramPathOverrides | null | undefined,
  metas: ConnectionEdgeMeta[],
): ArrowConfig {
  if (!pathOverrides?.edges) return {}
  const out: ArrowConfig = {}
  for (const meta of metas) {
    const key = buildDiagramEdgeKey(meta.dariLangkahId, meta.keLangkahId, meta.cabang)
    const cfg = pathOverrides.edges[key]
    if (cfg) out[meta.connectionId] = cfg
  }
  return out
}

export function arrowConfigToPathOverrides(
  arrowConfig: ArrowConfig,
  labelConfig: LabelConfig | undefined,
  metas: ConnectionEdgeMeta[],
): DiagramPathOverrides {
  const edges: Record<string, ArrowConnectionConfig> = {}
  for (const meta of metas) {
    const cfg = arrowConfig[meta.connectionId]
    if (!cfg) continue
    edges[buildDiagramEdgeKey(meta.dariLangkahId, meta.keLangkahId, meta.cabang)] = cfg
  }
  const labels = labelConfig?.positions ?? {}
  return {
    edges: Object.keys(edges).length > 0 ? edges : undefined,
    labels: Object.keys(labels).length > 0 ? labels : undefined,
  }
}

/** Hapus edge override yang referensi langkah tidak ada lagi. */
export function pruneInvalidDiagramOverrides(
  overrides: DiagramPathOverrides | null,
  validLangkahIds: Set<string>,
): DiagramPathOverrides | null {
  if (!overrides) return null
  const edges: Record<string, ArrowConnectionConfig> = {}
  for (const [key, cfg] of Object.entries(overrides.edges ?? {})) {
    const parsed = parseDiagramEdgeKey(key)
    if (!parsed) continue
    if (!validLangkahIds.has(parsed.dariLangkahId) || !validLangkahIds.has(parsed.keLangkahId)) {
      continue
    }
    edges[key] = cfg
  }
  const labels = { ...(overrides.labels ?? {}) }
  const next: DiagramPathOverrides = {}
  if (Object.keys(edges).length > 0) next.edges = edges
  if (Object.keys(labels).length > 0) next.labels = labels
  return Object.keys(next).length > 0 ? next : null
}

export function diagramSliceToPatchPayload(
  jenis: JenisDiagramClient,
  slice: DiagramConfigSlice,
): {
  jenis: JenisDiagramClient
  layoutSeed: number
  pathOverrides: DiagramPathOverrides | null
} {
  return {
    jenis,
    layoutSeed: slice.layoutSeed,
    pathOverrides: slice.pathOverrides,
  }
}

function pathPointsEqual(
  left: { x: number; y: number },
  right: { x: number; y: number },
): boolean {
  return left.x === right.x && left.y === right.y
}

function arrowConnectionsEqual(
  left: ArrowConnectionConfig,
  right: ArrowConnectionConfig,
): boolean {
  if (left.sSide !== right.sSide || left.eSide !== right.eSide) return false
  if (!pathPointsEqual(left.startPoint, right.startPoint)) return false
  if (!pathPointsEqual(left.endPoint, right.endPoint)) return false
  if (left.bendPoints.length !== right.bendPoints.length) return false
  for (let i = 0; i < left.bendPoints.length; i += 1) {
    if (!pathPointsEqual(left.bendPoints[i]!, right.bendPoints[i]!)) return false
  }
  return true
}

function pathOverridesEqual(
  left: DiagramPathOverrides | null,
  right: DiagramPathOverrides | null,
): boolean {
  if (left === right) return true
  if (left === null || right === null) return left === right
  const leftEdges = left.edges ?? {}
  const rightEdges = right.edges ?? {}
  const edgeKeys = Object.keys(leftEdges)
  if (edgeKeys.length !== Object.keys(rightEdges).length) return false
  for (const key of edgeKeys) {
    const leftEdge = leftEdges[key]
    const rightEdge = rightEdges[key]
    if (!leftEdge || !rightEdge || !arrowConnectionsEqual(leftEdge, rightEdge)) return false
  }
  const leftLabels = left.labels ?? {}
  const rightLabels = right.labels ?? {}
  const labelKeys = Object.keys(leftLabels)
  if (labelKeys.length !== Object.keys(rightLabels).length) return false
  for (const key of labelKeys) {
    const leftLabel = leftLabels[key]
    const rightLabel = rightLabels[key]
    if (!leftLabel || !rightLabel || !pathPointsEqual(leftLabel, rightLabel)) return false
  }
  return true
}

export function diagramSlicesEqual(a: DiagramConfigSlice, b: DiagramConfigSlice): boolean {
  return a.layoutSeed === b.layoutSeed && pathOverridesEqual(a.pathOverrides, b.pathOverrides)
}

function buildFlowchartConnections(
  sortedSteps: SOPStep[],
  rowIdToSeq: Map<string, number>,
): Array<{ id: string; from: string; to: string; label?: string | null }> {
  const list: Array<{ id: string; from: string; to: string; label?: string | null }> = []
  for (let i = 0; i < sortedSteps.length; i += 1) {
    const step = sortedSteps[i]!
    if (step.type === 'decision' && step.id_next_step_if_yes && step.id_next_step_if_no) {
      const toYes = rowIdToSeq.get(step.id_next_step_if_yes)
      const toNo = rowIdToSeq.get(step.id_next_step_if_no)
      if (toYes != null) {
        list.push({
          id: `conn-${step.seq_number}-yes-${toYes}`,
          from: `sop-step-${step.seq_number}`,
          to: `sop-step-${toYes}`,
          label: 'Ya',
        })
      }
      if (toNo != null) {
        list.push({
          id: `conn-${step.seq_number}-no-${toNo}`,
          from: `sop-step-${step.seq_number}`,
          to: `sop-step-${toNo}`,
          label: 'Tidak',
        })
      }
      continue
    }
    const explicitNextSeq =
      step.id_next_step_if_yes != null
        ? rowIdToSeq.get(step.id_next_step_if_yes)
        : undefined
    if (explicitNextSeq != null) {
      list.push({
        id: `conn-${step.seq_number}-to-${explicitNextSeq}`,
        from: `sop-step-${step.seq_number}`,
        to: `sop-step-${explicitNextSeq}`,
      })
      continue
    }
    if (i < sortedSteps.length - 1) {
      const toStep = sortedSteps[i + 1]!
      list.push({
        id: `conn-${step.seq_number}-to-${toStep.seq_number}`,
        from: `sop-step-${step.seq_number}`,
        to: `sop-step-${toStep.seq_number}`,
      })
    }
  }
  return list
}

function toBpmnConnectionId(flowchartConnectionId: string): string {
  const yesMatch = flowchartConnectionId.match(/^conn-(\d+)-yes-(\d+)$/)
  if (yesMatch) {
    return `conn-${yesMatch[1]}-to-${yesMatch[2]}-yes`
  }
  const noMatch = flowchartConnectionId.match(/^conn-(\d+)-no-(\d+)$/)
  if (noMatch) {
    return `conn-${noMatch[1]}-to-${noMatch[2]}-no`
  }
  return flowchartConnectionId
}

function toBpmnConnections(
  flowchartConnections: Array<{ id: string; from: string; to: string; label?: string | null }>,
): Array<{ id: string; from: string; to: string; label?: string | null }> {
  return flowchartConnections.map((connection) => ({
    ...connection,
    from: connection.from.replace('sop-step-', 'bpmn-step-'),
    to: connection.to.replace('sop-step-', 'bpmn-step-'),
    id: toBpmnConnectionId(connection.id),
  }))
}

export interface DiagramPreviewStateInput {
  diagramKonfigurasi?: {
    flowchart?: DiagramConfigSlice
    bpmn?: DiagramConfigSlice
  } | null
  prosedurRows: ProsedurRow[]
  implementers: { id: string; name: string }[]
  activeTab: 'flowchart' | 'bpmn'
}

/** Bangun pathLayoutSeed, arrowConfig, dan labelConfig untuk pratinjau read-only. */
export function buildDiagramStateForPreviewTab(
  input: DiagramPreviewStateInput,
): {
  pathLayoutSeed: number
  arrowConfig: ArrowConfig
  labelConfig: LabelConfig
} {
  const konfigurasi = diagramKonfigurasiFromWorkbench(input.diagramKonfigurasi)
  const slice = input.activeTab === 'flowchart' ? konfigurasi.flowchart : konfigurasi.bpmn
  const diagramSteps = rowsToSteps(input.prosedurRows, input.implementers)
  const sortedSteps = [...diagramSteps].sort((a, b) => a.seq_number - b.seq_number)
  const rowIdToSeq = new Map<string, number>()
  for (const row of input.prosedurRows) {
    if (row.id && row.no != null) rowIdToSeq.set(row.id, row.no)
  }
  const flowchartConnections = buildFlowchartConnections(sortedSteps, rowIdToSeq)
  const connections =
    input.activeTab === 'flowchart'
      ? flowchartConnections
      : toBpmnConnections(flowchartConnections)
  const metas = buildConnectionEdgeMetas(connections, input.prosedurRows, diagramSteps)
  const arrowConfig = pathOverridesToArrowConfig(slice.pathOverrides, metas)
  const positions: LabelPositions = { ...(slice.pathOverrides?.labels ?? {}) }
  return {
    pathLayoutSeed: slice.layoutSeed,
    arrowConfig,
    labelConfig: { custom_labels: {}, positions },
  }
}
