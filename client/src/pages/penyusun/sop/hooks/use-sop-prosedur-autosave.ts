import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  JenisLangkahProsedur,
  LangkahPatchItem,
  PelaksanaPatchItem,
  SatuanWaktu,
  UpdateSopProsedurDto,
} from '@/types/dto/sop.dto'
import type { ProsedurRow, SopEditorImplementer } from '@/types/ui/sop'
import { resolveProsedurPelaksanaId } from '@/lib/sop/resolve-prosedur-implementer'

const DEFAULT_DEBOUNCE_MS = 800
const SAVED_INDICATOR_MS = 1500

/* Mapping UI row.type -> API JenisLangkahProsedur. Sejajar dengan
   `ROW_TYPE_TO_API_JENIS` di detailSop.mappers.ts agar perilaku konsisten. */
const ROW_TYPE_TO_JENIS: Record<NonNullable<ProsedurRow['type']>, JenisLangkahProsedur> = {
  task: 'KEGIATAN',
  decision: 'KEPUTUSAN',
  terminator: 'AWAL_AKHIR',
}

const SATUAN_ALIASES: Record<string, SatuanWaktu> = {
  m: 'm',
  h: 'h',
  d: 'd',
  w: 'w',
  mo: 'mo',
  y: 'y',
  menit: 'm',
  jam: 'h',
  hari: 'd',
  minggu: 'w',
  bulan: 'mo',
  tahun: 'y',
  Menit: 'm',
  Jam: 'h',
  Hari: 'd',
  Minggu: 'w',
  Bulan: 'mo',
  Tahun: 'y',
}

function normalizeSatuan(input: string | undefined): SatuanWaktu | undefined {
  if (input === undefined || input === '') return undefined
  return SATUAN_ALIASES[input]
}

export function pickNonEmptyTrimmed(
  ...candidates: (string | undefined | null)[]
): string | undefined {
  for (const c of candidates) {
    const t = (c ?? '').trim()
    if (t.length > 0) return t
  }
  return undefined
}

function parseMutuWaktuFallback(
  mutuWaktu: string | undefined,
): { waktu?: number; satuanWaktu?: SatuanWaktu } {
  const raw = (mutuWaktu ?? '').trim()
  if (raw.length === 0) return {}
  const match = raw.match(/^(\d+)\s*([A-Za-z]+)?$/)
  if (!match) return {}
  const parsed = Number.parseInt(match[1], 10)
  if (!Number.isFinite(parsed)) return {}
  const satuan = normalizeSatuan(match[2])
  return {
    waktu: Math.max(0, parsed),
    satuanWaktu: satuan ?? 'm',
  }
}

export interface SopProsedurSnapshot {
  pelaksana: PelaksanaPatchItem[]
  langkah: LangkahPatchItem[]
}

export function buildSopProsedurSnapshot(
  implementers: SopEditorImplementer[],
  rows: ProsedurRow[],
): SopProsedurSnapshot {
  const pelaksana: PelaksanaPatchItem[] = implementers
    .filter((p) => p.id.length > 0)
    .map((p) => ({ pelaksanaId: p.id }))

  const langkah: LangkahPatchItem[] = rows
    .map((row) => mapRowToLangkah(row))
    .filter((item): item is LangkahPatchItem => item !== null)

  return { pelaksana, langkah }
}

function mapRowToLangkah(row: ProsedurRow): LangkahPatchItem | null {
  const kegiatan = (row.kegiatan ?? '').trim()
  const pelaksanaId = resolveProsedurPelaksanaId(row)
  if (kegiatan.length === 0 && pelaksanaId.length === 0) return null

  const jenis: JenisLangkahProsedur = row.type
    ? (ROW_TYPE_TO_JENIS[row.type] ?? 'KEGIATAN')
    : 'KEGIATAN'
  const isKeputusan = jenis === 'KEPUTUSAN'

  const waktuRaw = row.waktu ?? row.time
  const waktuFromField =
    typeof waktuRaw === 'number' && Number.isFinite(waktuRaw)
      ? Math.max(0, waktuRaw)
      : undefined
  const satuanRaw = row.satuanWaktu ?? row.time_unit
  const satuanFromField = normalizeSatuan(satuanRaw)
  const waktuFallback = parseMutuWaktuFallback(row.mutu_waktu)
  const waktu = waktuFromField ?? waktuFallback.waktu
  const satuanWaktu = satuanFromField ?? waktuFallback.satuanWaktu

  return {
    tempId: row.id,
    jenis,
    kegiatan,
    kelengkapan: pickNonEmptyTrimmed(row.mutu_kelengkapan, row.kelengkapan),
    keluaran: pickNonEmptyTrimmed(row.output, row.keluaran),
    waktu,
    satuanWaktu,
    keterangan: (row.keterangan ?? '').trim() || undefined,
    pelaksanaId: pelaksanaId.length > 0 ? pelaksanaId : undefined,
    langkahSelanjutnyaYaTempId: isKeputusan
      ? (row.id_next_step_if_yes ?? null) || null
      : null,
    langkahSelanjutnyaTidakTempId: isKeputusan
      ? (row.id_next_step_if_no ?? null) || null
      : null,
  }
}

function pelaksanaListEqual(a: PelaksanaPatchItem[], b: PelaksanaPatchItem[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].pelaksanaId !== b[i].pelaksanaId) return false
  }
  return true
}

function langkahItemEqual(a: LangkahPatchItem, b: LangkahPatchItem): boolean {
  return (
    a.tempId === b.tempId &&
    a.jenis === b.jenis &&
    a.kegiatan === b.kegiatan &&
    (a.kelengkapan ?? '') === (b.kelengkapan ?? '') &&
    (a.keluaran ?? '') === (b.keluaran ?? '') &&
    (a.waktu ?? null) === (b.waktu ?? null) &&
    (a.satuanWaktu ?? null) === (b.satuanWaktu ?? null) &&
    (a.keterangan ?? '') === (b.keterangan ?? '') &&
    (a.pelaksanaId ?? null) === (b.pelaksanaId ?? null) &&
    (a.langkahSelanjutnyaYaTempId ?? null) === (b.langkahSelanjutnyaYaTempId ?? null) &&
    (a.langkahSelanjutnyaTidakTempId ?? null) === (b.langkahSelanjutnyaTidakTempId ?? null)
  )
}

function langkahListEqual(a: LangkahPatchItem[], b: LangkahPatchItem[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (!langkahItemEqual(a[i], b[i])) return false
  }
  return true
}

export function diffSopProsedurSnapshots(
  current: SopProsedurSnapshot,
  baseline: SopProsedurSnapshot,
): UpdateSopProsedurDto {
  const dto: UpdateSopProsedurDto = {}
  if (!pelaksanaListEqual(current.pelaksana, baseline.pelaksana)) dto.pelaksana = current.pelaksana
  if (!langkahListEqual(current.langkah, baseline.langkah)) dto.langkah = current.langkah
  return dto
}

function hasAnyKey(dto: UpdateSopProsedurDto): boolean {
  return dto.pelaksana !== undefined || dto.langkah !== undefined
}

export type SopProsedurAutosaveStatus =
  | 'idle'
  | 'pending'
  | 'saving'
  | 'saved'
  | 'error'

export interface UseSopProsedurAutosaveOptions {
  detailSopId: string | undefined
  snapshot: SopProsedurSnapshot
  save: (payload: UpdateSopProsedurDto) => Promise<unknown>
  enabled?: boolean
  debounceMs?: number
}

export interface SopProsedurAutosaveControls {
  /** True berarti latest snapshot sudah tersimpan atau tidak ada diff. */
  flush: () => Promise<boolean>
  resetBaseline: (next: SopProsedurSnapshot) => void
  status: SopProsedurAutosaveStatus
  lastError: Error | null
}

export function useSopProsedurAutosave(
  options: UseSopProsedurAutosaveOptions,
): SopProsedurAutosaveControls {
  const {
    detailSopId,
    snapshot,
    save,
    enabled = true,
    debounceMs = DEFAULT_DEBOUNCE_MS,
  } = options
  const baselineRef = useRef<SopProsedurSnapshot>(snapshot)
  const latestSnapshotRef = useRef<SopProsedurSnapshot>(snapshot)
  const timerRef = useRef<number | null>(null)
  const savedTimerRef = useRef<number | null>(null)
  const inFlightRef = useRef<Promise<boolean> | null>(null)
  const saveRef = useRef(save)
  saveRef.current = save

  const [status, setStatus] = useState<SopProsedurAutosaveStatus>('idle')
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
    const diff = diffSopProsedurSnapshots(latestSnapshotRef.current, baselineRef.current)
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
        if (inFlightRef.current === promise) inFlightRef.current = null
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
    (next: SopProsedurSnapshot) => {
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
    const diff = diffSopProsedurSnapshots(snapshot, baselineRef.current)
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
