import { FileText, Loader2 } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Card } from '@/components/ui/card'
import { Pagination } from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import { ArsipSearchField } from './arsip-chrome'
import { ArsipSopTable, type ArsipSopTableVariant } from './arsip-sop-table'
import type { PublicSopItem } from '@/types/dto/sop-public.dto'
import type { PaginationMetaDto } from '@/types/dto/evaluasi.dto'

export interface ArsipSopPanelProps {
  title: string
  subtitle?: string
  items: PublicSopItem[]
  pagination?: PaginationMetaDto
  page: number
  onPageChange: (page: number) => void
  isLoading: boolean
  isError: boolean
  isFetching: boolean
  showOpdColumn?: boolean
  selectedDetailSopId?: string
  onSelectSop: (sop: PublicSopItem) => void
  emptyTitle: string
  emptyHint: string
  embedded?: boolean
  hideHeader?: boolean
  listVariant?: ArsipSopTableVariant
  showSopSearchFilter?: boolean
  sopSearch?: string
  onSopSearchChange?: (value: string) => void
}

export function ArsipSopPanel({
  title,
  subtitle,
  items,
  pagination,
  page,
  onPageChange,
  isLoading,
  isError,
  isFetching,
  showOpdColumn = false,
  selectedDetailSopId,
  onSelectSop,
  emptyTitle,
  emptyHint,
  embedded = false,
  hideHeader = false,
  listVariant = 'default',
  showSopSearchFilter = false,
  sopSearch = '',
  onSopSearchChange,
}: ArsipSopPanelProps) {
  return (
    <section
      className={cn(
        'flex h-full min-h-0 flex-col bg-surface',
        !embedded && 'min-h-[calc(100vh-12rem)] max-h-[calc(100vh-12rem)] rounded-xl border border-border shadow-surface',
      )}
      aria-label={title}
    >
      {!hideHeader ? (
        <header className="border-b border-border px-4 py-4 sm:px-5">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-sm text-secondary-foreground">{subtitle}</p> : null}
        </header>
      ) : null}
      {showSopSearchFilter && onSopSearchChange ? (
        <div className={cn('border-b border-border', embedded ? 'px-2 py-2 sm:px-3' : 'px-4 py-3 sm:px-5')}>
          <ArsipSearchField
            id="arsip-sop-filter"
            value={sopSearch}
            onChange={onSopSearchChange}
            placeholder="Cari judul atau nomor SOP…"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">Kosongkan untuk melihat semua SOP OPD ini.</p>
        </div>
      ) : null}
      <div className={cn('flex-1 overflow-y-auto', embedded ? 'p-2 sm:p-3' : 'p-4 sm:p-5')}>
        {isLoading ? (
          <div role="status" aria-busy="true">
            <span className="sr-only">Memuat daftar SOP</span>
            <SopPanelSkeleton />
          </div>
        ) : null}
        {isError ? (
          <Card role="alert" className="border-red-200 bg-red-50 p-6 text-center text-sm text-red-800">
            Gagal memuat daftar SOP.
          </Card>
        ) : null}
        {!isLoading && !isError && items.length === 0 ? (
          <Card className="p-10 text-center">
            <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground" aria-hidden />
            <p className="font-medium text-foreground">{emptyTitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">{emptyHint}</p>
          </Card>
        ) : null}
        {!isLoading && !isError && items.length > 0 ? (
          <div aria-live="polite">
            <ArsipSopTable
              items={items}
              showOpdColumn={showOpdColumn}
              selectedDetailSopId={selectedDetailSopId}
              onSelectSop={onSelectSop}
              variant={listVariant}
            />
          </div>
        ) : null}
      </div>
      {isFetching && !isLoading ? (
        <p className="flex items-center justify-center gap-2 border-t border-border py-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Memperbarui…
        </p>
      ) : null}
      {pagination && !isLoading && !isError ? (
        <div className={cn('border-t border-border', embedded ? 'px-2 py-2 sm:px-3' : 'px-4 py-4 sm:px-5')}>
          <Pagination
            currentPage={page}
            totalItems={pagination.totalItems}
            pageSize={pagination.limit}
            label="SOP"
            showSinglePageSummary
            onPageChange={onPageChange}
            className="border-t-0 px-0 py-0"
          />
        </div>
      ) : null}
    </section>
  )
}

function SopPanelSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-16 rounded-xl" />
      ))}
    </div>
  )
}
