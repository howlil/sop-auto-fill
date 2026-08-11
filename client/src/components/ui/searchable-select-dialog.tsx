import { useEffect, useId, useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/utils/cn'

export interface SearchableSelectDialogProps<T> {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  searchPlaceholder: string
  items: T[]
  existingIds?: readonly string[]
  getId: (item: T) => string
  getSearchText: (item: T) => string
  renderItem: (item: T) => React.ReactNode
  emptyMessage: string
  emptySearchMessage: string
  confirmLabel?: string
  cancelLabel?: string
  contentClassName?: string
  listClassName?: string
  itemClassName?: string
  onConfirm: (selectedIds: string[]) => void
}

export function SearchableSelectDialog<T>({
  open,
  onOpenChange,
  title,
  description,
  searchPlaceholder,
  items,
  existingIds = [],
  getId,
  getSearchText,
  renderItem,
  emptyMessage,
  emptySearchMessage,
  confirmLabel = 'Tambahkan',
  cancelLabel = 'Batal',
  contentClassName = 'max-w-lg',
  listClassName = 'h-[220px]',
  itemClassName,
  onConfirm,
}: SearchableSelectDialogProps<T>) {
  const selectionStatusId = useId()
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setSelectedIds([])
    }
  }, [open])

  const existingIdSet = useMemo(() => new Set(existingIds), [existingIds])
  const normalizedQuery = query.trim().toLowerCase()
  const filteredItems = useMemo(() => {
    if (!normalizedQuery) return items
    return items.filter((item) =>
      getSearchText(item).toLowerCase().includes(normalizedQuery),
    )
  }, [getSearchText, items, normalizedQuery])

  const handleClose = () => {
    setQuery('')
    setSelectedIds([])
    onOpenChange(false)
  }

  const handleConfirm = () => {
    onConfirm(selectedIds)
    handleClose()
  }

  const toggle = (id: string) => {
    if (existingIdSet.has(id)) return
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          contentClassName,
          'max-h-[90vh] overflow-hidden scrollbar-hide p-0 [&>*]:p-0',
        )}
      >
        <div className="flex flex-col h-full max-h-[90vh]">
          <DialogHeader className="px-5 pt-5 pb-3 border-b-0">
            <DialogTitle className="text-base">{title}</DialogTitle>
            {description != null ? (
              <DialogDescription className="mt-1 text-xs leading-snug">
                {description}
              </DialogDescription>
            ) : null}
          </DialogHeader>

          <div className="px-5 pb-4">
            <SearchInput
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 w-full max-w-none rounded-control border border-border-strong bg-surface-subtle px-2.5 focus-within:border-primary focus-within:bg-surface focus-within:ring-2 focus-within:ring-primary/20"
              inputClassName="border-0 bg-transparent focus:ring-0 focus-visible:ring-0 text-sm"
            />
          </div>

          <div className="flex-1 flex flex-col min-h-0 border-t border-border">
            <div className="bg-surface-subtle/50 px-5 py-2 border-b border-border">
              <p
                id={selectionStatusId}
                className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                {filteredItems.length} pilihan ditemukan
                {selectedIds.length > 0 ? ` · ${selectedIds.length} dipilih` : ''}
              </p>
            </div>

            <div
              className={cn('overflow-y-auto scrollbar-hide', listClassName)}
              aria-describedby={selectionStatusId}
            >
              <div className="divide-y divide-border">
                {filteredItems.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    {items.length === 0 ? emptyMessage : emptySearchMessage}
                  </div>
                ) : (
                    filteredItems.map((item) => {
                      const id = getId(item)
                      const already = existingIdSet.has(id)
                      const selected = selectedIds.includes(id)
                      return (
                        <label
                          key={id}
                          className={cn(
                            'relative flex min-h-9 w-full cursor-pointer items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-surface-subtle has-[:focus-visible]:z-[1] has-[:focus-visible]:bg-surface-subtle has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary/50',
                            selected && 'bg-primary-subtle/50',
                            already && 'opacity-60 cursor-not-allowed',
                            itemClassName,
                          )}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={selected || already}
                            disabled={already}
                            onChange={() => toggle(id)}
                          />
                          <span
                            className={cn(
                              'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                              selected || already
                                ? 'border-primary bg-primary'
                                : 'border-border-strong bg-surface',
                            )}
                            aria-hidden
                          >
                            {selected || already ? <Check className="h-3 w-3 text-white" /> : null}
                          </span>
                          <div className="min-w-0 flex-1">
                            {renderItem(item)}
                            {already ? <span className="sr-only"> Sudah ditambahkan.</span> : null}
                          </div>
                        </label>
                      )
                    })
                  )}
              </div>
            </div>
          </div>

          <DialogFooter className="px-5 py-4 gap-2 border-t border-border bg-surface">
            <Button variant="outline" size="default" onClick={handleClose}>
              {cancelLabel}
            </Button>
            <Button
              size="default"
              disabled={selectedIds.length === 0}
              onClick={handleConfirm}
            >
              {confirmLabel}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
