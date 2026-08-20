import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { UpdateSopHeaderDto } from '@/types/dto/sop.dto'
import type { SOPDetailMetadata } from '@/types/ui/sop'

const DEFAULT_DEBOUNCE_MS = 800
const SAVED_INDICATOR_MS = 1500

/**
 * Snapshot ringkas metadata header yang dilacak autosave. Menjaga kontrak diff
 * agar tidak mengirim PATCH untuk perubahan yang tidak relevan dengan header SOP.
 */
export interface SopHeaderSnapshot {
  judul: string
  nomorSOP: string
  namaLembaga: string
  peringatan: string[]
  dasarHukumPeraturanIds: string[]
  sopTerkaitDetailIds: string[]
  kualifikasiPelaksanaan: string[]
  peralatanPerlengkapan: string[]
  pencatatanPendataan: string[]
}

function asArray(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value.map((v) => v.trim()).filter((v) => v.length > 0)
  if (typeof value === 'string' && value.trim().length > 0) return [value.trim()]
  return []
}

/**
 * Pisahkan `metadata` UI menjadi snapshot ringkas yang akan dibandingkan untuk diff.
 * Multi-baris `lembaga` digabung dari `institutionLines` jika tersedia.
 */
export function buildSopHeaderSnapshot(metadata: SOPDetailMetadata): SopHeaderSnapshot {
  const lembagaFromLines = (metadata.institutionLines ?? [])
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join('\n')
  const lembaga =
    lembagaFromLines.length > 0 ? lembagaFromLines : (metadata.lembaga ?? '').trim()
  return {
    judul: (metadata.judul ?? metadata.nama ?? '').trim(),
    nomorSOP: (metadata.nomorSOP ?? metadata.nomor ?? '').trim(),
    namaLembaga: lembaga,
    peringatan: asArray(metadata.warning),
    dasarHukumPeraturanIds: [...(metadata.lawBasisIds ?? [])],
    sopTerkaitDetailIds: [...(metadata.relatedSopDetailIds ?? [])],
    kualifikasiPelaksanaan: asArray(metadata.implementQualification),
    peralatanPerlengkapan: asArray(metadata.equipment),
    pencatatanPendataan: asArray(metadata.recordData),
  }
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

/**
 * Hitung diff antara snapshot terbaru dengan baseline tersimpan.
 * Field yang tidak berubah tidak dimasukkan ke payload sehingga PATCH minimal.
 */
export function diffSopHeaderSnapshots(
  current: SopHeaderSnapshot,
  baseline: SopHeaderSnapshot,
): UpdateSopHeaderDto {
  const dto: UpdateSopHeaderDto = {}
  if (current.judul !== baseline.judul) dto.judul = current.judul
  if (current.nomorSOP !== baseline.nomorSOP) dto.nomorSOP = current.nomorSOP
  if (current.namaLembaga !== baseline.namaLembaga) dto.namaLembaga = current.namaLembaga
  if (!arraysEqual(current.peringatan, baseline.peringatan)) {
    dto.lampiran = { ...(dto.lampiran ?? {}), peringatan: current.peringatan }
  }
  if (!arraysEqual(current.dasarHukumPeraturanIds, baseline.dasarHukumPeraturanIds)) {
    dto.dasarHukumPeraturanIds = current.dasarHukumPeraturanIds
  }
  if (!arraysEqual(current.sopTerkaitDetailIds, baseline.sopTerkaitDetailIds)) {
    dto.sopTerkaitDetailIds = current.sopTerkaitDetailIds
  }
  if (!arraysEqual(current.kualifikasiPelaksanaan, baseline.kualifikasiPelaksanaan)) {
    dto.lampiran = { ...(dto.lampiran ?? {}), kualifikasiPelaksanaan: current.kualifikasiPelaksanaan }
  }
  if (!arraysEqual(current.peralatanPerlengkapan, baseline.peralatanPerlengkapan)) {
    dto.lampiran = { ...(dto.lampiran ?? {}), peralatanPerlengkapan: current.peralatanPerlengkapan }
  }
  if (!arraysEqual(current.pencatatanPendataan, baseline.pencatatanPendataan)) {
    dto.lampiran = { ...(dto.lampiran ?? {}), pencatatanPendataan: current.pencatatanPendataan }
  }
  return dto
}

function hasAnyKey(dto: UpdateSopHeaderDto): boolean {
  return Object.keys(dto).length > 0
}

/** Status autosave yang dapat ditampilkan ke user. */
export type SopHeaderAutosaveStatus =
  | 'idle'
  | 'pending'
  | 'saving'
  | 'saved'
  | 'error'

export interface UseSopHeaderAutosaveOptions {
  /** ID DetailSOP atau header SOP — autosave dimatikan jika kosong / `enabled=false`. */
  detailSopId: string | undefined
  /** Snapshot metadata terbaru hasil `buildSopHeaderSnapshot`. */
  snapshot: SopHeaderSnapshot
  /** Mutator untuk menyimpan perubahan; harus mengembalikan promise (mis. `mutateAsync`). */
  save: (payload: UpdateSopHeaderDto) => Promise<unknown>
  /** Boleh dimatikan saat data awal belum siap. Default `true`. */
  enabled?: boolean
  /** Override durasi debounce, default 800ms. */
  debounceMs?: number
}

export interface SopHeaderAutosaveControls {
  /** Paksa kirim diff sekarang. True berarti latest snapshot sudah tersimpan atau tidak ada diff. */
  flush: () => Promise<boolean>
  /** Setel ulang baseline tanpa kirim PATCH (mis. setelah workbench dimuat ulang dari server). */
  resetBaseline: (next: SopHeaderSnapshot) => void
  /** Status autosave saat ini (untuk indikator UI). */
  status: SopHeaderAutosaveStatus
  /** Error terakhir (jika `status === 'error'`). Reference baru per error agar consumer bisa toast sekali. */
  lastError: Error | null
}

/**
 * Autosave debounced untuk PATCH header SOP. Strategi:
 * 1. Setiap perubahan `snapshot` dijadwalkan menjadi PATCH setelah `debounceMs` idle.
 * 2. Hanya field yang berubah dari `baseline` yang dikirim (diff minimal).
 * 3. PATCH yang sedang berjalan di-cancel/di-overwrite dengan diff terbaru saat user lanjut mengetik.
 * 4. `flush()` memaksa pengiriman synchronous untuk dipanggil sebelum aksi besar (selesai/save draft).
 * 5. Status (`idle | pending | saving | saved | error`) di-expose untuk indikator UI.
 */
export function useSopHeaderAutosave(
  options: UseSopHeaderAutosaveOptions,
): SopHeaderAutosaveControls {
  const { detailSopId, snapshot, save, enabled = true, debounceMs = DEFAULT_DEBOUNCE_MS } = options
  const baselineRef = useRef<SopHeaderSnapshot>(snapshot)
  const latestSnapshotRef = useRef<SopHeaderSnapshot>(snapshot)
  const timerRef = useRef<number | null>(null)
  const savedTimerRef = useRef<number | null>(null)
  const inFlightRef = useRef<Promise<boolean> | null>(null)
  const saveRef = useRef(save)
  saveRef.current = save

  const [status, setStatus] = useState<SopHeaderAutosaveStatus>('idle')
  const [lastError, setLastError] = useState<Error | null>(null)

  const clearSavedTimer = useCallback(() => {
    if (savedTimerRef.current !== null) {
      window.clearTimeout(savedTimerRef.current)
      savedTimerRef.current = null
    }
  }, [])

  const scheduleSavedFlash = useCallback(() => {
    clearSavedTimer()
    savedTimerRef.current = window.setTimeout(() => {
      savedTimerRef.current = null
      setStatus((prev) => (prev === 'saved' ? 'idle' : prev))
    }, SAVED_INDICATOR_MS)
  }, [clearSavedTimer])

  const performSave = useCallback(async (): Promise<boolean> => {
    if (!enabled || !detailSopId) return true
    const diff = diffSopHeaderSnapshots(latestSnapshotRef.current, baselineRef.current)
    if (!hasAnyKey(diff)) return true
    const targetSnapshot = latestSnapshotRef.current
    clearSavedTimer()
    setStatus('saving')
    const promise = saveRef
      .current(diff)
      .then(() => {
        baselineRef.current = targetSnapshot
        setLastError(null)
        setStatus('saved')
        scheduleSavedFlash()
        return true
      })
      .catch((err: unknown) => {
        const error = err instanceof Error ? err : new Error(String(err))
        setLastError(error)
        setStatus('error')
        return false
      })
      .finally(() => {
        if (inFlightRef.current === promise) {
          inFlightRef.current = null
        }
      })
    inFlightRef.current = promise
    return promise
  }, [clearSavedTimer, detailSopId, enabled, scheduleSavedFlash])

  const cancelTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const flush = useCallback(async (): Promise<boolean> => {
    cancelTimer()
    if (inFlightRef.current) {
      const inFlightSucceeded = await inFlightRef.current
      if (!inFlightSucceeded) return false
    }
    return performSave()
  }, [cancelTimer, performSave])

  const resetBaseline = useCallback(
    (next: SopHeaderSnapshot) => {
      cancelTimer()
      baselineRef.current = next
      latestSnapshotRef.current = next
      clearSavedTimer()
      setStatus('idle')
      setLastError(null)
    },
    [cancelTimer, clearSavedTimer],
  )

  useEffect(() => {
    latestSnapshotRef.current = snapshot
    if (!enabled || !detailSopId) return
    const diff = diffSopHeaderSnapshots(snapshot, baselineRef.current)
    if (!hasAnyKey(diff)) {
      setStatus((prev) => (prev === 'pending' ? 'idle' : prev))
      return
    }
    cancelTimer()
    setStatus((prev) => (prev === 'saving' ? prev : 'pending'))
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      void performSave()
    }, debounceMs)
    return () => {
      cancelTimer()
    }
  }, [snapshot, enabled, detailSopId, debounceMs, cancelTimer, performSave])

  useEffect(() => {
    return () => {
      cancelTimer()
      clearSavedTimer()
    }
  }, [cancelTimer, clearSavedTimer])

  return useMemo(
    () => ({ flush, resetBaseline, status, lastError }),
    [flush, resetBaseline, status, lastError],
  )
}
