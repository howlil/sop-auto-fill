/**
 * Context page-scoped untuk halaman editor `/penyusun/sop/:id`.
 *
 * Tujuan: hilangkan props drilling untuk state header SOP (metadata, implementers,
 * pelaksana, dasar hukum, keterkaitan SOP, dll.) dan turunannya. Ruang lingkup
 * Context dibatasi per halaman (mount/unmount mengikuti rute) — bukan store global.
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
  sopDetailId: string | undefined
  metadata: SOPDetailMetadata
  setMetadata: React.Dispatch<React.SetStateAction<SOPDetailMetadata>>
  handleMetadataChange: <K extends keyof SOPDetailMetadata>(
    field: K,
    value: SOPDetailMetadata[K],
  ) => void
  implementers: SopEditorImplementer[]
  setImplementers: React.Dispatch<React.SetStateAction<SopEditorImplementer[]>>
  masterPelaksanaOptions: SopEditorMasterPelaksana[]
  peraturanList: Peraturan[]
  relatedSopOptions: SopEditorRelatedSopOption[]
  prosedurRows: ProsedurRow[]
  setProsedurRows: React.Dispatch<React.SetStateAction<ProsedurRow[]>>
  autosaveStatus: SopHeaderAutosaveStatus
  autosaveError: Error | null
  flushHeaderAutosave: () => Promise<boolean>
  prosedurAutosaveStatus: SopProsedurAutosaveStatus
  prosedurAutosaveError: Error | null
  flushProsedurAutosave: () => Promise<boolean>
  isReadOnly: boolean
}

const SopEditorContext = createContext<SopEditorContextValue | null>(null)

export interface SopEditorProviderProps {
  value: SopEditorContextValue
  children: ReactNode
}

export function SopEditorProvider({ value, children }: SopEditorProviderProps) {
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

export function useSopEditorOptional(): SopEditorContextValue | null {
  return useContext(SopEditorContext)
}
