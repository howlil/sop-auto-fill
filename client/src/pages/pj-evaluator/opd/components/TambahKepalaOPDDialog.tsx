import { PersonFormDialog } from '@/components/forms/person-form-dialog'
import { OpdSelectField } from '@/components/forms/opd-select-field'
import type { FormTambahKepalaState } from '@/types/ui/organisasi'

interface OPD {
  id: string
  name: string
}

export interface TambahKepalaOPDDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: FormTambahKepalaState
  setForm: React.Dispatch<React.SetStateAction<FormTambahKepalaState>>
  opdList: OPD[]
  onConfirm: () => void
}

export function TambahKepalaOPDDialog({
  open,
  onOpenChange,
  form,
  setForm,
  opdList,
  onConfirm,
}: TambahKepalaOPDDialogProps) {
  const valid =
    form.opdId &&
    form.nama.trim() &&
    form.email.trim() &&
    form.nip.trim() &&
    form.jabatan.trim() &&
    form.pangkat.trim() &&
    form.nohp.trim()

  return (
    <PersonFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Tambah Kepala OPD"
      description="Buat akun Kepala OPD baru untuk OPD terpilih. Kata sandi awal ditetapkan server (sama seperti penyusun)."
      confirmLabel="Simpan"
      cancelLabel="Batal"
      onConfirm={onConfirm}
      confirmDisabled={!valid}
      size="md"
      beforeFields={
        <OpdSelectField
          value={form.opdId}
          onValueChange={(opdId) => setForm((f) => ({ ...f, opdId }))}
          options={opdList}
        />
      }
      value={form}
      onChange={setForm}
      labels={{ name: 'Nama lengkap', pangkat: 'Pangkat / golongan' }}
      placeholders={{
        name: 'Contoh: Dr. Ahmad Pratama, S.Sos',
        nip: 'NIP 18 digit',
        email: 'email@pemda.go.id',
        jabatan: 'Contoh: Kepala Dinas',
        phone: '081234567890',
      }}
    />
  )
}
