import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Select } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type { ProsedurRow } from '@/types/ui/sop'

interface DecisionStepDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  decisionStepIndex: number | null
  prosedurRows: ProsedurRow[]
  decisionYesId: string
  decisionNoId: string
  setDecisionYesId: (v: string) => void
  setDecisionNoId: (v: string) => void
  onSave: (stepIndex: number, yesId: string, noId: string) => void
  onValidationError: (message: string) => void
}

export function DecisionStepDialog({
  open,
  onOpenChange,
  decisionStepIndex,
  prosedurRows,
  decisionYesId,
  decisionNoId,
  setDecisionYesId,
  setDecisionNoId,
  onSave,
  onValidationError,
}: DecisionStepDialogProps) {
  const handleSave = () => {
    if (decisionStepIndex === null) return
    if (decisionYesId && decisionNoId && decisionYesId === decisionNoId) {
      onValidationError('Tahap jika Ya dan Tahap jika Tidak harus berbeda.')
      return
    }
    onSave(decisionStepIndex, decisionYesId, decisionNoId)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Atur cabang keputusan</DialogTitle>
          <DialogDescription className="text-xs">
            Pilih langkah tujuan untuk jawaban <strong>Ya</strong> dan <strong>Tidak</strong>. Keduanya harus mengarah ke tahap yang berbeda.
          </DialogDescription>
        </DialogHeader>
        {decisionStepIndex !== null && (
          <div className="space-y-3">
            <p className="text-xs text-secondary-foreground">
              Decision pada tahap <strong>{decisionStepIndex + 1}</strong> –{' '}
              <span className="italic">{prosedurRows[decisionStepIndex]?.kegiatan || 'Tanpa judul'}</span>
            </p>
            <FormField label={<>Tahap jika <span className="font-semibold text-red-600">Tidak</span></>}>
              <Select
                className="h-8"
                value={decisionNoId}
                onValueChange={setDecisionNoId}
                placeholder="Pilih tahap"
                options={prosedurRows.map((row, idx) => ({
                  value: row.id,
                  label: `${idx + 1}. ${row.kegiatan || '(tanpa judul)'}`,
                  disabled: idx === decisionStepIndex || row.id === decisionYesId,
                }))}
              />
            </FormField>
            <FormField label={<>Tahap jika <span className="font-semibold text-green-700">Ya</span></>}>
              <Select
                className="h-8"
                value={decisionYesId}
                onValueChange={setDecisionYesId}
                placeholder="Pilih tahap"
                options={prosedurRows.map((row, idx) => ({
                  value: row.id,
                  label: `${idx + 1}. ${row.kegiatan || '(tanpa judul)'}`,
                  disabled: idx === decisionStepIndex || row.id === decisionNoId,
                }))}
              />
            </FormField>
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => onOpenChange(false)}
          >
            Batal
          </Button>
          <Button size="sm" className="h-8 text-xs" onClick={handleSave}>
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
