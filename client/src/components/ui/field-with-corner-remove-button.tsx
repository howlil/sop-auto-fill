import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'

const cornerRemoveButtonClassName =
  'absolute right-1 top-1 z-10 h-5 w-5 rounded-full border border-border bg-surface p-0 text-muted-foreground shadow-surface hover:border-danger hover:bg-danger-subtle hover:text-danger'

interface FieldWithCornerRemoveButtonProps {
  children: ReactNode
  onRemove: () => void
  removeLabel?: string
  className?: string
  contentClassName?: string
}

/** Bungkus input/konten editable; tombol hapus lingkaran di pojok kanan atas. */
export function FieldWithCornerRemoveButton({
  children,
  onRemove,
  removeLabel = 'Hapus',
  className,
  contentClassName,
}: FieldWithCornerRemoveButtonProps) {
  return (
    <div className={cn('relative', className)}>
      <div className={cn('[&_textarea]:pr-7 [&_input]:pr-7', contentClassName)}>{children}</div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cornerRemoveButtonClassName}
        onClick={onRemove}
        title={removeLabel}
        aria-label={removeLabel}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  )
}
