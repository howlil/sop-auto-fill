import type { ReactNode } from 'react'
import { FormDialog } from '@/components/ui/form-dialog'
import {
  PersonIdentityFields,
  type PersonIdentityLabels,
  type PersonIdentityValue,
} from '@/components/forms/person-identity-fields'

export interface PersonFormDialogProps<T extends PersonIdentityValue> {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  value: T
  onChange: React.Dispatch<React.SetStateAction<T>>
  onConfirm: () => void
  confirmLabel?: string
  cancelLabel?: string
  confirmDisabled?: boolean
  showStatus?: boolean
  labels?: PersonIdentityLabels
  placeholders?: Partial<Record<'name' | 'nip' | 'email' | 'jabatan' | 'pangkat' | 'phone', string>>
  beforeFields?: ReactNode
  afterFields?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export function PersonFormDialog<T extends PersonIdentityValue>({
  open,
  onOpenChange,
  title,
  description,
  value,
  onChange,
  onConfirm,
  confirmLabel = 'Simpan',
  cancelLabel = 'Batal',
  confirmDisabled,
  showStatus = false,
  labels,
  placeholders,
  beforeFields,
  afterFields,
  size = 'md',
  className,
}: PersonFormDialogProps<T>) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      onConfirm={onConfirm}
      confirmDisabled={confirmDisabled}
      size={size}
      className={className}
    >
      {beforeFields}
      <PersonIdentityFields
        value={value}
        onChange={onChange}
        showStatus={showStatus}
        labels={labels}
        placeholders={placeholders}
      />
      {afterFields}
    </FormDialog>
  )
}
