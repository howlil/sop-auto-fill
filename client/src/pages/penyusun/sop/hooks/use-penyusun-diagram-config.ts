import { startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PathUpdatedPayload } from '@/components/sop/sop-diagram/shapes/FlowchartArrowConnector'
import type {
  ArrowConfig,
  LabelConfig,
  ProsedurRow,
  SOPStep,
} from '@/components/sop/sop-diagram/core/sopDiagramTypes'
import { rowsToSteps } from '@/components/sop/sop-diagram/core/sopDiagramTypes'
import type { PenyusunWorkbenchData } from '@/types/dto/sop.dto'
import {
  arrowConfigToPathOverrides,
  buildConnectionEdgeMetas,
  createEmptyDiagramKonfigurasi,
  diagramKonfigurasiFromWorkbench,
  pathOverridesToArrowConfig,
  pruneInvalidDiagramOverrides,
  resetDiagramSlicePaths,
  type DiagramConfigSlice,
  type DiagramKonfigurasiState,
  type JenisDiagramClient,
} from '@/lib/sop/diagram-config.mapper'
import { useUpdateSopDiagram } from '@/api/sop'
import { useSopDiagramAutosave } from './use-sop-diagram-autosave'

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

export interface UsePenyusunDiagramConfigOptions {
  detailSopId: string | undefined
  workbench: PenyusunWorkbenchData | undefined
  prosedurRows: ProsedurRow[]
  implementers: { id: string; name: string }[]
  activeTab: 'flowchart' | 'bpmn'
  enabled: boolean
}

export function usePenyusunDiagramConfig({
  detailSopId,
  workbench,
  prosedurRows,
  implementers,
  activeTab,
  enabled,
}: UsePenyusunDiagramConfigOptions) {
  const [diagramKonfigurasi, setDiagramKonfigurasi] = useState<DiagramKonfigurasiState>(
    createEmptyDiagramKonfigurasi(),
  )
  const [isEditingDiagramPaths, setIsEditingDiagramPaths] = useState(false)
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null)
  const [sessionArrowConfig, setSessionArrowConfig] = useState<Record<JenisDiagramClient, ArrowConfig>>({
    FLOWCHART: {},
    BPMN: {},
  })
  const [labelConfig, setLabelConfig] = useState<LabelConfig>({})
  const [isDiagramHydrated, setIsDiagramHydrated] = useState(false)
  const lastSyncedDetailIdRef = useRef<string | null>(null)
  const prevActiveTabRef = useRef(activeTab)
  const diagramKonfigurasiRef = useRef(diagramKonfigurasi)
  diagramKonfigurasiRef.current = diagramKonfigurasi
  const resetBaselineRef = useRef<(next: DiagramConfigSlice) => void>(() => {})
  const updateDiagramMutation = useUpdateSopDiagram(detailSopId ?? '')

  const diagramSteps = useMemo(
    () => rowsToSteps(prosedurRows, implementers),
    [prosedurRows, implementers],
  )
  const sortedSteps = useMemo(
    () => [...diagramSteps].sort((a, b) => a.seq_number - b.seq_number),
    [diagramSteps],
  )
  const rowIdToSeq = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of prosedurRows) {
      if (row.id && row.no != null) map.set(row.id, row.no)
    }
    return map
  }, [prosedurRows])

  const flowchartConnections = useMemo(
    () => buildFlowchartConnections(sortedSteps, rowIdToSeq),
    [sortedSteps, rowIdToSeq],
  )

  const flowchartMetas = useMemo(
    () => buildConnectionEdgeMetas(flowchartConnections, prosedurRows, diagramSteps),
    [flowchartConnections, prosedurRows, diagramSteps],
  )

  const bpmnConnections = useMemo(
    () => toBpmnConnections(flowchartConnections),
    [flowchartConnections],
  )

  const bpmnMetas = useMemo(
    () => buildConnectionEdgeMetas(bpmnConnections, prosedurRows, diagramSteps),
    [bpmnConnections, prosedurRows, diagramSteps],
  )

  const activeJenis: JenisDiagramClient = activeTab === 'flowchart' ? 'FLOWCHART' : 'BPMN'
  const activeSlice = diagramKonfigurasi[activeTab === 'flowchart' ? 'flowchart' : 'bpmn']
  const activeMetas = activeTab === 'flowchart' ? flowchartMetas : bpmnMetas
  const activeConnectionIds = useMemo(
    () => (activeTab === 'flowchart' ? flowchartConnections : bpmnConnections).map((connection) => connection.id),
    [activeTab, bpmnConnections, flowchartConnections],
  )

  const persistedArrowConfig = useMemo(
    () => pathOverridesToArrowConfig(activeSlice.pathOverrides, activeMetas),
    [activeSlice.pathOverrides, activeMetas],
  )

  const effectiveArrowConfig = useMemo(
    () => ({ ...persistedArrowConfig, ...sessionArrowConfig[activeJenis] }),
    [persistedArrowConfig, sessionArrowConfig, activeJenis],
  )

  const persistedArrowConfigRef = useRef(persistedArrowConfig)
  persistedArrowConfigRef.current = persistedArrowConfig
  const sessionArrowConfigRef = useRef(sessionArrowConfig)
  sessionArrowConfigRef.current = sessionArrowConfig
  const labelConfigRef = useRef(labelConfig)
  labelConfigRef.current = labelConfig

  const diagramAutosave = useSopDiagramAutosave({
    detailSopId,
    jenis: activeJenis,
    slice: activeSlice,
    save: updateDiagramMutation.mutateAsync,
    enabled: enabled && Boolean(detailSopId) && isDiagramHydrated,
  })

  resetBaselineRef.current = diagramAutosave.resetBaseline

  useEffect(() => {
    if (!detailSopId) {
      lastSyncedDetailIdRef.current = null
      setIsDiagramHydrated(false)
    }
  }, [detailSopId])

  useLayoutEffect(() => {
    if (!workbench?.detail.id) return
    if (lastSyncedDetailIdRef.current === workbench.detail.id) return
    lastSyncedDetailIdRef.current = workbench.detail.id
    const loaded = diagramKonfigurasiFromWorkbench(workbench.diagramKonfigurasi)
    setDiagramKonfigurasi(loaded)
    setSessionArrowConfig({ FLOWCHART: {}, BPMN: {} })
    setLabelConfig({
      custom_labels: {},
      positions: {
        ...(loaded.flowchart.pathOverrides?.labels ?? {}),
        ...(loaded.bpmn.pathOverrides?.labels ?? {}),
      },
    })
    const tabKey = activeTab === 'flowchart' ? 'flowchart' : 'bpmn'
    prevActiveTabRef.current = activeTab
    resetBaselineRef.current(loaded[tabKey])
    setIsDiagramHydrated(true)
  }, [workbench?.detail.id, workbench?.diagramKonfigurasi, activeTab])

  useLayoutEffect(() => {
    if (!isDiagramHydrated) return
    if (prevActiveTabRef.current === activeTab) return
    prevActiveTabRef.current = activeTab
    const tabKey = activeTab === 'flowchart' ? 'flowchart' : 'bpmn'
    resetBaselineRef.current(diagramKonfigurasiRef.current[tabKey])
  }, [activeTab, isDiagramHydrated])

  useEffect(() => {
    const validIds = new Set(
      prosedurRows.map((r) => r.id).filter((id): id is string => Boolean(id)),
    )
    setDiagramKonfigurasi((prev) => {
      const nextFlow = pruneInvalidDiagramOverrides(prev.flowchart.pathOverrides, validIds)
      const nextBpmn = pruneInvalidDiagramOverrides(prev.bpmn.pathOverrides, validIds)
      if (
        nextFlow === prev.flowchart.pathOverrides &&
        nextBpmn === prev.bpmn.pathOverrides
      ) {
        return prev
      }
      return {
        flowchart: { ...prev.flowchart, pathOverrides: nextFlow },
        bpmn: { ...prev.bpmn, pathOverrides: nextBpmn },
      }
    })
  }, [prosedurRows])

  useEffect(() => {
    if (!isEditingDiagramPaths) {
      setSelectedConnectionId(null)
      return
    }
    if (activeConnectionIds.length === 0) {
      setSelectedConnectionId(null)
      return
    }
    setSelectedConnectionId((prev) =>
      prev && activeConnectionIds.includes(prev) ? prev : activeConnectionIds[0] ?? null,
    )
  }, [activeConnectionIds, isEditingDiagramPaths])

  const updateActiveSlice = useCallback(
    (updater: (slice: DiagramConfigSlice) => DiagramConfigSlice) => {
      setDiagramKonfigurasi((prev) => {
        const key = activeTab === 'flowchart' ? 'flowchart' : 'bpmn'
        return { ...prev, [key]: updater(prev[key]) }
      })
    },
    [activeTab],
  )

  const handleManualPathChange = useCallback(
    (payload: PathUpdatedPayload) => {
      const connectionPatch = {
        sSide: payload.sSide,
        eSide: payload.eSide,
        startPoint: payload.startPoint,
        endPoint: payload.endPoint,
        bendPoints: payload.bendPoints,
      }
      const nextSession: ArrowConfig = {
        ...sessionArrowConfigRef.current[activeJenis],
        [payload.connectionId]: connectionPatch,
      }
      startTransition(() => {
        setSessionArrowConfig((prev) => ({
          ...prev,
          [activeJenis]: nextSession,
        }))
        const mergedConfig: ArrowConfig = {
          ...persistedArrowConfigRef.current,
          ...nextSession,
        }
        const pathOverrides = arrowConfigToPathOverrides(
          mergedConfig,
          labelConfigRef.current,
          activeMetas,
        )
        updateActiveSlice((slice) => ({ ...slice, pathOverrides }))
      })
    },
    [activeJenis, activeMetas, updateActiveSlice],
  )

  const handleResetSelectedPath = useCallback(() => {
    if (!selectedConnectionId) return
    const merged = { ...effectiveArrowConfig }
    delete merged[selectedConnectionId]
    setSessionArrowConfig((prev) => {
      const next = { ...prev[activeJenis] }
      delete next[selectedConnectionId]
      return { ...prev, [activeJenis]: next }
    })
    const pathOverrides = arrowConfigToPathOverrides(merged, labelConfig, activeMetas)
    updateActiveSlice((slice) => ({ ...slice, pathOverrides }))
    setSelectedConnectionId(null)
  }, [
    activeJenis,
    activeMetas,
    effectiveArrowConfig,
    labelConfig,
    selectedConnectionId,
    updateActiveSlice,
  ])

  const handleResetAllPaths = useCallback(() => {
    setSessionArrowConfig((prev) => ({
      ...prev,
      [activeJenis]: {},
    }))
    updateActiveSlice(resetDiagramSlicePaths)
    setSelectedConnectionId(null)
  }, [activeJenis, updateActiveSlice])

  const pathLayoutSeed =
    activeTab === 'flowchart'
      ? diagramKonfigurasi.flowchart.layoutSeed
      : diagramKonfigurasi.bpmn.layoutSeed

  return {
    isDiagramHydrated,
    pathLayoutSeed,
    effectiveArrowConfig,
    labelConfig,
    isEditingDiagramPaths,
    setIsEditingDiagramPaths,
    selectedConnectionId,
    setSelectedConnectionId,
    handleManualPathChange,
    handleResetSelectedPath,
    handleResetAllPaths,
    flushDiagramAutosave: diagramAutosave.flush,
    diagramAutosaveStatus: diagramAutosave.status,
  }
}
