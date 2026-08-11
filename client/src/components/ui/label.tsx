import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cn } from '@/utils/cn'

export interface LabelProps
  extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> {
  /** Tampilkan asterisk (*) setelah teks untuk field wajib */
  required?: boolean
  /** default = primary (gray-700), muted = secondary (gray-500) */
  variant?: 'default' | 'muted'
}

const Label = React.forwardRef<
  React.ComponentRef<typeof LabelPrimitive.Root>,
  LabelProps
>(({ className, required, variant = 'default', children, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      'mb-1 block text-sm font-medium leading-5',
      variant === 'muted' ? 'text-muted-foreground' : 'text-secondary-foreground',
      className
    )}
    {...props}
  >
    {children}
    {required && <span className="text-danger"> *</span>}
  </LabelPrimitive.Root>
))
Label.displayName = LabelPrimitive.Root.displayName

export { Label }
