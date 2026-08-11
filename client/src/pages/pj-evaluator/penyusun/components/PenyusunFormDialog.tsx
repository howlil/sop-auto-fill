import { useEffect, useState } from 'react'
import { FormDialog } from '@/components/ui/form-dialog'
import { FormField } from '@/components/ui/form-field'
import { Select } from '@/components/ui/select'
import {
  ManageAssignmentDialog,
  type AssignmentDialogTab,
} from '@/components/organisasi/manage-assignment-dialog'
import { OpdSelectField } from '@/components/forms/opd-select-field'
import { PersonIdentityFields } from '@/components/forms/person-identity-fields'
import type { StatusTim } from '@/types/dto/tim.dto'

interface OPD {
  id: string
  name: string
}

export type PeranPenyusunApi = 'PENYUSUN' | 'PJ_PENYUSUN'

export interface PenyusunFormData {
  namaLengkap: string
  nip: string
  jabatan: string
  pangkat: string
  email: string
  nohp: string
  peranTim: PeranPenyusunApi
  /** Mode edit: dikirim lewat PATCH penyusun bersama field lain */
  statusAkun?: StatusTim
}

export type PenyusunFormDialogMode = 'create' | 'edit'

export interface PenyusunFormDialogProps {
  mode: PenyusunFormDialogMode
  open: boolean
  onOpenChange: (open: boolean) => void
  formData: PenyusunFormData
  setFormData: React.Dispatch<React.SetStateAction<PenyusunFormData>>
  createOpdId: string
  setCreateOpdId: (id: string) => void
  opdList: OPD[]
  isFormValid: boolean
  onConfirm: () => void
  confirmDisabled?: boolean
  confirmLabel?: string
  /** Tab Pindah OPD — OPD asal penyusun */
  editingOpdId?: string
  opdTujuanId?: string
  setOpdTujuanId?: (id: string) => void
  onConfirmPindah?: () => void
  pindahConfirmDisabled?: boolean
}

const PERAN_OPTIONS: { value: PeranPenyusunApi; label: string }[] = [
  { value: 'PENYUSUN', label: 'Penyusun' },
  { value: 'PJ_PENYUSUN', label: 'PJ Penyusun' },
]

export function PenyusunFormDialog({
  mode,
  open,
  onOpenChange,
  formData,
  setFormData,
  createOpdId,
  setCreateOpdId,
  opdList,
  isFormValid,
  onConfirm,
  confirmDisabled = false,
  confirmLabel,
  editingOpdId,
  opdTujuanId = '',
  setOpdTujuanId,
  onConfirmPindah,
  pindahConfirmDisabled = false,
}: PenyusunFormDialogProps) {
  const isCreate = mode === 'create'
  const [editTab, setEditTab] = useState<AssignmentDialogTab>('edit')

  useEffect(() => {
    if (open && !isCreate) {
      setEditTab('edit')
    }
  }, [open, isCreate])

  const canPindahTab = (formData.statusAkun ?? 'AKTIF') === 'AKTIF'

  useEffect(() => {
    if (!canPindahTab && editTab === 'pindah') {
      setEditTab('edit')
    }
  }, [canPindahTab, editTab])

  const pindahOptions = opdList
    .filter((opd) => opd.id !== editingOpdId)
    .map((opd) => ({ value: opd.id, label: opd.name }))

  const personFieldsValue = {
    namaLengkap: formData.namaLengkap,
    nip: formData.nip,
    jabatan: formData.jabatan,
    pangkat: formData.pangkat,
    email: formData.email,
    nohp: formData.nohp,
    status: formData.statusAkun ?? 'AKTIF',
  }

  const setPersonFieldsValue: React.Dispatch<React.SetStateAction<typeof personFieldsValue>> = (
    action,
  ) => {
    setFormData((prev) => {
      const current = {
        namaLengkap: prev.namaLengkap,
        nip: prev.nip,
        jabatan: prev.jabatan,
        pangkat: prev.pangkat,
        email: prev.email,
        nohp: prev.nohp,
        status: prev.statusAkun ?? 'AKTIF',
      }
      const next = typeof action === 'function' ? action(current) : action
      return {
        ...prev,
        namaLengkap: next.namaLengkap,
        nip: next.nip,
        jabatan: next.jabatan,
        pangkat: next.pangkat,
        email: next.email,
        nohp: next.nohp,
        statusAkun: next.status as StatusTim,
      }
    })
  }

  const fieldsSection = (
    <>
      <PersonIdentityFields
        value={personFieldsValue}
        onChange={setPersonFieldsValue}
        showStatus={!isCreate}
      />
      <FormField label="Peran" required>
        <Select
          value={formData.peranTim}
          onValueChange={(v) =>
            setFormData((prev) => ({ ...prev, peranTim: v as PeranPenyusunApi }))
          }
          options={PERAN_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          placeholder="Pilih peran"
        />
      </FormField>
    </>
  )

  const createForm = (
    <div className="space-y-3">
      <OpdSelectField value={createOpdId} onValueChange={setCreateOpdId} options={opdList} />
      {fieldsSection}
    </div>
  )

  if (isCreate) {
    return (
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Tambah penyusun"
        description="Pilih OPD dan isi data pegawai. Sandi awal ditetapkan server."
        confirmLabel={confirmLabel ?? 'Simpan'}
        cancelLabel="Batal"
        onConfirm={onConfirm}
        confirmDisabled={!isFormValid || confirmDisabled}
        size="md"
        className="max-w-lg"
      >
        {createForm}
      </FormDialog>
    )
  }

  return (
    <ManageAssignmentDialog
      open={open}
      onOpenChange={onOpenChange}
      entityLabel="data penyusun"
      description="Perbarui data, status akun, atau mutasi ke OPD lain (satu akun yang sama)."
      tab={editTab}
      onTabChange={setEditTab}
      canMove={canPindahTab}
      moveDisabledMessage={
        <>
          Penyusun nonaktif tidak dapat dipindahkan. Set status ke Aktif di tab{' '}
          <span className="font-medium text-orange-900">Edit data</span> lalu simpan.
        </>
      }
      opdTujuanId={opdTujuanId}
      onOpdTujuanChange={(value) => setOpdTujuanId?.(value)}
      opdOptions={pindahOptions.map((item) => ({ id: item.value, name: String(item.label) }))}
      editContent={<div className="space-y-3">{fieldsSection}</div>}
      editConfirmDisabled={!isFormValid || confirmDisabled}
      moveConfirmDisabled={pindahConfirmDisabled || onConfirmPindah == null}
      editConfirmLabel={confirmLabel ?? 'Simpan Perubahan'}
      onConfirmEdit={onConfirm}
      onConfirmMove={() => onConfirmPindah?.()}
    />
  )
}
