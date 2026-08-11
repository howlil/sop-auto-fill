import { FormField } from '@/components/ui/form-field'
import { Select } from '@/components/ui/select'

export interface OpdOption {
  id: string
  name: string
  disabled?: boolean
}

export interface OpdSelectFieldProps {
  value: string
  onValueChange: (value: string) => void
  options: OpdOption[]
  label?: string
  placeholder?: string
}

export function OpdSelectField({
  value,
  onValueChange,
  options,
  label = 'OPD',
  placeholder = 'Pilih OPD',
}: OpdSelectFieldProps) {
  return (
    <FormField label={label} required>
      <Select
        value={value}
        onValueChange={onValueChange}
        options={options.map((opd) => ({
          value: opd.id,
          label: opd.name,
          disabled: opd.disabled,
        }))}
        placeholder={placeholder}
      />
    </FormField>
  )
}
