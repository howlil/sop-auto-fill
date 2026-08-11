import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import type { TTESignaturePayload } from '@/types/dto/tte.dto'
import { getValidasiPengesahanUrl } from '@/lib/tte/url'
import { formatDateIdLong } from '@/utils/format-date'

export interface TTESignatureBlockProps {
  payload: TTESignaturePayload
  /** Contoh label penanda: "OPD" atau "PJ Evaluator" */
  roleLabel?: string
  /** Ukuran sisi QR (px). */
  qrSize?: number
  className?: string
  showRoleLabel?: boolean
  showNip?: boolean
  showCaption?: boolean
  showSignedDate?: boolean
  placeNameBelowQr?: boolean
}

export function TTESignatureBlock({
  payload,
  roleLabel,
  qrSize = 80,
  className = '',
  showRoleLabel = true,
  showNip = true,
  showCaption = true,
  showSignedDate = true,
  placeNameBelowQr = false,
}: TTESignatureBlockProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const url = getValidasiPengesahanUrl(payload.dokumenTteId, payload.userId)
    QRCode.toDataURL(url, { width: qrSize, margin: 1 })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl)
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [payload.dokumenTteId, payload.userId, qrSize])

  const signedDate = payload.signedAt
    ? formatDateIdLong(payload.signedAt)
    : '—'

  return (
    <div className={`inline-block text-center ${className}`}>
      {showRoleLabel && roleLabel ? (
        <p className="text-xs font-medium text-secondary-foreground mb-1">{roleLabel}</p>
      ) : null}
      {qrDataUrl && (
        <div className="mt-2 flex justify-center">
          <img
            src={qrDataUrl}
            alt="QR Validasi Pengesahan"
            width={qrSize}
            height={qrSize}
            className="border border-border rounded"
          />
        </div>
      )}
      {placeNameBelowQr ? (
        <>
          <p className="mt-2 text-sm font-semibold text-foreground">{payload.namaLengkap}</p>
          {showNip ? <p className="text-xs text-secondary-foreground">NIP. {payload.nip}</p> : null}
          {showCaption ? <p className="text-xs text-muted-foreground mt-1">TTE simulasi (format selaras BSRE)</p> : null}
          {showSignedDate ? <p className="text-xs text-muted-foreground">{signedDate}</p> : null}
        </>
      ) : (
        <>
          <p className="mt-2 text-sm font-semibold text-foreground">{payload.namaLengkap}</p>
          {showNip ? <p className="text-xs text-secondary-foreground">NIP. {payload.nip}</p> : null}
          {showCaption ? <p className="text-xs text-muted-foreground mt-1">TTE simulasi (format selaras BSRE)</p> : null}
          {showSignedDate ? <p className="text-xs text-muted-foreground">{signedDate}</p> : null}
        </>
      )}
    </div>
  )
}
