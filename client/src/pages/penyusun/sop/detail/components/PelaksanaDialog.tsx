/**
 * Dialog pilih aktor pelaksana untuk metadata SOP.
 */
import { SearchableSelectDialog } from '@/components/ui/searchable-select-dialog'

export interface PelaksanaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Daftar pelaksana dari master (Manajemen Pelaksana SOP) */
  options: {
    id: string
    name: string
  }[]
  existingImplementers: { id: string; name: string }[]
  onAdd: (newItems: { id: string; name: string }[]) => void
}

export function PelaksanaDialog({
  open,
  onOpenChange,
  options,
  existingImplementers,
  onAdd,
}: PelaksanaDialogProps) {
  return (
    <SearchableSelectDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Pilih Aktor Pelaksana"
      description="Cari pelaksana yang akan ditambahkan (nama atau kode). Data dari Manajemen Pelaksana SOP."
      searchPlaceholder="Cari pelaksana (nama)..."
      items={options}
      existingIds={existingImplementers.map((item) => item.id)}
      getId={(item) => item.id}
      getSearchText={(item) => `${item.name} ${item.id}`}
      renderItem={(item) => (
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground leading-snug">{item.name}</p>
        </div>
      )}
      emptyMessage="Belum ada data pelaksana. Kelola di menu Manajemen Pelaksana SOP."
      emptySearchMessage="Tidak ada pelaksana yang cocok dengan pencarian."
      onConfirm={(selectedIds) => {
        const existingIdSet = new Set(existingImplementers.map((item) => item.id))
        const additional = options
          .filter((item) => selectedIds.includes(item.id) && !existingIdSet.has(item.id))
          .map((item) => ({ id: item.id, name: item.name }))
        onAdd([...existingImplementers, ...additional])
      }}
    />
  )
}
