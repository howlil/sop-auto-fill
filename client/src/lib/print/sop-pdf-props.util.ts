import type { SOPPreviewTemplateProps } from '@/components/sop/sop-preview-template'
import type {
  SopPdfDocumentProps,
  SopPdfPrintMode,
} from '@/components/sop/sop-pdf-document'

export interface SopPdfPropsFromPreviewOptions {
  includeHeader?: boolean
  printMode?: SopPdfPrintMode
}

/** Memetakan props pratinjau workbench ke dokumen PDF SOP. */
export function sopPreviewPropsToPdfDocumentProps(
  preview: SOPPreviewTemplateProps,
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
    includeHeader,
    printMode,
  }
}
