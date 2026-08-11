import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import type { StatusHasilEvaluasi } from '@/types/dto/evaluasi.dto'

export interface EvaluasiKeputusanSebelumnyaCardProps {
  hasil: StatusHasilEvaluasi
  catatan: string | null
}

function labelHasil(hasil: StatusHasilEvaluasi): string {
  if (hasil === 'SESUAI') return 'Sesuai'
  if (hasil === 'PERLU_PERBAIKAN') return 'Perlu perbaikan'
  return hasil
}

export function EvaluasiKeputusanSebelumnyaCard({
  hasil,
  catatan,
}: EvaluasiKeputusanSebelumnyaCardProps) {
  const [open, setOpen] = useState(true)
  return (
    <div className="rounded-lg border border-border bg-surface-subtle/80 text-xs">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left font-medium text-secondary-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        <span>Keputusan sebelumnya</span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? (
        <div className="px-3 pb-3 pt-0 space-y-1 text-secondary-foreground border-t border-border">
          <p>
            <span className="text-muted-foreground">Status: </span>
            <span className="font-medium text-foreground">{labelHasil(hasil)}</span>
          </p>
          {catatan?.trim() ? (
            <p className="leading-snug whitespace-pre-wrap">
              <span className="text-muted-foreground">Catatan: </span>
              {catatan}
            </p>
          ) : null}
          <p className="text-[11px] text-muted-foreground pt-1">
            Ini bukan penilaian aktif — pilih hasil baru di bawah setelah meninjau dokumen
            terbaru.
          </p>
        </div>
      ) : null}
    </div>
  )
}
