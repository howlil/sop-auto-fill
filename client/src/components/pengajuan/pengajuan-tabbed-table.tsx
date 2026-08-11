import type { ReactNode } from 'react'
import { FileSignature } from 'lucide-react'
import { Table } from '@/components/ui/data-table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'

function TableLoadingRows({
  rows = 5,
  columns,
}: {
  rows?: number
  columns: number
}) {
  const rowKeys = Array.from({ length: rows }, (_, index) => `loading-row-${index}`)
  const columnKeys = Array.from(
    { length: columns },
    (_, index) => `loading-column-${index}`,
  )
  return (
    <>
      {rowKeys.map((rowKey, rowIndex) => (
        <Table.BodyRow key={rowKey}>
          {columnKeys.map((columnKey, columnIndex) => (
            <Table.Td key={`${rowKey}-${columnKey}`}>
              {rowIndex === 0 && columnIndex === 0 ? (
                <span className="sr-only" role="status">Memuat data pengajuan…</span>
              ) : null}
              <Skeleton className="h-3 w-full" />
            </Table.Td>
          ))}
        </Table.BodyRow>
      ))}
    </>
  )
}

export function PengajuanBaNumberCell({ value }: { value?: string | null }) {
  return <span className="font-mono text-secondary-foreground">{value?.trim() || '-'}</span>
}

export function PengajuanDateCell({
  value,
  formatter,
}: {
  value?: string | null
  formatter: (value: string | null | undefined) => string
}) {
  return <span className="whitespace-nowrap text-secondary-foreground">{formatter(value)}</span>
}

export interface PengajuanTableColumn<T> {
  id: string
  header: ReactNode
  className?: string
  align?: 'left' | 'center'
  render: (row: T) => ReactNode
}

export interface PengajuanTabbedTableTab<T> {
  value: string
  label: string
  rows: T[]
  emptyTitle: string
  emptyDescription: string
}

export interface PengajuanTabbedTableProps<T> {
  tabs: PengajuanTabbedTableTab<T>[]
  columns: PengajuanTableColumn<T>[]
  isLoading: boolean
  getRowId: (row: T) => string
  renderAction: (row: T) => ReactNode
  label: string
  defaultValue: string
  pageSize?: number
  loadingRows?: number
  emptyIcon?: ReactNode
}

export function PengajuanTabbedTable<T>({
  tabs,
  columns,
  isLoading,
  getRowId,
  renderAction,
  label,
  defaultValue,
  pageSize,
  loadingRows = 5,
  emptyIcon = <FileSignature />,
}: PengajuanTabbedTableProps<T>) {
  return (
    <Tabs defaultValue={defaultValue} className="space-y-3">
      <TabsList className="h-9 w-full grid grid-cols-2">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} className="text-xs w-full">
            {tab.label} ({tab.rows.length})
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="mt-0">
          <Table.Paginated data={tab.rows} pageSize={pageSize} label={label}>
            {(pageData) => (
              <Table.Root>
                <Table.Table>
                  <thead>
                    <Table.HeadRow>
                      {columns.map((column) => (
                        <Table.Th
                          key={column.id}
                          className={column.className}
                          align={column.align}
                        >
                          {column.header}
                        </Table.Th>
                      ))}
                      <Table.ActionTh>Aksi</Table.ActionTh>
                    </Table.HeadRow>
                  </thead>
                  <tbody aria-busy={isLoading || undefined}>
                    {isLoading ? (
                      <TableLoadingRows
                        rows={loadingRows}
                        columns={columns.length + 1}
                      />
                    ) : pageData.length === 0 ? (
                      <EmptyState
                        asTableRow
                        colSpan={columns.length + 1}
                        icon={emptyIcon}
                        title={tab.emptyTitle}
                        description={tab.emptyDescription}
                      />
                    ) : (
                      pageData.map((row) => (
                        <Table.BodyRow key={getRowId(row)}>
                          {columns.map((column) => (
                            <Table.Td key={column.id} className={column.className}>
                              {column.render(row)}
                            </Table.Td>
                          ))}
                          <Table.ActionTd>{renderAction(row)}</Table.ActionTd>
                        </Table.BodyRow>
                      ))
                    )}
                  </tbody>
                </Table.Table>
              </Table.Root>
            )}
          </Table.Paginated>
        </TabsContent>
      ))}
    </Tabs>
  )
}
