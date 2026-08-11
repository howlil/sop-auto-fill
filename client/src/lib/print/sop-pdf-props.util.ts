import type { SopPreviewWorkbenchProps } from '@/components/pengajuan/sop-document-preview-pane'
import type {
  SopPdfDocumentProps,
  SopPdfPrintMode,
} from '@/components/sop/sop-pdf-document'
import type { TTESignaturePayload } from '@/types/dto/tte.dto'

export interface SopPdfPropsFromPreviewOptions {
  includeHeader?: boolean
  printMode?: SopPdfPrintMode
  tteSignaturePayload?: TTESignaturePayload | null
}

/** Memetakan props pratinjau workbench ke dokumen PDF SOP. */
export function sopPreviewPropsToPdfDocumentProps(
  preview: SopPreviewWorkbenchProps,
  options: SopPdfPropsFromPreviewOptions = {},
): SopPdfDocumentProps {
  const printMode = options.printMode ?? 'diagrams_only'
  const includeHeader =
    options.includeHeader ??
    (printMode === 'full' ||
      printMode === 'steps_and_diagrams' ||
      printMode === 'header_and_steps' ||
      printMode === 'header_steps_bpmn')
  return {
    name: preview.name,
    number: preview.number,
    metadata: preview.metadata,
    prosedurRows: preview.prosedurRows,
    implementers: preview.implementers,
    tteSignaturePayload: options.tteSignaturePayload ?? null,
    includeHeader,
    printMode,
    diagramKonfigurasi: preview.diagramKonfigurasi,
  }
}
