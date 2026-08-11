import { pdf } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import {
  BeritaAcaraPdfDocument,
  type BeritaAcaraPdfDocumentProps,
} from '@/components/pengajuan/berita-acara-pdf-document'
import type { BeritaAcaraTemplateProps } from '@/components/pengajuan/berita-acara-template'
import { getValidasiPengesahanUrl } from '@/lib/tte/url'
import type { TTESignaturePayload } from '@/types/dto/tte.dto'

const QR_SIZE = 64

async function buildQrDataUrl(
  payload: TTESignaturePayload | undefined,
): Promise<string | undefined> {
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

export interface BeritaAcaraPdfQrUrls {
  qrDataUrlPjEvaluator?: string
  qrDataUrlPjPenyusun?: string
}

export async function buildBeritaAcaraPdfQrUrls(
  props: BeritaAcaraTemplateProps,
): Promise<BeritaAcaraPdfQrUrls> {
  const [qrDataUrlPjEvaluator, qrDataUrlPjPenyusun] = await Promise.all([
    buildQrDataUrl(props.tteSignaturePayloadPjEvaluator),
    buildQrDataUrl(props.tteSignaturePayloadPjPenyusun),
  ])
  return { qrDataUrlPjEvaluator, qrDataUrlPjPenyusun }
}

/** Sanitasi nama file unduhan PDF Berita Acara. */
export function sanitizeBeritaAcaraPdfFilename(props: BeritaAcaraTemplateProps): string {
  const raw = props.nomorBA?.trim() || props.opd.trim() || 'berita-acara'
  const sanitized = raw
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
  return `BA-${sanitized || 'dokumen'}.pdf`
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

export async function downloadBeritaAcaraPdf(props: BeritaAcaraTemplateProps): Promise<void> {
  const qrUrls = await buildBeritaAcaraPdfQrUrls(props)
  const documentProps: BeritaAcaraPdfDocumentProps = {
    ...props,
    ...qrUrls,
  }
  const downloadableBlob = await pdf(<BeritaAcaraPdfDocument {...documentProps} />).toBlob()
  triggerBlobDownload(downloadableBlob, sanitizeBeritaAcaraPdfFilename(props))
}
