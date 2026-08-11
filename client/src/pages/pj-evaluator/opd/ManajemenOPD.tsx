import { useState } from 'react'
import { Building2, Users } from 'lucide-react'
import { SearchToolbar } from '@/components/ui/search-toolbar'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ListPageLayout } from '@/components/layout/ListPageLayout'
import { useToast } from '@/hooks/useToast'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useOpd } from '@/api/opd'
import {
  useKepalaOpdList,
  useCreateKepalaOpd,
  useUpdateKepalaOpd,
  useDeleteKepalaOpd,
} from '@/api/kepala-opd'
import type { OPDUI as OPD } from '@/types/ui/organisasi'
import type { KepalaOpdDto } from '@/types/dto/kepala-opd.dto'
import { OPDTab } from './components/OPDTab'
import { KepalaOPDTab } from './components/KepalaOPDTab'

function hasRelasiData(opd: OPD): boolean {
  if (!opd._count) return false
  return opd._count.sop > 0 || opd._count.pengguna > 0 || opd._count.pengajuanEvaluasi > 0
}

function canDeleteKepala(kepala: KepalaOpdDto): boolean {
  return kepala.dapatDihapus
}

export function ManajemenOPD() {
  const { showToast } = useToast()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchUserQuery, setSearchUserQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'opd' | 'kepala'>('opd')
  const debouncedOpdSearch = useDebouncedValue(searchQuery, 300)
  const debouncedKepalaSearch = useDebouncedValue(searchUserQuery, 300)
  const opdSearchParam =
    activeTab === 'opd' && debouncedOpdSearch.trim() !== ''
      ? debouncedOpdSearch.trim()
      : undefined
  const { list: opdResponseList, create, update, delete: deleteOpd } = useOpd({
    search: opdSearchParam,
  })

  const opdList: OPD[] = opdResponseList.map((o) => ({
    id: o.id,
    name: o.nama,
  }))

  const kepalaSearchParam =
    activeTab === 'kepala' && debouncedKepalaSearch.trim() !== ''
      ? debouncedKepalaSearch.trim()
      : undefined
  const { data: kepalaData = [], isLoading: isLoadingKepala } = useKepalaOpdList(
    kepalaSearchParam,
    { enabled: activeTab === 'kepala' },
  )
  const { mutateAsync: createKepala } = useCreateKepalaOpd()
  const { mutateAsync: updateKepala } = useUpdateKepalaOpd()
  const { mutateAsync: deleteKepala } = useDeleteKepalaOpd()

  const [deleteOpdId, setDeleteOpdId] = useState<string | null>(null)
  const [deleteKepalaId, setDeleteKepalaId] = useState<string | null>(null)

  const handleDeleteOpd = (id: string) => {
    const opd = opdList.find((o) => o.id === id)
    if (opd && hasRelasiData(opd)) {
      showToast(
        'OPD dengan data (SOP, proyek, evaluasi) hanya dapat dinonaktifkan. Gunakan tombol Nonaktif untuk menonaktifkan akun; penghapusan permanen tidak diperbolehkan.',
        'error',
      )
      return
    }
    setDeleteOpdId(id)
  }

  const onConfirmCreate = async (name: string) => {
    try {
      await create({ nama: name })
    } catch {
      /* Pesan error sudah ditampilkan oleh useMutationWithToast */
    }
  }

  const onConfirmEdit = async ({ id, name }: { id: string; name: string }) => {
    try {
      await update({ id, payload: { nama: name } })
    } catch {
      /* Pesan error sudah ditampilkan oleh useMutationWithToast */
    }
  }

  return (
    <ListPageLayout
      breadcrumb={[{ label: 'Manajemen OPD' }]}
      title="Manajemen OPD"
      description="Kelola data organisasi perangkat daerah dan jabatan kepala OPD"
      toolbar={
        <SearchToolbar
          searchPlaceholder={
            activeTab === 'opd'
              ? 'Cari nama OPD...'
              : 'Cari nama, NIP, atau email...'
          }
          searchValue={activeTab === 'opd' ? searchQuery : searchUserQuery}
          onSearchChange={(e) =>
            activeTab === 'opd' ? setSearchQuery(e.target.value) : setSearchUserQuery(e.target.value)
          }
        />
      }
    >
      <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v as 'opd' | 'kepala')} className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-9 bg-surface border border-border w-full">
          <TabsTrigger value="opd" className="text-xs gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            Manajemen OPD
          </TabsTrigger>
          <TabsTrigger value="kepala" className="text-xs gap-1.5">
            <Users className="w-3.5 h-3.5" />
            Kepala OPD
          </TabsTrigger>
        </TabsList>

        <TabsContent value="opd" className="space-y-3 mt-3">
          <OPDTab
            filteredOPD={opdList}
            hasRelasiData={hasRelasiData}
            onDelete={handleDeleteOpd}
            onCreate={onConfirmCreate}
            onUpdate={onConfirmEdit}
          />
        </TabsContent>

        <TabsContent value="kepala" className="space-y-3 mt-3">
          <KepalaOPDTab
            opdList={opdList}
            kepalaRows={kepalaData}
            isLoading={isLoadingKepala}
            onCreate={async (payload) => {
              await createKepala(payload)
            }}
            onUpdate={async (id, payload) => {
              await updateKepala({ id, payload })
            }}
            onPindah={async (id, opdTujuanId) => {
              await updateKepala({ id, payload: { opdId: opdTujuanId } })
            }}
            onDeleteRequest={(id) => setDeleteKepalaId(id)}
            canDeleteKepala={canDeleteKepala}
          />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={deleteOpdId != null}
        onOpenChange={(open) => !open && setDeleteOpdId(null)}
        title="Hapus OPD?"
        description="Apakah Anda yakin ingin menghapus OPD ini? Hapus permanen hanya untuk OPD tanpa data."
        onConfirm={async () => {
          if (deleteOpdId) {
            try {
              await deleteOpd(deleteOpdId)
              setDeleteOpdId(null)
            } catch {
              /* Pesan error sudah ditampilkan oleh useMutationWithToast */
            }
          }
        }}
      />

      <ConfirmDialog
        open={deleteKepalaId != null}
        onOpenChange={(open) => !open && setDeleteKepalaId(null)}
        title="Hapus Kepala OPD?"
        description={
          deleteKepalaId
            ? 'Belum ada Detail SOP yang berelasi dengan akun ini. Akun akan dihapus dari daftar dan jabatan kepala pada OPD dikosongkan.'
            : undefined
        }
        confirmLabel="Hapus"
        destructive
        onConfirm={async () => {
          if (deleteKepalaId) {
            try {
              await deleteKepala(deleteKepalaId)
            } finally {
              setDeleteKepalaId(null)
            }
          }
        }}
      />
    </ListPageLayout>
  )
}
