import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/utils/cn'

export interface RiwayatOpdRow {
  id: string
  namaOpd: string
  isAktif: boolean
  primaryDate?: string
  primaryDateLabel?: string
  secondaryDate?: string
  secondaryDateLabel?: string
}

export interface RiwayatOpdDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle?: string
  rows?: RiwayatOpdRow[]
  isLoading?: boolean
  isError?: boolean
  loadingMessage?: string
  emptyMessage: string
  errorMessage?: string
  className?: string
  listClassName?: string
}

export function RiwayatOpdDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  rows,
  isLoading = false,
  isError = false,
  loadingMessage = 'Memuat riwayat.',
  emptyMessage,
  errorMessage = 'Gagal memuat riwayat. Coba lagi.',
  className,
  listClassName,
}: RiwayatOpdDialogProps) {
  const hasRows = !isLoading && !isError && rows != null && rows.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn('max-w-lg max-h-[85vh] overflow-y-auto', className)}
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle className="text-sm">{title}</DialogTitle>
          {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
        </DialogHeader>
        <div
          className={cn(
            'space-y-2 text-sm text-secondary-foreground max-h-[min(50vh,320px)] overflow-y-auto',
            listClassName,
          )}
        >
          {isLoading ? <p className="text-muted-foreground">{loadingMessage}</p> : null}
          {isError ? <p className="text-danger">{errorMessage}</p> : null}
          {!isLoading && !isError && rows?.length === 0 ? (
            <p className="text-muted-foreground">{emptyMessage}</p>
          ) : null}
          {hasRows
            ? rows.map((row) => (
                <div
                  key={row.id}
                  className="rounded-md border border-border bg-surface-subtle/80 px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{row.namaOpd}</p>
                    {row.isAktif ? (
                      <Badge variant="success" className="text-[10px]">
                        OPD saat ini
                      </Badge>
                    ) : null}
                  </div>
                  {row.primaryDate ? (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {row.primaryDateLabel ? `${row.primaryDateLabel}: ` : ''}
                      {row.primaryDate}
                    </p>
                  ) : null}
                  {row.secondaryDate ? (
                    <p className="text-[11px] text-muted-foreground">
                      {row.secondaryDateLabel ? `${row.secondaryDateLabel}: ` : ''}
                      {row.secondaryDate}
                    </p>
                  ) : null}
                </div>
              ))
            : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
