import { PinDialog } from '@/components/security/pin-dialog'

export interface PinVerificationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  onConfirm: (pin: string) => boolean | Promise<boolean>
  /** Label untuk tombol konfirmasi */
  confirmLabel?: string
}

export function PinVerificationDialog({
  open,
  onOpenChange,
  title,
  description = 'Masukkan PIN TTE Anda untuk melanjutkan (simulasi).',
  onConfirm,
  confirmLabel = 'Tanda Tangan',
}: PinVerificationDialogProps) {
  return (
    <PinDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      loadingLabel="Menandatangani..."
      pinLabel="PIN TTE"
      pinPlaceholder="Masukkan PIN"
      maxLength={8}
      requireConfirm={false}
      onSubmit={({ pin }) => onConfirm(pin)}
    />
  )
}
