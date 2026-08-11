import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Building2 } from 'lucide-react'
import { Table } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import {
  ExpandableGroupedTable,
  GroupedTableState,
} from '@/components/data/expandable-grouped-table'
import { PengajuanStatusBadge } from '@/components/status/pengajuan-status-badge'
import type {
  PaginationMetaDto,
  PengajuanEvaluasiRingkasRow,
} from '@/types/dto/evaluasi.dto'
import { formatDateId } from '@/utils/format-date'

type PengajuanGroupByOpd = {
  opdId: string
  opdNama: string
  rows: PengajuanEvaluasiRingkasRow[]
  latestRequestAt: number
}

export interface EvaluasiPengajuanGroupedListProps {
  rows: PengajuanEvaluasiRingkasRow[]
  isLoading: boolean
  pagination?: PaginationMetaDto | null
  onPageChange: (page: number) => void
  renderAction: (row: PengajuanEvaluasiRingkasRow) => ReactNode
}

function labelJenis(jenis: string): string {
  if (jenis === 'EVALUASI_REQUEST_EVALUATOR') return 'Request Evaluator'
  if (jenis === 'EVALUASI_REQUEST_OPD') return 'Request OPD'
  return jenis
}

function getRequestTimestamp(row: PengajuanEvaluasiRingkasRow): number {
  const requestAt = Date.parse(row.createdAt || row.tanggalEvaluasi || '')
  return Number.isNaN(requestAt) ? 0 : requestAt
}

export function EvaluasiPengajuanGroupedList({
  rows,
  isLoading,
  pagination,
  onPageChange,
  renderAction,
}: EvaluasiPengajuanGroupedListProps) {
  const groupedByOpd = useMemo<PengajuanGroupByOpd[]>(() => {
    const map = new Map<string, PengajuanGroupByOpd>()
    for (const row of rows) {
      const requestTs = getRequestTimestamp(row)
      const existing = map.get(row.opdId)
      if (!existing) {
        map.set(row.opdId, {
          opdId: row.opdId,
          opdNama: row.opdNama,
          rows: [row],
          latestRequestAt: requestTs,
        })
        continue
      }
      existing.rows.push(row)
      if (requestTs > existing.latestRequestAt) {
        existing.latestRequestAt = requestTs
      }
    }
    const groups = [...map.values()]
    for (const group of groups) {
      group.rows.sort((a, b) => getRequestTimestamp(b) - getRequestTimestamp(a))
    }
    groups.sort((a, b) => b.latestRequestAt - a.latestRequestAt)
    return groups
  }, [rows])

  return (
    <ExpandableGroupedTable
      groups={groupedByOpd}
      getGroupId={(group) => group.opdId}
      renderGroupTitle={(group) => group.opdNama}
      renderGroupMeta={(group) => `${group.rows.length} pengajuan`}
      renderGroupAside={(group) => (
        <>
          Request terbaru{' '}
          {group.latestRequestAt > 0
            ? formatDateId(new Date(group.latestRequestAt).toISOString())
            : '-'}
        </>
      )}
      isLoading={isLoading}
      loadingContent={<StateTable title="Memuat data..." description="Mohon tunggu." />}
      emptyContent={
        <StateTable
          title="Tidak ada pengajuan"
          description="Sesuaikan filter atau kata kunci pencarian."
        />
      }
      pagination={pagination}
      onPageChange={onPageChange}
      renderRows={(group) => (
        <Table.Table>
          <thead>
            <Table.HeadRow>
              <Table.Th>Jenis</Table.Th>
              <Table.Th>Status pengajuan</Table.Th>
              <Table.Th>Tanggal</Table.Th>
              <Table.Th>Progres</Table.Th>
              <Table.ActionTh>Aksi</Table.ActionTh>
            </Table.HeadRow>
          </thead>
          <tbody>
            {group.rows.map((row) => (
              <Table.BodyRow key={row.pengajuanEvaluasiId}>
                <Table.Td className="text-secondary-foreground">
                  {labelJenis(row.jenis)}
                </Table.Td>
                <Table.Td>
                  <PengajuanStatusBadge
                    status={row.status}
                    label={row.statusLabel}
                    showDomain={false}
                  />
                </Table.Td>
                <Table.Td className="text-secondary-foreground whitespace-nowrap">
                  {row.createdAt
                    ? formatDateId(row.createdAt)
                    : row.tanggalEvaluasi
                      ? formatDateId(row.tanggalEvaluasi)
                      : '-'}
                </Table.Td>
                <Table.Td className="text-secondary-foreground">
                  <span className="tabular-nums">
                    {row.jumlahSudahDinilai} / {row.jumlahSop}
                  </span>{' '}
                  <span className="text-muted-foreground">SOP dinilai</span>
                </Table.Td>
                <Table.ActionTd>
                  {renderAction(row)}
                </Table.ActionTd>
              </Table.BodyRow>
            ))}
          </tbody>
        </Table.Table>
      )}
    />
  )
}

function StateTable({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <GroupedTableState>
      <EmptyState
        asTableRow
        colSpan={6}
        icon={<Building2 />}
        title={title}
        description={description}
      />
    </GroupedTableState>
  )
}
