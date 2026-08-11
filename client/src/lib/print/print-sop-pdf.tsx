import { pdf } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import { tteApi } from '@/api/tte'
import {
  SopPdfDocument,
  type SopPdfDocumentProps,
  type SopPdfPrintMode,
} from '@/components/sop/sop-pdf-document'
import { exportSopDiagramSnapshots } from '@/lib/print/sop-diagram-export.util'
import { getValidasiPengesahanUrl } from '@/lib/tte/url'
import type { TTESignaturePayload } from '@/types/dto/tte.dto'

const QR_SIZE = 64

export type SopPdfPrintOptions = {
  signPdf?: boolean
  skipDiagramExport?: boolean
  pin?: string
}

export interface PrepareSopPdfDocumentPropsResult {
  props: SopPdfDocumentProps
  diagramExportFailed: boolean
  diagramExportError?: Error
}

async function buildQrDataUrl(payload: TTESignaturePayload | null | undefined): Promise<string | undefined> {
  if (!payload) {
    return undefined
  }
  const url = getValidasiPengesahanUrl(payload.dokumenTteId, payload.userId)
  try {
    return await QRCode.toDataURL(url, { width: QR_SIZE, margin: 1 })
  } catch {
    return undefined
  }
}

export function sanitizeSopPdfFilename(props: SopPdfDocumentProps): string {
  const raw = props.number?.trim() || props.name?.trim() || props.metadata?.name?.trim() || 'sop'
  const sanitized = raw
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
  return `SOP-${sanitized || 'dokumen'}.pdf`
}

function shouldExportDiagrams(props: SopPdfDocumentProps, options?: SopPdfPrintOptions): boolean {
  if (options?.skipDiagramExport) {
    return false
  }
  const requiredKinds = getRequiredDiagramKinds(props)
  if (requiredKinds.length === 0) {
    return false
  }
  const snapshots = props.diagramSnapshots ?? []
  if (
    snapshots.length > 0 &&
    requiredKinds.every((kind) => snapshots.some((snapshot) => snapshot.kind === kind))
  ) {
    return false
  }
  const printMode: SopPdfPrintMode =
    props.printMode ?? (props.includeHeader === false ? 'diagrams_only' : 'full')
  return (
    printMode === 'diagrams_only' ||
    printMode === 'steps_and_diagrams' ||
    printMode === 'header_steps_bpmn' ||
    printMode === 'full'
  )
}

function getRequiredDiagramKinds(props: SopPdfDocumentProps): Array<'flowchart' | 'bpmn'> {
  if (!props.prosedurRows || props.prosedurRows.length === 0) {
    return []
  }
  const printMode: SopPdfPrintMode =
    props.printMode ?? (props.includeHeader === false ? 'diagrams_only' : 'full')
  if (printMode === 'header_steps_bpmn') {
    return ['flowchart', 'bpmn']
  }
  if (
    printMode === 'diagrams_only' ||
    printMode === 'steps_and_diagrams' ||
    printMode === 'full'
  ) {
    return ['flowchart', 'bpmn']
  }
  return []
}

/** Siapkan props PDF termasuk ekspor diagram bila diperlukan. */
export async function prepareSopPdfDocumentProps(
  props: SopPdfDocumentProps,
  options?: SopPdfPrintOptions,
): Promise<PrepareSopPdfDocumentPropsResult> {
  if (!shouldExportDiagrams(props, options)) {
    return { props, diagramExportFailed: false }
  }
  try {
    const diagramSnapshots = await exportSopDiagramSnapshots({
      name: props.name,
      prosedurRows: props.prosedurRows ?? [],
      implementers: props.implementers ?? [],
      diagramKonfigurasi: props.diagramKonfigurasi,
    }, {
      requiredKinds: getRequiredDiagramKinds(props),
    })
    return {
      props: { ...props, diagramSnapshots },
      diagramExportFailed: false,
    }
  } catch (err) {
    console.error('[SOP PDF] Diagram export gagal:', err)
    return {
      props,
      diagramExportFailed: true,
      diagramExportError: err instanceof Error ? err : new Error(String(err)),
    }
  }
}

export async function buildSopPdfBlob(
  props: SopPdfDocumentProps,
  options?: SopPdfPrintOptions,
): Promise<Blob> {
  const { props: resolvedProps } = await prepareSopPdfDocumentProps(props, options)
  const qrDataUrlKepalaOpd = await buildQrDataUrl(resolvedProps.tteSignaturePayload)
  return pdf(
    <SopPdfDocument
      {...resolvedProps}
      qrDataUrlKepalaOpd={qrDataUrlKepalaOpd}
    />,
  ).toBlob()
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

/** Bangun PDF arsip lengkap; kegagalan ekspor diagram wajib menghentikan pengesahan. */
export async function buildSopOfficialPdfBase64(props: SopPdfDocumentProps): Promise<string> {
  const requiredKinds = getRequiredDiagramKinds(props)

  // Jika tidak ada diagram yang dibutuhkan (misalnya prosedurRows kosong),
  // langsung buat PDF tanpa diagram.
  if (requiredKinds.length === 0) {
    const blob = await buildSopPdfBlob(props, { skipDiagramExport: true })
    return blobToBase64(blob)
  }

  const {
    props: resolvedProps,
    diagramExportFailed,
    diagramExportError,
  } = await prepareSopPdfDocumentProps(props)
  const snapshots = resolvedProps.diagramSnapshots ?? []
  const missingKinds = requiredKinds.filter(
    (kind) => !snapshots.some((snapshot) => snapshot.kind === kind),
  )

  if (diagramExportFailed || missingKinds.length > 0) {
    const detail = missingKinds.length > 0
      ? `Diagram yang gagal: ${missingKinds.join(', ')}. `
      : ''
    throw new Error(
      `${detail}Flowchart atau BPMN SOP gagal dirender setelah beberapa percobaan. ` +
      `${diagramExportError?.message ? `Detail teknis: ${diagramExportError.message}. ` : ''}` +
      `Pengesahan dibatalkan agar PDF resmi tidak rusak. ` +
      `Silakan muat ulang halaman dan coba lagi.`,
    )
  }
  const blob = await buildSopPdfBlob(resolvedProps, { skipDiagramExport: true })
  return blobToBase64(blob)
}

function base64ToPdfBlob(base64: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new Blob([bytes], { type: 'application/pdf' })
}

async function signSopPdfBlob(
  blob: Blob,
  props: SopPdfDocumentProps,
  options: SopPdfPrintOptions | undefined,
): Promise<Blob> {
  const shouldSign = options?.signPdf ?? Boolean(props.tteSignaturePayload)
  if (!shouldSign || !props.tteSignaturePayload || !options?.pin) {
    return blob
  }

  const response = await tteApi.signPdf({
    pin: options.pin,
    dokumenTteId: props.tteSignaturePayload.dokumenTteId,
    userId: props.tteSignaturePayload.userId,
    jenisDokumen: 'SOP_BERLAKU',
    pdfBase64: await blobToBase64(blob),
  })
  return base64ToPdfBlob(response.signedPdfBase64)
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function printBlob(blob: Blob): Promise<void> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.src = url

    const cleanup = () => {
      iframe.remove()
      URL.revokeObjectURL(url)
      window.removeEventListener('afterprint', cleanup)
      resolve()
    }

    iframe.onload = () => {
      const frameWindow = iframe.contentWindow
      if (!frameWindow) {
        window.open(url, '_blank', 'noopener,noreferrer')
        window.setTimeout(cleanup, 1000)
        return
      }
      window.addEventListener('afterprint', cleanup, { once: true })
      frameWindow.focus()
      frameWindow.print()
      window.setTimeout(cleanup, 60_000)
    }

    document.body.appendChild(iframe)
  })
}

export interface SopPdfActionResult {
  diagramExportFailed: boolean
}

export async function downloadSopPdf(
  props: SopPdfDocumentProps,
  options?: SopPdfPrintOptions,
): Promise<SopPdfActionResult> {
  const { props: resolvedProps, diagramExportFailed } = await prepareSopPdfDocumentProps(
    props,
    options,
  )
  const unsignedBlob = await buildSopPdfBlob(resolvedProps, {
    ...options,
    skipDiagramExport: true,
  })
  const downloadableBlob = await signSopPdfBlob(unsignedBlob, resolvedProps, options)
  triggerBlobDownload(downloadableBlob, sanitizeSopPdfFilename(resolvedProps))
  return { diagramExportFailed }
}

export async function printSopPdfDocument(
  props: SopPdfDocumentProps,
  options?: SopPdfPrintOptions,
): Promise<SopPdfActionResult> {
  const { props: resolvedProps, diagramExportFailed } = await prepareSopPdfDocumentProps(
    props,
    options,
  )
  const unsignedBlob = await buildSopPdfBlob(resolvedProps, {
    ...options,
    skipDiagramExport: true,
  })
  const printableBlob = await signSopPdfBlob(unsignedBlob, resolvedProps, options)
  await printBlob(printableBlob)
  return { diagramExportFailed }
}
