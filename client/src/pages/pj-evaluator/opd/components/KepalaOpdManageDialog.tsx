import { PersonIdentityFields } from '@/components/forms/person-identity-fields'
import {
  ManageAssignmentDialog,
  type AssignmentDialogTab,
} from '@/components/organisasi/manage-assignment-dialog'
import type { KepalaFormState, PindahFormState } from '@/types/ui/organisasi'
import type { KepalaOpdDto } from '@/types/dto/kepala-opd.dto'
import type { OPDOption as OPD } from './types'

export interface KepalaOpdManageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tab: AssignmentDialogTab
  onTabChange: (tab: AssignmentDialogTab) => void
  editingSource: KepalaOpdDto | null
  opdList: OPD[]
  form: KepalaFormState
  setForm: React.Dispatch<React.SetStateAction<KepalaFormState>>
  pindahForm: PindahFormState
  setPindahForm: React.Dispatch<React.SetStateAction<PindahFormState>>
  canPickOpdAsDestination: (opdId: string) => boolean
  onConfirmEdit: () => void
  onConfirmPindah: () => void
}

export function KepalaOpdManageDialog({
  open,
  onOpenChange,
  tab,
  onTabChange,
  editingSource,
  opdList,
  form,
  setForm,
  pindahForm,
  setPindahForm,
  canPickOpdAsDestination,
  onConfirmEdit,
  onConfirmPindah,
}: KepalaOpdManageDialogProps) {
  const editValid =
    Boolean(
      form.name.trim() &&
        form.email.trim() &&
        form.jabatan.trim() &&
        form.pangkat.trim() &&
        form.nohp.trim(),
    )
  const canPindah = editingSource?.isActive === true
  const pindahValid = Boolean(pindahForm.opdId && canPindah)
  const description =
    editingSource && opdList.find((o) => o.id === editingSource.opdId)
      ? `OPD saat ini: ${opdList.find((o) => o.id === editingSource.opdId)?.name}`
      : undefined

  return (
    <ManageAssignmentDialog
      open={open}
      onOpenChange={onOpenChange}
      entityLabel="Kepala OPD"
      description={description}
      tab={tab}
      onTabChange={onTabChange}
      canMove={canPindah}
      moveDisabledMessage="Akun nonaktif tidak dapat dipindahkan. Aktifkan kembali di tab Edit data."
      opdTujuanId={pindahForm.opdId}
      onOpdTujuanChange={(opdId) =>
        setPindahForm((f: PindahFormState) => ({ ...f, opdId }))
      }
      opdOptions={
        editingSource
          ? opdList
              .filter((opd) => opd.id !== editingSource.opdId)
              .filter((opd) => canPickOpdAsDestination(opd.id))
          : []
      }
      editContent={
        <PersonIdentityFields
          value={form}
          onChange={setForm}
          showStatus
          labels={{ name: 'Nama', pangkat: 'Pangkat / golongan' }}
          placeholders={{
            name: 'Nama lengkap dengan gelar',
            nip: 'NIP',
            email: 'email@pemda.go.id',
            phone: '0812-xxxx-xxxx',
          }}
        />
      }
      editConfirmDisabled={!editValid}
      moveConfirmDisabled={!pindahValid}
      onConfirmEdit={onConfirmEdit}
      onConfirmMove={onConfirmPindah}
    />
  )
}
