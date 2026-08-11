/**
 * Dialog pilih dasar hukum (peraturan) untuk metadata SOP.
 */
import { SearchableSelectDialog } from '@/components/ui/searchable-select-dialog'
import type { Peraturan } from '@/types/dto/peraturan.dto'
import { useSopEditor } from '../SopEditorContext'

export interface LawBasisDialogResult {
  ids: string[]
  labels: string[]
}

export interface LawBasisDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Override opsional saat dipakai di luar editor SOP (contoh: dialog import). */
  peraturanList?: Peraturan[]
  /** Override label yang sudah terpasang. Default: `metadata.lawBasis` dari context. */
  existingLawBasis?: string[]
  /** Override id yang sudah terpasang. Default: `metadata.lawBasisIds` dari context. */
  existingLawBasisIds?: string[]
  onAdd: (next: LawBasisDialogResult) => void
}

function formatLawBasisLabel(p: Peraturan): string {
  return `${p.namaPeraturan} No. ${p.nomor}/${p.tahun} tentang ${p.tentang}`
}

export function LawBasisDialog({
  open,
  onOpenChange,
  peraturanList: peraturanListOverride,
  existingLawBasis: existingLawBasisOverride,
  existingLawBasisIds: existingLawBasisIdsOverride,
  onAdd,
}: LawBasisDialogProps) {
  const { peraturanList: peraturanListCtx, metadata } = useSopEditor()
  const peraturanList = peraturanListOverride ?? peraturanListCtx
  const existingLawBasis = existingLawBasisOverride ?? metadata.lawBasis ?? []
  const existingLawBasisIds = existingLawBasisIdsOverride ?? metadata.lawBasisIds ?? []

  return (
    <SearchableSelectDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Pilih Dasar Hukum"
      description="Cari peraturan yang akan ditambahkan ke dasar hukum (tentang, peraturan, atau nomor/tahun)."
      searchPlaceholder="Cari peraturan (tentang, peraturan, nomor)..."
      items={peraturanList}
      existingIds={existingLawBasisIds}
      getId={(item) => item.id}
      getSearchText={(item) =>
        `${item.tentang} ${item.namaPeraturan} ${item.nomor}/${item.tahun}`
      }
      renderItem={(item) => (
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-xs font-medium text-foreground leading-snug">
            {item.namaPeraturan} No. {item.nomor}/{item.tahun}
          </p>
          <p className="text-[11px] text-secondary-foreground leading-snug line-clamp-2">
            {item.tentang}
          </p>
        </div>
      )}
      emptyMessage="Belum ada data peraturan."
      emptySearchMessage="Tidak ada peraturan yang cocok dengan pencarian."
      onConfirm={(selectedIds) => {
        const additionalIds: string[] = []
        const additionalLabels: string[] = []
        const existingIdSet = new Set(existingLawBasisIds)
        for (const id of selectedIds) {
          if (existingIdSet.has(id)) continue
          const item = peraturanList.find((p) => p.id === id)
          if (!item) continue
          additionalIds.push(id)
          additionalLabels.push(formatLawBasisLabel(item))
        }
        onAdd({
          ids: [...existingLawBasisIds, ...additionalIds],
          labels: [...existingLawBasis, ...additionalLabels],
        })
      }}
    />
  )
}
