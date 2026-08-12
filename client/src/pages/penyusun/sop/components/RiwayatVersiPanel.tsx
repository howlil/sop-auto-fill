import { useMutation, useQueryClient } from '@tanstack/react-query'
import { GitBranchPlus, History, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SopStatusBadge } from '@/components/status/sop-status-badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { useRiwayatVersi } from '@/api/sop'
import { sopApi } from '@/api/sop-client'
import { queryKeys } from '@/config/query-keys'
import type { SopRiwayatVersiRow } from '@/types/dto/sop.dto'
import { useState } from 'react'
import { formatDateIdLong } from '@/utils/format-date'

export interface RiwayatVersiPanelProps {
  workspaceId: string
  sopId: string
  activeDetailSopId?: string
  isReadOnly?: boolean
  onBuatVersiBaru?: (source: SopRiwayatVersiRow) => void
  isBuatVersiBaruPending?: boolean
}

export function RiwayatVersiPanel({
  workspaceId,
  sopId,
  activeDetailSopId,
  isReadOnly = false,
  onBuatVersiBaru,
  isBuatVersiBaruPending = false,
}: RiwayatVersiPanelProps) {
  const queryClient = useQueryClient()
  const { data: rows = [], isLoading } = useRiwayatVersi(sopId)
  const [hapusTarget, setHapusTarget] = useState<string | null>(null)
  const deleteMutation = useMutation({
    mutationFn: (detailId: string) => sopApi.hapusVersiDraft(detailId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.sop }),
        queryClient.invalidateQueries({ queryKey: queryKeys.sopRiwayatVersi(sopId) }),
      ])
    },
  })

  if (isLoading) return <LoadingState compact message="Memuat riwayat versi…" />
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
    <div className="space-y-2 p-3">
      <p className="text-xs font-medium text-secondary-foreground">Riwayat versi dokumen</p>
      <ul className="space-y-2">
        {rows.map((row) => {
          const isActive = row.detailSopId === activeDetailSopId
          return (
            <li
              key={row.detailSopId}
              className={`rounded-control border p-2 text-xs ${isActive ? 'border-primary bg-primary-subtle' : 'border-border bg-surface'}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">v{row.versi} · {row.nomorSOP}</p>
                  {row.revisiDariVersi != null ? (
                    <p className="mt-0.5 text-muted-foreground">Dibuat dari v{row.revisiDariVersi}</p>
                  ) : null}
                  <p className="mt-0.5 text-muted-foreground">{formatDateIdLong(row.updatedAt)}</p>
                </div>
                <SopStatusBadge status={row.status} label={row.statusLabel} showDomain={false} className="text-[10px]" />
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                  <a href={`/workspaces/${workspaceId}/sops/${row.detailSopId}`}>
                    {isActive ? 'Sedang dibuka' : 'Buka'}
                  </a>
                </Button>
                {onBuatVersiBaru && row.canBuatVersiBaru ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 border-success/30 text-success-foreground hover:bg-success-subtle"
                    onClick={() => onBuatVersiBaru(row)}
                    disabled={isBuatVersiBaruPending}
                  >
                    <GitBranchPlus className="mr-1 h-3 w-3" /> Buat versi baru
                  </Button>
                ) : null}
                {!isReadOnly && row.canHapusDraft ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 border-danger/30 text-danger hover:bg-danger-subtle"
                    onClick={() => setHapusTarget(row.detailSopId)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="mr-1 h-3 w-3" /> Hapus draft
                  </Button>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
      <ConfirmDialog
        open={hapusTarget != null}
        onOpenChange={(open) => { if (!open) setHapusTarget(null) }}
        title="Hapus versi draft?"
        description="Versi draft terbaru akan dihapus permanen dan versi selesai sebelumnya tetap tersimpan."
        confirmLabel="Hapus"
        destructive
        onConfirm={() => {
          if (hapusTarget == null) return
          void deleteMutation.mutateAsync(hapusTarget).then(() => setHapusTarget(null))
        }}
      />
    </div>
  )
}
