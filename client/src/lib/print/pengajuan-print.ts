/** Target aksi arsip pengajuan: unduh BA (PDF) atau cetak SOP (PDF). */
export type PengajuanPrintTarget = 'ba' | 'sop'

export const PRINT_DELAY_MS = 150

import type { SopPreviewWorkbenchProps } from '@/components/pengajuan/sop-document-preview-pane'
import {
  downloadSopPdf,
  buildSopOfficialPdfBase64,
  printSopPdfDocument,
  type SopPdfPrintOptions,
} from './print-sop-pdf'
import { sopPreviewPropsToPdfDocumentProps } from './sop-pdf-props.util'
import type { SopPdfDocumentProps } from '@/components/sop/sop-pdf-document'
import type { TTESignaturePayload } from '@/types/dto/tte.dto'


export { downloadSopPdf, printSopPdfDocument } from './print-sop-pdf'

export const CETAK_ARSIP_DISABLED_TITLE =
  'Tersedia setelah seluruh SOP ditandatangani Kepala OPD (status pengajuan selesai).'

export const CETAK_BA_DISABLED_TITLE =
  'Tersedia setelah Berita Acara ditandatangani PJ Evaluator dan PJ Penyusun.'

/** Unduh Berita Acara arsip — setelah kedua PJ menandatangani BA. */
export function canCetakBeritaAcaraPengajuan(status: string | undefined): boolean {
  return status === 'DITANDATANGANI_PJ_PENYUSUN' || status === 'SELESAI'
}

/** Cetak SOP arsip pengajuan — hanya setelah pengajuan SELESAI (semua SOP Berlaku). */
export function canCetakSopArsipPengajuan(status: string | undefined): boolean {
  return status === 'SELESAI'
}



export interface SopPdfFromPreviewOptions extends SopPdfPrintOptions {
  includeHeader?: boolean
  printMode?: SopPdfDocumentProps['printMode']
}

const SOP_ARSIP_PDF_OPTIONS: Pick<SopPdfFromPreviewOptions, 'includeHeader' | 'printMode'> = {
  includeHeader: true,
  printMode: 'header_steps_bpmn',
}

/** Cetak SOP dari props pratinjau workbench (PDF + diagram). */
export async function printSopFromPreviewProps(
  preview: SopPreviewWorkbenchProps,
  tteSignaturePayload: TTESignaturePayload | null = null,
  options: SopPdfFromPreviewOptions = {},
): Promise<{ diagramExportFailed: boolean }> {
  const pdfProps = sopPreviewPropsToPdfDocumentProps(preview, {
    includeHeader: options.includeHeader,
    printMode: options.printMode,
    tteSignaturePayload,
  })
  return printSopPdfDocument(pdfProps, options)
}

/** Cetak SOP resmi dengan format arsip yang sama di seluruh halaman. */
export function printSopArsipFromPreviewProps(
  preview: SopPreviewWorkbenchProps,
  tteSignaturePayload: TTESignaturePayload | null = null,
  options: SopPdfPrintOptions = {},
): Promise<{ diagramExportFailed: boolean }> {
  return printSopFromPreviewProps(preview, tteSignaturePayload, {
    ...SOP_ARSIP_PDF_OPTIONS,
    ...options,
  })
}

/** Bangun artefak PDF resmi untuk disimpan server saat Kepala OPD mengesahkan SOP. */
export function buildSopArsipPdfBase64FromPreviewProps(
  preview: SopPreviewWorkbenchProps,
): Promise<string> {
  return buildSopOfficialPdfBase64(
    sopPreviewPropsToPdfDocumentProps(preview, SOP_ARSIP_PDF_OPTIONS),
  )
}

/** Unduh SOP dari props pratinjau workbench (PDF + diagram). */
export async function downloadSopFromPreviewProps(
  preview: SopPreviewWorkbenchProps,
  tteSignaturePayload: TTESignaturePayload | null = null,
  options: SopPdfFromPreviewOptions = {},
): Promise<{ diagramExportFailed: boolean }> {
  const pdfProps = sopPreviewPropsToPdfDocumentProps(preview, {
    includeHeader: options.includeHeader,
    printMode: options.printMode,
    tteSignaturePayload,
  })
  return downloadSopPdf(pdfProps, options)
}

export function triggerSopPrint(props: SopPdfDocumentProps, options?: SopPdfPrintOptions): void {
  void printSopPdfDocument(props, options)
}

export function schedulePengajuanPrint(
  target: 'sop',
  props: SopPdfDocumentProps,
  delayMs: number = PRINT_DELAY_MS,
  options?: SopPdfPrintOptions,
): Promise<{ diagramExportFailed: boolean }> {
  if (target !== 'sop') {
    return Promise.resolve({ diagramExportFailed: false })
  }
  return new Promise((resolve, reject) => {
    window.setTimeout(() => {
      printSopPdfDocument(props, options).then(resolve, reject)
    }, delayMs)
  })
}

/** Cetak dokumen SOP PDF-native memakai `@react-pdf/renderer`. */
export function scheduleSopDocumentPrint(
  props: SopPdfDocumentProps,
  delayMs: number = PRINT_DELAY_MS,
  options?: SopPdfPrintOptions,
): Promise<{ diagramExportFailed: boolean }> {
  return schedulePengajuanPrint('sop', props, delayMs, options)
}


