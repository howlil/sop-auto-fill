import { Download, Loader2, MoreVertical, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  CETAK_ARSIP_DISABLED_TITLE,
  CETAK_BA_DISABLED_TITLE,
  canCetakBeritaAcaraPengajuan,
  canCetakSopArsipPengajuan,
  type PengajuanPrintTarget,
} from '@/lib/print/pengajuan-print'

export type PengajuanCetakArsipPrintScope = 'pj-evaluator' | 'pj-penyusun-kepala-opd'

interface PengajuanCetakArsipButtonsProps {
  printScope: PengajuanCetakArsipPrintScope
  pengajuanStatus: string | undefined
  effectiveSopDetailId: string | null
  sopCount: number
  cetakLoading?: boolean
  onCetak: (target: PengajuanPrintTarget) => void | Promise<void>
}

export function PengajuanCetakArsipButtons({
  printScope,
  pengajuanStatus,
  effectiveSopDetailId,
  sopCount,
  cetakLoading = false,
  onCetak,
}: PengajuanCetakArsipButtonsProps) {
  const canCetakBa = canCetakBeritaAcaraPengajuan(pengajuanStatus)
  const canCetakSopArsip = canCetakSopArsipPengajuan(pengajuanStatus)
  const showSopItems = printScope === 'pj-penyusun-kepala-opd'
  const baDisabledTitle = canCetakBa ? undefined : CETAK_BA_DISABLED_TITLE
  const sopDisabledTitle = canCetakSopArsip ? undefined : CETAK_ARSIP_DISABLED_TITLE
  const baItemDisabled = !canCetakBa || cetakLoading
  const sopItemDisabled =
    !canCetakSopArsip || effectiveSopDetailId === null || cetakLoading
  const sopItemTitle =
    !canCetakSopArsip
      ? sopDisabledTitle
      : effectiveSopDetailId === null
        ? 'Pilih SOP untuk dicetak'
        : undefined
  const hasAnyEnabledItem =
    canCetakBa || (showSopItems && canCetakSopArsip && sopCount > 0)
  const triggerDisabled = !hasAnyEnabledItem || cetakLoading
  const triggerTitle = triggerDisabled
    ? canCetakBa
      ? undefined
      : baDisabledTitle
    : undefined

  const handleSelect = (target: PengajuanPrintTarget) => {
    void onCetak(target)
  }

  return (
    <div data-print-hide>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={triggerDisabled}
            title={triggerTitle}
            aria-label="Arsip dokumen pengajuan"
          >
            {cetakLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <MoreVertical className="h-4 w-4" aria-hidden />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[11rem]">
          <DropdownMenuItem
            disabled={baItemDisabled}
            title={baDisabledTitle}
            onClick={() => handleSelect('ba')}
          >
            <Download className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            Unduh BA (PDF)
          </DropdownMenuItem>
          {showSopItems ? (
            <DropdownMenuItem
              disabled={sopItemDisabled}
              title={sopItemTitle}
              onClick={() => handleSelect('sop')}
            >
              <Printer className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              Cetak SOP
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
