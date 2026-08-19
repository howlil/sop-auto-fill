import { AlertTriangle, ChevronRight, LoaderCircle, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type {
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

function locationLabel(location: SopQualityFindingLocation): string {
  switch (location.kind) {
    case 'STEP':
      return `Langkah ${location.stepOrder}`
    case 'ACTOR':
      return `Pelaksana: ${location.actorName}`
    case 'PERINGATAN':
      return 'Peringatan'
    case 'KUALIFIKASI_PELAKSANAAN':
      return 'Kualifikasi pelaksanaan'
    case 'PERALATAN_PERLENGKAPAN':
      return 'Peralatan / perlengkapan'
    case 'PENCATATAN_PENDATAAN':
      return 'Pencatatan / pendataan'
    case 'HEADER':
      return 'Header SOP'
  }
}

export function AiSopQualityReviewPanel({
  isAvailable,
  isAvailabilityLoading,
  isRunning,
  review,
  error,
  onRunReview,
  onSelectFinding,
}: AiSopQualityReviewPanelProps) {
  const disabled = !isAvailable || isAvailabilityLoading || isRunning

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

        <Button
          type="button"
          className="mt-3 w-full"
          disabled={disabled}
          onClick={() => void onRunReview()}
        >
          {isRunning ? (
            <>
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Memeriksa dengan AI…
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" aria-hidden />
              Periksa dengan AI
            </>
          )}
        </Button>

        {!isAvailabilityLoading && !isAvailable ? (
          <p className="mt-2 text-xs text-muted-foreground">
            AI review belum tersedia pada environment ini.
          </p>
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
            <p className="mt-1 text-sm font-semibold text-foreground">
              {STATUS_LABEL[review.result.status]}
            </p>
            <p className="mt-2 text-xs leading-5 text-secondary-foreground">
              {review.result.summary}
            </p>
          </div>

          {review.result.findings.length === 0 ? (
            <div className="rounded-lg border border-border bg-background p-3 text-xs leading-5 text-muted-foreground">
              Tidak ada finding terstruktur dari review ini. Tetap lakukan pemeriksaan manusia sebelum SOP digunakan.
            </div>
          ) : (
            <div className="space-y-2" aria-label="Temuan review AI">
              {review.result.findings.map((finding, index) => (
                <button
                  key={`${finding.severity}-${finding.category}-${finding.title}-${index}`}
                  type="button"
                  aria-label={`Buka ${finding.title}`}
                  onClick={() => onSelectFinding(finding)}
                  className="w-full rounded-lg border border-border bg-background p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="rounded border border-border px-1.5 py-0.5 font-semibold text-foreground">
                          {SEVERITY_LABEL[finding.severity]}
                        </span>
                        <span className="text-muted-foreground">{locationLabel(finding.location)}</span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-foreground">{finding.title}</p>
                      <p className="mt-1 text-xs leading-5 text-secondary-foreground">
                        {finding.explanation}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        Saran: {finding.recommendation}
                      </p>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
