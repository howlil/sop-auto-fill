import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'

export interface DialogFooterActionsProps {
  cancelLabel?: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
  confirmDisabled?: boolean
  /** Use destructive (red) variant for confirm button */
  destructive?: boolean
}

/**
 * Standard cancel/confirm button pair for dialog footers.
 */
export function DialogFooterActions({
  cancelLabel = 'Batal',
  confirmLabel,
  onCancel,
  onConfirm,
  confirmDisabled,
  destructive,
}: DialogFooterActionsProps) {
  return (
    <DialogFooter className="gap-2 pt-3">
      <Button variant="outline" size="sm" onClick={onCancel}>
        {cancelLabel}
      </Button>
      <Button size="sm" onClick={onConfirm} disabled={confirmDisabled} variant={destructive ? 'destructive' : 'default'}>
        {confirmLabel}
      </Button>
    </DialogFooter>
  )
}
