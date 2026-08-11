import { useMemo } from 'react'
import { SOPDiagramBpmn } from '@/components/sop/sop-diagram'
import { SOPDiagramFlowchart } from '@/components/sop/sop-diagram'
import { rowsToSteps } from '@/components/sop/sop-diagram'
import { SOP_DOCUMENT_CONTENT_WRAPPER_CLASS } from '@/components/sop/sop-diagram/layout/sopDocumentLayout'
import { buildDiagramStateForPreviewTab } from '@/lib/sop/diagram-config.mapper'
import type { SopDiagramExportInput } from '@/lib/print/sop-diagram-export.util'

export function SopDiagramExportHost({
  input,
  kinds = ['flowchart', 'bpmn'],
}: {
  input: SopDiagramExportInput
  kinds?: Array<'flowchart' | 'bpmn'>
}) {
  const safeImplementers = useMemo(
    () =>
      (input.implementers ?? []).map((impl, index) => ({
        id: impl?.id ?? `impl-${index + 1}`,
        name: (impl?.name ?? impl?.id ?? `Pelaksana ${index + 1}`).toString(),
      })),
    [input.implementers],
  )
  const diagramSteps = useMemo(
    () => rowsToSteps(input.prosedurRows ?? [], safeImplementers),
    [input.prosedurRows, safeImplementers],
  )
  const flowchartState = useMemo(
    () =>
      buildDiagramStateForPreviewTab({
        diagramKonfigurasi: input.diagramKonfigurasi,
        prosedurRows: input.prosedurRows ?? [],
        implementers: safeImplementers,
        activeTab: 'flowchart',
      }),
    [input.diagramKonfigurasi, input.prosedurRows, safeImplementers],
  )
  const bpmnState = useMemo(
    () =>
      buildDiagramStateForPreviewTab({
        diagramKonfigurasi: input.diagramKonfigurasi,
        prosedurRows: input.prosedurRows ?? [],
        implementers: safeImplementers,
        activeTab: 'bpmn',
      }),
    [input.diagramKonfigurasi, input.prosedurRows, safeImplementers],
  )
  const flowchartProps = {
    data: {
      rows: input.prosedurRows ?? [],
      steps: diagramSteps,
      implementers: safeImplementers,
    },
    config: {
      pathLayoutSeed: flowchartState.pathLayoutSeed,
      arrowConfig: flowchartState.arrowConfig,
      labelConfig: flowchartState.labelConfig,
      editMode: false,
      selectedConnectionId: null,
    },
    events: {
      onManualChange: undefined,
      onSelectConnection: () => {},
    },
  }
  const bpmnProps = {
    data: {
      name: input.name,
      steps: diagramSteps,
      implementers: safeImplementers,
    },
    config: {
      pathLayoutSeed: bpmnState.pathLayoutSeed,
      arrowConfig: bpmnState.arrowConfig,
      labelConfig: bpmnState.labelConfig,
      editMode: false,
      selectedConnectionId: null,
    },
    events: {
      onManualChange: undefined,
      onSelectConnection: () => {},
    },
  }
  return (
    <div data-sop-diagram-export-root className="bg-surface">
      {kinds.includes('flowchart') && (
        <div className={`sop-print-diagram-flowchart ${SOP_DOCUMENT_CONTENT_WRAPPER_CLASS}`}>
          <SOPDiagramFlowchart {...flowchartProps} />
        </div>
      )}
      {kinds.includes('bpmn') && (
        <div className={`sop-print-diagram-bpmn ${SOP_DOCUMENT_CONTENT_WRAPPER_CLASS}`}>
          <SOPDiagramBpmn {...bpmnProps} />
        </div>
      )}
    </div>
  )
}
