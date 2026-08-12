import { useEffect, useMemo, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { AlertTriangle, ArrowLeft, RefreshCcw } from 'lucide-react'
import { DetailSopPenyusunHeader } from './components/DetailSopPenyusunHeader'
import { DetailSopPenyusunMain } from './components/DetailSopPenyusunMain'
import { DetailSopPenyusunSidePanel } from './components/DetailSopPenyusunSidePanel'
import { Button } from '@/components/ui/button'
import { showErrorMessages, useToast } from '@/hooks/useToast'
import { useDetailSopPenyusun } from '@/api/sop'
import { useWorkspaceDraft } from '@/stores/workspaceDraftStore'
import { SopEditorProvider, type SopEditorContextValue } from './SopEditorContext'
import type { SopHeaderAutosaveStatus } from '@/pages/penyusun/sop/hooks/use-sop-header-autosave'

const AUTOSAVE_RANK: Record<SopHeaderAutosaveStatus, number> = {
  idle: 0,
  saved: 1,
  pending: 2,
  saving: 3,
  error: 4,
}

function combineAutosaveStatus(
  header: SopHeaderAutosaveStatus,
  prosedur: SopHeaderAutosaveStatus,
): SopHeaderAutosaveStatus {
  return AUTOSAVE_RANK[header] >= AUTOSAVE_RANK[prosedur] ? header : prosedur
}

export function DetailSOPPenyusun() {
  const params = useParams({ strict: false }) as { workspaceId?: string; sopId?: string; id?: string }
  const routeWorkspaceId = params.workspaceId
  const id = params.sopId ?? params.id ?? ''
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState<'flowchart' | 'bpmn'>('flowchart')
  const [isEditingSteps, setIsEditingSteps] = useState(false)
  const { steps: workspaceSteps, setSteps: setWorkspaceSteps } = useWorkspaceDraft()

  const editor = useDetailSopPenyusun(id)
  const {
    sopDetailId,
    workspaceId,
    sopId,
    auditLogs,
    isLoading,
    loadError,
    currentSopStatus,
    currentSopStatusLabel,
    metadata,
    setMetadata,
    implementers,
    setImplementers,
    prosedurRows,
    setProsedurRows,
    masterPelaksanaOptions,
    peraturanList,
    relatedSopOptions,
    isReadOnly,
    canBuatVersiBaru,
    autosaveStatus,
    autosaveError,
    flushHeaderAutosave,
    prosedurAutosaveStatus,
    prosedurAutosaveError,
    flushProsedurAutosave,
    transitionToDone,
    retryAutosave,
    handleBuatVersiBaru,
    isBuatVersiBaruPending,
    handleMetadataChange,
  } = editor

  const combinedAutosaveStatus = combineAutosaveStatus(autosaveStatus, prosedurAutosaveStatus)
  const combinedAutosaveError = autosaveError ?? prosedurAutosaveError

  useEffect(() => {
    if (combinedAutosaveError) {
      showErrorMessages(combinedAutosaveError, 'Gagal menyimpan perubahan otomatis')
    }
  }, [combinedAutosaveError, showToast])

  useEffect(() => {
    if (prosedurRows.length > 0 && workspaceSteps.length === 0) {
      setWorkspaceSteps(prosedurRows)
    }
  }, [prosedurRows, workspaceSteps.length, setWorkspaceSteps])

  const contextValue = useMemo<SopEditorContextValue>(
    () => ({
      sopDetailId,
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
      sopDetailId,
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

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-subtle p-6">
        <div className="max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-red-600" />
          <h2 className="text-lg font-semibold text-red-900">SOP tidak dapat dimuat</h2>
          <p className="mt-2 text-sm text-red-800">{loadError.message}</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Muat ulang
          </Button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-subtle">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const resolvedWorkspaceId = workspaceId ?? routeWorkspaceId ?? ''
  const backHref = resolvedWorkspaceId ? `/workspaces/${resolvedWorkspaceId}` : '/workspaces'

  return (
    <SopEditorProvider value={contextValue}>
      <main className="flex min-h-screen flex-col bg-surface-subtle">
        <header className="shrink-0 border-b border-border bg-background px-4 py-3">
          <div className="mx-auto flex max-w-[1800px] items-start gap-3">
            <a href={backHref} className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted">
              <ArrowLeft className="h-4 w-4" />
            </a>
            <div className="min-w-0 flex-1">
              <DetailSopPenyusunHeader
                metadata={metadata}
                currentSopStatus={currentSopStatus}
                currentSopStatusLabel={currentSopStatusLabel}
                autosaveStatus={combinedAutosaveStatus}
                onRetryAutosave={retryAutosave}
                onComplete={() => void transitionToDone()}
                isReadOnly={isReadOnly}
                canBuatVersiBaru={canBuatVersiBaru}
                onBuatVersiBaru={() => void handleBuatVersiBaru()}
                isBuatVersiBaruPending={isBuatVersiBaruPending}
              />
            </div>
          </div>
        </header>

        <div className="mx-auto flex min-h-0 w-full max-w-[1800px] flex-1 gap-0 overflow-hidden">
          <DetailSopPenyusunMain
            activeTab={activeTab}
            onActiveTabChange={setActiveTab}
            isEditingSteps={isEditingSteps}
            setIsEditingSteps={setIsEditingSteps}
          />
          {resolvedWorkspaceId && sopId ? (
            <DetailSopPenyusunSidePanel
              workspaceId={resolvedWorkspaceId}
              detailSopId={sopDetailId}
              sopId={sopId}
              auditEntries={auditLogs}
              isReadOnly={isReadOnly}
              onBuatVersiBaru={() => void handleBuatVersiBaru()}
              isBuatVersiBaruPending={isBuatVersiBaruPending}
            />
          ) : null}
        </div>
      </main>
    </SopEditorProvider>
  )
}
