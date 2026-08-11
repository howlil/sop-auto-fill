/**
 * Dialog pilih keterkaitan SOP untuk metadata header.
 * Sumber data: daftar SOP penyusun (judul + detailSopId terbaru).
 */
import { SearchableSelectDialog } from '@/components/ui/searchable-select-dialog'
import { useSopEditor } from '../SopEditorContext'

export interface RelatedSopOption {
  /** detailSopId terbaru dari header SOP yang relevan. */
  id: string
  /** Label tampilan (judul SOP). */
  label: string
}

export interface RelatedSopDialogResult {
  ids: string[]
  labels: string[]
}

export interface RelatedPosDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Override opsional bila dipakai di luar editor SOP. */
  options?: RelatedSopOption[]
  /** Override label yang sudah terpasang. Default dari context. */
  existingRelatedSop?: string[]
  /** Override ID DetailSOP terpasang. Default dari context. */
  existingRelatedSopIds?: string[]
  onAdd: (next: RelatedSopDialogResult) => void
}

export function RelatedPosDialog({
  open,
  onOpenChange,
  options: optionsOverride,
  existingRelatedSop: existingRelatedSopOverride,
  existingRelatedSopIds: existingRelatedSopIdsOverride,
  onAdd,
}: RelatedPosDialogProps) {
  const { relatedSopOptions, metadata } = useSopEditor()
  const options = optionsOverride ?? relatedSopOptions
  const existingRelatedSop = existingRelatedSopOverride ?? metadata.relatedSop ?? []
  const existingRelatedSopIds = existingRelatedSopIdsOverride ?? metadata.relatedSopDetailIds ?? []

  return (
    <SearchableSelectDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Pilih Keterkaitan SOP"
      description="Cari SOP yang terkait."
      searchPlaceholder="Cari SOP..."
      items={options}
      existingIds={existingRelatedSopIds}
      getId={(item) => item.id}
      getSearchText={(item) => item.label}
      renderItem={(item) => (
        <p className="text-xs font-medium text-foreground leading-snug">{item.label}</p>
      )}
      emptyMessage="Belum ada SOP lain pada OPD ini."
      emptySearchMessage="Tidak ada SOP yang cocok dengan pencarian."
      itemClassName="items-center"
      onConfirm={(selectedIds) => {
        const additionalIds: string[] = []
        const additionalLabels: string[] = []
        const existingIdSet = new Set(existingRelatedSopIds)
        for (const id of selectedIds) {
          if (existingIdSet.has(id)) continue
          const item = options.find((opt) => opt.id === id)
          if (!item) continue
          additionalIds.push(id)
          additionalLabels.push(item.label)
        }
        onAdd({
          ids: [...existingRelatedSopIds, ...additionalIds],
          labels: [...existingRelatedSop, ...additionalLabels],
        })
      }}
    />
  )
}
