import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DialogFooterActions } from '@/components/ui/dialog-footer-actions'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { OpdSelectField, type OpdOption } from '@/components/forms/opd-select-field'

export type AssignmentDialogTab = 'edit' | 'pindah'

export interface ManageAssignmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityLabel: string
  description?: string
  tab: AssignmentDialogTab
  onTabChange: (tab: AssignmentDialogTab) => void
  canMove: boolean
  moveDisabledMessage: React.ReactNode
  opdTujuanId: string
  onOpdTujuanChange: (opdId: string) => void
  opdOptions: OpdOption[]
  editContent: React.ReactNode
  editConfirmDisabled: boolean
  moveConfirmDisabled?: boolean
  editConfirmLabel?: string
  moveConfirmLabel?: string
  onConfirmEdit: () => void
  onConfirmMove: () => void
}

export function ManageAssignmentDialog({
  open,
  onOpenChange,
  entityLabel,
  description,
  tab,
  onTabChange,
  canMove,
  moveDisabledMessage,
  opdTujuanId,
  onOpdTujuanChange,
  opdOptions,
  editContent,
  editConfirmDisabled,
  moveConfirmDisabled,
  editConfirmLabel = 'Simpan Perubahan',
  moveConfirmLabel = 'Pindahkan',
  onConfirmEdit,
  onConfirmMove,
}: ManageAssignmentDialogProps) {
  const confirmDisabled =
    tab === 'edit'
      ? editConfirmDisabled
      : !canMove || !opdTujuanId || moveConfirmDisabled === true
  const confirmLabel = tab === 'edit' ? editConfirmLabel : moveConfirmLabel

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto scrollbar-hide">
        <DialogHeader>
          <DialogTitle className="text-sm">Ubah {entityLabel}</DialogTitle>
          {description != null ? (
            <DialogDescription className="text-xs">{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(value) => onTabChange(value as AssignmentDialogTab)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 h-9">
            <TabsTrigger value="edit" className="text-xs">
              Edit data
            </TabsTrigger>
            <TabsTrigger value="pindah" className="text-xs" disabled={!canMove}>
              Pindah OPD
            </TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="mt-3">
            {editContent}
          </TabsContent>

          <TabsContent value="pindah" className="space-y-3 mt-3">
            {canMove ? (
              <OpdSelectField
                value={opdTujuanId}
                onValueChange={onOpdTujuanChange}
                options={opdOptions}
                label="OPD tujuan"
              />
            ) : (
              <div className="rounded-lg border border-orange-200 bg-orange-100 px-3 py-2.5 text-xs text-orange-800">
                {moveDisabledMessage}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooterActions
          cancelLabel="Batal"
          confirmLabel={confirmLabel}
          onCancel={() => onOpenChange(false)}
          onConfirm={tab === 'edit' ? onConfirmEdit : onConfirmMove}
          confirmDisabled={confirmDisabled}
        />
      </DialogContent>
    </Dialog>
  )
}
