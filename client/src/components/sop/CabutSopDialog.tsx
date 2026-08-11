import { ConfirmDialog } from '@/components/ui/confirm-dialog'

export interface CabutSopDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sopJudul: string
  nomorSop: string
  onConfirm: () => void
  isPending?: boolean
}

export function CabutSopDialog({
  open,
  onOpenChange,
  sopJudul,
  nomorSop,
  onConfirm,
  isPending = false,
}: CabutSopDialogProps) {
  const nomorLabel = nomorSop.trim() !== '' ? nomorSop : '—'
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Cabut SOP?"
      description={`Anda akan mencabut SOP "${sopJudul}" (${nomorLabel}). Setelah dicabut, SOP tidak berlaku lagi dan hanya tersedia untuk kebutuhan riwayat dan audit. Tindakan ini tidak dapat dibatalkan.`}
      confirmLabel={isPending ? 'Mencabut…' : 'Ya, cabut SOP'}
      cancelLabel="Batal"
      onConfirm={onConfirm}
      destructive
    />
  )
}
