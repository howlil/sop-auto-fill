import { Check, CloudOff, CloudUpload, Eye, GitBranchPlus, PenLine, Printer, RefreshCcw, Save } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  mode: 'edit' | 'preview'
  onModeChange: (mode: 'edit' | 'preview') => void
  onReviewAndComplete: () => void
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
      return { Icon: CloudUpload, label: 'Menunggu disimpan', className: 'bg-amber-50 text-amber-700 border-amber-200' }
    case 'saving':
      return { Icon: CloudUpload, label: 'Menyimpan…', className: 'bg-blue-50 text-blue-700 border-blue-200' }
    case 'saved':
      return { Icon: Check, label: 'Tersimpan', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    case 'error':
      return { Icon: CloudOff, label: 'Gagal menyimpan', className: 'bg-red-50 text-red-700 border-red-200' }
    default:
      return null
  }
}

function metadataTitle(metadata: SOPDetailMetadata): string {
  return metadata.nama ?? metadata.judul ?? metadata.name ?? 'Dokumen SOP'
}

export function DetailSOPPenyusunHeader({
  metadata,
  currentSopStatus,
  currentSopStatusLabel,
  autosaveStatus = 'idle',
  onRetryAutosave,
  mode,
  onModeChange,
  onReviewAndComplete,
  isReadOnly = false,
  canBuatVersiBaru = false,
  onBuatVersiBaru,
  isBuatVersiBaruPending = false,
}: DetailSOPPenyusunHeaderProps) {
  const { sopDetailId } = useSopEditor()
  const { data: workbench, isLoading: isWorkbenchLoading } = usePenyusunWorkbench(sopDetailId)
  const { showToast } = useToast()
  const [isPrinting, setIsPrinting] = useState(false)
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
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="max-w-2xl truncate text-base font-semibold text-foreground sm:text-lg">
            {metadataTitle(metadata)}
          </h1>
          <Badge className="border-0 bg-blue-100 px-2 text-xs text-blue-700">v{metadata.version || 1}</Badge>
          <SopStatusBadge status={currentSopStatus} label={currentSopStatusLabel} showDomain={false} className="text-xs" />
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {metadata.revisiDariVersi != null ? <span>Dibuat dari v{metadata.revisiDariVersi}</span> : null}
          {indicator ? (
            <span role="status" aria-live="polite" className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium', indicator.className)}>
              <indicator.Icon className="h-3 w-3" aria-hidden />
              {indicator.label}
            </span>
          ) : isReadOnly ? <span>Versi read-only</span> : null}
          {autosaveStatus === 'error' && !isReadOnly && onRetryAutosave ? (
            <button type="button" className="inline-flex items-center gap-1 font-medium text-red-700 hover:underline" onClick={() => void onRetryAutosave()}>
              <RefreshCcw className="h-3 w-3" /> Coba lagi
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1" role="group" aria-label="Mode dokumen">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn('h-8 gap-1.5 px-2.5 text-xs', mode === 'edit' && 'bg-background text-foreground shadow-sm')}
            onClick={() => onModeChange('edit')}
          >
            <PenLine className="h-3.5 w-3.5" /> {isReadOnly ? 'Isi' : 'Edit'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn('h-8 gap-1.5 px-2.5 text-xs', mode === 'preview' && 'bg-background text-foreground shadow-sm')}
            onClick={() => onModeChange('preview')}
          >
            <Eye className="h-3.5 w-3.5" /> Preview
          </Button>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5"
          onClick={() => void handlePrintSop()}
          disabled={isWorkbenchLoading || isPrinting}
        >
          <Printer className="h-3.5 w-3.5" />
          {isPrinting ? 'Menyiapkan…' : 'PDF'}
        </Button>

        {canBuatVersiBaru && onBuatVersiBaru ? (
          <Button
            size="sm"
            className="h-9 gap-1.5"
            onClick={onBuatVersiBaru}
            disabled={isBuatVersiBaruPending}
          >
            <GitBranchPlus className="h-3.5 w-3.5" />
            {isBuatVersiBaruPending ? 'Membuat…' : 'Buat versi baru'}
          </Button>
        ) : null}

        {!isReadOnly && currentSopStatus === 'DRAFT' ? (
          <Button size="sm" className="h-9 gap-1.5 px-3" onClick={onReviewAndComplete}>
            <Check className="h-3.5 w-3.5" /> Review & Complete
          </Button>
        ) : null}
      </div>
    </div>
  )
}
