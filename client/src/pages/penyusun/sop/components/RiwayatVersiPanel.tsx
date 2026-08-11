import { Link } from '@tanstack/react-router'
import { GitBranchPlus, History, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SopStatusBadge } from '@/components/status/sop-status-badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { useHapusVersiDraft, useRiwayatVersi } from '@/api/sop'
import { ROUTES } from '@/utils/constants'
import type { SopRiwayatVersiRow, StatusSOP } from '@/types/dto/sop.dto'
import { useState } from 'react'
import { formatDateIdLong } from '@/utils/format-date'
import { isTerminalVersionStatus } from '@/lib/sop/sop-version-domain'

export interface RiwayatVersiPanelProps {
  sopId: string
  activeDetailSopId?: string
  isReadOnly?: boolean
  onBuatVersiBaru?: (source: SopRiwayatVersiRow) => void
  isBuatVersiBaruPending?: boolean
  buatVersiBaruBlockingReason?: string | null
}

export function RiwayatVersiPanel({
  sopId,
  activeDetailSopId,
  isReadOnly = false,
  onBuatVersiBaru,
  isBuatVersiBaruPending = false,
  buatVersiBaruBlockingReason = null,
}: RiwayatVersiPanelProps) {
  const { data: rows = [], isLoading } = useRiwayatVersi(sopId)
  const { mutateAsync: hapusDraft, isPending: isDeleting } = useHapusVersiDraft(sopId)
  const [hapusTarget, setHapusTarget] = useState<string | null>(null)

  if (isLoading) {
    return <LoadingState compact message="Memuat riwayat versi…" />
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<History />}
        title="Belum ada riwayat versi"
        description="Versi dokumen akan muncul di sini setelah dibuat."
        className="min-h-0 py-8"
      />
    )
  }

  return (
    <div className="p-3 space-y-2">
      <p className="text-xs font-medium text-secondary-foreground">Riwayat versi dokumen</p>
      <ul className="space-y-2">
        {rows.map((row) => {
          const isActive = row.detailSopId === activeDetailSopId
          return (
            <li
              key={row.detailSopId}
              data-testid={`sop-version-row-${row.versi}`}
              className={`rounded-control border p-2 text-xs ${isActive ? 'border-primary bg-primary-subtle' : 'border-border bg-surface'}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">
                    v{row.versi} · {row.nomorSOP}
                  </p>
                  {row.revisiDariVersi != null ? (
                    <p className="text-muted-foreground mt-0.5">Revisi dari v{row.revisiDariVersi}</p>
                  ) : null}
                  <p className="text-muted-foreground mt-0.5">{formatDateIdLong(row.updatedAt)}</p>
                </div>
                <SopStatusBadge
                  status={row.status as StatusSOP}
                  label={row.statusLabel}
                  showDomain={false}
                  className="text-[10px]"
                />
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                  <Link
                    to={ROUTES.PENYUSUN.DETAIL_SOP}
                    params={{ id: row.detailSopId }}
                  >
                    {isActive ? 'Sedang dibuka' : 'Buka'}
                  </Link>
                </Button>
                {onBuatVersiBaru && isTerminalVersionStatus(row.status) ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 border-success/30 text-success-foreground hover:bg-success-subtle"
                    onClick={() => onBuatVersiBaru(row)}
                    disabled={isBuatVersiBaruPending || !row.canBuatVersiBaru}
                    aria-label={`Buat versi baru dari versi ${row.versi}`}
                    title={
                      row.canBuatVersiBaru ? undefined : (buatVersiBaruBlockingReason ?? undefined)
                    }
                  >
                    <GitBranchPlus className="w-3 h-3 mr-1" aria-hidden />
                    Buat dari versi ini
                  </Button>
                ) : null}
                {!isReadOnly && row.canHapusDraft ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 border-danger/30 text-danger hover:bg-danger-subtle"
                    onClick={() => setHapusTarget(row.detailSopId)}
                    disabled={isDeleting}
                  >
                    <Trash2 className="w-3 h-3 mr-1" aria-hidden />
                    Hapus draft
                  </Button>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
      <ConfirmDialog
        open={hapusTarget != null}
        onOpenChange={(open) => {
          if (!open) setHapusTarget(null)
        }}
        title="Hapus versi draft?"
        description="Versi draft revisi akan dihapus permanen. Versi yang berlaku tidak terpengaruh."
        confirmLabel="Hapus"
        destructive
        onConfirm={() => {
          if (hapusTarget == null) return
          void hapusDraft(hapusTarget).then(() => setHapusTarget(null))
        }}
      />
    </div>
  )
}
