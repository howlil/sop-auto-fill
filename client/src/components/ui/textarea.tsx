import * as React from 'react'
import { cn } from '@/utils/cn'
import { useFormFieldContext } from '@/components/ui/form-field'

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({
    className,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-required': ariaRequired,
    ...props
  }, ref) => {
    const field = useFormFieldContext()
    return (
      <textarea
        ref={ref}
        className={cn(
          'flex min-h-24 w-full rounded-control border border-border-strong bg-surface p-3 text-sm text-foreground',
          'placeholder:text-muted-foreground',
          'focus:outline-none focus:ring-2 focus:ring-primary',
          'disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:opacity-50',
          'resize-none',
          className
        )}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel == null ? (ariaLabelledBy ?? field?.labelId) : ariaLabelledBy}
        aria-required={(ariaRequired ?? field?.required) || undefined}
        {...props}
      />
    )
  }
)
Textarea.displayName = 'Textarea'

export { Textarea }
