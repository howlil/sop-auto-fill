
import { LOCALE_ID } from '@/utils/constants'

type DateInput = string | Date | null | undefined

/** Zona kalender dokumen SOP (konsisten lintas browser; hindari off-by-one UTC). */
export const SOP_DOCUMENT_TIME_ZONE = 'Asia/Jakarta' as const

function toDate(value: DateInput): Date | null {
  if (value == null || value === '') return null
  const d = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Tanggal kalender ISO → DD/MM/YYYY di Asia/Jakarta (untuk header SOP cetak/preview).
 */
export function formatIsoToDdMmYyyyWib(value: DateInput): string {
  const d = toDate(value)
  if (!d) return ''
  return d.toLocaleDateString('en-GB', {
    timeZone: SOP_DOCUMENT_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * ISO datetime → nilai `YYYY-MM-DD` untuk `<input type="date">` (hari kalender di Jakarta).
 */
export function isoToDateInputValueWib(iso: string | null | undefined): string {
  const d = toDate(iso)
  if (!d) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SOP_DOCUMENT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  const day = parts.find((p) => p.type === 'day')?.value
  if (y === undefined || m === undefined || day === undefined) return ''
  return `${y}-${m}-${day}`
}

/** Format singkat: 20/02/2026 */
export function formatDateId(value: DateInput): string {
  return toDate(value)?.toLocaleDateString(LOCALE_ID) ?? '—'
}

/** Format panjang: 20 Feb 2026 */
export function formatDateIdLong(value: DateInput): string {
  const d = toDate(value)
  return d
    ? d.toLocaleDateString(LOCALE_ID, { day: 'numeric', month: 'short', year: 'numeric' })
    : '—'
}

/** Format lengkap: 20 Februari 2026 */
export function formatDateIdFull(value: DateInput, fallback: string = '—'): string {
  const d = toDate(value)
  return d
    ? d.toLocaleDateString(LOCALE_ID, { day: 'numeric', month: 'long', year: 'numeric' })
    : fallback
}

/** Format tempat & tanggal: "Padang, 20 Februari 2026" */
export function formatTempatTanggal(value: DateInput, tempat: string = 'Padang'): string {
  const d = toDate(value)
  if (!d) return '—'
  const formattedDate = formatDateIdFull(d)
  return `${tempat}, ${formattedDate}`
}
