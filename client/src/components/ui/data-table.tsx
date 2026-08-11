import { useState, useEffect, useMemo } from 'react'
import * as React from 'react'
import { cn } from '@/utils/cn'
import { Pagination } from '@/components/ui/pagination'

const tableSurfaceClassName =
  'relative isolate overflow-clip rounded-surface border border-border bg-surface shadow-surface'

/** Wrapper overflow-x-auto; untuk scroll horizontal tabel. */
const DataTableRoot = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, 'aria-label': ariaLabel, ...props }, ref) => (
  <div
    ref={ref}
    role="region"
    tabIndex={0}
    aria-label={ariaLabel ?? 'Tabel data; gulir secara horizontal untuk melihat kolom lainnya'}
    className={cn(
      'w-full overflow-x-auto overscroll-x-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
      className,
    )}
    {...props}
  />
))
DataTableRoot.displayName = 'DataTableRoot'

/** Shell tabel non-paginasi; Table.Root menangani scroll horizontal di dalamnya. */
const DataTableCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(tableSurfaceClassName, className)}
    {...props}
  />
))
DataTableCard.displayName = 'DataTableCard'

/** Tabel produktif: 13px untuk data padat tanpa mengorbankan keterbacaan. */
const DataTableTable = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <table
    ref={ref}
    className={cn('w-full border-collapse text-[13px]/[18px] text-foreground', className)}
    {...props}
  />
))
DataTableTable.displayName = 'DataTableTable'

/** Baris header: border-b border-border bg-blue-50. */
const DataTableHeaderRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn('sticky top-0 z-10 border-b border-border bg-primary-subtle shadow-[0_1px_0_var(--color-border)]', className)}
    {...props}
  />
))
DataTableHeaderRow.displayName = 'DataTableHeaderRow'

/** Baris body: border-b border-border hover:bg-surface-subtle transition-all. */
const DataTableBodyRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn('border-b border-border transition-colors hover:bg-surface-subtle focus-within:bg-primary-subtle/50', className)}
    {...props}
  />
))
DataTableBodyRow.displayName = 'DataTableBodyRow'

/** <th>: 12px medium agar hierarki jelas tanpa terlihat berat. Default left. */
const DataTableTh = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'center' | 'right' }
>(({ className, align = 'left', ...props }, ref) => (
  <th
    ref={ref}
    scope="col"
    className={cn(
      'whitespace-nowrap px-3 py-2 text-ui-label font-medium text-secondary-foreground',
      align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left',
      className
    )}
    {...props}
  />
))
DataTableTh.displayName = 'DataTableTh'

/** <td>: padding ringkas untuk kepadatan tabel desktop yang nyaman. */
const DataTableTd = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn('px-3 py-2', className)} {...props} />
))
DataTableTd.displayName = 'DataTableTd'

/** Kolom aksi global: ringkas, tidak melebar, dan konsisten rata kiri. */
const DataTableActionTh = React.forwardRef<
  HTMLTableCellElement,
  Omit<React.ThHTMLAttributes<HTMLTableCellElement>, 'align'>
>(({ className, ...props }, ref) => (
  <DataTableTh
    ref={ref}
    className={cn('w-0 whitespace-nowrap text-left', className)}
    {...props}
  />
))
DataTableActionTh.displayName = 'DataTableActionTh'

const DataTableActionTd = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <DataTableTd
    ref={ref}
    className={cn('w-0 whitespace-nowrap text-left align-middle', className)}
    {...props}
  />
))
DataTableActionTd.displayName = 'DataTableActionTd'

// ==================== Paginated Table ====================

interface PaginatedTableProps<T> {
  /** Array data yang akan di-paginate. */
  data: T[]
  /** Jumlah item per halaman. Default 10. */
  pageSize?: number
  /** Label entitas untuk info pagination, e.g. "SOP". */
  label?: string
  /** Render function: terima data halaman saat ini + offset index dari array asal. */
  children: (pageData: T[], startIndex: number) => React.ReactNode
  className?: string
}

function PaginatedTable<T>({
  data,
  pageSize = 10,
  label,
  children,
  className,
}: PaginatedTableProps<T>) {
  const [page, setPage] = useState(1)
  const totalPages = data.length === 0 ? 1 : Math.ceil(data.length / pageSize)
  const safePage = Math.min(Math.max(1, page), totalPages)

  useEffect(() => {
    if (totalPages > 0 && page > totalPages) setPage(1)
  }, [totalPages, page])

  const startIndex = (safePage - 1) * pageSize
  const pageData = useMemo(
    () => data.slice(startIndex, startIndex + pageSize),
    [data, startIndex, pageSize]
  )

  const showPagination = data.length > pageSize

  return (
    <div className={cn(tableSurfaceClassName, className)}>
      {children(pageData, startIndex)}
      {showPagination && (
        <Pagination
          totalItems={data.length}
          currentPage={safePage}
          onPageChange={setPage}
          pageSize={pageSize}
          label={label}
        />
      )}
    </div>
  )
}

// ==================== Exports ====================

export {
  DataTableRoot,
  DataTableCard,
  DataTableTable,
  DataTableHeaderRow,
  DataTableBodyRow,
  DataTableTh,
  DataTableTd,
  DataTableActionTh,
  DataTableActionTd,
  PaginatedTable,
}

export { Pagination } from '@/components/ui/pagination'

/** Compound component untuk pemakaian: Table.Card, Table.Root, Table.Table, Table.Paginated, dll. */
export const Table = {
  Root: DataTableRoot,
  Card: DataTableCard,
  Table: DataTableTable,
  HeadRow: DataTableHeaderRow,
  BodyRow: DataTableBodyRow,
  Th: DataTableTh,
  Td: DataTableTd,
  ActionTh: DataTableActionTh,
  ActionTd: DataTableActionTd,
  Pagination,
  Paginated: PaginatedTable,
}
