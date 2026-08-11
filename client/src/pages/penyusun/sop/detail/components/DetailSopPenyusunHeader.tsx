import { useState } from 'react'
import {
  AlertTriangle,
  Check,
  CloudOff,
  CloudUpload,
  GitBranchPlus,
  RefreshCcw,
  Save,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { SopStatusBadge } from '@/components/status/sop-status-badge'
import { cn } from '@/utils/cn'
import type { SOPDetailMetadata } from '@/types/ui/sop'
import type { StatusSOP } from '@/types/dto/sop.dto'
import type { SopHeaderAutosaveStatus } from '@/pages/penyusun/sop/hooks/use-sop-header-autosave'
import { Printer } from 'lucide-react'
import { usePenyusunWorkbench } from '@/api/sop'
import { useSopEditor } from '../SopEditorContext'
import { useToast } from '@/hooks/useToast'
import { printSopArsipFromPreviewProps } from '@/lib/print/pengajuan-print'
import { mapPenyusunWorkbenchToPreviewProps } from '@/lib/sop/detailSop.mappers'

export interface DetailSOPPenyusunHeaderProps {
  metadata: SOPDetailMetadata
  currentSopStatus: StatusSOP
  currentSopStatusLabel: string
  isRevisionFlow: boolean
  primaryActionLabel: string
  /** Di alur revisi: hanya PJ Penyusun yang melihat tombol kirim ulang. */
  canShowKirimUlangAction?: boolean
  /**
   * Status autosave gabungan (header + prosedur) — ditampilkan sebagai indikator
   * kecil di kanan tombol aksi.
   */
  autosaveStatus?: SopHeaderAutosaveStatus
  /** Handler untuk mencoba ulang autosave saat status `error`. */
  onRetryAutosave?: () => void | Promise<void>
  onComplete: () => void
  /** Menonaktifkan tombol aksi utama (mis. saat POST kirim ulang evaluasi). */
  isPrimaryActionPending?: boolean
  /** Mode lihat: sembunyikan autosave, Selesai, dan retry. */
  isReadOnly?: boolean
  /** Pesan blokir kirim ulang (tindak lanjut belum SELESAI). */
  kirimUlangBlockingReason?: string | null
  /** Tampilkan tombol buat versi baru dari versi terminal yang sedang dibuka. */
  canBuatVersiBaru?: boolean
  buatVersiBaruBlockingReason?: string | null
  onBuatVersiBaru?: () => void
  isBuatVersiBaruPending?: boolean
}

interface AutosaveBadgeAppearance {
  Icon: typeof Save
  label: string
  className: string
}

function autosaveAppearance(status: SopHeaderAutosaveStatus): AutosaveBadgeAppearance | null {
  switch (status) {
    case 'pending':
      return {
        Icon: CloudUpload,
        label: 'Perubahan menunggu disimpan',
        className: 'bg-amber-50 text-amber-700 border-amber-200',
      }
    case 'saving':
      return {
        Icon: CloudUpload,
        label: 'Menyimpan...',
        className: 'bg-blue-50 text-blue-700 border-blue-200',
      }
    case 'saved':
      return {
        Icon: Check,
        label: 'Tersimpan',
        className: 'bg-green-50 text-green-700 border-green-200',
      }
    case 'error':
      return {
        Icon: CloudOff,
        label: 'Gagal menyimpan',
        className: 'bg-red-50 text-red-700 border-red-200',
      }
    case 'idle':
    default:
      return null
  }
}

export function DetailSOPPenyusunHeader({
  metadata,
  currentSopStatus,
  currentSopStatusLabel,
  isRevisionFlow,
  primaryActionLabel,
  canShowKirimUlangAction = true,
  autosaveStatus = 'idle',
  onRetryAutosave,
  onComplete,
  isPrimaryActionPending = false,
  isReadOnly = false,
  kirimUlangBlockingReason = null,
  canBuatVersiBaru = false,
  buatVersiBaruBlockingReason = null,
  onBuatVersiBaru,
  isBuatVersiBaruPending = false,
}: DetailSOPPenyusunHeaderProps) {
  const { sopDetailId } = useSopEditor()
  const { data: workbench, isLoading: isWorkbenchLoading } = usePenyusunWorkbench(sopDetailId)
  const { showToast } = useToast()
  const [isPrinting, setIsPrinting] = useState(false)

  const handlePrintSop = async () => {
    if (isWorkbenchLoading) return
    setIsPrinting(true)
    try {
      if (!workbench) {
        showToast('Data SOP belum siap untuk dicetak.', 'error')
        return
      }
      const previewProps = mapPenyusunWorkbenchToPreviewProps(workbench)
      const { diagramExportFailed } = await printSopArsipFromPreviewProps(
        previewProps,
        workbench.tteSignaturePayloadKepalaOpd ?? null,
        {
          signPdf: false,
        },
      )
      if (diagramExportFailed) {
        showToast(
          'Beberapa halaman diagram tidak dapat diekspor; PDF tetap dicetak dengan tabel langkah.',
          'error',
        )
      }
    } catch {
      showToast('Gagal memuat cetak. Coba muat ulang halaman.', 'error')
    } finally {
      setIsPrinting(false)
    }
  }

  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const indicator = isReadOnly ? null : autosaveAppearance(autosaveStatus)
  const confirmTitle = isRevisionFlow ? 'Kirim ulang evaluasi?' : 'Yakin SOP sudah siap?'
  const confirmDescription = isRevisionFlow
    ? (kirimUlangBlockingReason ??
      'SOP akan dikirim ulang untuk evaluasi oleh tim evaluator. Pastikan semua perbaikan sudah tersimpan.')
    : 'Status SOP akan diubah menjadi Menunggu pengajuan evaluasi. PJ Penyusun dapat membuka pengajuan evaluasi ke Biro Organisasi. Pastikan dokumen sudah lengkap sebelum melanjutkan.'
  const confirmLabel = isRevisionFlow ? 'Ya, kirim ulang' : 'Ya, selesai'
  const handleConfirmComplete = () => {
    setIsConfirmOpen(false)
    onComplete()
  }
  return (
    <>
      <div 
        className="flex items-center justify-between gap-4 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        onWheel={(e) => {
          if (e.deltaY !== 0) {
            e.currentTarget.scrollLeft += e.deltaY
          }
        }}
      >
        <h2 className="text-sm font-semibold text-foreground whitespace-nowrap">Dokumen SOP</h2>
        <div className="flex items-center gap-2 shrink-0">
          {indicator !== null ? (
            <span
              role="status"
              aria-live="polite"
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium',
                indicator.className,
              )}
              title={
                autosaveStatus === 'error'
                  ? 'Autosave header SOP gagal — klik tombol di sebelahnya untuk coba lagi.'
                  : 'Status autosave header SOP'
              }
            >
              <indicator.Icon className="h-3 w-3" aria-hidden />
              {indicator.label}
            </span>
          ) : null}
          {autosaveStatus === 'error' && !isReadOnly && onRetryAutosave !== undefined ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 px-2 text-[11px] text-red-700 border-red-200 hover:bg-red-50"
              onClick={() => void onRetryAutosave()}
              title="Kirim ulang perubahan header"
            >
              <RefreshCcw className="h-3 w-3" />
              Coba lagi
            </Button>
          ) : null}
          {currentSopStatus === 'BERLAKU' ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs gap-1.5 rounded-md border-border-strong text-secondary-foreground hover:bg-surface-subtle"
              onClick={() => void handlePrintSop()}
              disabled={isWorkbenchLoading || isPrinting}
              title="Cetak dokumen SOP sebagai PDF (A4 landscape)."
            >
              <Printer className="w-3.5 h-3.5" />
              {isPrinting ? 'Menyiapkan…' : 'Cetak PDF'}
            </Button>
          ) : null}
          {canBuatVersiBaru && onBuatVersiBaru ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs gap-1.5 rounded-md border-emerald-200 text-emerald-800 hover:bg-emerald-50"
              onClick={onBuatVersiBaru}
              disabled={isBuatVersiBaruPending || Boolean(buatVersiBaruBlockingReason)}
              title={buatVersiBaruBlockingReason ?? undefined}
            >
              <GitBranchPlus className="w-3.5 h-3.5" />
              {isBuatVersiBaruPending ? 'Membuat…' : 'Buat versi baru'}
            </Button>
          ) : null}
          {!isReadOnly && (!isRevisionFlow || canShowKirimUlangAction) ? (
            <Button
              size="sm"
              className="h-8 gap-1.5 rounded-control bg-primary px-3 text-xs text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
              onClick={() => setIsConfirmOpen(true)}
              disabled={isPrimaryActionPending || Boolean(kirimUlangBlockingReason)}
              title={kirimUlangBlockingReason ?? undefined}
            >
              <Check className="w-3.5 h-3.5" />
              {isPrimaryActionPending ? 'Mengirim…' : primaryActionLabel}
            </Button>
          ) : null}
        </div>
      </div>
      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel={confirmLabel}
        cancelLabel="Batal"
        onConfirm={handleConfirmComplete}
      />
      <div className="pt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-secondary-foreground">
        <Badge className="h-4 px-1.5 text-xs bg-blue-100 text-blue-700 border-0">
          v{metadata.version || '1.0'}
        </Badge>
        {metadata.revisiDariVersi != null ? (
          <span className="text-muted-foreground">Revisi dari v{metadata.revisiDariVersi}</span>
        ) : null}
        <SopStatusBadge
          status={currentSopStatus}
          label={currentSopStatusLabel}
          showDomain={false}
          className="text-xs"
        />
      </div>
      {isRevisionFlow && !isReadOnly && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="mr-1 inline h-3.5 w-3.5 align-text-bottom" aria-hidden />
          {kirimUlangBlockingReason ? (
            kirimUlangBlockingReason
          ) : !canShowKirimUlangAction ? (
            <>
              SOP ini dikembalikan oleh evaluator untuk revisi. Selesaikan perbaikan, lalu minta{' '}
              <span className="font-semibold">PJ Penyusun</span> mengirim ulang evaluasi.
            </>
          ) : (
            <>
              SOP ini dikembalikan oleh evaluator untuk revisi. Pastikan perbaikan tersimpan, lalu
              klik <span className="font-semibold">Kirim ulang evaluasi</span>.
            </>
          )}
        </div>
      )}
    </>
  )
}
