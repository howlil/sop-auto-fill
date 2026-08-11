import { ChevronRight } from 'lucide-react'
import { Table } from '@/components/ui/data-table'
import { formatDateIdLong } from '@/utils/format-date'
import { cn } from '@/utils/cn'
import type { PublicSopItem } from '@/types/dto/sop-public.dto'

export type ArsipSopTableVariant = 'default' | 'compact'

export interface ArsipSopTableProps {
  items: PublicSopItem[]
  showOpdColumn?: boolean
  selectedDetailSopId?: string
  onSelectSop: (sop: PublicSopItem) => void
  variant?: ArsipSopTableVariant
}

export function ArsipSopTable({
  items,
  showOpdColumn = false,
  selectedDetailSopId,
  onSelectSop,
  variant = 'default',
}: ArsipSopTableProps) {
  const isCompact = variant === 'compact'
  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground sm:hidden">
        Ketuk dokumen untuk membaca pratinjau layar penuh.
      </p>
      {!isCompact ? (
        <p className="mb-3 hidden text-sm text-muted-foreground sm:block">
          Klik SOP di daftar kiri untuk membuka pratinjau di sebelah kanan.
        </p>
      ) : (
        <p className="mb-2 text-xs text-muted-foreground">
          Klik SOP di daftar kiri untuk membuka pratinjau di sebelah kanan.
        </p>
      )}
      {!isCompact ? (
        <div className="hidden sm:block">
          <Table.Card>
            <Table.Root>
              <Table.Table>
                <thead>
                  <Table.HeadRow>
                    <Table.Th className="min-w-[12rem]">Judul SOP</Table.Th>
                    {showOpdColumn ? <Table.Th className="min-w-[8rem]">OPD</Table.Th> : null}
                    <Table.Th className="whitespace-nowrap">Nomor</Table.Th>
                    <Table.Th className="whitespace-nowrap">Versi</Table.Th>
                    <Table.Th className="whitespace-nowrap">Berlaku sejak</Table.Th>
                    <Table.Th align="center" className="w-16">
                      <span className="sr-only">Lihat</span>
                    </Table.Th>
                  </Table.HeadRow>
                </thead>
                <tbody>
                  {items.map((sop) => (
                    <SopTableRow
                      key={sop.detailSopId}
                      sop={sop}
                      showOpdColumn={showOpdColumn}
                      isSelected={sop.detailSopId === selectedDetailSopId}
                      onSelectSop={onSelectSop}
                    />
                  ))}
                </tbody>
              </Table.Table>
            </Table.Root>
          </Table.Card>
        </div>
      ) : null}
      <ul className={cn('space-y-2', !isCompact && 'sm:hidden')} aria-label="Daftar SOP">
        {items.map((sop) => {
          const isSelected = sop.detailSopId === selectedDetailSopId
          return (
            <li key={sop.detailSopId}>
              <button
                type="button"
                data-arsip-sop-id={sop.detailSopId}
                onClick={() => onSelectSop(sop)}
                className={cn(
                  'flex min-h-11 w-full gap-2 rounded-lg border px-3 py-2.5 text-left transition',
                  isCompact ? 'items-start' : 'flex-col gap-1 rounded-xl px-4 py-3 shadow-surface',
                  isSelected
                    ? 'border-blue-200 bg-blue-50 ring-1 ring-blue-200'
                    : 'border-border bg-surface hover:border-blue-100',
                )}
              >
                <span className="min-w-0 flex-1">
                  <p className={cn('font-medium text-foreground', isCompact && 'text-sm leading-snug')}>
                    {sop.judul}
                  </p>
                  {showOpdColumn ? (
                    <p className="mt-0.5 text-xs text-secondary-foreground">{sop.opdNama}</p>
                  ) : null}
                  <p className={cn('text-muted-foreground', isCompact ? 'mt-0.5 text-xs' : 'text-sm')}>
                    {sop.nomorSOP} · Versi {sop.versi}
                    {sop.tanggalEfektif ? ` · ${formatDateIdLong(sop.tanggalEfektif)}` : null}
                  </p>
                </span>
                {isCompact ? (
                  <ChevronRight
                    className={cn(
                      'mt-0.5 h-4 w-4 shrink-0',
                      isSelected ? 'text-blue-700' : 'text-muted-foreground',
                    )}
                    aria-hidden
                  />
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}

function SopTableRow({
  sop,
  showOpdColumn,
  isSelected,
  onSelectSop,
}: {
  sop: PublicSopItem
  showOpdColumn: boolean
  isSelected: boolean
  onSelectSop: (sop: PublicSopItem) => void
}) {
  return (
    <Table.BodyRow
      data-arsip-sop-id={sop.detailSopId}
      className={cn(
        'cursor-pointer',
        isSelected && 'bg-blue-50 ring-1 ring-inset ring-blue-200',
      )}
      onClick={() => onSelectSop(sop)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelectSop(sop)
        }
      }}
      tabIndex={0}
      role="button"
      aria-pressed={isSelected}
    >
      <Table.Td className="font-medium text-foreground">{sop.judul}</Table.Td>
      {showOpdColumn ? <Table.Td className="text-secondary-foreground">{sop.opdNama}</Table.Td> : null}
      <Table.Td className="text-secondary-foreground">{sop.nomorSOP}</Table.Td>
      <Table.Td className="text-secondary-foreground">{sop.versi}</Table.Td>
      <Table.Td className="text-secondary-foreground">
        {sop.tanggalEfektif ? formatDateIdLong(sop.tanggalEfektif) : '—'}
      </Table.Td>
      <Table.Td className="text-center">
        <ChevronRight
          className={cn('mx-auto h-4 w-4', isSelected ? 'text-blue-700' : 'text-muted-foreground')}
          aria-hidden
        />
      </Table.Td>
    </Table.BodyRow>
  )
}
