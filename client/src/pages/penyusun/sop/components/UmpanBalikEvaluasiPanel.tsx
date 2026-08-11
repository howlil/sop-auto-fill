import { Check, MessageSquare } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { HasilEvaluasiBadge } from '@/components/status/hasil-evaluasi-badge'
import { useTandaiTindakLanjutSelesai } from '@/api/evaluasi'
import {
  getStatusTindakLanjutBadgeClass,
  getStatusTindakLanjutLabel,
} from '@/lib/status'
import type { UmpanBalikEvaluasiDetail } from '@/types/dto/evaluasi.dto'

export interface UmpanBalikEvaluasiPanelProps {
  umpanBalik: UmpanBalikEvaluasiDetail | null | undefined
  isLoading?: boolean
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function UmpanBalikEvaluasiPanel({
  umpanBalik,
  isLoading = false,
}: UmpanBalikEvaluasiPanelProps) {
  const tandaiTindakLanjutSelesai = useTandaiTindakLanjutSelesai(umpanBalik?.detailSopId)

  if (isLoading) {
    return <LoadingState compact message="Memuat komentar evaluasi…" />
  }

  if (!umpanBalik) {
    return (
      <EmptyState
        icon={<MessageSquare />}
        title="Belum ada komentar evaluasi"
        description="Catatan evaluator untuk dokumen ini akan ditampilkan di sini."
        className="min-h-0 py-8"
      />
    )
  }

  const umpanBalikData = umpanBalik
  const isDitolak =
    umpanBalikData.pengajuanStatus === 'DITOLAK' || umpanBalikData.hasil === 'DITOLAK'
  const isTerbuka = umpanBalikData.statusTindakLanjut === 'TERBUKA'
  const isSelesai = umpanBalikData.statusTindakLanjut === 'SELESAI'
  const tindakLanjutLabel = getStatusTindakLanjutLabel(
    umpanBalikData.statusTindakLanjut,
    umpanBalikData.statusTindakLanjutLabel,
  )

  const handleTandaiSelesai = () => {
    void tandaiTindakLanjutSelesai
      .mutateAsync({
        pengajuanEvaluasiId: umpanBalikData.pengajuanEvaluasiId,
        detailSopId: umpanBalikData.detailSopId,
      })
      .catch(() => undefined)
  }

  return (
    <div className="p-3 space-y-3">
      <p className="text-[10px] text-muted-foreground leading-snug">
        {isDitolak
          ? 'Versi ini ditolak final dan tidak dapat diajukan ulang. Gunakan alasan evaluator sebagai acuan untuk membuat versi baru.'
          : 'Komentar evaluator disimpan pada nilai evaluasi. Kirim ulang evaluasi setelah perbaikan tersimpan.'}
      </p>
      <div
        className={`space-y-2 rounded-control border p-3 text-xs ${isDitolak ? 'border-danger/30 bg-danger-subtle' : 'border-warning/30 bg-warning-subtle'}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <HasilEvaluasiBadge hasil={umpanBalikData.hasil} label={umpanBalikData.hasilLabel} />
          {tindakLanjutLabel && (isTerbuka || isSelesai) ? (
            <Badge
              className={`text-xs inline-flex items-center gap-0.5 ${getStatusTindakLanjutBadgeClass(umpanBalikData.statusTindakLanjut)}`}
            >
              {isSelesai ? <Check className="w-3 h-3" aria-hidden /> : null}
              {tindakLanjutLabel}
            </Badge>
          ) : null}
        </div>
        {umpanBalikData.dinilaiOleh ? (
          <p className="text-secondary-foreground">
            Evaluator:{' '}
            <span className="font-medium text-foreground">{umpanBalikData.dinilaiOleh.nama}</span>
          </p>
        ) : null}
        <p className="text-foreground whitespace-pre-wrap break-words">
          {umpanBalikData.catatan ?? '—'}
        </p>
        {umpanBalikData.ditindaklanjutiPada && umpanBalikData.ditindaklanjutiOleh ? (
          <p className="text-[10px] text-muted-foreground">
            Ditandai selesai oleh {umpanBalikData.ditindaklanjutiOleh.nama} pada{' '}
            {formatDate(umpanBalikData.ditindaklanjutiPada)}
          </p>
        ) : null}
        {isTerbuka && !isDitolak ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-1 h-8 w-full gap-1.5 text-xs"
            disabled={tandaiTindakLanjutSelesai.isPending}
            onClick={handleTandaiSelesai}
          >
            <Check className="h-3.5 w-3.5" aria-hidden />
            {tandaiTindakLanjutSelesai.isPending
              ? 'Menandai selesai…'
              : 'Tandai tindak lanjut selesai'}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
