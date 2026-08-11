import { cn } from '@/utils/cn'
import {
  deriveTahapPenilaianSop,
  type TahapPenilaianSop,
} from '@/lib/evaluasi/evaluasi-domain'
import { HasilEvaluasiBadge } from './hasil-evaluasi-badge'
import { SopStatusBadge } from './sop-status-badge'
import { TahapPenilaianBadge } from './tahap-penilaian-badge'

export interface SopEvaluasiStatusGroupProps {
  statusDokumen: string
  statusDokumenLabel: string
  hasilEvaluasi?: string
  hasilEvaluasiLabel?: string
  statusTindakLanjut?: string | null
  statusTindakLanjutLabel?: string | null
  /** Jika diisi, menggantikan turunan otomatis dari hasil/tindak lanjut. */
  tahapPenilaian?: TahapPenilaianSop
  className?: string
  showPenilaian?: boolean
}

export function SopEvaluasiStatusGroup({
  statusDokumen,
  statusDokumenLabel,
  hasilEvaluasi,
  hasilEvaluasiLabel,
  statusTindakLanjut,
  statusTindakLanjutLabel,
  tahapPenilaian: tahapProp,
  className,
  showPenilaian = true,
}: SopEvaluasiStatusGroupProps) {
  const tahap =
    tahapProp ??
    deriveTahapPenilaianSop({
      hasil: hasilEvaluasi,
      statusTindakLanjut: statusTindakLanjut ?? null,
      statusDetail: statusDokumen,
    })
  const showTahapDominan =
    showPenilaian &&
    (tahap === 'tinjauan_ulang' || tahap === 'menunggu_perbaikan_opd')
  const showHasilBadge =
    showPenilaian &&
    !showTahapDominan &&
    hasilEvaluasi !== undefined &&
    hasilEvaluasiLabel !== undefined
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <SopStatusBadge status={statusDokumen} label={statusDokumenLabel} />
      {showTahapDominan ? <TahapPenilaianBadge tahap={tahap} /> : null}
      {showHasilBadge ? (
        <HasilEvaluasiBadge hasil={hasilEvaluasi} label={hasilEvaluasiLabel} />
      ) : null}
      {statusTindakLanjutLabel && !showTahapDominan ? (
        <span className="text-[10px] text-secondary-foreground">{statusTindakLanjutLabel}</span>
      ) : null}
    </div>
  )
}
