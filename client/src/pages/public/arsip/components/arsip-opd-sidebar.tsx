import { Building2, Loader2 } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Card } from '@/components/ui/card'
import { Pagination } from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import { ArsipSearchField } from './arsip-chrome'
import type { PublicOpdItem } from '@/types/dto/sop-public.dto'
import type { PaginationMetaDto } from '@/types/dto/evaluasi.dto'

export interface ArsipOpdSidebarProps {
  items: PublicOpdItem[]
  selectedOpdId?: string
  opdFilter: string
  onOpdFilterChange: (value: string) => void
  onSelectOpd: (opdId: string) => void
  isLoading: boolean
  isError: boolean
  isFetching: boolean
  pagination?: PaginationMetaDto
  page?: number
  onPageChange?: (page: number) => void
  hidden?: boolean
  embedded?: boolean
  compactPagination?: boolean
}

export function ArsipOpdSidebar({
  items,
  selectedOpdId,
  opdFilter,
  onOpdFilterChange,
  onSelectOpd,
  isLoading,
  isError,
  isFetching,
  pagination,
  page = 1,
  onPageChange,
  hidden = false,
  embedded = false,
  compactPagination = false,
}: ArsipOpdSidebarProps) {
  if (hidden) {
    return null
  }
  const hasFilter = opdFilter.trim().length > 0
  return (
    <aside
      className={cn(
        'flex h-full min-h-0 flex-col bg-surface',
        !embedded && 'max-h-[calc(100vh-12rem)] min-h-[calc(100vh-12rem)] rounded-xl border border-border shadow-surface',
      )}
      aria-label="Daftar OPD"
    >
      <OpdSidebarHeader opdFilter={opdFilter} onOpdFilterChange={onOpdFilterChange} />
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="space-y-2 p-2" aria-busy="true" role="status">
            <span className="sr-only">Memuat daftar OPD</span>
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : null}
        {isError ? (
          <Card role="alert" className="m-2 border-red-200 bg-red-50 p-4 text-center text-sm text-red-800">
            Gagal memuat daftar OPD.
          </Card>
        ) : null}
        {!isLoading && !isError && items.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">
            {hasFilter
              ? 'Tidak ada OPD yang cocok. Coba kata kunci lain.'
              : 'Ketik nama OPD di kotak saring, atau gunakan halaman berikutnya.'}
          </p>
        ) : null}
        {!isLoading && !isError && items.length > 0 ? (
          <ul className="space-y-1" role="listbox" aria-label="Pilih OPD">
            {items.map((opd) => {
              const isSelected = opd.opdId === selectedOpdId
              return (
                <li key={opd.opdId} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => onSelectOpd(opd.opdId)}
                    className={cn(
                      'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition',
                      isSelected
                        ? 'border border-blue-200 bg-blue-50 ring-1 ring-blue-100'
                        : 'border border-transparent hover:bg-surface-subtle',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                        isSelected ? 'bg-blue-100 text-blue-700' : 'bg-surface-muted text-secondary-foreground',
                      )}
                    >
                      <Building2 className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{opd.nama}</span>
                      <span className="text-xs text-muted-foreground">{opd.jumlahSopBerlaku} SOP berlaku</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>
      {isFetching && !isLoading ? (
        <p className="flex items-center justify-center gap-2 border-t border-border py-2 text-xs text-muted-foreground" role="status">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Memperbarui…
        </p>
      ) : null}
      {pagination && onPageChange && !isLoading && !isError ? (
        <div className={cn('border-t border-border', compactPagination ? 'px-2 py-2' : 'px-3 py-3')}>
          <Pagination
            currentPage={page}
            totalItems={pagination.totalItems}
            pageSize={pagination.limit}
            label="OPD"
            showSinglePageSummary
            onPageChange={onPageChange}
            className={cn('border-t-0 px-0 py-0', compactPagination && 'flex-col gap-2')}
          />
        </div>
      ) : null}
    </aside>
  )
}

function OpdSidebarHeader({
  opdFilter,
  onOpdFilterChange,
}: {
  opdFilter: string
  onOpdFilterChange: (value: string) => void
}) {
  return (
    <div className="border-b border-border p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Organisasi (OPD)</p>
      <ArsipSearchField
        id="arsip-opd-filter"
        value={opdFilter}
        onChange={onOpdFilterChange}
        placeholder="Saring nama OPD…"
      />
    </div>
  )
}
