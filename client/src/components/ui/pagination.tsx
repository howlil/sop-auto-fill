import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import { DEFAULT_PAGE_SIZE } from "@/utils/constants";

export interface PaginationProps {
  /** Total jumlah item */
  totalItems: number
  /** Halaman saat ini (1-based) */
  currentPage: number
  /** Callback saat halaman berubah */
  onPageChange: (page: number) => void
  /** Jumlah per halaman. Default 10. */
  pageSize?: number
  /** Label entitas (opsional), e.g. "SOP" untuk "1–10 dari 24 SOP" */
  label?: string
  /** Tampilkan ringkasan jumlah saat hanya ada satu halaman. */
  showSinglePageSummary?: boolean
  className?: string
}

/**
 * Pagination compact: info "X–Y dari Z" + tombol Sebelumnya / nomor halaman / Selanjutnya.
 * Default-nya hanya render jika totalItems > pageSize; gunakan showSinglePageSummary untuk ringkasan satu halaman.
 */
export function Pagination({
  totalItems,
  currentPage,
  onPageChange,
  pageSize = DEFAULT_PAGE_SIZE,
  label = '',
  showSinglePageSummary = false,
  className,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(Math.max(1, currentPage), totalPages)
  const start = (safePage - 1) * pageSize + 1
  const end = Math.min(safePage * pageSize, totalItems)
  const labelText = label ? ` ${label}` : ''

  if (totalItems <= pageSize) {
    if (!showSinglePageSummary) return null

    return (
      <p className={cn('text-center text-sm text-muted-foreground', className)} aria-live="polite">
        {totalItems}
        {labelText}
      </p>
    )
  }

  const canPrev = safePage > 1
  const canNext = safePage < totalPages

  const pageNumbers = getPageNumbers(safePage, totalPages)

  return (
    <nav
      aria-label={`Navigasi halaman${labelText}`}
      className={cn(
        'flex flex-col items-stretch justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center',
        className
      )}
    >
      <p className="text-center text-sm text-secondary-foreground sm:text-left" aria-live="polite" aria-atomic="true">
        {start}–{end} dari {totalItems}
        {labelText}
      </p>
      <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 w-10 p-0 sm:h-8 sm:w-8"
          disabled={!canPrev}
          onClick={() => onPageChange(safePage - 1)}
          aria-label="Sebelumnya"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="min-w-0 flex-1 text-center text-sm font-medium text-foreground sm:hidden" aria-current="page">
          Halaman {safePage} dari {totalPages}
        </span>
        <div className="hidden items-center gap-1 sm:flex">
          {pageNumbers.map((p, i) =>
            p === '…' ? (
              <span key={`ellipsis-${i}`} className="px-2 text-sm text-muted-foreground" aria-hidden>
                …
              </span>
            ) : (
              <Button
                type="button"
                key={p}
                variant={p === safePage ? 'default' : 'outline'}
                size="sm"
                className={cn('h-10 min-w-10 px-2 text-sm sm:h-8 sm:min-w-8', p === safePage && 'bg-primary hover:bg-primary-hover')}
                onClick={() => onPageChange(p)}
                aria-label={`Halaman ${p}`}
                aria-current={p === safePage ? 'page' : undefined}
              >
                {p}
              </Button>
            )
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 w-10 p-0 sm:h-8 sm:w-8"
          disabled={!canNext}
          onClick={() => onPageChange(safePage + 1)}
          aria-label="Selanjutnya"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </nav>
  )
}

function getPageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 6) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  if (current <= 3) return [1, 2, 3, '…', total]
  if (current >= total - 2) return [1, '…', total - 2, total - 1, total]
  return [1, '…', current - 1, current, current + 1, '…', total]
}
