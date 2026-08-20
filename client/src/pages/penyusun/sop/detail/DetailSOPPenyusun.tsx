import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { AlertTriangle, ArrowLeft, RefreshCcw } from 'lucide-react'
import { DetailSOPPenyusunHeader } from './components/DetailSopPenyusunHeader'
import { DetailSOPPenyusunMain } from './components/DetailSopPenyusunMain'
import {
  DetailSOPPenyusunSidePanel,
  type DetailSopSidePanelTabId,
} from './components/DetailSopPenyusunSidePanel'
import { Button } from '@/components/ui/button'
import { showErrorMessages } from '@/hooks/useToast'
import { useDetailSopPenyusun } from '@/api/sop'
import { SopEditorProvider, type SopEditorContextValue } from './SopEditorContext'
import { applyAiRevisionToEditor } from './ai-sop-revision-apply'
import { useAiSopQualityReview } from '@/pages/penyusun/sop/hooks/use-ai-sop-quality-review'
import { useAiSopRevision } from '@/pages/penyusun/sop/hooks/use-ai-sop-revision'
import type { SopHeaderAutosaveStatus } from '@/pages/penyusun/sop/hooks/use-sop-header-autosave'
import type { SopQualityFinding } from '@/api/workspace-sops'

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
  const [activeTab, setActiveTab] = useState<'flowchart' | 'bpmn'>('flowchart')
  const [isEditingSteps, setIsEditingSteps] = useState(false)
  const [sidePanelTab, setSidePanelTab] = useState<DetailSopSidePanelTabId>('edit')

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
    flushAllAutosave,
    transitionToDone,
    retryAutosave,
    handleBuatVersiBaru,
    isBuatVersiBaruPending,
    handleMetadataChange,
  } = editor

  const combinedAutosaveStatus = combineAutosaveStatus(autosaveStatus, prosedurAutosaveStatus)
  const combinedAutosaveError = autosaveError ?? prosedurAutosaveError
  const contentFingerprint = useMemo(
    () => JSON.stringify({ metadata, implementers, prosedurRows }),
    [metadata, implementers, prosedurRows],
  )
  const aiReview = useAiSopQualityReview({
    detailSopId: sopDetailId,
    isReadOnly,
    flushAllAutosave,
    contentFingerprint,
  })
  const reviewFingerprint = useMemo(
    () => (aiReview.review ? JSON.stringify(aiReview.review.result) : null),
    [aiReview.review],
  )
  const aiRevision = useAiSopRevision({
    detailSopId: sopDetailId,
    isReadOnly,
    flushAllAutosave,
    contentFingerprint,
    reviewFingerprint,
  })

  const latestEditorStateRef = useRef({ metadata, prosedurRows })
  latestEditorStateRef.current = { metadata, prosedurRows }
  const latestRevisionProposalRef = useRef(aiRevision.proposal)
  latestRevisionProposalRef.current = aiRevision.proposal
  const latestDetailSopIdRef = useRef(sopDetailId)
  latestDetailSopIdRef.current = sopDetailId

  useEffect(() => {
    if (combinedAutosaveError) {
      showErrorMessages(combinedAutosaveError, 'Gagal menyimpan perubahan otomatis')
    }
  }, [combinedAutosaveError])

  const handleSelectAiFinding = useCallback((finding: SopQualityFinding) => {
    if (finding.location.kind !== 'STEP') {
      setSidePanelTab('edit')
      return
    }

    const stepOrder = finding.location.stepOrder
    setIsEditingSteps(true)
    window.requestAnimationFrame(() => {
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>(`[data-sop-step-order="${stepOrder}"]`),
      )
      const target = candidates.find((element) => element.getClientRects().length > 0) ?? candidates[0]
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      target?.querySelector<HTMLElement>('input, textarea, button, [tabindex]')?.focus()
    })
  }, [])

  const handleApplyAiRevision = useCallback(() => {
    const proposal = latestRevisionProposalRef.current
    const currentDetailSopId = latestDetailSopIdRef.current
    if (!proposal) return
    if (proposal.sourceDetailSopId !== currentDetailSopId) {
      aiRevision.clear()
      showErrorMessages(
        new Error('Usulan AI sudah tidak berlaku untuk SOP yang sedang dibuka.'),
        'Usulan AI tidak dapat diterapkan',
      )
      return
    }

    const currentEditorState = latestEditorStateRef.current
    const applied = applyAiRevisionToEditor(currentEditorState, proposal.suggestion)
    if (!applied.ok) {
      aiRevision.clear()
      showErrorMessages(
        new Error('Bagian SOP berubah setelah usulan dibuat. Minta usulan AI ulang.'),
        'Usulan AI tidak dapat diterapkan',
      )
      return
    }

    setMetadata(applied.metadata)
    setProsedurRows(applied.prosedurRows)
    aiRevision.clear()
    aiReview.clearReview()
  }, [aiRevision.clear, aiReview.clearReview, setMetadata, setProsedurRows])

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
              <DetailSOPPenyusunHeader
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
          <DetailSOPPenyusunMain
            activeTab={activeTab}
            onActiveTabChange={setActiveTab}
            isEditingSteps={isEditingSteps}
            setIsEditingSteps={setIsEditingSteps}
          />
          {resolvedWorkspaceId && sopId ? (
            <DetailSOPPenyusunSidePanel
              workspaceId={resolvedWorkspaceId}
              detailSopId={sopDetailId}
              sopId={sopId}
              activeTab={sidePanelTab}
              onActiveTabChange={setSidePanelTab}
              aiReviewPanelProps={{
                isAvailable: aiReview.isAvailable,
                isAvailabilityLoading: aiReview.isAvailabilityLoading,
                isRunning: aiReview.isRunning,
                review: aiReview.review,
                error: aiReview.error,
                onRunReview: aiReview.runReview,
                onSelectFinding: handleSelectAiFinding,
                aiRevision: {
                  isAvailable: aiRevision.isAvailable,
                  isAvailabilityLoading: aiRevision.isAvailabilityLoading,
                  isRunning: aiRevision.isRunning,
                  proposal: aiRevision.proposal,
                  error: aiRevision.error,
                  onSuggest: aiRevision.suggest,
                  onCancel: aiRevision.cancel,
                  onApply: handleApplyAiRevision,
                },
              }}
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
