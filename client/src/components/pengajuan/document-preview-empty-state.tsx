import { cn } from '@/utils/cn'

export interface DocumentPreviewEmptyStateProps {
  message?: string
  className?: string
}

export function DocumentPreviewEmptyState({
  message = 'Tidak ada SOP untuk ditampilkan.',
  className,
}: DocumentPreviewEmptyStateProps) {
  return (
    <div
      className={cn(
        'flex h-full min-h-[240px] items-center justify-center rounded-lg border border-dashed border-border bg-surface text-sm text-muted-foreground',
        className,
      )}
    >
      {message}
    </div>
  )
}
