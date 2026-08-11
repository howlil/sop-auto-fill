import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { DocumentPreviewEmptyState } from '@/components/pengajuan/document-preview-empty-state'
import {
  SOPPreviewTemplate,
  type SOPPreviewTemplateProps,
} from '@/components/sop/sop-preview-template'
import { useSopPreviewDiagramState } from '@/hooks/use-sop-preview-diagram-state'
import type { PenyusunWorkbenchDiagramKonfigurasi } from '@/types/dto/sop.dto'
import type { TTESignaturePayload } from '@/types/dto/tte.dto'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/ui/loading-state'

export interface SopPreviewWorkbenchProps {
  name?: string
  number?: string
  metadata: SOPPreviewTemplateProps['metadata']
  prosedurRows: SOPPreviewTemplateProps['prosedurRows']
  implementers: SOPPreviewTemplateProps['implementers']
  diagramKonfigurasi?: PenyusunWorkbenchDiagramKonfigurasi
}

export interface SopDocumentPreviewPaneProps {
  selectedSop: { nama: string; nomor: string } | null | undefined
  isLoading: boolean
  sopPreviewProps: SopPreviewWorkbenchProps | null
  tteSignaturePayload?: TTESignaturePayload | null
  loadingMessage?: string
  errorMessage?: string
  onRetry?: () => void
}

function SopPreviewWithDiagram({
  previewProps,
  tteSignaturePayload,
}: {
  previewProps: SopPreviewWorkbenchProps
  tteSignaturePayload: TTESignaturePayload | null
}) {
  const [activeTab, setActiveTab] = useState<'flowchart' | 'bpmn'>('flowchart')
  const diagramState = useSopPreviewDiagramState(
    {
      diagramKonfigurasi: previewProps.diagramKonfigurasi,
      prosedurRows: previewProps.prosedurRows ?? [],
      implementers: previewProps.implementers ?? [],
    },
    activeTab,
  )
  return (
    <SOPPreviewTemplate
      name={previewProps.name}
      number={previewProps.number}
      metadata={previewProps.metadata}
      prosedurRows={previewProps.prosedurRows}
      implementers={previewProps.implementers}
      tteSignaturePayload={tteSignaturePayload}
      previewOptions={{ editable: false, showScrollbar: true }}
      diagramState={{
        activeTab,
        onActiveTabChange: setActiveTab,
        ...diagramState,
      }}
    />
  )
}

export function SopDocumentPreviewPane({
  selectedSop,
  isLoading,
  sopPreviewProps,
  tteSignaturePayload = null,
  loadingMessage = 'Memuat dokumen SOP...',
  errorMessage,
  onRetry,
}: SopDocumentPreviewPaneProps) {
  if (selectedSop == null) {
    return <DocumentPreviewEmptyState />
  }
  if (isLoading) {
    return <LoadingState className="min-h-64" message={loadingMessage} />
  }
  if (errorMessage != null && onRetry != null && sopPreviewProps === null) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <AlertCircle className="h-10 w-10 text-danger" aria-hidden />
        <p className="max-w-md text-sm text-secondary-foreground">{errorMessage}</p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Coba lagi
        </Button>
      </div>
    )
  }
  if (sopPreviewProps !== null) {
    return (
      <div>
        <SopPreviewWithDiagram
          previewProps={sopPreviewProps}
          tteSignaturePayload={tteSignaturePayload}
        />
      </div>
    )
  }
  return (
    <div>
      <SOPPreviewTemplate
        name={selectedSop.nama}
        number={selectedSop.nomor}
        tteSignaturePayload={tteSignaturePayload}
        previewOptions={{ editable: false, showScrollbar: true }}
      />
    </div>
  )
}
