import { useEffect, useState } from 'react'
import { XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const MAKS_ALASAN = 2000

export interface TolakPengajuanEvaluasiDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  jumlahSop: number
  onConfirm: (alasan: string) => void
  isSubmitting?: boolean
}

export function TolakPengajuanEvaluasiDialog({
  open,
  onOpenChange,
  jumlahSop,
  onConfirm,
  isSubmitting = false,
}: TolakPengajuanEvaluasiDialogProps) {
  const [alasan, setAlasan] = useState('')

  useEffect(() => {
    if (!open) setAlasan('')
  }, [open])

  const alasanBersih = alasan.trim()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm text-red-800">
            <XCircle className="h-4 w-4" aria-hidden />
            Tolak pengajuan evaluasi?
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            {jumlahSop} versi SOP dalam pengajuan ini akan ditolak secara final dan tidak dapat
            diajukan ulang. Penyusun wajib membuat versi baru. Alasan penolakan akan menjadi
            catatan resmi pada setiap SOP.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="alasan-penolakan" className="text-xs text-secondary-foreground">
            Alasan penolakan <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="alasan-penolakan"
            value={alasan}
            onChange={(event) => setAlasan(event.target.value.slice(0, MAKS_ALASAN))}
            placeholder="Jelaskan alasan dan perbaikan yang diperlukan..."
            rows={5}
            maxLength={MAKS_ALASAN}
            disabled={isSubmitting}
            autoFocus
          />
          <p className="text-right text-[10px] text-muted-foreground">
            {alasan.length}/{MAKS_ALASAN}
          </p>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => onConfirm(alasanBersih)}
            disabled={alasanBersih.length === 0 || isSubmitting}
          >
            <XCircle className="h-3.5 w-3.5" aria-hidden />
            {isSubmitting ? 'Menolak...' : 'Ya, tolak pengajuan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
