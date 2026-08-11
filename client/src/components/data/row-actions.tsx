import type { LucideIcon } from 'lucide-react'
import { IconActionButton } from '@/components/ui/icon-action-button'
import { cn } from '@/utils/cn'

export interface RowAction {
  icon: LucideIcon
  title: string
  onClick?: () => void
  to?: string
  params?: Record<string, string>
  search?: Record<string, string>
  state?: Record<string, unknown>
  disabled?: boolean
  destructive?: boolean
  variant?: 'ghost' | 'outline'
  className?: string
}

export interface RowActionsProps {
  actions: RowAction[]
  align?: 'start' | 'center' | 'end'
  wrap?: boolean
  className?: string
}

const ALIGN_CLASS = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
} as const

export function RowActions({
  actions,
  align = 'start',
  wrap = false,
  className,
}: RowActionsProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1',
        ALIGN_CLASS[align],
        wrap && 'flex-wrap',
        className,
      )}
    >
      {actions.map((action) => (
        <IconActionButton
          key={action.title}
          icon={action.icon}
          title={action.title}
          onClick={action.onClick}
          to={action.to}
          params={action.params}
          search={action.search}
          state={action.state}
          disabled={action.disabled}
          destructive={action.destructive}
          variant={action.variant}
          className={action.className}
        />
      ))}
    </div>
  )
}
