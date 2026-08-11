/**
 * Context page-scoped untuk halaman editor `/penyusun/sop/:id`.
 *
 * Tujuan: hilangkan props drilling untuk state header SOP (metadata, implementers,
 * pelaksana, dasar hukum, keterkaitan SOP, dll.) dan turunannya. Ruang lingkup
 * Context dibatasi per halaman (mount/unmount mengikuti rute) — bukan store global.
 *
 * Komponen di bawah `<SopEditorProvider>` boleh konsumsi via `useSopEditor()`.
 * Dialog dan komponen UI murni (open/close, tombol) tetap pakai props lokal.
 */
import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import type { Peraturan } from '@/types/dto/peraturan.dto'
import type {
  ProsedurRow,
  SOPDetailMetadata,
  SopEditorImplementer,
  SopEditorMasterPelaksana,
  SopEditorRelatedSopOption,
} from '@/types/ui/sop'
import type { SopHeaderAutosaveStatus } from '@/pages/penyusun/sop/hooks/use-sop-header-autosave'
import type { SopProsedurAutosaveStatus } from '@/pages/penyusun/sop/hooks/use-sop-prosedur-autosave'

export interface SopEditorContextValue {
  /** ID DetailSOP atau header SOP yang sedang diedit (bisa undefined sebelum siap). */
  sopDetailId: string | undefined
  /** Metadata header — source of truth UI selama editor terbuka. */
  metadata: SOPDetailMetadata
  /** Setter generik (gunakan untuk update banyak field sekaligus). */
  setMetadata: React.Dispatch<React.SetStateAction<SOPDetailMetadata>>
  /** Update satu field metadata (pengganti props drilling). */
  handleMetadataChange: <K extends keyof SOPDetailMetadata>(
    field: K,
    value: SOPDetailMetadata[K],
  ) => void
  /** Daftar pelaksana terpakai pada SOP saat ini. */
  implementers: SopEditorImplementer[]
  setImplementers: React.Dispatch<React.SetStateAction<SopEditorImplementer[]>>
  /** Opsi master pelaksana untuk dialog tambah pelaksana. */
  masterPelaksanaOptions: SopEditorMasterPelaksana[]
  /** Daftar peraturan untuk dialog dasar hukum. */
  peraturanList: Peraturan[]
  /** Opsi keterkaitan SOP (id = detailSopId terbaru per SOP). */
  relatedSopOptions: SopEditorRelatedSopOption[]
  /** Baris prosedur (langkah) yang sedang diedit di main panel. */
  prosedurRows: ProsedurRow[]
  setProsedurRows: React.Dispatch<React.SetStateAction<ProsedurRow[]>>
  /** Status autosave header (idle/pending/saving/saved/error). */
  autosaveStatus: SopHeaderAutosaveStatus
  /** Error autosave header terakhir; berubah reference per error. */
  autosaveError: Error | null
  /** Paksa flush autosave header SOP (mis. sebelum aksi besar / pindah halaman). */
  flushHeaderAutosave: () => Promise<void>
  /** Status autosave prosedur (swimlane + langkah). Disatukan di indikator UI bersama header. */
  prosedurAutosaveStatus: SopProsedurAutosaveStatus
  /** Error autosave prosedur terakhir; reference baru per error. */
  prosedurAutosaveError: Error | null
  /** Paksa flush autosave prosedur SOP. */
  flushProsedurAutosave: () => Promise<void>
  /** Dokumen hanya untuk dibaca (status tidak mengizinkan penyuntingan). */
  isReadOnly: boolean
}

const SopEditorContext = createContext<SopEditorContextValue | null>(null)

export interface SopEditorProviderProps {
  value: SopEditorContextValue
  children: ReactNode
}

export function SopEditorProvider({ value, children }: SopEditorProviderProps) {
  /* Memoize agar consumer tidak ikut re-render saat parent re-render
     selama nilai-nilai di dalamnya secara reference tidak berubah. */
  const memoized = useMemo<SopEditorContextValue>(
    () => ({
      sopDetailId: value.sopDetailId,
      metadata: value.metadata,
      setMetadata: value.setMetadata,
      handleMetadataChange: value.handleMetadataChange,
      implementers: value.implementers,
      setImplementers: value.setImplementers,
      masterPelaksanaOptions: value.masterPelaksanaOptions,
      peraturanList: value.peraturanList,
      relatedSopOptions: value.relatedSopOptions,
      prosedurRows: value.prosedurRows,
      setProsedurRows: value.setProsedurRows,
      autosaveStatus: value.autosaveStatus,
      autosaveError: value.autosaveError,
      flushHeaderAutosave: value.flushHeaderAutosave,
      prosedurAutosaveStatus: value.prosedurAutosaveStatus,
      prosedurAutosaveError: value.prosedurAutosaveError,
      flushProsedurAutosave: value.flushProsedurAutosave,
      isReadOnly: value.isReadOnly,
    }),
    [
      value.sopDetailId,
      value.metadata,
      value.setMetadata,
      value.handleMetadataChange,
      value.implementers,
      value.setImplementers,
      value.masterPelaksanaOptions,
      value.peraturanList,
      value.relatedSopOptions,
      value.prosedurRows,
      value.setProsedurRows,
      value.autosaveStatus,
      value.autosaveError,
      value.flushHeaderAutosave,
      value.prosedurAutosaveStatus,
      value.prosedurAutosaveError,
      value.flushProsedurAutosave,
      value.isReadOnly,
    ],
  )
  return (
    <SopEditorContext.Provider value={memoized}>{children}</SopEditorContext.Provider>
  )
}

export function useSopEditor(): SopEditorContextValue {
  const ctx = useContext(SopEditorContext)
  if (ctx === null) {
    throw new Error('useSopEditor harus dipanggil di dalam <SopEditorProvider>')
  }
  return ctx
}

/** Versi non-throwing untuk komponen yang dapat dipakai di luar provider (mis. halaman evaluator). */
export function useSopEditorOptional(): SopEditorContextValue | null {
  return useContext(SopEditorContext)
}
