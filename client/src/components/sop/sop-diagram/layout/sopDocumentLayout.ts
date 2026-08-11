/** Lebar tetap konten cetak SOP (297mm − 3cm). Sinkron header, flowchart, dan BPMN. */
export const SOP_DOCUMENT_PAGE_WIDTH_CLASS =
  'w-[calc(297mm-3cm)] min-w-[calc(297mm-3cm)] max-w-[calc(297mm-3cm)] print:w-[calc(297mm-3cm)] print:min-w-[calc(297mm-3cm)] print:max-w-[calc(297mm-3cm)]'

/** Wrapper pratinjau: mengikuti viewport hingga batas lebar cetak. */
export const SOP_DOCUMENT_CONTENT_WRAPPER_CLASS =
  'box-border min-w-0 w-full max-w-[calc(297mm-3cm)] print:mx-auto print:my-0 print:w-[calc(297mm-3cm)] print:min-w-[calc(297mm-3cm)] print:max-w-[calc(297mm-3cm)] [print-color-adjust:exact] [-webkit-print-color-adjust:exact]'
