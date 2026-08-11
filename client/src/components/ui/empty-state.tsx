import { ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
  /** Render as a table row with colspan */
  asTableRow?: boolean
  colSpan?: number
}

/**
 * Empty state display: icon + title + description + optional action.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  asTableRow,
  colSpan = 1,
}: EmptyStateProps) {
  const content = (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-6 text-center',
        !asTableRow && 'min-h-[120px]',
        className
      )}
    >
      {icon && (
        <div className="mb-3 text-muted-foreground [&_svg]:h-8 [&_svg]:w-8">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm leading-5 text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )

  if (asTableRow) {
    return (
      <tr>
        <td colSpan={colSpan} className="p-0 align-middle">
          {content}
        </td>
      </tr>
    )
  }

  return content
}

/**
 * Empty state rendered as a table row.
 */
export function EmptyTableRow({
  icon,
  title,
  description,
  action,
  colSpan = 1,
  className,
}: Omit<EmptyStateProps, 'asTableRow'>) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      action={action}
      asTableRow
      colSpan={colSpan}
      className={className}
    />
  )
}
