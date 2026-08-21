import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { AlertTriangle, ArrowLeft, RefreshCcw } from 'lucide-react'
import { DetailSOPPenyusunHeader } from './components/DetailSopPenyusunHeader'
import { DetailSOPPenyusunMain } from './components/DetailSopPenyusunMain'
import {
  SopEditorSectionNav,
  type SopEditorSection,
  type SopSectionProgress,
} from './components/SopEditorSectionNav'
import { SopBasicInfoSection } from './components/SopBasicInfoSection'
import { SopActorsSection } from './components/SopActorsSection'
import { SopSupportingInfoSection } from './components/SopSupportingInfoSection'
import { SopReviewSection } from './components/SopReviewSection'
import { DetailSOPProsedurEditor } from './components/DetailSopProsedurEditor'
import { Button } from '@/components/ui/button'
import { showErrorMessages } from '@/hooks/useToast'
import { useDetailSopPenyusun } from '@/api/sop'
import { SopEditorProvider, type SopEditorContextValue } from './SopEditorContext'
import { applyAiRevisionToEditor } from './ai-sop-revision-apply'
import { useAiSopQualityReview } from '@/pages/penyusun/sop/hooks/use-ai-sop-quality-review'
import { useAiSopRevision } from '@/pages/penyusun/sop/hooks/use-ai-sop-revision'
import type { SopHeaderAutosaveStatus } from '@/pages/penyusun/sop/hooks/use-sop-header-autosave'
import type { SopQualityFinding } from '@/api/workspace-sops'
import { validateProsedurRows } from '@/lib/sop/validateProsedurRows'

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

function metadataTitle(metadata: SopEditorContextValue['metadata']): string {
  return (metadata.nama ?? metadata.judul ?? metadata.name ?? '').trim()
}

function metadataNumber(metadata: SopEditorContextValue['metadata']): string {
  return (metadata.nomorSOP ?? metadata.nomor ?? metadata.number ?? '').trim()
}

function hasSupportingInfo(metadata: SopEditorContextValue['metadata']): boolean {
  const values = [
    metadata.lawBasis,
    metadata.relatedSop,
    metadata.warning,
    metadata.implementQualification,
    metadata.equipment,
    metadata.recordData,
  ]
  return values.some((value) => {
    if (Array.isArray(value)) return value.some((item) => String(item).trim().length > 0)
    return typeof value === 'string' && value.trim().length > 0
  })
}

function sectionForFinding(finding: SopQualityFinding): SopEditorSection {
  switch (finding.location.kind) {
    case 'HEADER':
      return 'basic'
    case 'ACTOR':
      return 'actors'
    case 'STEP':
      return 'procedure'
    case 'PERINGATAN':
    case 'KUALIFIKASI_PELAKSANAAN':
    case 'PERALATAN_PERLENGKAPAN':
    case 'PENCATATAN_PENDATAAN':
      return 'supporting'
  }
}

export function DetailSOPPenyusun() {
  const params = useParams({ strict: false }) as { workspaceId?: string; sopId?: string; id?: string }
  const routeWorkspaceId = params.workspaceId
  const id = params.sopId ?? params.id ?? ''
  const [activeTab, setActiveTab] = useState<'flowchart' | 'bpmn'>('flowchart')
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [activeSection, setActiveSection] = useState<SopEditorSection>('basic')

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

  const combinedAutosaveStatus = combineAutosaveStatus(
    autosaveStatus,
    prosedurAutosaveStatus as SopHeaderAutosaveStatus,
  )
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

  const focusProcedureStep = useCallback((stepOrder: number) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const candidates = Array.from(
          document.querySelectorAll<HTMLElement>(`[data-sop-step-order="${stepOrder}"]`),
        )
        const target = candidates.find((element) => element.getClientRects().length > 0) ?? candidates[0]
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        target?.querySelector<HTMLElement>('input, textarea, button, [tabindex]')?.focus()
      })
    })
  }, [])

  const handleSelectAiFinding = useCallback(
    (finding: SopQualityFinding) => {
      setMode('edit')
      const nextSection = sectionForFinding(finding)
      setActiveSection(nextSection)
      if (finding.location.kind === 'STEP') focusProcedureStep(finding.location.stepOrder)
    },
    [focusProcedureStep],
  )

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
    setMode('edit')
    if (proposal.suggestion.target.kind === 'HEADER') setActiveSection('basic')
    if (proposal.suggestion.target.kind === 'PERINGATAN') setActiveSection('supporting')
    if (proposal.suggestion.target.kind === 'STEP') {
      setActiveSection('procedure')
      focusProcedureStep(proposal.suggestion.target.stepOrder)
    }
  }, [aiRevision.clear, aiReview.clearReview, focusProcedureStep, setMetadata, setProsedurRows])

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
  const procedureValid = validateProsedurRows(prosedurRows, implementers.length).valid
  const progress: SopSectionProgress = {
    basic: metadataTitle(metadata).length > 0 && metadataNumber(metadata).length > 0,
    actors: implementers.length > 0,
    procedure: procedureValid,
    supporting: hasSupportingInfo(metadata),
    review: isReadOnly || aiReview.review !== null,
  }

  const aiReviewPanelProps = {
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
  }

  const editorSectionContent = (() => {
    switch (activeSection) {
      case 'basic':
        return <SopBasicInfoSection />
      case 'actors':
        return <SopActorsSection workspaceId={resolvedWorkspaceId} />
      case 'procedure':
        return (
          <DetailSOPProsedurEditor
            prosedurRows={prosedurRows}
            setProsedurRows={setProsedurRows}
            implementers={implementers}
            readOnly={isReadOnly}
            onDone={() => setActiveSection(isReadOnly ? 'review' : 'supporting')}
          />
        )
      case 'supporting':
        return <SopSupportingInfoSection />
      case 'review':
        return (
          <SopReviewSection
            workspaceId={resolvedWorkspaceId}
            sopId={sopId}
            detailSopId={sopDetailId}
            aiReviewPanelProps={aiReviewPanelProps}
            auditEntries={auditLogs}
            combinedAutosaveStatus={combinedAutosaveStatus}
            onComplete={() => void transitionToDone()}
            canBuatVersiBaru={canBuatVersiBaru}
            onBuatVersiBaru={() => void handleBuatVersiBaru()}
            isBuatVersiBaruPending={isBuatVersiBaruPending}
          />
        )
    }
  })()

  return (
    <SopEditorProvider value={contextValue}>
      <main className="flex min-h-screen flex-col bg-surface-subtle">
        <header className="shrink-0 border-b border-border bg-background px-4 py-3 sm:px-6">
          <div className="mx-auto flex max-w-[1800px] items-start gap-3">
            <a
              href={backHref}
              className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Kembali ke workspace"
            >
              <ArrowLeft className="h-4 w-4" />
            </a>
            <div className="min-w-0 flex-1">
              <DetailSOPPenyusunHeader
                metadata={metadata}
                currentSopStatus={currentSopStatus}
                currentSopStatusLabel={currentSopStatusLabel}
                autosaveStatus={combinedAutosaveStatus}
                onRetryAutosave={retryAutosave}
                mode={mode}
                onModeChange={setMode}
                onReviewAndComplete={() => {
                  setMode('edit')
                  setActiveSection('review')
                }}
                isReadOnly={isReadOnly}
                canBuatVersiBaru={canBuatVersiBaru}
                onBuatVersiBaru={() => void handleBuatVersiBaru()}
                isBuatVersiBaruPending={isBuatVersiBaruPending}
              />
            </div>
          </div>
        </header>

        {mode === 'preview' ? (
          <div className="mx-auto w-full max-w-[1800px] flex-1 p-4 sm:p-6">
            <DetailSOPPenyusunMain activeTab={activeTab} onActiveTabChange={setActiveTab} />
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col lg:flex-row">
            <aside className="border-b border-border bg-background px-4 py-4 lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r lg:px-3 lg:py-6">
              <SopEditorSectionNav
                activeSection={activeSection}
                onSectionChange={setActiveSection}
                progress={progress}
                readOnly={isReadOnly}
              />
            </aside>
            <div className="min-w-0 flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
              {editorSectionContent}
            </div>
          </div>
        )}
      </main>
    </SopEditorProvider>
  )
}
