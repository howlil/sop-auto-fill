import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { HasilEvaluasiBadge } from './hasil-evaluasi-badge'
import { PengajuanStatusBadge } from './pengajuan-status-badge'
import { SopStatusBadge } from './sop-status-badge'

const LEGEND_PENGAJUAN_EVALUASI = {
  status: 'DITANDATANGANI_PJ_EVALUATOR',
  label: 'BA ditandatangani PJ Evaluator',
} as const
const LEGEND_DOKUMEN = {
  status: 'MENUNGGU_TTD_PJ_EVALUATOR',
  label: 'Menunggu TTD PJ Evaluator',
} as const
const LEGEND_SESUAI = { hasil: 'SESUAI', label: 'Sesuai' } as const
const LEGEND_PERBAIKAN = { hasil: 'PERLU_PERBAIKAN', label: 'Perlu perbaikan' } as const

export function EvaluasiStatusLegend() {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs text-secondary-foreground"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          Apa arti status?
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md text-xs">
        <DialogHeader>
          <DialogTitle className="text-sm">Tiga jenis status</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div>
            <p className="text-secondary-foreground mb-2">
              <strong>Pengajuan evaluasi</strong> — progres pengajuan evaluasi OPD (penilaian → tanda tangan → selesai).
            </p>
            <PengajuanStatusBadge
              status={LEGEND_PENGAJUAN_EVALUASI.status}
              label={LEGEND_PENGAJUAN_EVALUASI.label}
              showDomain={false}
            />
          </div>
          <div>
            <p className="text-secondary-foreground mb-2">
              <strong>Dokumen</strong> — siklus hidup SOP di sistem (disusun → berlaku).
            </p>
            <SopStatusBadge
              status={LEGEND_DOKUMEN.status}
              label={LEGEND_DOKUMEN.label}
              showDomain={false}
            />
          </div>
          <div>
            <p className="text-secondary-foreground mb-2">
              <strong>Penilaian</strong> — keputusan evaluator per dokumen.
            </p>
            <div className="flex flex-wrap gap-2">
              <HasilEvaluasiBadge
                hasil={LEGEND_SESUAI.hasil}
                label={LEGEND_SESUAI.label}
                showDomain={false}
              />
              <HasilEvaluasiBadge
                hasil={LEGEND_PERBAIKAN.hasil}
                label={LEGEND_PERBAIKAN.label}
                showDomain={false}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
