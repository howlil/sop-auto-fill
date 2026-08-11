import type { Dispatch, SetStateAction } from 'react'
import { FormDialog } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'

export type PeraturanFormData = {
  peraturan: string
  nomor: string
  tahun: string
  tentang: string
}

export interface PeraturanFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  value: PeraturanFormData
  onChange: Dispatch<SetStateAction<PeraturanFormData>>
  onConfirm: () => void
  confirmDisabled?: boolean
}

export function PeraturanFormDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  value,
  onChange,
  onConfirm,
  confirmDisabled,
}: PeraturanFormDialogProps) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      onConfirm={onConfirm}
      confirmDisabled={confirmDisabled}
      size="md"
    >
      <FormField label="Peraturan" required>
        <Input
          className="h-9 text-xs"
          placeholder="Contoh: Permendikbud, Perda, SK Kadis"
          value={value.peraturan}
          onChange={(event) =>
            onChange((prev) => ({ ...prev, peraturan: event.target.value }))
          }
        />
      </FormField>
      <FormField label="Nomor" required>
        <Input
          className="h-9 text-xs"
          placeholder="Contoh: 1"
          value={value.nomor}
          onChange={(event) =>
            onChange((prev) => ({ ...prev, nomor: event.target.value }))
          }
        />
      </FormField>
      <FormField label="Tahun" required>
        <Input
          className="h-9 text-xs"
          placeholder="2026"
          maxLength={4}
          value={value.tahun}
          onChange={(event) =>
            onChange((prev) => ({ ...prev, tahun: event.target.value }))
          }
        />
      </FormField>
      <FormField label="Tentang" required>
        <Input
          className="h-9 text-xs"
          placeholder="Contoh: Penerimaan Peserta Didik Baru"
          value={value.tentang}
          onChange={(event) =>
            onChange((prev) => ({ ...prev, tentang: event.target.value }))
          }
        />
      </FormField>
    </FormDialog>
  )
}
