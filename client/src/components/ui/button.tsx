import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/utils/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-control text-ui-body font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-white hover:bg-primary-hover active:bg-primary-active',
        destructive: 'bg-danger text-white hover:bg-red-800 active:bg-red-900',
        outline: 'border border-border-strong bg-surface text-secondary-foreground hover:bg-surface-subtle',
        ghost: 'text-secondary-foreground hover:bg-surface-muted',
        secondary: 'bg-surface-muted text-foreground hover:bg-border',
      },
      size: {
        default: 'h-9 px-4 py-1.5 gap-2 text-sm',
        sm: 'h-8 px-3 text-xs gap-1.5',
        lg: 'h-10 px-5 gap-2.5 text-base',
        icon: 'h-9 w-9',
        'icon-sm': 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    const resolvedVariant = variant ?? 'default'
    const isSolid = resolvedVariant === 'default' || resolvedVariant === 'destructive'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        data-button-appearance={isSolid ? 'solid' : 'non-solid'}
        data-button-variant={resolvedVariant}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
