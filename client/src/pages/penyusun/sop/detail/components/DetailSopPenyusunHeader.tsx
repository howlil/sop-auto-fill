import { useState } from 'react'
import { Check, CloudOff, CloudUpload, GitBranchPlus, Printer, RefreshCcw, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { SopStatusBadge } from '@/components/status/sop-status-badge'
import { cn } from '@/utils/cn'
import type { SOPDetailMetadata } from '@/types/ui/sop'
import type { StatusSOP } from '@/types/dto/sop.dto'
import type { SopHeaderAutosaveStatus } from '@/pages/penyusun/sop/hooks/use-sop-header-autosave'
import { usePenyusunWorkbench } from '@/api/sop'
import { useSopEditor } from '../SopEditorContext'
import { useToast } from '@/hooks/useToast'
import { printSopPdfDocument } from '@/lib/print/print-sop-pdf'
import { sopPreviewPropsToPdfDocumentProps } from '@/lib/print/sop-pdf-props.util'
import { mapPenyusunWorkbenchToPreviewProps } from '@/lib/sop/detailSop.mappers'

export interface DetailSOPPenyusunHeaderProps {
  metadata: SOPDetailMetadata
  currentSopStatus: StatusSOP
  currentSopStatusLabel: string
  autosaveStatus?: SopHeaderAutosaveStatus
  onRetryAutosave?: () => void | Promise<void>
  onComplete: () => void
  isPrimaryActionPending?: boolean
  isReadOnly?: boolean
  canBuatVersiBaru?: boolean
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
      return { Icon: CloudUpload, label: 'Perubahan menunggu disimpan', className: 'bg-amber-50 text-amber-700 border-amber-200' }
    case 'saving':
      return { Icon: CloudUpload, label: 'Menyimpan...', className: 'bg-blue-50 text-blue-700 border-blue-200' }
    case 'saved':
      return { Icon: Check, label: 'Tersimpan', className: 'bg-green-50 text-green-700 border-green-200' }
    case 'error':
      return { Icon: CloudOff, label: 'Gagal menyimpan', className: 'bg-red-50 text-red-700 border-red-200' }
    default:
      return null
  }
}

export function DetailSOPPenyusunHeader({
  metadata,
  currentSopStatus,
  currentSopStatusLabel,
  autosaveStatus = 'idle',
  onRetryAutosave,
  onComplete,
  isPrimaryActionPending = false,
  isReadOnly = false,
  canBuatVersiBaru = false,
  onBuatVersiBaru,
  isBuatVersiBaruPending = false,
}: DetailSOPPenyusunHeaderProps) {
  const { sopDetailId } = useSopEditor()
  const { data: workbench, isLoading: isWorkbenchLoading } = usePenyusunWorkbench(sopDetailId)
  const { showToast } = useToast()
  const [isPrinting, setIsPrinting] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const indicator = isReadOnly ? null : autosaveAppearance(autosaveStatus)

  const handlePrintSop = async () => {
    if (isWorkbenchLoading) return
    setIsPrinting(true)
    try {
      if (!workbench) {
        showToast('Data SOP belum siap untuk dicetak.', 'error')
        return
      }
      const previewProps = mapPenyusunWorkbenchToPreviewProps(workbench)
      const pdfProps = sopPreviewPropsToPdfDocumentProps(previewProps, {
        includeHeader: true,
        printMode: 'header_steps_bpmn',
      })
      const { diagramExportFailed } = await printSopPdfDocument(pdfProps)
      if (diagramExportFailed) {
        showToast('Beberapa halaman diagram tidak dapat diekspor; PDF tetap dicetak dengan tabel langkah.', 'error')
      }
    } catch {
      showToast('Gagal menyiapkan PDF. Coba muat ulang halaman.', 'error')
    } finally {
      setIsPrinting(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <h2 className="text-sm font-semibold text-foreground whitespace-nowrap">Dokumen SOP</h2>
        <div className="flex items-center gap-2 shrink-0">
          {indicator ? (
            <span role="status" aria-live="polite" className={cn('inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium', indicator.className)}>
              <indicator.Icon className="h-3 w-3" aria-hidden />
              {indicator.label}
            </span>
          ) : null}
          {autosaveStatus === 'error' && !isReadOnly && onRetryAutosave ? (
            <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-[11px] text-red-700 border-red-200 hover:bg-red-50" onClick={() => void onRetryAutosave()}>
              <RefreshCcw className="h-3 w-3" /> Coba lagi
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" className="h-8 px-3 text-xs gap-1.5 rounded-md" onClick={() => void handlePrintSop()} disabled={isWorkbenchLoading || isPrinting}>
            <Printer className="w-3.5 h-3.5" />
            {isPrinting ? 'Menyiapkan…' : 'Cetak PDF'}
          </Button>
          {canBuatVersiBaru && onBuatVersiBaru ? (
            <Button size="sm" variant="outline" className="h-8 px-3 text-xs gap-1.5 rounded-md border-emerald-200 text-emerald-800 hover:bg-emerald-50" onClick={onBuatVersiBaru} disabled={isBuatVersiBaruPending}>
              <GitBranchPlus className="w-3.5 h-3.5" />
              {isBuatVersiBaruPending ? 'Membuat…' : 'Buat versi baru'}
            </Button>
          ) : null}
          {!isReadOnly && currentSopStatus === 'DRAFT' ? (
            <Button size="sm" className="h-8 gap-1.5 rounded-control bg-primary px-3 text-xs text-primary-foreground hover:bg-primary-hover" onClick={() => setIsConfirmOpen(true)} disabled={isPrimaryActionPending}>
              <Check className="w-3.5 h-3.5" />
              {isPrimaryActionPending ? 'Menyelesaikan…' : 'Selesai'}
            </Button>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title="Tandai SOP selesai?"
        description="Versi aktif akan dikunci. Jika perlu mengubahnya lagi, buat versi baru yang akan menyalin seluruh isi versi ini."
        confirmLabel="Ya, selesai"
        cancelLabel="Batal"
        onConfirm={() => {
          setIsConfirmOpen(false)
          onComplete()
        }}
      />

      <div className="pt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-secondary-foreground">
        <Badge className="h-4 px-1.5 text-xs bg-blue-100 text-blue-700 border-0">v{metadata.version || 1}</Badge>
        {metadata.revisiDariVersi != null ? <span className="text-muted-foreground">Dibuat dari v{metadata.revisiDariVersi}</span> : null}
        <SopStatusBadge status={currentSopStatus} label={currentSopStatusLabel} showDomain={false} className="text-xs" />
      </div>
    </>
  )
}
