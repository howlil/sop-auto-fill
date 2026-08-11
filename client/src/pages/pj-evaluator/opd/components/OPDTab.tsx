import { useState } from 'react'
import { Building2, Edit, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table } from '@/components/ui/data-table'
import { SingleTextFieldDialog } from '@/components/forms/single-text-field-dialog'
import { RowActions } from '@/components/data/row-actions'
import type { OPDUI as OPD } from '@/types/ui/organisasi'

interface OpdDialogState {
  isCreateOpen: boolean
  isEditOpen: boolean
}

export interface OPDTabProps {
  filteredOPD: OPD[]
  hasRelasiData: (opd: OPD) => boolean
  onDelete: (id: string) => void
  onCreate: (name: string) => void | Promise<void>
  onUpdate: (payload: { id: string; name: string }) => void | Promise<void>
}

export function OPDTab({
  filteredOPD,
  hasRelasiData,
  onDelete,
  onCreate,
  onUpdate,
}: OPDTabProps) {
  const [selectedOPD, setSelectedOPD] = useState<OPD | null>(null)
  const [formData, setFormData] = useState({ name: '' })
  const [dialogState, setDialogState] = useState<OpdDialogState>({
    isCreateOpen: false,
    isEditOpen: false,
  })

  const openCreateDialog = () => {
    setFormData({ name: '' })
    setDialogState((prev) => ({ ...prev, isCreateOpen: true }))
  }
  const openEditDialog = (opd: OPD) => {
    setSelectedOPD(opd)
    setFormData({ name: opd.name })
    setDialogState((prev) => ({ ...prev, isEditOpen: true }))
  }
  const handleConfirmCreate = () => onCreate(formData.name)
  const handleConfirmEdit = () => {
    if (!selectedOPD) return
    onUpdate({ id: selectedOPD.id, name: formData.name })
  }

  return (
    <>
      <Table.Paginated data={filteredOPD} label="OPD" className="w-full">
        {(pageData) => (
          <>
            <div className="flex justify-end mb-2">
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={openCreateDialog}
              >
                Tambah OPD
              </Button>
            </div>
            <Table.Root>
              <Table.Table>
              <thead>
                <Table.HeadRow>
                  <Table.Th className="w-full">Nama OPD</Table.Th>
                  <Table.ActionTh>Aksi</Table.ActionTh>
                </Table.HeadRow>
              </thead>
              <tbody>
                {pageData.map((opd) => (
                  <Table.BodyRow key={opd.id}>
                    <Table.Td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-blue-100 rounded-md flex items-center justify-center shrink-0">
                          <Building2 className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <p className="font-medium text-foreground">{opd.name}</p>
                      </div>
                    </Table.Td>
                    <Table.ActionTd>
                      <RowActions
                        actions={[
                          {
                            icon: Edit,
                            title: 'Edit OPD',
                            onClick: () => openEditDialog(opd),
                          },
                          {
                            icon: Trash2,
                            title: hasRelasiData(opd)
                              ? 'Hapus (ditolak: ada SOP)'
                              : 'Hapus OPD',
                            destructive: true,
                            onClick: () => onDelete(opd.id),
                            disabled: hasRelasiData(opd),
                          },
                        ]}
                      />
                    </Table.ActionTd>
                  </Table.BodyRow>
                ))}
              </tbody>
              </Table.Table>
            </Table.Root>
          </>
        )}
      </Table.Paginated>

      <SingleTextFieldDialog
        open={dialogState.isCreateOpen}
        onOpenChange={(open) =>
          setDialogState((prev) => ({ ...prev, isCreateOpen: open }))
        }
        title="Tambah OPD Baru"
        description="Lengkapi form berikut untuk menambah OPD baru"
        confirmLabel="Simpan"
        cancelLabel="Batal"
        onConfirm={handleConfirmCreate}
        confirmDisabled={!formData.name}
        size="md"
        label="Nama OPD"
        placeholder="Contoh: Dinas Pendidikan"
        value={formData.name}
        onValueChange={(name) => setFormData((prev) => ({ ...prev, name }))}
      />

      <SingleTextFieldDialog
        open={dialogState.isEditOpen}
        onOpenChange={(open) =>
          setDialogState((prev) => ({ ...prev, isEditOpen: open }))
        }
        title="Edit OPD"
        description="Perbarui informasi OPD"
        confirmLabel="Simpan Perubahan"
        cancelLabel="Batal"
        onConfirm={handleConfirmEdit}
        confirmDisabled={!formData.name}
        size="md"
        label="Nama OPD"
        value={formData.name}
        onValueChange={(name) => setFormData((prev) => ({ ...prev, name }))}
      />
    </>
  )
}
