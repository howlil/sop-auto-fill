/**
 * Reusable inline-editable list of strings (add, edit, remove).
 * Replaces the repeated pattern in DetailSOPMetadataPanel.
 */
import { Plus } from 'lucide-react'
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea'
import { Button } from '@/components/ui/button'
import { FieldWithCornerRemoveButton } from '@/components/ui/field-with-corner-remove-button'

interface AddItemIconButtonProps {
  onClick: () => void
  label?: string
}

/** Tombol tambah item berbentuk ikon + (konsisten di header kartu metadata SOP). */
export function AddItemIconButton({
  onClick,
  label = 'Tambah',
}: AddItemIconButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="h-7 w-7 shrink-0"
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      <Plus className="h-3.5 w-3.5" />
    </Button>
  )
}

interface EditableStringListProps {
  items: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  emptyMessage?: string
  /** Sembunyikan tombol tambah bila parent menempatkannya di header kartu. */
  showAddButton?: boolean
}

export function EditableStringList({
  items,
  onChange,
  placeholder = '',
  emptyMessage = 'Belum ada item. Gunakan tombol + di atas untuk menambahkan.',
  showAddButton = true,
}: EditableStringListProps) {
  const handleAdd = () => onChange([...items, ''])

  const handleChange = (idx: number, value: string) => {
    const next = [...items]
    next[idx] = value
    onChange(next)
  }

  const handleRemove = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx))
  }

  return (
    <>
      {showAddButton ? (
        <div className="flex justify-end">
          <AddItemIconButton onClick={handleAdd} />
        </div>
      ) : null}
      <div className={showAddButton ? 'space-y-2 mt-1.5' : 'space-y-2'}>
        {items.map((item, idx) => (
          <FieldWithCornerRemoveButton key={idx} onRemove={() => handleRemove(idx)}>
            <AutoResizeTextarea
              className="min-h-9 w-full py-1.5"
              minRows={1}
              maxRows={8}
              value={item}
              onChange={(e) => handleChange(idx, e.target.value)}
              placeholder={placeholder ? `${placeholder} ${idx + 1}` : undefined}
            />
          </FieldWithCornerRemoveButton>
        ))}
        {items.length === 0 && (
          <p className="text-[11px] text-muted-foreground">{emptyMessage}</p>
        )}
      </div>
    </>
  )
}
