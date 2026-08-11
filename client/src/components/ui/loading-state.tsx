import { Loader2 } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface LoadingStateProps {
  message?: string
  description?: string
  compact?: boolean
  className?: string
}

/** Consistent, announced loading feedback for panels and page sections. */
export function LoadingState({
  message = 'Memuat data…',
  description,
  compact = false,
  className,
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        'flex items-center justify-center text-muted-foreground',
        compact ? 'gap-2 py-3 text-sm' : 'min-h-32 flex-col gap-3 p-6 text-center',
        className,
      )}
    >
      <Loader2
        className={cn('shrink-0 animate-spin text-primary motion-reduce:animate-none', compact ? 'h-4 w-4' : 'h-7 w-7')}
        aria-hidden
      />
      <div>
        <p className="text-sm font-medium text-secondary-foreground">{message}</p>
        {description ? <p className="mt-1 text-sm leading-5">{description}</p> : null}
      </div>
    </div>
  )
}

export interface LoadingTableRowProps extends LoadingStateProps {
  colSpan: number
}

/** Valid table loading state for use directly inside tbody. */
export function LoadingTableRow({ colSpan, ...props }: LoadingTableRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-0 align-middle">
        <LoadingState {...props} />
      </td>
    </tr>
  )
}
