import { GitBranchPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface BuatVersiBaruDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  judulSop: string
  versiSumber: number
  statusSumber: string
  versiBaru: number
  isPending?: boolean
  onConfirm: () => void | Promise<void>
}

export function BuatVersiBaruDialog({
  open,
  onOpenChange,
  judulSop,
  versiSumber,
  statusSumber,
  versiBaru,
  isPending = false,
  onConfirm,
}: BuatVersiBaruDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranchPlus className="w-4 h-4" aria-hidden />
            Buat versi baru
          </DialogTitle>
          <DialogDescription>
            Isi versi {versiSumber} ({statusSumber}) akan disalin menjadi versi {versiBaru} (status
            DRAFT). Status, tanggal, dokumen resmi, dan riwayat semua versi lama tidak berubah.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-secondary-foreground">
          SOP: <span className="font-medium text-foreground">{judulSop}</span>
        </p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Batal
          </Button>
          <Button type="button" onClick={() => void onConfirm()} disabled={isPending}>
            {isPending ? 'Membuat…' : 'Buat versi baru'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
