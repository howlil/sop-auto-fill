import type { ProsedurRow } from '@/types/ui/sop'
import { resolveProsedurPelaksanaId } from '@/lib/sop/resolve-prosedur-implementer'

export interface ProsedurRowsValidationResult {
  valid: boolean
  errors: string[]
}

function isNonEmpty(value: string | undefined | null): boolean {
  return (value ?? '').trim().length > 0
}

function pickKelengkapan(row: ProsedurRow): string {
  return (row.mutu_kelengkapan ?? row.kelengkapan ?? '').trim()
}

function pickKeluaran(row: ProsedurRow): string {
  return (row.output ?? row.keluaran ?? '').trim()
}

function hasMutuWaktu(row: ProsedurRow): boolean {
  const waktuRaw = row.waktu ?? row.time
  if (typeof waktuRaw === 'number' && Number.isFinite(waktuRaw)) {
    return true
  }
  const raw = (row.mutu_waktu ?? '').trim()
  if (raw.length === 0) return false
  return /^\d+/.test(raw)
}

/**
 * Validasi kelengkapan baris prosedur sebelum keluar dari mode edit.
 * Selaras dengan `assertWorkbenchCompleteForSiapDievaluasi` di server + kolom waktu di editor.
 */
export function validateProsedurRows(
  rows: ProsedurRow[],
  implementerCount: number,
): ProsedurRowsValidationResult {
  const errors: string[] = []
  if (implementerCount === 0) {
    errors.push('Tambahkan minimal satu aktor pelaksana terlebih dahulu.')
  }
  if (rows.length === 0) {
    errors.push('Minimal satu langkah prosedur wajib ada.')
  }
  rows.forEach((row, index) => {
    const prefix = `Langkah ${index + 1}`
    if (!isNonEmpty(row.kegiatan)) {
      errors.push(`${prefix}: kegiatan wajib diisi`)
    }
    if (!pickKelengkapan(row)) {
      errors.push(`${prefix}: kelengkapan wajib diisi`)
    }
    if (!pickKeluaran(row)) {
      errors.push(`${prefix}: keluaran wajib diisi`)
    }
    if (!hasMutuWaktu(row)) {
      errors.push(`${prefix}: waktu wajib diisi`)
    }
    if (!isNonEmpty(row.keterangan)) {
      errors.push(`${prefix}: keterangan wajib diisi`)
    }
    if (!resolveProsedurPelaksanaId(row)) {
      errors.push(`${prefix}: pelaksana wajib dipilih`)
    }
    if (row.type === 'decision') {
      if (!isNonEmpty(row.id_next_step_if_yes)) {
        errors.push(`${prefix}: cabang "Ya" wajib menunjuk langkah berikutnya`)
      }
      if (!isNonEmpty(row.id_next_step_if_no)) {
        errors.push(`${prefix}: cabang "Tidak" wajib menunjuk langkah berikutnya`)
      }
    }
  })
  return { valid: errors.length === 0, errors }
}

/** Ringkas daftar error untuk toast (maks. 3 baris pertama). */
export function formatProsedurValidationMessage(errors: string[]): string {
  if (errors.length === 0) return ''
  const shown = errors.slice(0, 3).join(' • ')
  if (errors.length <= 3) return shown
  return `${shown} • (dan ${errors.length - 3} isian lainnya)`
}
