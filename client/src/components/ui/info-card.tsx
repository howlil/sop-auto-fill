import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export interface InfoCardProps {
  children: ReactNode
  /** Color variant for contextual cards (success, warning, neutral). */
  variant?: 'neutral' | 'success' | 'warning' | 'info'
  /** Optional title heading */
  title?: string
  /** Optional icon */
  icon?: ReactNode
  className?: string
}

const VARIANT_MAP: Record<string, string> = {
  neutral: 'border-border bg-surface-subtle text-secondary-foreground',
  success: 'border-success bg-success-subtle text-success-foreground',
  warning: 'border-warning bg-warning-subtle text-warning-foreground',
  info: 'border-info bg-info-subtle text-info-foreground',
}

/**
 * A small info/note card used for contextual information, warnings, and callouts.
 * Replaces the ~15 instances of `<div className="p-3 bg-surface-subtle rounded-lg border border-border">`.
 */
export function InfoCard({ children, variant = 'neutral', title, icon, className }: InfoCardProps) {
  return (
    <div className={cn('rounded-surface border p-card text-sm leading-5', VARIANT_MAP[variant], className)}>
      {(title || icon) && (
        <div className="flex items-center gap-1.5 mb-1.5 font-medium">
          {icon && <span className="shrink-0 [&_svg]:w-4 [&_svg]:h-4">{icon}</span>}
          {title && <span>{title}</span>}
        </div>
      )}
      {children}
    </div>
  )
}
