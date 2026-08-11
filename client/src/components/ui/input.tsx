import * as React from 'react'
import { cn } from '@/utils/cn'
import { useFormFieldContext } from '@/components/ui/form-field'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Error message to display and link via aria-describedby */
  errorMessage?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({
    className,
    type,
    errorMessage,
    'aria-describedby': ariaDescribedBy,
    'aria-labelledby': ariaLabelledBy,
    'aria-label': ariaLabel,
    'aria-required': ariaRequired,
    ...props
  }, ref) => {
    const field = useFormFieldContext()
    const generatedId = React.useId()
    const errorId = errorMessage ? `input-error-${generatedId}` : undefined
    const describedBy = [ariaDescribedBy, errorId].filter(Boolean).join(' ') || undefined
    const labelledBy = ariaLabel == null ? (ariaLabelledBy ?? field?.labelId) : ariaLabelledBy

    return (
      <>
        <input
          type={type}
          className={cn(
            'flex h-9 w-full rounded-control border border-border-strong bg-surface px-3 py-1.5 text-sm text-foreground',
            'placeholder:text-muted-foreground',
            'focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary',
            'disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:opacity-50',
            errorMessage && 'border-danger ring-2 ring-danger',
            className
          )}
          ref={ref}
          aria-invalid={!!errorMessage}
          aria-describedby={describedBy}
          aria-label={ariaLabel}
          aria-labelledby={labelledBy}
          aria-required={(ariaRequired ?? field?.required) || undefined}
          {...props}
        />
        {errorMessage ? (
          <p id={errorId} role="alert" className="mt-1.5 text-xs text-red-600">
            {errorMessage}
          </p>
        ) : null}
      </>
    )
  }
)
Input.displayName = 'Input'

export { Input }
