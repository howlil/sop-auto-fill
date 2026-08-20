import { AlertTriangle, ChevronRight, LoaderCircle, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type {
  SopAiRevisionResponse,
  SopAiRevisionTarget,
  SopQualityFinding,
  SopQualityFindingLocation,
  SopQualityReviewResponse,
} from '@/api/workspace-sops'

export interface AiSopQualityReviewPanelProps {
  isAvailable: boolean
  isAvailabilityLoading: boolean
  isRunning: boolean
  review: SopQualityReviewResponse | null
  error: Error | null
  onRunReview: () => void | Promise<void>
  onSelectFinding: (finding: SopQualityFinding) => void
  aiRevision: {
    isAvailable: boolean
    isAvailabilityLoading: boolean
    isRunning: boolean
    proposal: SopAiRevisionResponse | null
    error: Error | null
    onSuggest: (finding: SopQualityFinding) => void | Promise<void>
    onCancel: () => void
    onApply: () => void
  }
}

const STATUS_LABEL = {
  PERLU_PERBAIKAN: 'Perlu perbaikan',
  CUKUP_BAIK: 'Cukup baik',
  SIAP_DIREVIEW: 'Siap direview',
} as const

const SEVERITY_LABEL = {
  ERROR: 'Error',
  WARNING: 'Peringatan',
  SUGGESTION: 'Saran',
} as const

const STEP_FIELD_LABEL = {
  KEGIATAN: 'Kegiatan',
  KELENGKAPAN: 'Kelengkapan',
  KELUARAN: 'Output',
  KETERANGAN: 'Keterangan',
} as const

function locationLabel(location: SopQualityFindingLocation): string {
  switch (location.kind) {
    case 'STEP': return `Langkah ${location.stepOrder}`
    case 'ACTOR': return `Pelaksana: ${location.actorName}`
    case 'PERINGATAN': return 'Peringatan'
    case 'KUALIFIKASI_PELAKSANAAN': return 'Kualifikasi pelaksanaan'
    case 'PERALATAN_PERLENGKAPAN': return 'Peralatan / perlengkapan'
    case 'PENCATATAN_PENDATAAN': return 'Pencatatan / pendataan'
    case 'HEADER': return 'Header SOP'
  }
}

export function isAiRevisionEligibleFinding(finding: SopQualityFinding): boolean {
  if (finding.location.kind === 'HEADER') return finding.category === 'CLARITY'
  if (finding.location.kind === 'PERINGATAN') {
    return ['CLARITY', 'SUPPORTING_FIELD', 'COMPLETENESS'].includes(finding.category)
  }
  if (finding.location.kind !== 'STEP') return false
  return ['CLARITY', 'INPUT_OUTPUT', 'COMPLETENESS', 'SUPPORTING_FIELD'].includes(
    finding.category,
  )
}

function revisionTargetLabel(target: SopAiRevisionTarget): string {
  if (target.kind === 'HEADER') return 'Judul SOP'
  if (target.kind === 'PERINGATAN') return `Peringatan ${target.itemIndex + 1}`
  return `Langkah ${target.stepOrder} · ${STEP_FIELD_LABEL[target.field]}`
}

export function AiSopQualityReviewPanel({
  isAvailable,
  isAvailabilityLoading,
  isRunning,
  review,
  error,
  onRunReview,
  onSelectFinding,
  aiRevision,
}: AiSopQualityReviewPanelProps) {
  const disabled = !isAvailable || isAvailabilityLoading || isRunning
  const revisionActionDisabled = aiRevision.isAvailabilityLoading || aiRevision.isRunning

  return (
    <div className="space-y-3 p-2">
      <div className="rounded-lg border border-border bg-background p-3">
        <div className="flex items-start gap-2.5">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Review kualitas SOP</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Saran AI bersifat advisory dan bukan persetujuan, penilaian kepatuhan, atau pengganti review manusia.
            </p>
          </div>
        </div>

        <Button type="button" className="mt-3 w-full" disabled={disabled} onClick={() => void onRunReview()}>
          {isRunning ? (
            <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden />Memeriksa dengan AI…</>
          ) : (
            <><Sparkles className="mr-2 h-4 w-4" aria-hidden />Periksa dengan AI</>
          )}
        </Button>

        {!isAvailabilityLoading && !isAvailable ? (
          <p className="mt-2 text-xs text-muted-foreground">AI review belum tersedia pada environment ini.</p>
        ) : null}

        {error ? (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{error.message}</span>
          </div>
        ) : null}
      </div>

      {review ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-background p-3">
            <p className="text-xs font-medium text-muted-foreground">Status advisory</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{STATUS_LABEL[review.result.status]}</p>
            <p className="mt-2 text-xs leading-5 text-secondary-foreground">{review.result.summary}</p>
          </div>

          {aiRevision.error ? (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{aiRevision.error.message}</span>
            </div>
          ) : null}

          {aiRevision.proposal ? (
            <div className="rounded-lg border border-border bg-background p-3" aria-label="Preview usulan AI">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" aria-hidden />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Target perbaikan</p>
                  <p className="text-sm font-semibold text-foreground">
                    {revisionTargetLabel(aiRevision.proposal.suggestion.target)}
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <div className="rounded-md border border-border bg-muted/30 p-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sebelum</p>
                  <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-secondary-foreground">
                    {aiRevision.proposal.suggestion.before}
                  </p>
                </div>
                <div className="rounded-md border border-border bg-background p-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Usulan</p>
                  <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-foreground">
                    {aiRevision.proposal.suggestion.after}
                  </p>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  {aiRevision.proposal.suggestion.rationale}
                </p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" onClick={aiRevision.onCancel}>Batal</Button>
                <Button type="button" onClick={aiRevision.onApply}>Terapkan</Button>
              </div>
            </div>
          ) : null}

          {review.result.findings.length === 0 ? (
            <div className="rounded-lg border border-border bg-background p-3 text-xs leading-5 text-muted-foreground">
              Tidak ada finding terstruktur dari review ini. Tetap lakukan pemeriksaan manusia sebelum SOP digunakan.
            </div>
          ) : (
            <div className="space-y-2" aria-label="Temuan review AI">
              {review.result.findings.map((finding, index) => {
                const revisionEligible = isAiRevisionEligibleFinding(finding)
                const canSuggest = revisionEligible && aiRevision.isAvailable && !aiRevision.isAvailabilityLoading
                return (
                  <div
                    key={`${finding.severity}-${finding.category}-${finding.title}-${index}`}
                    className="w-full rounded-lg border border-border bg-background p-3 text-left"
                  >
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="rounded border border-border px-1.5 py-0.5 font-semibold text-foreground">
                        {SEVERITY_LABEL[finding.severity]}
                      </span>
                      <span className="text-muted-foreground">{locationLabel(finding.location)}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-foreground">{finding.title}</p>
                    <p className="mt-1 text-xs leading-5 text-secondary-foreground">{finding.explanation}</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">Saran: {finding.recommendation}</p>
                    {!revisionEligible ? (
                      <p className="mt-2 text-[11px] font-medium text-muted-foreground">Perbaiki secara manual karena temuan ini menyangkut struktur atau keputusan pengguna.</p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        aria-label={`Buka ${finding.title}`}
                        onClick={() => onSelectFinding(finding)}
                        className="inline-flex items-center rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Buka lokasi <ChevronRight className="ml-1 h-3.5 w-3.5" aria-hidden />
                      </button>
                      {canSuggest ? (
                        <button
                          type="button"
                          aria-label={`Sarankan perbaikan ${finding.title}`}
                          disabled={revisionActionDisabled}
                          onClick={() => void aiRevision.onSuggest(finding)}
                          className="inline-flex items-center rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {aiRevision.isRunning ? (
                            <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                          ) : (
                            <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                          )}
                          Sarankan Perbaikan
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
