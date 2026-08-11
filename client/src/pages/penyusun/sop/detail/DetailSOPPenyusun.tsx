import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { DetailPageLayout } from '@/components/layout/DetailPageLayout'
import { useAppRole } from '@/hooks/useAppRole'
import { useToast } from '@/hooks/useToast'
import { ROUTES } from '@/utils/constants'
import { useUmpanBalikEvaluasi } from '@/api/evaluasi'
import { getKirimUlangBlockingReason } from '@/lib/evaluasi/evaluasi-domain'
import { getKirimUlangRoleBlockingReason } from '@/lib/sop/sop-permissions'
import {
  useBuatVersiBaru,
  useDetailSopPenyusun,
  useRiwayatVersi,
} from '@/api/sop'
import { BuatVersiBaruDialog } from '@/pages/penyusun/sop/components/BuatVersiBaruDialog'
import {
  getBuatVersiDariRiwayatBlockingReason,
  getNextSopVersion,
  isTerminalVersionStatus,
} from '@/lib/sop/sop-version-domain'
import type { SopRiwayatVersiRow } from '@/types/dto/sop.dto'
import type { SopHeaderAutosaveStatus } from '@/pages/penyusun/sop/hooks/use-sop-header-autosave'
import type { SopProsedurAutosaveStatus } from '@/pages/penyusun/sop/hooks/use-sop-prosedur-autosave'
import { DetailSOPPenyusunHeader } from './components/DetailSopPenyusunHeader'
import { DetailSOPPenyusunMain } from './components/DetailSopPenyusunMain'
import { DetailSOPPenyusunSidePanel } from './components/DetailSopPenyusunSidePanel'
import { SopEditorProvider, type SopEditorContextValue } from './SopEditorContext'

type CombinedAutosaveStatus = SopHeaderAutosaveStatus

/**
 * Gabungkan dua status autosave (header + prosedur) menjadi satu indikator UI.
 * Prioritas: error > saving > pending > saved > idle.
 */
function combineAutosaveStatus(
  header: SopHeaderAutosaveStatus,
  prosedur: SopProsedurAutosaveStatus,
): CombinedAutosaveStatus {
  const order: CombinedAutosaveStatus[] = ['error', 'saving', 'pending', 'saved', 'idle']
  for (const candidate of order) {
    if (header === candidate || prosedur === candidate) return candidate
  }
  return 'idle'
}

export function DetailSOPPenyusun() {
  const { role } = useAppRole()
  const { id } = useParams({ from: '/penyusun/sop/$id' })
  const navigate = useNavigate()
  const { showToast } = useToast()

  const {
    metadata,
    setMetadata: _setMetadata,
    prosedurRows,
    setProsedurRows,
    implementers,
    setImplementers,
    activeTab,
    setActiveTab,
    isEditingSteps,
    setIsEditingSteps,
    isEditPanelCollapsed,
    setIsEditPanelCollapsed,
    rightPanelTab,
    setRightPanelTab,
    masterPelaksanaOptions,
    relatedSopOptions,
    peraturanList,
    auditLogs,
    currentSopStatus,
    currentSopStatusLabel,
    isRevisionFlow,
    primaryActionLabel,
    canKirimUlangKeEvaluator,
    handleMetadataChange,
    handleComplete,
    isKirimUlangKeEvaluatorPending,
    autosaveStatus,
    autosaveError,
    flushHeaderAutosave,
    prosedurAutosaveStatus,
    prosedurAutosaveError,
    flushProsedurAutosave,
    canEditDetail,
  } = useDetailSopPenyusun(id, undefined, undefined)

  const isReadOnly = !canEditDetail

  useEffect(() => {
    if (isReadOnly) {
      setIsEditingSteps(false)
    }
  }, [isReadOnly, setIsEditingSteps])
  /* `setMetadata` perlu di-cast karena hook mengembalikan dispatcher yang sama persis
     bentuknya dengan tipe context — alias ini hanya untuk memenuhi naming convention. */
  const setMetadata = _setMetadata

  const { data: umpanBalik, isLoading: isUmpanBalikLoading } = useUmpanBalikEvaluasi(
    id,
    Boolean(id),
  )
  const kirimUlangBlockingReason = isRevisionFlow
    ? getKirimUlangBlockingReason(umpanBalik ?? null) ??
      getKirimUlangRoleBlockingReason(role)
    : null

  const sopHeaderId = metadata.sopId
  const { data: riwayatVersi = [] } = useRiwayatVersi(sopHeaderId)
  const { mutateAsync: buatVersiBaru, isPending: isBuatVersiBaruPending } = useBuatVersiBaru()
  const [buatVersiSource, setBuatVersiSource] = useState<SopRiwayatVersiRow | null>(null)
  const currentVersionSource = riwayatVersi.find((row) => row.detailSopId === id)
  const nextVersion = getNextSopVersion(riwayatVersi)
  const buatVersiBaruBlockingReason = getBuatVersiDariRiwayatBlockingReason(currentVersionSource)
  const canBuatVersiBaru = buatVersiBaruBlockingReason === null
  const terminalSource = riwayatVersi.find((row) => isTerminalVersionStatus(row.status))
  const historyBuatVersiBlockingReason = getBuatVersiDariRiwayatBlockingReason(terminalSource)

  /* Toast error autosave sekali per error reference (hindari spam saat re-render). */
  const lastHeaderErrorRef = useRef<Error | null>(null)
  useEffect(() => {
    if (isReadOnly) return
    if (autosaveError && autosaveError !== lastHeaderErrorRef.current) {
      lastHeaderErrorRef.current = autosaveError
      showToast(`Gagal autosave header SOP: ${autosaveError.message}`, 'error')
    }
    if (autosaveError === null) {
      lastHeaderErrorRef.current = null
    }
  }, [autosaveError, showToast, isReadOnly])

  const lastProsedurErrorRef = useRef<Error | null>(null)
  useEffect(() => {
    if (isReadOnly) return
    if (prosedurAutosaveError && prosedurAutosaveError !== lastProsedurErrorRef.current) {
      lastProsedurErrorRef.current = prosedurAutosaveError
      showToast(
        `Gagal autosave langkah/aktor pelaksana: ${prosedurAutosaveError.message}`,
        'error',
      )
    }
    if (prosedurAutosaveError === null) {
      lastProsedurErrorRef.current = null
    }
  }, [prosedurAutosaveError, showToast, isReadOnly])

  /* Best-effort flush sebelum tab disembunyikan / ditutup / refresh. */
  useEffect(() => {
    if (isReadOnly) return
    const flushBothFireAndForget = (): void => {
      void flushHeaderAutosave()
      void flushProsedurAutosave()
    }
    const flushBothAwaited = (): void => {
      void Promise.all([flushHeaderAutosave(), flushProsedurAutosave()])
    }
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') {
        flushBothAwaited()
      }
    }
    window.addEventListener('beforeunload', flushBothFireAndForget)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', flushBothAwaited)
    return () => {
      window.removeEventListener('beforeunload', flushBothFireAndForget)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', flushBothAwaited)
      flushBothAwaited()
    }
  }, [flushHeaderAutosave, flushProsedurAutosave, isReadOnly])

  const editorContextValue = useMemo<SopEditorContextValue>(
    () => ({
      sopDetailId: id,
      metadata,
      setMetadata,
      handleMetadataChange,
      implementers,
      setImplementers,
      masterPelaksanaOptions,
      peraturanList,
      relatedSopOptions,
      prosedurRows,
      setProsedurRows,
      autosaveStatus,
      autosaveError,
      flushHeaderAutosave,
      prosedurAutosaveStatus,
      prosedurAutosaveError,
      flushProsedurAutosave,
      isReadOnly,
    }),
    [
      id,
      metadata,
      setMetadata,
      handleMetadataChange,
      implementers,
      setImplementers,
      masterPelaksanaOptions,
      peraturanList,
      relatedSopOptions,
      prosedurRows,
      setProsedurRows,
      autosaveStatus,
      autosaveError,
      flushHeaderAutosave,
      prosedurAutosaveStatus,
      prosedurAutosaveError,
      flushProsedurAutosave,
      isReadOnly,
    ],
  )

  /* Status gabungan header + prosedur untuk satu indikator autosave di header.
     Prioritas: error > saving > pending > saved > idle. */
  const combinedAutosaveStatus = useMemo(() => combineAutosaveStatus(autosaveStatus, prosedurAutosaveStatus), [
    autosaveStatus,
    prosedurAutosaveStatus,
  ])
  const combinedFlushAutosave = useCallback(async () => {
    await Promise.all([flushHeaderAutosave(), flushProsedurAutosave()])
  }, [flushHeaderAutosave, flushProsedurAutosave])

  return (
    <SopEditorProvider value={editorContextValue}>
      <DetailPageLayout
        breadcrumb={[
          { label: 'Manajemen SOP', to: ROUTES.PENYUSUN.SOP },
          { label: isReadOnly ? 'Lihat SOP' : 'Edit SOP' },
        ]}
        title={isReadOnly ? 'Lihat Dokumen SOP' : 'Edit Dokumen SOP'}
        description={metadata.nama ?? metadata.judul ?? ''}
        backTo={ROUTES.PENYUSUN.SOP}
        backSize="icon"
        header={
          <DetailSOPPenyusunHeader
            metadata={metadata}
            currentSopStatus={currentSopStatus}
            currentSopStatusLabel={currentSopStatusLabel}
            isRevisionFlow={isRevisionFlow}
            primaryActionLabel={primaryActionLabel}
            canShowKirimUlangAction={!isRevisionFlow || canKirimUlangKeEvaluator}
            autosaveStatus={combinedAutosaveStatus}
            onRetryAutosave={combinedFlushAutosave}
            onComplete={() => handleComplete(id, role ?? null, navigate)}
            isReadOnly={isReadOnly}
            isPrimaryActionPending={isKirimUlangKeEvaluatorPending}
            kirimUlangBlockingReason={kirimUlangBlockingReason}
            canBuatVersiBaru={canBuatVersiBaru}
            buatVersiBaruBlockingReason={
              currentSopStatus === 'BERLAKU' ? buatVersiBaruBlockingReason : null
            }
            onBuatVersiBaru={() => {
              if (currentVersionSource) setBuatVersiSource(currentVersionSource)
            }}
            isBuatVersiBaruPending={isBuatVersiBaruPending}
          />
        }
        main={
          <DetailSOPPenyusunMain
            activeTab={activeTab}
            onActiveTabChange={setActiveTab}
            isEditingSteps={isEditingSteps}
            setIsEditingSteps={setIsEditingSteps}
          />
        }
        rightPanel={
          <DetailSOPPenyusunSidePanel
            collapsed={isEditPanelCollapsed}
            onCollapsedChange={setIsEditPanelCollapsed}
            rightPanelTab={rightPanelTab}
            onTabChange={setRightPanelTab}
            auditEntries={auditLogs ?? []}
            editTabLabel={isReadOnly ? 'Informasi' : 'Edit'}
            umpanBalik={umpanBalik ?? null}
            isUmpanBalikLoading={isUmpanBalikLoading}
            isReadOnly={isReadOnly}
            detailSopId={id}
            sopId={sopHeaderId}
            onBuatVersiBaru={setBuatVersiSource}
            isBuatVersiBaruPending={isBuatVersiBaruPending}
            buatVersiBaruBlockingReason={historyBuatVersiBlockingReason}
          />
        }
      />
      <BuatVersiBaruDialog
        open={buatVersiSource !== null}
        onOpenChange={(open) => {
          if (!open) setBuatVersiSource(null)
        }}
        judulSop={metadata.nama ?? metadata.judul ?? 'SOP'}
        versiSumber={buatVersiSource?.versi ?? 0}
        statusSumber={buatVersiSource?.statusLabel ?? ''}
        versiBaru={nextVersion}
        isPending={isBuatVersiBaruPending}
        onConfirm={async () => {
          if (buatVersiSource === null) return
          const workbench = await buatVersiBaru(buatVersiSource.detailSopId)
          setBuatVersiSource(null)
          void navigate({
            to: ROUTES.PENYUSUN.DETAIL_SOP,
            params: { id: workbench.detail.id },
          })
        }}
      />
    </SopEditorProvider>
  )
}
