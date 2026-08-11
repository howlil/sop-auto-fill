import { useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Table } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Pagination } from '@/components/ui/pagination'
import { LoadingState } from '@/components/ui/loading-state'
import type { PaginationMetaDto } from '@/types/dto/evaluasi.dto'
import { cn } from '@/utils/cn'

export interface ExpandableGroupedTableProps<TGroup> {
  groups: TGroup[]
  getGroupId: (group: TGroup) => string
  renderGroupTitle: (group: TGroup) => ReactNode
  renderGroupMeta?: (group: TGroup) => ReactNode
  renderGroupAside?: (group: TGroup) => ReactNode
  renderRows: (group: TGroup) => ReactNode
  emptyContent?: ReactNode
  isLoading?: boolean
  loadingContent?: ReactNode
  pagination?: PaginationMetaDto | null
  onPageChange?: (page: number) => void
  className?: string
}

export function ExpandableGroupedTable<TGroup>({
  groups,
  getGroupId,
  renderGroupTitle,
  renderGroupMeta,
  renderGroupAside,
  renderRows,
  emptyContent,
  isLoading = false,
  loadingContent,
  pagination,
  onPageChange,
  className,
}: ExpandableGroupedTableProps<TGroup>) {
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([])
  const panelIdPrefix = useId()

  useEffect(() => {
    if (isLoading) return
    setExpandedGroupIds((prev) => {
      const prevSet = new Set(prev)
      const existingIds = groups.map(getGroupId)
      const persisted = existingIds.filter((id) => prevSet.has(id))
      const next = persisted.length > 0 ? persisted : existingIds
      if (prev.length === next.length && prev.every((id, index) => id === next[index])) {
        return prev
      }
      return next
    })
  }, [getGroupId, groups, isLoading])

  const toggleGroup = (groupId: string) => {
    setExpandedGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId],
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      {isLoading ? (loadingContent ?? <LoadingState />) : null}
      {!isLoading && groups.length === 0 ? emptyContent : null}
      {!isLoading
        ? groups.map((group) => {
            const groupId = getGroupId(group)
            const isExpanded = expandedGroupIds.includes(groupId)
            const panelId = `${panelIdPrefix}-${groupId}`
            return (
              <div
                key={groupId}
                className="overflow-hidden rounded-surface border border-border bg-surface shadow-surface"
              >
                <button
                  type="button"
                  className="w-full border-b border-border bg-surface-subtle/70 px-3 py-2.5 text-left transition-colors hover:bg-surface-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                  onClick={() => toggleGroup(groupId)}
                  aria-expanded={isExpanded}
                  aria-controls={panelId}
                >
                  <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="truncate text-[13px] font-medium text-foreground">
                        {renderGroupTitle(group)}
                      </span>
                      {renderGroupMeta ? (
                        <Badge variant="default" className="text-[11px] font-medium shrink-0">
                          {renderGroupMeta(group)}
                        </Badge>
                      ) : null}
                    </div>
                    {renderGroupAside ? (
                      <span className="pl-6 text-xs text-secondary-foreground sm:pl-0">
                        {renderGroupAside(group)}
                      </span>
                    ) : null}
                  </div>
                </button>
                {isExpanded ? (
                  <div id={panelId}>
                    <Table.Root>{renderRows(group)}</Table.Root>
                  </div>
                ) : null}
              </div>
            )
          })
        : null}
      {pagination && onPageChange ? (
        <div className="rounded-surface border border-border bg-surface shadow-surface">
          <Pagination
            totalItems={pagination.totalItems}
            currentPage={pagination.page}
            onPageChange={onPageChange}
            pageSize={pagination.limit}
            label="pengajuan"
          />
        </div>
      ) : null}
    </div>
  )
}

export function GroupedTableState({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-surface border border-border bg-surface shadow-surface">
      <Table.Table>
        <tbody>{children}</tbody>
      </Table.Table>
    </div>
  )
}
