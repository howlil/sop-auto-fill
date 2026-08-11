import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { AccountStatusBadge } from '@/components/status/account-status-badge'
import { cn } from '@/utils/cn'

export interface PersonNameCellProps {
  name?: string | null
  icon?: LucideIcon
  avatarText?: string
  iconClassName?: string
  avatarClassName?: string
  children?: ReactNode
}

export function PersonNameCell({
  name,
  icon: Icon,
  avatarText,
  iconClassName = 'text-blue-600',
  avatarClassName = 'bg-blue-100',
  children,
}: PersonNameCellProps) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'w-7 h-7 rounded-md flex items-center justify-center shrink-0',
          avatarClassName,
        )}
      >
        {Icon ? (
          <Icon className={cn('w-3.5 h-3.5', iconClassName)} />
        ) : (
          <span className="text-[11px] font-semibold text-blue-700">
            {avatarText ?? name?.[0] ?? '-'}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="font-medium text-foreground truncate">{name ?? '-'}</p>
        {children}
      </div>
    </div>
  )
}

export function PersonMonoCell({ value }: { value?: string | null }) {
  return <span className="font-mono text-secondary-foreground">{value ?? '-'}</span>
}

export function PersonTextCell({
  value,
  className,
}: {
  value?: string | null
  className?: string
}) {
  return <span className={cn('text-secondary-foreground', className)}>{value ?? '-'}</span>
}

export function PersonStatusCell({
  status,
  subtext,
}: {
  status: string
  subtext?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <AccountStatusBadge status={status} />
      {subtext ? <span className="text-[10px] text-muted-foreground">{subtext}</span> : null}
    </div>
  )
}
