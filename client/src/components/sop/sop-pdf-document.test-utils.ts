import type { SopPdfDocumentProps } from '@/components/sop/sop-pdf-document'

/** Util tes untuk logika layout PDF SOP (dieksport dari komponen dokumen). */
export function resolvePrintSections(props: SopPdfDocumentProps): {
  showHeader: boolean
  showSteps: boolean
  showDiagrams: boolean
} {
  const printMode = props.printMode ?? (props.includeHeader === false ? 'diagrams_only' : 'full')
  const hasDiagrams = (props.diagramSnapshots?.length ?? 0) > 0
  const showHeader =
    props.includeHeader !== false &&
    printMode !== 'diagrams_only' &&
    printMode !== 'steps_only'
  const showSteps =
    printMode === 'full' ||
    printMode === 'header_and_steps' ||
    printMode === 'steps_only' ||
    printMode === 'steps_and_diagrams' ||
    (printMode === 'diagrams_only' && !hasDiagrams)
  const showDiagrams =
    hasDiagrams &&
    (printMode === 'full' ||
      printMode === 'diagrams_only' ||
      printMode === 'steps_and_diagrams' ||
      printMode === 'header_steps_bpmn')
  return { showHeader, showSteps, showDiagrams }
}
