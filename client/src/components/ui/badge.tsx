import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/utils/cn'

const badgeVariants = cva(
  'inline-flex min-h-6 items-center rounded-control border px-2 py-0.5 text-xs font-medium leading-4 transition-colors',
  {
    variants: {
      variant: {
        default: 'border-0 bg-primary-subtle text-primary-hover',
        secondary: 'border-0 bg-surface-muted text-secondary-foreground',
        outline: 'border-border-strong bg-transparent text-secondary-foreground',
        success: 'border-0 bg-success-subtle text-success-foreground',
        warning: 'border-0 bg-warning-subtle text-warning-foreground',
        destructive: 'border-0 bg-danger-subtle text-danger-foreground',
      },
    },
    defaultVariants: {
      variant: 'secondary',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
