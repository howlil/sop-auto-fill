import { cn } from '@/utils/cn'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface ToastProps {
  message: string
  type?: ToastType
  className?: string
  /** Role for aria-live region. Use 'status' for polite, 'alert' for assertive */
  role?: 'status' | 'alert'
  onDismiss?: () => void
}

const typeClasses: Record<ToastType, string> = {
  success: 'border-success bg-success-subtle text-success-foreground',
  error: 'border-danger bg-danger-subtle text-danger-foreground',
  info: 'border-info bg-info-subtle text-info-foreground',
}

const typeIcons: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
}

export function Toast({ message, type = 'success', className, role = 'status', onDismiss }: ToastProps) {
  const Icon = typeIcons[type]
  return (
    <div
      role={role}
      aria-live={role === 'alert' ? 'assertive' : 'polite'}
      className={cn(
        'flex w-full max-w-sm items-start gap-3 rounded-surface border px-4 py-3 text-sm leading-5 shadow-raised',
        typeClasses[type],
        className
      )}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <span className="flex-1 break-words whitespace-pre-wrap">{message}</span>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="-my-2 -mr-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
          aria-label="Tutup notifikasi"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </div>
  )
}

