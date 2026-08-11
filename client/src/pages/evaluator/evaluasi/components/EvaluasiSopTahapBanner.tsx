import { Info } from 'lucide-react'
import { formatDateId } from '@/utils/format-date'
import {
  getTahapPenilaianCopy,
  isDetailDiperbaruiSetelahTindakLanjut,
  type TahapPenilaianSop,
} from '@/lib/evaluasi/evaluasi-domain'

export interface EvaluasiSopTahapBannerProps {
  tahap: TahapPenilaianSop
  versi?: number
  detailUpdatedAt?: string | null
  ditindaklanjutiPada?: string | null
}

export function EvaluasiSopTahapBanner({
  tahap,
  versi,
  detailUpdatedAt,
  ditindaklanjutiPada,
}: EvaluasiSopTahapBannerProps) {
  const copy = getTahapPenilaianCopy(tahap)
  if (!copy.bannerTitle) {
    return null
  }
  const diperbaruiSetelahTindak = isDetailDiperbaruiSetelahTindakLanjut(
    detailUpdatedAt,
    ditindaklanjutiPada,
  )
  const variantClass =
    tahap === 'tinjauan_ulang'
      ? 'bg-sky-50 border-sky-200 text-sky-900'
      : 'bg-amber-50 border-amber-200 text-amber-900'

  return (
    <div className={`rounded-lg border p-3 text-xs ${variantClass}`}>
      <div className="flex gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5 opacity-80" />
        <div className="space-y-1 min-w-0">
          <p className="font-semibold">{copy.bannerTitle}</p>
          <p className="leading-snug opacity-90">{copy.bannerDescription}</p>
          {versi != null && detailUpdatedAt ? (
            <p className="text-[11px] opacity-80 pt-0.5">
              Versi V{versi}
              {tahap === 'tinjauan_ulang' ? (
                <>
                  {' '}
                  · diperbarui {formatDateId(detailUpdatedAt)}
                  {diperbaruiSetelahTindak ? ' (setelah tindak lanjut OPD)' : ''}
                </>
              ) : null}
            </p>
          ) : null}
          {ditindaklanjutiPada && tahap === 'tinjauan_ulang' ? (
            <p className="text-[11px] opacity-75">
              Tindak lanjut OPD: {formatDateId(ditindaklanjutiPada)}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
