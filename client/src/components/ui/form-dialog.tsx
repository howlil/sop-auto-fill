import type { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DialogFooterActions } from '@/components/ui/dialog-footer-actions'
import { cn } from '@/utils/cn'

export interface FormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  confirmDisabled?: boolean
  /** Dialog width variant. */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Class untuk wrapper konten (area form). */
  contentClassName?: string
  /** Class untuk DialogContent. */
  className?: string
  children: ReactNode
}

const SIZE_MAP: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
}

/**
 * Pre-wired form dialog: title + description + form content + Batal/Simpan footer.
 * Covers the ~20 create/edit dialog instances across the codebase.
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Simpan',
  cancelLabel = 'Batal',
  onConfirm,
  confirmDisabled,
  size = 'md',
  contentClassName,
  className,
  children,
}: FormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(SIZE_MAP[size], 'max-h-[90vh] overflow-y-auto scrollbar-hide', className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description != null && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        <div className={cn('space-y-4', contentClassName)}>{children}</div>

        <DialogFooterActions
          cancelLabel={cancelLabel}
          confirmLabel={confirmLabel}
          onCancel={() => onOpenChange(false)}
          onConfirm={onConfirm}
          confirmDisabled={confirmDisabled}
        />
      </DialogContent>
    </Dialog>
  )
}
