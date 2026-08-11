import { Badge } from '@/components/ui/badge'
import { cn } from '@/utils/cn'
import type { StatusBadgeColors } from '@/lib/status/status-badge.types'

const BASE_CLASS =
  'inline-flex min-h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border-0 px-2.5 py-0.5 text-xs font-medium leading-4 align-middle'

export interface DomainStatusBadgeProps {
  domainLabel: string
  label: string
  colors: StatusBadgeColors
  className?: string
  showDomain?: boolean
}

export function DomainStatusBadge({
  domainLabel,
  label,
  colors,
  className,
  showDomain = true,
}: DomainStatusBadgeProps) {
  return (
    <span className={cn('inline-flex shrink-0 flex-nowrap items-center gap-1 whitespace-nowrap', className)}>
      {showDomain ? (
        <span className="shrink-0 text-xs font-medium text-secondary-foreground">{domainLabel}</span>
      ) : null}
      <Badge className={cn(BASE_CLASS, colors.bgColor, colors.color)}>
        {label}
      </Badge>
    </span>
  )
}
