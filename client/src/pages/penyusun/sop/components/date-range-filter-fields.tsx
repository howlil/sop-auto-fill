import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'

export interface DateRangeFilterFieldsProps {
  fromId: string
  toId: string
  fromValue: string
  toValue: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
}

export function DateRangeFilterFields({
  fromId,
  toId,
  fromValue,
  toValue,
  onFromChange,
  onToChange,
}: DateRangeFilterFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <FormField label="Dari" variant="muted" htmlFor={fromId}>
        <Input
          id={fromId}
          type="date"
          className="h-9 text-xs"
          value={fromValue}
          onChange={(e) => onFromChange(e.target.value)}
        />
      </FormField>
      <FormField label="Sampai" variant="muted" htmlFor={toId}>
        <Input
          id={toId}
          type="date"
          className="h-9 text-xs"
          value={toValue}
          onChange={(e) => onToChange(e.target.value)}
        />
      </FormField>
    </div>
  )
}
