import { cn } from '@/utils/cn'

function Skeleton({
  className,
  'aria-hidden': ariaHidden = true,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden={ariaHidden}
      className={cn('animate-pulse rounded-control bg-surface-muted motion-reduce:animate-none', className)}
      {...props}
    />
  )
}

export { Skeleton }
