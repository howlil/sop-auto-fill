import { Button } from '@/components/ui/button'
import { SopEvaluasiStatusGroup } from '@/components/status/sop-evaluasi-status-group'
import { SopStatusBadge } from '@/components/status/sop-status-badge'
import type { TahapPenilaianSop } from '@/lib/evaluasi/evaluasi-domain'
import { cn } from '@/utils/cn'

export interface SOPListItem {
  id: string
  nama: string
  nomor: string
  statusDokumen?: string
  statusDokumenLabel?: string
  hasilEvaluasi?: string
  hasilEvaluasiLabel?: string
  statusTindakLanjut?: string | null
  statusTindakLanjutLabel?: string | null
  tahapPenilaian?: TahapPenilaianSop
}

export interface SOPListCardProps {
  items: SOPListItem[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  className?: string
  variant?: 'default' | 'compact'
}

const ITEM_CLASS =
  'w-full justify-start text-left h-auto rounded-lg border px-2 py-1.5 text-xs transition-colors flex flex-col items-stretch border-border hover:bg-surface-subtle text-secondary-foreground'
const SELECTED_ITEM_CLASS =
  'border-primary bg-primary-subtle text-primary-hover'

function renderStatus(sop: SOPListItem) {
  const statusDokumen = sop.statusDokumen
  const statusDokumenLabel = sop.statusDokumenLabel
  if (!statusDokumen || !statusDokumenLabel) return null
  const hasPenilaian =
    sop.hasilEvaluasi !== undefined && sop.hasilEvaluasiLabel !== undefined
  if (hasPenilaian) {
    return (
      <SopEvaluasiStatusGroup
        statusDokumen={statusDokumen}
        statusDokumenLabel={statusDokumenLabel}
        hasilEvaluasi={sop.hasilEvaluasi}
        hasilEvaluasiLabel={sop.hasilEvaluasiLabel}
        statusTindakLanjut={sop.statusTindakLanjut}
        statusTindakLanjutLabel={sop.statusTindakLanjutLabel}
        tahapPenilaian={sop.tahapPenilaian}
      />
    )
  }
  return <SopStatusBadge status={statusDokumen} label={statusDokumenLabel} />
}

function SopListItemButton({
  sop,
  isSelected,
  onSelect,
}: {
  sop: SOPListItem
  isSelected: boolean
  onSelect: (id: string) => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      aria-pressed={isSelected}
      className={cn(ITEM_CLASS, isSelected && SELECTED_ITEM_CLASS)}
      onClick={() => onSelect(sop.id)}
    >
      <p className="w-full truncate font-medium leading-snug">{sop.nama}</p>
      <div className="mt-0.5">{renderStatus(sop)}</div>
    </Button>
  )
}

export function SOPListCard({
  items,
  selectedId = null,
  onSelect,
  className,
}: SOPListCardProps) {
  if (items.length === 0) {
    return (
      <div className={cn('p-2 text-xs text-muted-foreground', className)}>
        Tidak ada SOP
      </div>
    )
  }

  return (
    <div className={cn('space-y-1', className)}>
      {items.map((sop) => {
        const isSelected = selectedId === sop.id
        if (onSelect != null) {
          return (
            <SopListItemButton
              key={sop.id}
              sop={sop}
              isSelected={isSelected}
              onSelect={onSelect}
            />
          )
        }
        return (
          <div key={sop.id} className={cn('px-2 py-1.5', ITEM_CLASS)}>
            <p className="w-full truncate font-medium leading-snug">{sop.nama}</p>
            <div className="mt-0.5">{renderStatus(sop)}</div>
          </div>
        )
      })}
    </div>
  )
}
