import {
  useMemo,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useId,
  useRef,
  startTransition,
  type MutableRefObject,
} from 'react'
import {
  FlowchartArrowConnector,
  clearPathCache,
  type FlowchartConnection,
  type UsedSides,
  type PathUpdatedPayload,
} from '../shapes/FlowchartArrowConnector'
import { type OccupiedSegment } from '../core/route/shared/orthogonalRouter'
import { FlowchartOpcRow } from './flowchart-opc-row'
import type { ImplementerColumnBoundsMap } from '../core/route/flowchart/flowchart-column-bounds.util'
import type { FlowchartAreaIdResolver } from '../core/route/flowchart/flowchart-column-bounds.util'
import type { FlowchartGridLayout } from '../core/route/flowchart/flowchart-grid-layout.util'
import { assignColumnTrunkSlots } from '../core/route/flowchart/flowchart-column-trunk.util'
import { assignCrossColumnGutterSlots } from '../core/route/flowchart/flowchart-cross-column-route.util'
import { assignLoopbackCorridorIndices } from '../core/route/flowchart/flowchart-loopback-route.util'
import {
  measureFlowchartLayoutWithColumns,
} from './sop-diagram-flowchart-measure.util'
import type {
  ProsedurRow,
  LayoutConfig,
  Implementer,
  SOPStep,
  ArrowConfig,
  LabelConfig,
} from '../core/sopDiagramTypes'
import { getFullTimeUnit, isTidakLabel } from '../core/sopDiagramTypes'
import {
  splitStepsIntoPages,
  splitCrossPageConnections,
  getOpcShapesForPage,
  getOpcElementId,
  type PositionedOpcEndpoint,
} from '../core/route/flowchart/flowchartPagination'
import { SOP_DOCUMENT_PAGE_WIDTH_CLASS } from '../layout/sopDocumentLayout'
import {
  findConnectionIdsWithCrossings,
  sortConnectionsForRouting,
} from '../core/route/shared/connection-route-order.util'
import { applyUsedSidePayload } from '../core/route/shared/used-side-usage.util'

/* ───────────────────────── Defaults ─────────────────────────── */

const DEFAULT_LAYOUT = {
  widthKegiatan: 25,
  widthKelengkapan: 15,
  widthWaktu: 10,
  widthOutput: 15,
  widthKeterangan: 15,
  firstPageSteps: 7,
  nextPageSteps: 8,
}
const MAX_ROUTING_RECONCILE_PASSES = 4
const MEASURE_RETRY_MAX_FRAMES = 12
const MEASURE_RETRY_TIMEOUT_MS = 500

/** Lebar tetap A4 content agar konsisten (path/arrow tidak berubah saat resize); scroll horizontal jika viewport sempit */
const PAGE_WIDTH_CLASS = SOP_DOCUMENT_PAGE_WIDTH_CLASS

/* ───────────────────────── Props ─────────────────────────── */

export interface SOPDiagramFlowchartProps {
  data: {
    rows: ProsedurRow[]
    steps: SOPStep[]
    implementers: Implementer[]
  }
  config?: {
    layoutConfig?: LayoutConfig
    arrowConfig?: ArrowConfig
    labelConfig?: LabelConfig
    /** Seed untuk urutan koneksi; nilai berbeda mencoba kemungkinan layout path lain */
    pathLayoutSeed?: number
    editMode?: boolean
    selectedConnectionId?: string | null
  }
  events?: {
    onPathUpdated?: (payload: PathUpdatedPayload) => void
    onManualChange?: (payload: PathUpdatedPayload) => void
  onSelectConnection?: (connectionId: string | null) => void
}
}

/* ───────────────────────── Helpers ─────────────────────────── */

function stepShapeType(step: SOPStep): string {
  if (step.type === 'terminator') return 'flowchart-terminator'
  if (step.type === 'decision') return 'flowchart-decision'
  return 'flowchart-process'
}

function sopAreaId(pageIndex: number) {
  return `main-sop-area-${pageIndex}`
}

function toFlowchartDomToken(reactId: string): string {
  const token = reactId
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/\d/g, (digit) => String.fromCharCode('a'.charCodeAt(0) + Number(digit)))
  return token || 'instance'
}

type FlowchartBoundsRect = { left: number; top: number; right: number; bottom: number }

function hasFlowchartMeasureDom(
  pageCount: number,
  areaIdForPage: FlowchartAreaIdResolver = sopAreaId,
): boolean {
  for (let pi = 0; pi < pageCount; pi += 1) {
    const container = document.getElementById(areaIdForPage(pi))
    if (!container) continue
    if (container.querySelector('td[data-implementer-id]')) return true
  }
  return false
}

function buildPelaksanaBoundsSig(
  boundsByPage: Record<number, FlowchartBoundsRect>,
): string {
  return Object.entries(boundsByPage)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([pi, bounds]) => `${pi}:${bounds.left},${bounds.top},${bounds.right},${bounds.bottom}`)
    .join('|')
}

/** Ukur koridor pelaksana per halaman; kembalikan bounds + signature untuk gate layoutMeasured. */
export function measureFlowchartPelaksanaBounds(
  pageCount: number,
  boundsStore: Record<number, FlowchartBoundsRect>,
  areaIdForPage: FlowchartAreaIdResolver = sopAreaId,
): { sig: string; domReady: boolean } {
  const PAD_LEFT = 8
  const PAD_RIGHT = 8
  const PAD_TOP = 4
  const PAD_BOTTOM = 8
  let domReady = false
  for (let pi = 0; pi < pageCount; pi += 1) {
    const container = document.getElementById(areaIdForPage(pi))
    if (!container) continue
    domReady = true
    const containerRect = container.getBoundingClientRect()
    const implCells = container.querySelectorAll('td[data-implementer-id]')
    let minLeft = Infinity
    let maxRight = -Infinity
    let minTop = Infinity
    let maxBottom = -Infinity
    implCells.forEach((cell) => {
      const rect = cell.getBoundingClientRect()
      minLeft = Math.min(minLeft, rect.left - containerRect.left)
      maxRight = Math.max(maxRight, rect.right - containerRect.left)
      minTop = Math.min(minTop, rect.top - containerRect.top)
      maxBottom = Math.max(maxBottom, rect.bottom - containerRect.top)
    })
    const opcEls = container.querySelectorAll('[data-flowchart-opc]')
    opcEls.forEach((el) => {
      const rect = el.getBoundingClientRect()
      minTop = Math.min(minTop, rect.top - containerRect.top)
      maxBottom = Math.max(maxBottom, rect.bottom - containerRect.top)
    })
    if (minLeft === Infinity) minLeft = 0
    if (maxRight === -Infinity) maxRight = containerRect.width
    boundsStore[pi] = {
      left: Math.max(0, minLeft + PAD_LEFT),
      top: Math.max(0, minTop + PAD_TOP),
      right: maxRight - PAD_RIGHT,
      bottom: maxBottom + PAD_BOTTOM,
    }
  }
  return { sig: buildPelaksanaBoundsSig(boundsStore), domReady }
}

export function applyFlowchartPelaksanaFallbackBounds(
  pageCount: number,
  boundsStore: Record<number, FlowchartBoundsRect>,
  areaIdForPage: FlowchartAreaIdResolver = sopAreaId,
): string {
  const PAD_LEFT = 8
  const PAD_RIGHT = 8
  const PAD_TOP = 4
  const PAD_BOTTOM = 8
  for (let pi = 0; pi < pageCount; pi += 1) {
    const container = document.getElementById(areaIdForPage(pi))
    if (!container) continue
    const containerRect = container.getBoundingClientRect()
    boundsStore[pi] = {
      left: PAD_LEFT,
      top: PAD_TOP,
      right: Math.max(PAD_LEFT, containerRect.width - PAD_RIGHT),
      bottom: Math.max(PAD_TOP, containerRect.height - PAD_BOTTOM),
    }
  }
  return buildPelaksanaBoundsSig(boundsStore)
}



/* ───────────────────────── Optimizations ─────────────────────────── */

/** Debounce utility untuk limit resize re-measure */
function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  delay: number
): (...args: TArgs) => void {
  let timeoutId: ReturnType<typeof setTimeout>
  return (...args: TArgs) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

/* ───────────────────────── Component ─────────────────────────── */

export function SOPDiagramFlowchart({
  data,
  config: flowchartConfig,
  events,
}: SOPDiagramFlowchartProps) {
  const rows = data.rows
  const steps = data.steps
  const implementers = data.implementers
  const layoutConfig = flowchartConfig?.layoutConfig
  const arrowConfig = flowchartConfig?.arrowConfig
  const labelConfig = flowchartConfig?.labelConfig
  const pathLayoutSeed = flowchartConfig?.pathLayoutSeed ?? 0
  const editMode = flowchartConfig?.editMode ?? false
  const selectedConnectionId = flowchartConfig?.selectedConnectionId ?? null
  const onPathUpdatedProp = events?.onPathUpdated
  const onManualChangeProp = events?.onManualChange
  const onSelectConnectionProp = events?.onSelectConnection
  const config = { ...DEFAULT_LAYOUT, ...layoutConfig }
  const reactDiagramId = useId()
  const diagramDomPrefix = useMemo(
    () => `flowchart-${toFlowchartDomToken(reactDiagramId)}-`,
    [reactDiagramId],
  )
  const stepShapeIdPrefix = `${diagramDomPrefix}sop-step-`
  const areaIdForPage = useCallback(
    (pageIndex: number) => `${diagramDomPrefix}main-sop-area-${pageIndex}`,
    [diagramDomPrefix],
  )
  const stepShapeId = useCallback(
    (seqNumber: number) => `${stepShapeIdPrefix}${seqNumber}`,
    [stepShapeIdPrefix],
  )
  const sortedSteps = useMemo(() => [...steps].sort((a, b) => a.seq_number - b.seq_number), [steps])
  const MIN_PELAKSANA_COL_WIDTH = 10
  const pelaksanaColWidth = implementers.length > 0
    ? Math.max(MIN_PELAKSANA_COL_WIDTH, 70 / implementers.length)
    : 70

  const rowIdToSeq = useMemo(() => new Map(rows.map((r) => [r.id, r.no])), [rows])

  const routingPriorityIdsRef = useRef<Set<string>>(new Set())
  const lastRoutingViolatorSigRef = useRef<string | null>(null)
  const pageViolatorsRef = useRef<Map<number, string[]>>(new Map())
  const [routingReconcilePass, setRoutingReconcilePass] = useState(0)
  useEffect(() => {
    setRoutingReconcilePass(0)
    routingPriorityIdsRef.current = new Set()
    lastRoutingViolatorSigRef.current = null
    pageViolatorsRef.current = new Map()
  }, [pathLayoutSeed])

  const handlePageCrossings = useCallback(
    (pageIndex: number, violators: string[]) => {
      if (violators.length === 0) {
        pageViolatorsRef.current.delete(pageIndex)
        return
      }
      pageViolatorsRef.current.set(pageIndex, violators)
      const merged = new Set<string>()
      for (const ids of pageViolatorsRef.current.values()) {
        for (const id of ids) merged.add(id)
      }
      const sig = [...merged].sort().join('|')
      if (lastRoutingViolatorSigRef.current === sig) return
      if (routingReconcilePass >= MAX_ROUTING_RECONCILE_PASSES) return
      lastRoutingViolatorSigRef.current = sig
      routingPriorityIdsRef.current = merged
      startTransition(() => {
        setRoutingReconcilePass((pass) => pass + 1)
      })
    },
    [routingReconcilePass],
  )

  /* ── Pagination ─────────────────────────────────── */

  const allPages = useMemo(
    () => splitStepsIntoPages(sortedSteps, config.firstPageSteps, config.nextPageSteps),
    [sortedSteps, config.firstPageSteps, config.nextPageSteps],
  )
  const pageGeomSig = useMemo(
    () =>
      allPages
        .map((page) =>
          page
            .map((step) => `${step.seq_number}:${step.id_implementer ?? ''}:${step.type}`)
            .join(','),
        )
        .join('|'),
    [allPages],
  )
  const prevPageGeomSigRef = useRef('')

  /* ── Build connections (same logic as before) ───── */

  const allConnections = useMemo<FlowchartConnection[]>(() => {
    const list: FlowchartConnection[] = []
    for (let i = 0; i < sortedSteps.length; i++) {
      const step = sortedSteps[i]
      if (step.type === 'decision' && step.id_next_step_if_yes && step.id_next_step_if_no) {
        const toYes = rowIdToSeq.get(step.id_next_step_if_yes)
        const toNo = rowIdToSeq.get(step.id_next_step_if_no)
        const stepYes = sortedSteps.find((s) => s.seq_number === toYes)
        const stepNo = sortedSteps.find((s) => s.seq_number === toNo)
        if (toYes != null) {
          const customYes = labelConfig?.custom_labels?.[`step-${step.seq_number}-yes`]
          list.push({
            id: `conn-${step.seq_number}-yes-${toYes}`,
            from: stepShapeId(step.seq_number),
            to: stepShapeId(toYes),
            label: customYes ?? 'Ya',
            sourceType: 'flowchart-decision',
            targetType: stepYes ? stepShapeType(stepYes) : 'flowchart-process',
            fromImplementerId: step.id_implementer,
            toImplementerId: stepYes?.id_implementer,
          })
        }
        if (toNo != null) {
          const customNo = labelConfig?.custom_labels?.[`step-${step.seq_number}-no`]
          list.push({
            id: `conn-${step.seq_number}-no-${toNo}`,
            from: stepShapeId(step.seq_number),
            to: stepShapeId(toNo),
            label: customNo ?? 'Tidak',
            sourceType: 'flowchart-decision',
            targetType: stepNo ? stepShapeType(stepNo) : 'flowchart-process',
            fromImplementerId: step.id_implementer,
            toImplementerId: stepNo?.id_implementer,
          })
        }
        continue
      }
      const explicitNextSeq =
        step.id_next_step_if_yes != null
          ? rowIdToSeq.get(step.id_next_step_if_yes)
          : undefined
      if (explicitNextSeq != null) {
        const target = sortedSteps.find((s) => s.seq_number === explicitNextSeq)
        list.push({
          id: `conn-${step.seq_number}-to-${explicitNextSeq}`,
          from: stepShapeId(step.seq_number),
          to: stepShapeId(explicitNextSeq),
          sourceType: stepShapeType(step),
          targetType: target ? stepShapeType(target) : 'flowchart-process',
          fromImplementerId: step.id_implementer,
          toImplementerId: target?.id_implementer,
        })
        continue
      }
      if (i < sortedSteps.length - 1) {
        const toStep = sortedSteps[i + 1]
        list.push({
          id: `conn-${step.seq_number}-to-${toStep.seq_number}`,
          from: stepShapeId(step.seq_number),
          to: stepShapeId(toStep.seq_number),
          sourceType: stepShapeType(step),
          targetType: stepShapeType(toStep),
          fromImplementerId: step.id_implementer,
          toImplementerId: toStep.id_implementer,
        })
      }
    }
    return sortConnectionsForRouting(list, pathLayoutSeed, {
      priorityIds: routingPriorityIdsRef.current,
      reconcilePass: routingReconcilePass,
      priorityRoutesLast: true,
    })
  }, [sortedSteps, rowIdToSeq, labelConfig?.custom_labels, pathLayoutSeed, routingReconcilePass, stepShapeId])
  /* ── Scan: reserved sides per target (all Tidak to same target get left/right) ── */
  const reservedSidesRef = useRef<Map<string, Set<string>>>(new Map())
  reservedSidesRef.current = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const c of allConnections) {
      if (c.sourceType !== 'flowchart-decision' || !isTidakLabel(c.label)) continue
      for (const side of ['left', 'right'] as const) {
        const key = `${c.to}-${side}`
        if (!m.has(key)) m.set(key, new Set())
        m.get(key)!.add(c.id)
      }
    }
    return m
  }, [allConnections])

  /* ── Split cross-page connections + OPC pairs ──── */

  const { pages: pageConnections, opcPairs } = useMemo(
    () =>
      splitCrossPageConnections(
        allConnections,
        steps,
        config.firstPageSteps,
        config.nextPageSteps,
        stepShapeIdPrefix,
        diagramDomPrefix,
      ),
    [
      allConnections,
      steps,
      config.firstPageSteps,
      config.nextPageSteps,
      stepShapeIdPrefix,
      diagramDomPrefix,
    ],
  )

  /* ── Per-page obstacles (step shapes + OPC shapes) */

  const pageObstacles = useMemo(() => {
    return allPages.map((pageSteps, pi) => {
      const obs: { id: string }[] = [{ id: `${diagramDomPrefix}sop-page-${pi}-table-header` }]
      for (const s of pageSteps) obs.push({ id: stepShapeId(s.seq_number) })
      const { top, bottom } = getOpcShapesForPage(pi, opcPairs)
      for (const endpoint of top) {
        obs.push({ id: getOpcElementId(endpoint.opc, endpoint.variant) })
      }
      for (const endpoint of bottom) {
        obs.push({ id: getOpcElementId(endpoint.opc, endpoint.variant) })
      }
      return obs
    })
  }, [allPages, opcPairs, diagramDomPrefix, stepShapeId])

  /* ── usedSides (global across all pages) ─────── */

  const [usedSides, setUsedSides] = useState<UsedSides>({})

  const onPathUpdated = useCallback(
    (payload: PathUpdatedPayload) => {
      startTransition(() => {
        setUsedSides((prev) => applyUsedSidePayload(prev, payload))
      })
      onPathUpdatedProp?.(payload)
    },
    [onPathUpdatedProp],
  )

  /* ── Arrow readiness + pelaksana bounds per page ── */

  const pelaksanaBoundsRef = useRef<Record<number, { left: number; top: number; right: number; bottom: number }>>({})
  const columnBoundsRef = useRef<Record<number, ImplementerColumnBoundsMap>>({})
  const gridLayoutRef = useRef<Record<number, FlowchartGridLayout | null>>({})

  const [arrowsReady, setArrowsReady] = useState(false)
  const [layoutMeasureVersion, setLayoutMeasureVersion] = useState(0)
  const pelaksanaBoundsSigRef = useRef('')

  const commitPelaksanaMeasure = useCallback((nextSig: string, forceVersion = false) => {
    const changed = forceVersion || nextSig !== pelaksanaBoundsSigRef.current
    if (!changed) return false
    pelaksanaBoundsSigRef.current = nextSig
    setLayoutMeasureVersion((v) => v + 1)
    return true
  }, [])

  const measurePelaksanaBounds = useCallback((): boolean => {
    const { sig } = measureFlowchartLayoutWithColumns(
      allPages.length,
      pelaksanaBoundsRef.current,
      columnBoundsRef.current,
      areaIdForPage,
      gridLayoutRef.current,
    )
    if (!sig) return false
    return commitPelaksanaMeasure(sig)
  }, [allPages.length, areaIdForPage, commitPelaksanaMeasure])

  useEffect(() => {
    if (allPages.length === 0) {
      setArrowsReady(false)
      prevPageGeomSigRef.current = ''
      return
    }
    const geomUnchanged = pageGeomSig === prevPageGeomSigRef.current
    prevPageGeomSigRef.current = pageGeomSig
    if (geomUnchanged) {
      if (hasFlowchartMeasureDom(allPages.length, areaIdForPage)) {
        if (!measurePelaksanaBounds()) {
          const fallbackSig = applyFlowchartPelaksanaFallbackBounds(
            allPages.length,
            pelaksanaBoundsRef.current,
            areaIdForPage,
          )
          commitPelaksanaMeasure(fallbackSig || 'fallback-empty', true)
        }
        setArrowsReady(true)
      }
      return
    }
    setArrowsReady(false)
    let cancelled = false
    let frame = 0
    let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined

    const clearScheduledFallback = () => {
      if (timeoutId !== undefined) {
        globalThis.clearTimeout(timeoutId)
        timeoutId = undefined
      }
    }

    const finishWithFallback = () => {
      if (cancelled) return
      const fallbackSig = applyFlowchartPelaksanaFallbackBounds(
        allPages.length,
        pelaksanaBoundsRef.current,
        areaIdForPage,
      )
      if (fallbackSig) {
        commitPelaksanaMeasure(fallbackSig, true)
      } else {
        commitPelaksanaMeasure('fallback-empty', true)
      }
      setArrowsReady(true)
    }

    const tryMeasure = () => {
      if (cancelled) return
      frame += 1
      if (hasFlowchartMeasureDom(allPages.length, areaIdForPage)) {
        clearScheduledFallback()
        if (!measurePelaksanaBounds()) {
          const fallbackSig = applyFlowchartPelaksanaFallbackBounds(
            allPages.length,
            pelaksanaBoundsRef.current,
            areaIdForPage,
          )
          commitPelaksanaMeasure(fallbackSig || 'fallback-empty', true)
        }
        setArrowsReady(true)
        return
      }
      if (frame >= MEASURE_RETRY_MAX_FRAMES) {
        finishWithFallback()
        return
      }
      requestAnimationFrame(tryMeasure)
    }

    requestAnimationFrame(tryMeasure)
    timeoutId = globalThis.setTimeout(finishWithFallback, MEASURE_RETRY_TIMEOUT_MS)

    return () => {
      cancelled = true
      clearScheduledFallback()
    }
  }, [allPages.length, pageGeomSig, measurePelaksanaBounds, areaIdForPage, commitPelaksanaMeasure])

  useEffect(() => {
    const onBeforePrint = () => {
      measurePelaksanaBounds()
    }
    window.addEventListener('beforeprint', onBeforePrint)
    return () => {
      window.removeEventListener('beforeprint', onBeforePrint)
    }
  }, [measurePelaksanaBounds])

  useEffect(() => {
    const observers: ResizeObserver[] = []
    // OPTIMIZATION #2: Debounce resize events to avoid excessive re-measures
    const debouncedMeasure = debounce(() => {
      requestAnimationFrame(() => measurePelaksanaBounds())
    }, 150)
    
    for (let pi = 0; pi < allPages.length; pi++) {
      const container = document.getElementById(areaIdForPage(pi))
      if (!container) continue
      const ro = new ResizeObserver(debouncedMeasure)
      ro.observe(container)
      observers.push(ro)
    }
    return () => observers.forEach((ro) => ro.disconnect())
  }, [allPages.length, areaIdForPage, measurePelaksanaBounds])

  const arrowRerouteVersion =
    pathLayoutSeed + layoutMeasureVersion + routingReconcilePass
  const layoutMeasured = layoutMeasureVersion > 0

  /* ── Render ─────────────────────────────────────── */

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-8 overflow-visible print:gap-0">
      {allPages.map((pageSteps, pageIndex) => {
        const pageRows = rows.filter((r) =>
          pageSteps.some((s) => s.seq_number === r.no),
        )
        const conns = pageConnections[pageIndex] ?? []
        const obstacles = pageObstacles[pageIndex] ?? []
        const { top: opcTop, bottom: opcBottom } = getOpcShapesForPage(pageIndex, opcPairs)
        const areaId = areaIdForPage(pageIndex)

        return (
          <FlowchartPage
            key={pageIndex}
            pageIndex={pageIndex}
            areaId={areaId}
            tableHeaderId={`${diagramDomPrefix}sop-page-${pageIndex}-table-header`}
            stepShapeIdPrefix={stepShapeIdPrefix}
            pageSteps={pageSteps}
            pageRows={pageRows}
            implementers={implementers}
            config={config}
            pelaksanaColWidth={pelaksanaColWidth}
            connections={conns}
            obstacles={obstacles}
            opcTop={opcTop}
            opcBottom={opcBottom}
            usedSides={usedSides}
            arrowsReady={arrowsReady}
            layoutMeasured={layoutMeasured}
            arrowConfig={arrowConfig}
            labelConfig={labelConfig}
            editMode={editMode}
            selectedConnectionId={selectedConnectionId}
            onPathUpdated={onPathUpdated}
            onManualChange={onManualChangeProp}
            onSelectConnection={onSelectConnectionProp}
            pelaksanaBounds={pelaksanaBoundsRef.current[pageIndex] ?? null}
            columnBounds={columnBoundsRef.current[pageIndex] ?? null}
            gridLayout={gridLayoutRef.current[pageIndex] ?? null}
            isLastPage={pageIndex === allPages.length - 1}
            reservedSidesRef={reservedSidesRef}
            rerouteVersion={arrowRerouteVersion}
            routingReconcilePass={routingReconcilePass}
            onPageCrossings={handlePageCrossings}
          />
        )
      })}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
 *  FlowchartPage — renders a single print-page with its
 *  table, OPC shapes, and arrow SVG overlay.
 * ─────────────────────────────────────────────────────── */

interface FlowchartPageProps {
  pageIndex: number
  areaId: string
  tableHeaderId: string
  stepShapeIdPrefix: string
  pageSteps: SOPStep[]
  pageRows: ProsedurRow[]
  implementers: Implementer[]
  config: typeof DEFAULT_LAYOUT
  pelaksanaColWidth: number
  connections: FlowchartConnection[]
  obstacles: { id: string }[]
  opcTop: PositionedOpcEndpoint[]
  opcBottom: PositionedOpcEndpoint[]
  usedSides: UsedSides
  arrowsReady: boolean
  layoutMeasured?: boolean
  arrowConfig?: ArrowConfig
  labelConfig?: LabelConfig
  editMode?: boolean
  selectedConnectionId?: string | null
  onPathUpdated: (payload: PathUpdatedPayload) => void
  onManualChange?: (payload: PathUpdatedPayload) => void
  onSelectConnection?: (connectionId: string | null) => void
  onResetSelectedPath?: () => void
  pelaksanaBounds: { left: number; top: number; right: number; bottom: number } | null
  columnBounds: ImplementerColumnBoundsMap | null
  gridLayout: FlowchartGridLayout | null
  isLastPage: boolean
  reservedSidesRef: MutableRefObject<Map<string, Set<string>>>
  rerouteVersion?: number
  routingReconcilePass?: number
  onPageCrossings?: (pageIndex: number, violators: string[]) => void
}


function FlowchartPage({
  pageIndex,
  areaId,
  tableHeaderId,
  stepShapeIdPrefix,
  pageSteps,
  pageRows,
  implementers,
  config,
  pelaksanaColWidth,
  connections,
  obstacles,
  opcTop,
  opcBottom,
  usedSides,
  arrowsReady,
  layoutMeasured: _layoutMeasured = false,
  arrowConfig,
  labelConfig,
  editMode = false,
  selectedConnectionId = null,
  onPathUpdated,
  onManualChange,
  onSelectConnection,
  pelaksanaBounds,
  columnBounds,
  gridLayout,
  isLastPage,
  reservedSidesRef,
  rerouteVersion = 0,
  routingReconcilePass = 0,
  onPageCrossings,
}: FlowchartPageProps) {
  const pageRoutedSegmentsRef = useRef<Map<string, OccupiedSegment[]>>(new Map())
  const loopbackCorridorIndices = useMemo(
    () => assignLoopbackCorridorIndices(connections),
    [connections],
  )
  const crossColumnGutterSlots = useMemo(
    () => assignCrossColumnGutterSlots(connections),
    [connections],
  )
  const columnTrunkSlots = useMemo(
    () => assignColumnTrunkSlots(connections),
    [connections],
  )

  useLayoutEffect(() => {
    pageRoutedSegmentsRef.current = new Map()
  }, [rerouteVersion, connections.length, arrowsReady])

  useEffect(() => {
    if (!arrowsReady || connections.length === 0) return
    const timer = window.setTimeout(() => {
      if (pageRoutedSegmentsRef.current.size < connections.length) return
      const violators = findConnectionIdsWithCrossings(pageRoutedSegmentsRef.current)
      onPageCrossings?.(pageIndex, violators)
    }, 160)
    return () => window.clearTimeout(timer)
  }, [
    arrowsReady,
    connections.length,
    rerouteVersion,
    routingReconcilePass,
    pageIndex,
    onPageCrossings,
  ])

  useEffect(() => {
    if (arrowsReady) clearPathCache()
  }, [arrowsReady, areaId])

  const canRenderArrows = arrowsReady && connections.length > 0

  return (
    <div
      className={`print-page mx-auto ${PAGE_WIDTH_CLASS} box-border print:my-0 print:mx-auto [print-color-adjust:exact] [-webkit-print-color-adjust:exact] ${isLastPage ? 'print-last-page' : ''}`}
    >
      <div
        id={areaId}
        className="relative"
        data-sop-diagram-root
        data-sop-connection-count={connections.length}
      >
        {opcTop.length > 0 && (
          <FlowchartOpcRow
            endpoints={opcTop}
            position="top"
            implementers={implementers}
            kegiatanPercent={config.widthKegiatan}
            pelaksanaColPercent={pelaksanaColWidth}
            columnBounds={columnBounds}
            className="pb-2"
          />
        )}

        <table
          className="w-full border-collapse border-2 border-black table-fixed text-sm bg-surface"
        >
          <colgroup>
            <col style={{ width: '5%' }} />
            <col style={{ width: `${config.widthKegiatan}%` }} />
            {implementers.map((impl, index) => (
              <col key={impl?.id ?? `impl-${index + 1}`} style={{ width: `${pelaksanaColWidth}%` }} />
            ))}
            <col style={{ width: `${config.widthKelengkapan}%` }} />
            <col style={{ width: `${config.widthWaktu}%` }} />
            <col style={{ width: `${config.widthOutput}%` }} />
            <col style={{ width: `${config.widthKeterangan}%` }} />
          </colgroup>
          <thead id={tableHeaderId}>
            <tr className="bg-[#D9D9D9]">
              <th rowSpan={2} className="border-2 py-0.5 border-black">NO</th>
              <th rowSpan={2} className="border-2 py-0.5 border-black">KEGIATAN</th>
              <th colSpan={implementers.length || 1} className="border-2 py-0.5 px-1 border-black">PELAKSANA</th>
              <th colSpan={3} className="border-2 py-0.5 px-1 border-black">MUTU BAKU</th>
              <th rowSpan={2} className="border-2 py-0.5 px-1 border-black">KET</th>
            </tr>
            <tr className="bg-[#D9D9D9]">
              {implementers.map((impl, index) => (
                <th key={impl?.id ?? `impl-${index + 1}`} className="border-2 py-0.5 border-black font-bold text-xs">
                  {String(impl?.name ?? impl?.id ?? '').toUpperCase()}
                </th>
              ))}
              <th className="border-2 py-0.5 border-black text-xs">KELENGKAPAN</th>
              <th className="border-2 py-0.5 border-black text-xs">WAKTU</th>
              <th className="border-2 py-0.5 border-black text-xs">OUTPUT</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => {
              const step = pageSteps.find((s) => s.seq_number === row.no)
              if (!step) return null
              const isTerminator = step.type === 'terminator'
              const isDecision = step.type === 'decision'

              return (
                <tr key={row.id}>
                  <td className="border-2 border-black py-0.5 text-center align-top">
                    {step.seq_number}
                  </td>
                  <td
                    className="border-2 border-black py-0.5 px-1 text-justify break-words hyphens-auto align-top text-xs"
                    lang="id"
                  >
                    {step.name}
                  </td>
                  {implementers.map((impl, index) => (
                    <td
                      key={impl?.id ?? `impl-${index + 1}`}
                      className="border-2 border-black p-0 text-center align-middle relative"
                      data-implementer-id={impl?.id ?? `impl-${index + 1}`}
                    >
                      {step.id_implementer === impl?.id && (
                        <div className="flex flex-col justify-around items-center px-2 py-5 min-h-[70px] relative z-10">
                          <span
                            id={`${stepShapeIdPrefix}${step.seq_number}`}
                            className="inline-block leading-[0]"
                            aria-hidden
                          >
                            {isTerminator && (
                              <svg
                                width={86}
                                height={42}
                                viewBox="-2 -2 82 42"
                                className="overflow-visible"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                {/*
                                  viewBox harus memuat seluruh rect + stroke (strokeWidth 2).
                                  Sebelumnya minX=4 padahal rect di x=0.8 → lengkung kiri terpotong.
                                */}
                                <rect
                                  width={76}
                                  height={36}
                                  x={0.8}
                                  y={0.8}
                                  rx={19.2}
                                  ry={19.2}
                                  fill="none"
                                  stroke="black"
                                  strokeWidth={2}
                                />
                              </svg>
                            )}
                            {isDecision && (
                              <svg
                                width={66}
                                height={66}
                                viewBox="-2 -2 64 64"
                                className="overflow-visible"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <polygon
                                  points="30,1 59,30 30,59 1,30"
                                  fill="none"
                                  stroke="black"
                                  strokeWidth={2}
                                />
                              </svg>
                            )}
                            {!isTerminator && !isDecision && (
                              <svg
                                width={82}
                                height={42}
                                viewBox="0 -2 82 42"
                                className="overflow-visible"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <rect width={76} height={36} x={1} y={1} fill="none" stroke="black" strokeWidth={2} />
                              </svg>
                            )}
                          </span>
                        </div>
                      )}
                    </td>
                  ))}
                  <td
                    className="border-2 border-black py-0.5 px-1 text-justify break-words hyphens-auto whitespace-pre-line align-top text-xs"
                    lang="id"
                  >
                    {row.mutu_kelengkapan || ' - '}
                  </td>
                  <td
                    className="border-2 border-black py-0.5 px-1 text-justify break-words hyphens-auto align-top text-xs"
                    lang="id"
                  >
                    {row.time !== undefined && row.time_unit != null
                      ? row.time === 0 ? '' : `${row.time} ${getFullTimeUnit(row.time_unit)}`
                      : row.mutu_waktu || ' - '}
                  </td>
                  <td
                    className="border-2 border-black py-0.5 px-1 text-justify break-words hyphens-auto whitespace-pre-line align-top text-xs"
                    lang="id"
                  >
                    {row.output || ' - '}
                  </td>
                  <td
                    className="border-2 border-black py-0.5 px-1 text-justify break-words hyphens-auto whitespace-pre-line align-top text-xs"
                    lang="id"
                  >
                    {row.keterangan || ' - '}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {opcBottom.length > 0 && (
          <FlowchartOpcRow
            endpoints={opcBottom}
            position="bottom"
            implementers={implementers}
            kegiatanPercent={config.widthKegiatan}
            pelaksanaColPercent={pelaksanaColWidth}
            columnBounds={columnBounds}
            className="pt-2"
          />
        )}

        {canRenderArrows && (
          <svg
            className={`sop-diagram-overlay absolute inset-0 z-20 h-full w-full print:break-inside-avoid ${editMode ? 'pointer-events-auto' : 'pointer-events-none'}`}
            aria-hidden={!editMode}
            onClick={() => onSelectConnection?.(null)}
            xmlns="http://www.w3.org/2000/svg"
            width="100%"
            height="100%"
          >
            {connections.map((conn, idx) => (
              <FlowchartArrowConnector
                key={conn.id}
                connection={conn}
                idcontainer={areaId}
                idarrow={`${areaId}-p${pageIndex}-${idx}-${conn.id}`}
                obstacles={obstacles}
                usedSides={usedSides}
                connectionIndex={idx}
                allConnections={connections}
                manualConfig={arrowConfig?.[conn.id]}
                manualLabelPosition={labelConfig?.positions?.[conn.id]}
                onPathUpdated={onPathUpdated}
                onManualChange={onManualChange}
                editMode={editMode}
                isSelected={selectedConnectionId === conn.id}
                onSelect={(id) => onSelectConnection?.(id)}
                constraintRect={pelaksanaBounds}
                columnBounds={columnBounds}
                gridLayout={gridLayout}
                loopbackCorridorIndex={loopbackCorridorIndices.get(conn.id) ?? 0}
                crossColumnGutterSlot={crossColumnGutterSlots.get(conn.id) ?? 0}
                columnTrunkSlot={columnTrunkSlots.get(conn.id) ?? 0}
                routedSegmentsRef={pageRoutedSegmentsRef}
                reservedSidesRef={reservedSidesRef}
                rerouteVersion={rerouteVersion}
              />
            ))}
          </svg>
        )}
      </div>
    </div>
  )
}
