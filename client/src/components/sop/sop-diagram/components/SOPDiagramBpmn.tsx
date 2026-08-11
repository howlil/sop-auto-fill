import { useMemo } from 'react'
import type { Implementer, SOPStep, ArrowConfig, LabelConfig } from '../core/sopDiagramTypes'
import { buildWorkflowConnections } from '../core/workflow/build-workflow-connections.util'
import { BpmnPage, type ProcessedBpmnStep } from './BpmnPage'

export interface SOPDiagramBpmnProps {
  data: {
    name?: string
    steps: SOPStep[]
    implementers: Implementer[]
  }
  config?: {
    pathLayoutSeed?: number
    arrowConfig?: ArrowConfig
    labelConfig?: LabelConfig
    editMode?: boolean
    selectedConnectionId?: string | null
  }
  events?: {
    onManualEdit?: (config: unknown) => void
    onLabelEdit?: (config: unknown) => void
    onManualChange?: (payload: import('../shapes/FlowchartArrowConnector').PathUpdatedPayload) => void
    onSelectConnection?: (connectionId: string | null) => void
  }
}

function buildProcessedSteps(steps: SOPStep[]): ProcessedBpmnStep[] {
  if (!steps.length) return []
  const sorted = [...steps].sort((a, b) => a.seq_number - b.seq_number)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const endSeq = last ? last.seq_number + 1 : 1
  const start: ProcessedBpmnStep = {
    id_step: 'start-terminator',
    seq_number: 0,
    name: 'Mulai',
    type: 'terminator',
    id_implementer: first?.id_implementer,
  }
  const end: ProcessedBpmnStep = {
    id_step: 'end-terminator',
    seq_number: endSeq,
    name: 'Selesai',
    type: 'terminator',
    id_implementer: last?.id_implementer,
  }
  const workflow = sorted.map((s) => ({
    ...s,
    type: s.type === 'terminator' ? 'task' : s.type,
    seq_number: s.seq_number,
    id_step: s.id_step ?? `step-${s.seq_number}`,
  })) as ProcessedBpmnStep[]
  return [start, ...workflow, end]
}

/** Satu diagram BPMN utuh per SOP (paginasi hanya untuk flowchart cetak). */
export function SOPDiagramBpmn({ data, config, events }: SOPDiagramBpmnProps) {
  const { name, steps, implementers } = data
  const pathLayoutSeed = config?.pathLayoutSeed ?? 0
  const labelConfig = config?.labelConfig

  const processedSteps = useMemo(() => buildProcessedSteps(steps), [steps])

  const connections = useMemo(
    () =>
      buildWorkflowConnections({
        steps: processedSteps,
        shapePrefix: 'bpmn-step-',
        labelConfig,
        pathLayoutSeed,
      }),
    [processedSteps, labelConfig, pathLayoutSeed],
  )

  if (steps.length === 0) {
    return null
  }

  return (
    <BpmnPage
      pageIndex={0}
      isLastPage
      processedSteps={processedSteps}
      pageConnections={connections}
      name={name}
      implementers={implementers}
      config={config}
      events={events}
    />
  )
}
