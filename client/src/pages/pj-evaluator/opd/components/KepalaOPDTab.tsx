import { useState } from 'react'
import { Edit, History, Trash2, MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingTableRow } from '@/components/ui/loading-state'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import {
  PersonMonoCell,
  PersonNameCell,
  PersonStatusCell,
  PersonTextCell,
} from '@/components/person/person-table-cells'
import { KepalaOpdManageDialog } from './KepalaOpdManageDialog'
import { TambahKepalaOPDDialog } from './TambahKepalaOPDDialog'
import { KepalaOpdRiwayatDialog } from './KepalaOpdRiwayatDialog'
import type { FormTambahKepalaState, KepalaFormState } from '@/types/ui/organisasi'
import type { OPDOption as OPD, KepalaOPDRow } from './types'
import type { KepalaOpdDto, UpdateKepalaOpdDto } from '@/types/dto/kepala-opd.dto'

function mapDtoToRow(k: KepalaOpdDto): KepalaOPDRow {
  return {
    id: k.id,
    name: k.nama,
    nip: k.nip,
    email: k.email,
    phone: k.nohp,
    opdId: k.opdId,
    jabatan: k.jabatan,
    pangkat: k.pangkat,
    isActive: k.isActive,
  }
}

const EMPTY_KEPALA_FORM: KepalaFormState = {
  name: '',
  nip: '',
  email: '',
  nohp: '',
  jabatan: '',
  pangkat: '',
  status: 'AKTIF',
}

function emptyTambahForm(defaultOpdId: string): FormTambahKepalaState {
  return {
    opdId: defaultOpdId,
    nama: '',
    email: '',
    nip: '',
    jabatan: '',
    pangkat: '',
    nohp: '',
  }
}

export interface KepalaOPDTabProps {
  opdList: OPD[]
  kepalaRows: KepalaOpdDto[]
  isLoading: boolean
  onCreate: (payload: {
    opdId: string
    nama: string
    email: string
    nip: string
    jabatan: string
    pangkat: string
    nohp: string
  }) => Promise<void>
  onUpdate: (id: string, payload: UpdateKepalaOpdDto) => Promise<void>
  onPindah: (id: string, opdTujuanId: string) => Promise<void>
  onDeleteRequest: (id: string) => void
  canDeleteKepala: (k: KepalaOpdDto) => boolean
}

export function KepalaOPDTab({
  opdList,
  kepalaRows,
  isLoading,
  onCreate,
  onUpdate,
  onPindah,
  onDeleteRequest,
  canDeleteKepala,
}: KepalaOPDTabProps) {
  const [manageDialogOpen, setManageDialogOpen] = useState(false)
  const [manageTab, setManageTab] = useState<'edit' | 'pindah'>('edit')
  const [tambahKepalaOpen, setTambahKepalaOpen] = useState(false)
  const [riwayatForId, setRiwayatForId] = useState<string | null>(null)
  const [riwayatNama, setRiwayatNama] = useState('')
  const [editingSource, setEditingSource] = useState<KepalaOpdDto | null>(null)
  const [kepalaForm, setKepalaForm] = useState<KepalaFormState>(EMPTY_KEPALA_FORM)
  const [formTambahKepala, setFormTambahKepala] = useState<FormTambahKepalaState>(() =>
    emptyTambahForm(opdList[0]?.id ?? ''),
  )
  const [pindahForm, setPindahForm] = useState<{ opdId: string }>({ opdId: '' })

  const resetManageState = () => {
    setEditingSource(null)
    setManageTab('edit')
    setPindahForm({ opdId: '' })
  }

  const handleManageOpenChange = (open: boolean) => {
    setManageDialogOpen(open)
    if (!open) {
      resetManageState()
    }
  }

  const openManageDialog = (src: KepalaOpdDto) => {
    const row = mapDtoToRow(src)
    setEditingSource(src)
    setManageTab('edit')
    setPindahForm({ opdId: '' })
    setKepalaForm({
      name: row.name,
      nip: row.nip ?? '',
      email: row.email ?? '',
      nohp: row.phone ?? '',
      jabatan: row.jabatan ?? '',
      pangkat: row.pangkat ?? '',
      status: src.isActive ? 'AKTIF' : 'NONAKTIF',
    })
    setManageDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editingSource) return
    await onUpdate(editingSource.id, {
      nama: kepalaForm.name.trim(),
      nip: kepalaForm.nip.trim(),
      email: kepalaForm.email.trim(),
      nohp: kepalaForm.nohp.trim(),
      jabatan: kepalaForm.jabatan.trim(),
      pangkat: kepalaForm.pangkat.trim(),
      status: kepalaForm.status,
    })
    setManageDialogOpen(false)
    resetManageState()
  }

  const handleTambahConfirm = async () => {
    await onCreate({
      opdId: formTambahKepala.opdId,
      nama: formTambahKepala.nama.trim(),
      email: formTambahKepala.email.trim(),
      nip: formTambahKepala.nip.trim(),
      jabatan: formTambahKepala.jabatan.trim(),
      pangkat: formTambahKepala.pangkat.trim(),
      nohp: formTambahKepala.nohp.trim(),
    })
    setTambahKepalaOpen(false)
    setFormTambahKepala(emptyTambahForm(opdList[0]?.id ?? ''))
  }

  const handlePindahConfirm = async () => {
    if (!editingSource || !pindahForm.opdId) return
    await onPindah(editingSource.id, pindahForm.opdId)
    setManageDialogOpen(false)
    resetManageState()
  }

  /** OPD boleh dipilih sebagai tujuan jika tidak ada kepala aktif lain di sana */
  const canPickOpdAsDestination = (opdId: string): boolean => {
    const other = kepalaRows.find((r) => r.opdId === opdId && r.isActive)
    return other === undefined
  }

  return (
    <>
      <div className="flex justify-end mb-2">
        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs shrink-0"
          onClick={() => {
            setFormTambahKepala(emptyTambahForm(opdList[0]?.id ?? ''))
            setTambahKepalaOpen(true)
          }}
        >
          Tambah Kepala OPD
        </Button>
      </div>
      <Table.Paginated data={kepalaRows} label="kepala" className="w-full">
        {(pageData) => (
          <Table.Root>
            <Table.Table>
            <thead>
              <Table.HeadRow>
                <Table.Th>Nama</Table.Th>
                <Table.Th>NIP</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>OPD</Table.Th>
                <Table.Th>Jabatan</Table.Th>
                <Table.Th align="center">Status</Table.Th>
                <Table.ActionTh>Aksi</Table.ActionTh>
              </Table.HeadRow>
            </thead>
            <tbody>
              {isLoading ? (
                <LoadingTableRow colSpan={7} message="Memuat data Kepala OPD…" />
              ) : pageData.length === 0 ? (
                <EmptyState
                  asTableRow
                  colSpan={7}
                  title="Belum ada Kepala OPD"
                  description="Gunakan tombol Tambah Kepala OPD untuk membuat akun baru."
                />
              ) : (
                pageData.map((k) => (
                  <Table.BodyRow key={k.id}>
                    <Table.Td>
                      <PersonNameCell name={k.nama} avatarText={k.nama[0]} />
                    </Table.Td>
                    <Table.Td>
                      <PersonMonoCell value={k.nip} />
                    </Table.Td>
                    <Table.Td>
                    <PersonTextCell value={k.email} />
                    </Table.Td>
                    <Table.Td>{k.namaOpd}</Table.Td>
                    <Table.Td className="max-w-[140px] truncate">
                    <PersonTextCell value={k.jabatan} />
                    </Table.Td>
                    <Table.Td className="text-center">
                      <PersonStatusCell status={k.isActive ? 'AKTIF' : 'NONAKTIF'} />
                    </Table.Td>
                    <Table.ActionTd>
                      <div className="flex justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4 text-secondary-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => {
                                setRiwayatForId(k.id)
                                setRiwayatNama(k.nama)
                              }}
                            >
                              <History className="mr-2 h-4 w-4" />
                              Riwayat penugasan
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openManageDialog(k)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Ubah / pindah OPD
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={!canDeleteKepala(k)}
                              onClick={() => onDeleteRequest(k.id)}
                              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Hapus Kepala OPD
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </Table.ActionTd>
                  </Table.BodyRow>
                ))
              )}
            </tbody>
            </Table.Table>
          </Table.Root>
        )}
      </Table.Paginated>
      <KepalaOpdManageDialog
        open={manageDialogOpen}
        onOpenChange={handleManageOpenChange}
        tab={manageTab}
        onTabChange={setManageTab}
        editingSource={editingSource}
        opdList={opdList}
        form={kepalaForm}
        setForm={setKepalaForm}
        pindahForm={pindahForm}
        setPindahForm={setPindahForm}
        canPickOpdAsDestination={canPickOpdAsDestination}
        onConfirmEdit={handleSaveEdit}
        onConfirmPindah={handlePindahConfirm}
      />

      <TambahKepalaOPDDialog
        open={tambahKepalaOpen}
        onOpenChange={setTambahKepalaOpen}
        form={formTambahKepala}
        setForm={setFormTambahKepala}
        opdList={opdList}
        onConfirm={handleTambahConfirm}
      />

      <KepalaOpdRiwayatDialog
        open={riwayatForId !== null}
        onOpenChange={(open) => !open && setRiwayatForId(null)}
        penggunaId={riwayatForId}
        namaKepala={riwayatNama}
      />
    </>
  )
}
