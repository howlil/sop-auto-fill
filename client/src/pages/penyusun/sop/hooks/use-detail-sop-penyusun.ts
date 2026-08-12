import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '@/hooks/useToast'
import { usePeraturan } from '@/api/peraturan'
import { usePenyusunWorkbench, useSop } from '@/api/sop-queries'
import {
  useBuatVersiBaru,
  usePelaksana,
  useSopStatus,
  useUpdateSopHeader,
  useUpdateSopProsedur,
} from '@/api/sop-mutations'
import {
  buildSopHeaderSnapshot,
  useSopHeaderAutosave,
  type SopHeaderAutosaveStatus,
} from '@/pages/penyusun/sop/hooks/use-sop-header-autosave'
import {
  buildSopProsedurSnapshot,
  useSopProsedurAutosave,
  type SopProsedurAutosaveStatus,
} from '@/pages/penyusun/sop/hooks/use-sop-prosedur-autosave'
import {
  transformLangkahToProsedurRow,
  transformSopDetailToMetadata,
} from '@/lib/sop/detailSop.mappers'
import type { Peraturan } from '@/types/dto/peraturan.dto'
import type { PenyusunWorkbenchLogEdit, StatusSOP } from '@/types/dto/sop.dto'
import type { ProsedurRow, SOPDetailMetadata, SopEditorImplementer } from '@/types/ui/sop'

export interface UseDetailSopPenyusunReturn {
  sopDetailId: string
  sopId: string
  workspaceId?: string
  metadata: SOPDetailMetadata
  setMetadata: React.Dispatch<React.SetStateAction<SOPDetailMetadata>>
  implementers: SopEditorImplementer[]
  setImplementers: React.Dispatch<React.SetStateAction<SopEditorImplementer[]>>
  prosedurRows: ProsedurRow[]
  setProsedurRows: React.Dispatch<React.SetStateAction<ProsedurRow[]>>
  masterPelaksanaOptions: { id: string; name: string }[]
  relatedSopOptions: { id: string; label: string }[]
  peraturanList: Peraturan[]
  auditLogs: PenyusunWorkbenchLogEdit[]
  isLoading: boolean
  loadError: Error | null
  currentSopStatus: StatusSOP
  currentSopStatusLabel: string
  isReadOnly: boolean
  canBuatVersiBaru: boolean
  autosaveStatus: SopHeaderAutosaveStatus
  autosaveError: Error | null
  flushHeaderAutosave: () => Promise<void>
  prosedurAutosaveStatus: SopProsedurAutosaveStatus
  prosedurAutosaveError: Error | null
  flushProsedurAutosave: () => Promise<void>
  transitionToDone: () => Promise<void>
  retryAutosave: () => Promise<void>
  handleBuatVersiBaru: () => Promise<void>
  isBuatVersiBaruPending: boolean
  handleMetadataChange: <K extends keyof SOPDetailMetadata>(
    field: K,
    value: SOPDetailMetadata[K],
  ) => void
}

/**
 * Adapter antara contract workspace SOP baru dan editor SOP existing.
 * State authoring tetap lokal + autosave; lifecycle hanya DRAFT/COMPLETED/ARCHIVED.
 */
export function useDetailSopPenyusun(detailOrSopId: string): UseDetailSopPenyusunReturn {
  const { showToast } = useToast()
  const workbenchQuery = usePenyusunWorkbench(detailOrSopId || undefined)
  const workbench = workbenchQuery.data
  const detail = workbench?.detail
  const resolvedDetailId = detail?.id ?? detailOrSopId
  const sopId = detail?.sopId ?? ''
  const workspaceId = detail?.sop?.workspaceId

  const { list: sopList } = useSop(workspaceId ? { workspaceId } : undefined)
  const { list: peraturanList } = usePeraturan()
  const { data: pelaksanaList = [] } = usePelaksana(workspaceId)
  const statusMutation = useSopStatus(resolvedDetailId)
  const buatVersiBaruMutation = useBuatVersiBaru(resolvedDetailId)
  const updateHeaderMutation = useUpdateSopHeader(resolvedDetailId)
  const updateProsedurMutation = useUpdateSopProsedur(resolvedDetailId)

  const [metadata, setMetadata] = useState<SOPDetailMetadata>({})
  const [implementers, setImplementers] = useState<SopEditorImplementer[]>([])
  const [prosedurRows, setProsedurRows] = useState<ProsedurRow[]>([])
  const lastSyncedDetailIdRef = useRef<string | null>(null)

  const currentSopStatus: StatusSOP = detail?.status ?? 'DRAFT'
  const currentSopStatusLabel = detail?.statusLabel ?? currentSopStatus
  const isReadOnly = currentSopStatus !== 'DRAFT'
  const canBuatVersiBaru = currentSopStatus === 'COMPLETED'

  const headerSnapshot = useMemo(() => buildSopHeaderSnapshot(metadata), [metadata])
  const headerAutosave = useSopHeaderAutosave({
    detailSopId: resolvedDetailId || undefined,
    snapshot: headerSnapshot,
    save: updateHeaderMutation.mutateAsync,
    enabled: Boolean(detail) && !isReadOnly,
  })

  const prosedurSnapshot = useMemo(
    () => buildSopProsedurSnapshot(implementers, prosedurRows),
    [implementers, prosedurRows],
  )
  const prosedurAutosave = useSopProsedurAutosave({
    detailSopId: resolvedDetailId || undefined,
    snapshot: prosedurSnapshot,
    save: updateProsedurMutation.mutateAsync,
    enabled: Boolean(detail) && !isReadOnly,
  })

  const resetHeaderBaselineRef = useRef(headerAutosave.resetBaseline)
  resetHeaderBaselineRef.current = headerAutosave.resetBaseline
  const resetProsedurBaselineRef = useRef(prosedurAutosave.resetBaseline)
  resetProsedurBaselineRef.current = prosedurAutosave.resetBaseline

  useEffect(() => {
    if (!detail || lastSyncedDetailIdRef.current === detail.id) return
    lastSyncedDetailIdRef.current = detail.id

    const nextMetadata = transformSopDetailToMetadata(detail)
    const nextRows = [...(workbench?.langkah ?? [])]
      .sort((a, b) => a.urutan - b.urutan)
      .map(transformLangkahToProsedurRow)

    const nextImplementers: SopEditorImplementer[] = []
    const seenIds = new Set<string>()
    for (const lane of [...(detail.swimlanes ?? [])].sort((a, b) => a.urutan - b.urutan)) {
      if (!lane.pelaksanaId || seenIds.has(lane.pelaksanaId)) continue
      seenIds.add(lane.pelaksanaId)
      nextImplementers.push({
        id: lane.pelaksanaId,
        name:
          lane.pelaksana?.namaPelaksana ??
          pelaksanaList.find((item) => item.id === lane.pelaksanaId)?.namaPelaksana ??
          lane.pelaksanaId,
      })
    }
    for (const row of nextRows) {
      if (!row.pelaksana || seenIds.has(row.pelaksana)) continue
      seenIds.add(row.pelaksana)
      nextImplementers.push({
        id: row.pelaksana,
        name:
          pelaksanaList.find((item) => item.id === row.pelaksana)?.namaPelaksana ?? row.pelaksana,
      })
    }

    setMetadata(nextMetadata)
    setProsedurRows(nextRows)
    setImplementers(nextImplementers)
    resetHeaderBaselineRef.current(buildSopHeaderSnapshot(nextMetadata))
    resetProsedurBaselineRef.current(buildSopProsedurSnapshot(nextImplementers, nextRows))
  }, [detail, pelaksanaList, workbench?.langkah])

  const masterPelaksanaOptions = useMemo(
    () => pelaksanaList.map((item) => ({ id: item.id, name: item.namaPelaksana })),
    [pelaksanaList],
  )

  const relatedSopOptions = useMemo(
    () =>
      sopList
        .filter((item) => item.detailSopId && item.id !== sopId)
        .map((item) => ({ id: item.detailSopId as string, label: item.judul })),
    [sopList, sopId],
  )

  const flushAll = useCallback(async () => {
    await Promise.all([headerAutosave.flush(), prosedurAutosave.flush()])
  }, [headerAutosave.flush, prosedurAutosave.flush])

  const transitionToDone = useCallback(async () => {
    if (!resolvedDetailId || currentSopStatus !== 'DRAFT') return
    await flushAll()
    await statusMutation.mutateAsync('COMPLETED')
  }, [currentSopStatus, flushAll, resolvedDetailId, statusMutation])

  const retryAutosave = useCallback(async () => {
    await flushAll()
  }, [flushAll])

  const handleBuatVersiBaru = useCallback(async () => {
    if (!resolvedDetailId || !workspaceId || !canBuatVersiBaru) return
    const nextWorkbench = await buatVersiBaruMutation.mutateAsync()
    const nextDetailId = nextWorkbench.detail.id
    showToast('Versi baru berhasil dibuat', 'success')
    window.location.assign(`/workspaces/${workspaceId}/sops/${nextDetailId}`)
  }, [buatVersiBaruMutation, canBuatVersiBaru, resolvedDetailId, showToast, workspaceId])

  const handleMetadataChange = useCallback(
    <K extends keyof SOPDetailMetadata>(field: K, value: SOPDetailMetadata[K]) => {
      setMetadata((previous) => ({ ...previous, [field]: value }))
    },
    [],
  )

  return {
    sopDetailId: resolvedDetailId,
    sopId,
    workspaceId,
    metadata,
    setMetadata,
    implementers,
    setImplementers,
    prosedurRows,
    setProsedurRows,
    masterPelaksanaOptions,
    relatedSopOptions,
    peraturanList,
    auditLogs: workbench?.logEdit ?? [],
    isLoading: workbenchQuery.isLoading,
    loadError: workbenchQuery.error instanceof Error ? workbenchQuery.error : null,
    currentSopStatus,
    currentSopStatusLabel,
    isReadOnly,
    canBuatVersiBaru,
    autosaveStatus: headerAutosave.status,
    autosaveError: headerAutosave.lastError,
    flushHeaderAutosave: headerAutosave.flush,
    prosedurAutosaveStatus: prosedurAutosave.status,
    prosedurAutosaveError: prosedurAutosave.lastError,
    flushProsedurAutosave: prosedurAutosave.flush,
    transitionToDone,
    retryAutosave,
    handleBuatVersiBaru,
    isBuatVersiBaruPending: buatVersiBaruMutation.isPending,
    handleMetadataChange,
  }
}

export type UseDetailSopPenyusunDataResult = UseDetailSopPenyusunReturn
export const useDetailSopPenyusunData = useDetailSopPenyusun
