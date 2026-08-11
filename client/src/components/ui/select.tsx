import * as React from 'react'
import { cn } from '@/utils/cn'
import { useFormFieldContext } from '@/components/ui/form-field'

export interface SelectOption {
  value: string
  label: React.ReactNode
  disabled?: boolean
}

export interface SelectProps
  extends Omit<
    React.SelectHTMLAttributes<HTMLSelectElement>,
    'value' | 'onChange'
  > {
  value?: string
  onValueChange?: (value: string) => void
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void
  options?: SelectOption[]
  placeholder?: string
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      value,
      onValueChange,
      options,
      placeholder,
      children,
      onChange,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      'aria-required': ariaRequired,
      ...props
    },
    ref
  ) => {
    const field = useFormFieldContext()
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange?.(e)
      onValueChange?.(e.target.value)
    }

    return (
      <select
        ref={ref}
        value={value ?? ''}
        onChange={handleChange}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel == null ? (ariaLabelledBy ?? field?.labelId) : ariaLabelledBy}
        aria-required={(ariaRequired ?? field?.required) || undefined}
        className={cn(
          'flex h-9 w-full rounded-control border border-border-strong bg-surface px-3 py-1.5 text-sm text-foreground',
          'focus:outline-none focus:ring-2 focus:ring-primary',
          'disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:opacity-50',
          className
        )}
        {...props}
      >
        {placeholder != null && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options != null
          ? options.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
              >
                {opt.label}
              </option>
            ))
          : children}
      </select>
    )
  }
)
Select.displayName = 'Select'

export { Select }
