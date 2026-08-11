import { ExternalLink, Loader2, RefreshCw, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SopStatusBadge } from '@/components/status/sop-status-badge'
import { resolveApiBaseUrl } from '@/config/env'
import { cn } from '@/utils/cn'

export interface ArsipSopPreviewPaneProps {
  detailSopId: string
  pdfUrl?: string
  title?: string
  opdName?: string
  onClose: () => void
  onRefresh?: () => void
  variant: 'inline' | 'overlay'
  embedded?: boolean
}

export function ArsipSopPreviewPane({
  detailSopId,
  pdfUrl,
  title = 'Dokumen SOP',
  opdName,
  onClose,
  onRefresh,
  variant,
  embedded = false,
}: ArsipSopPreviewPaneProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasLoadError, setHasLoadError] = useState(false)
  const resolvedPdfUrl = useMemo(() => resolvePdfUrl(pdfUrl), [pdfUrl])
  const shellClass = cn(
    'flex flex-col bg-surface',
    variant === 'overlay' && 'fixed inset-0 z-40 pt-[env(safe-area-inset-top)]',
    variant === 'inline' && embedded && 'h-full min-h-0',
    variant === 'inline' &&
      !embedded &&
      'h-full min-h-[calc(100vh-12rem)] max-h-[calc(100vh-12rem)] rounded-xl border border-border shadow-surface',
  )
  return (
    <section className={shellClass} aria-label="Pratinjau dokumen SOP">
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 lg:px-5">
        <div className="min-w-0 flex-1 pr-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">PDF resmi</p>
          <h2 className="mt-0.5 line-clamp-2 text-base font-semibold text-foreground sm:text-lg">{title}</h2>
          {opdName ? <p className="mt-1 text-sm text-secondary-foreground">{opdName}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {resolvedPdfUrl ? <SopStatusBadge status="BERLAKU" label="Berlaku" showDomain={false} /> : null}
          {resolvedPdfUrl ? (
            <Button asChild type="button" variant="outline" size="sm" className="gap-1.5">
              <a href={resolvedPdfUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" aria-hidden />
                Buka
              </a>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={onClose}
            aria-label="Tutup pratinjau"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </header>
      <div className="relative min-h-0 flex-1 bg-surface-muted">
        {!resolvedPdfUrl ? (
          <UnavailableState onRefresh={onRefresh} />
        ) : (
          <>
            {isLoading ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface/80">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" aria-label="Memuat PDF" />
              </div>
            ) : null}
            {hasLoadError ? (
              <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
                <UnavailableState onRefresh={onRefresh} />
              </div>
            ) : null}
            <iframe
              key={`${detailSopId}:${resolvedPdfUrl}`}
              title={`PDF SOP ${title}`}
              src={resolvedPdfUrl}
              className="h-full min-h-[70vh] w-full border-0 bg-surface"
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false)
                setHasLoadError(true)
              }}
            />
          </>
        )}
      </div>
    </section>
  )
}

function UnavailableState({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <div className="flex h-full min-h-[320px] items-center justify-center p-4">
      <Card className="max-w-md border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-900">
        <p className="font-medium">PDF SOP tidak tersedia.</p>
        <p className="mt-1">
          Dokumen mungkin sudah dicabut, digantikan versi baru, atau belum memiliki PDF resmi.
        </p>
        {onRefresh ? (
          <Button type="button" variant="outline" size="sm" className="mt-4 gap-1.5" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            Muat ulang daftar
          </Button>
        ) : null}
      </Card>
    </div>
  )
}

function resolvePdfUrl(pdfUrl: string | undefined): string | undefined {
  if (!pdfUrl) {
    return undefined
  }
  if (/^https?:\/\//i.test(pdfUrl)) {
    return pdfUrl
  }
  return `${resolveApiBaseUrl()}${pdfUrl.startsWith('/') ? pdfUrl : `/${pdfUrl}`}`
}
