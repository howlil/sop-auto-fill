import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchToolbar } from '@/components/ui/search-toolbar'
import { ListPageLayout } from '@/components/layout/ListPageLayout'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import type { Peraturan } from "@/types/dto/peraturan.dto";
import { usePeraturan } from "@/api/peraturan";
import { useAuthStore } from '@/stores/authStore'
import { useToast } from "@/hooks/useToast"
import { PeraturanTableTab } from './components/PeraturanTableTab'
import { hasRequiredStringFields } from '@/lib/forms/validation'

const REQUIRED_PERATURAN_FIELDS = ['peraturan', 'nomor', 'tahun', 'tentang'] as const

export function ManajemenPeraturan() {
  const { showToast } = useToast()
  const currentUser = useAuthStore((s) => s.user)
  const currentOpdId = currentUser?.opdId ?? ''

  const {
    list: peraturanList,
    isLoading: isLoadingPeraturan,
    create,
    update,
    delete: deletePeraturan,
  } = usePeraturan(currentOpdId || undefined)

  // Inline state (replaced useManajemenPeraturanState)
  const [searchQuery, setSearchQuery] = useState('')
  const [isPeraturanDialogOpen, setIsPeraturanDialogOpen] = useState(false)
  const [editingPeraturan, setEditingPeraturan] = useState<Peraturan | null>(null)
  const [peraturanFormData, setPeraturanFormData] = useState({
    peraturan: '',
    nomor: '',
    tahun: '',
    tentang: '',
  })
  const isPeraturanFormValid = hasRequiredStringFields(
    peraturanFormData,
    REQUIRED_PERATURAN_FIELDS,
  )
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: string } | null>(null)

  const filteredPeraturan = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return peraturanList
    return peraturanList.filter((item) =>
      ['namaPeraturan', 'nomor', 'tentang']
        .map((k) => String(item[k as keyof Peraturan] ?? ''))
        .join(' ')
        .toLowerCase()
        .includes(q)
    )
  }, [peraturanList, searchQuery])

  const canEditPeraturan = (p: Peraturan) => {
    // Only allow editing peraturan that belong to current user's OPD
    return p.opdId === currentOpdId;
  };

  const openPeraturanDialog = (peraturan?: Peraturan) => {
    if (peraturan) {
      setEditingPeraturan(peraturan)
      setPeraturanFormData({
        peraturan: peraturan.namaPeraturan,
        nomor: peraturan.nomor,
        tahun: String(peraturan.tahun),
        tentang: peraturan.tentang,
      })
    } else {
      setEditingPeraturan(null)
      setPeraturanFormData({ peraturan: '', nomor: '', tahun: '', tentang: '' })
    }
    setIsPeraturanDialogOpen(true)
  }

  const handleSavePeraturan = async () => {
    if (
      !isPeraturanFormValid
    ) {
      showToast('Semua field wajib diisi', 'error')
      return
    }

    // Validate year is reasonable (1900 - current year + 1)
    const year = Number(peraturanFormData.tahun)
    const currentYear = new Date().getFullYear()
    if (year < 1900 || year > currentYear + 1) {
      showToast(`Tahun harus antara 1900 hingga ${currentYear + 1}`, 'error')
      return
    }

    if (editingPeraturan && !canEditPeraturan(editingPeraturan)) {
      showToast('Hanya peraturan yang dibuat oleh OPD Anda yang dapat diedit.', 'error')
      return
    }
    try {
      if (editingPeraturan) {
        await update({
          id: editingPeraturan.id,
          payload: {
            namaPeraturan: peraturanFormData.peraturan,
            nomor: peraturanFormData.nomor,
            tahun: Number(peraturanFormData.tahun),
            tentang: peraturanFormData.tentang,
          },
        })
      } else {
        await create({
          namaPeraturan: peraturanFormData.peraturan,
          nomor: peraturanFormData.nomor,
          tahun: Number(peraturanFormData.tahun),
          tentang: peraturanFormData.tentang,
        })
      }
      setIsPeraturanDialogOpen(false)
    } catch {
      // Toast sukses/error dari usePeraturan → useMutationWithToast
    }
  }

  const handleDeletePeraturan = (id: string) => {
    const peraturan = peraturanList.find((p) => p.id === id)
    if (peraturan && !canEditPeraturan(peraturan)) {
      showToast('Hanya peraturan yang dibuat oleh OPD Anda yang dapat dihapus.', 'error')
      return
    }
    if (peraturan && peraturan.digunakan && peraturan.digunakan > 0) {
      showToast(`Tidak dapat menghapus. Masih ada ${peraturan.digunakan} SOP yang mengaitkan peraturan ini.`, 'error')
      return
    }
    setDeleteConfirm({ type: 'peraturan', id })
  }

  const doDeletePeraturan = async (id: string) => {
    try {
      await deletePeraturan(id)
    } catch {
      // Toast error dari useMutationWithToast
    }
  }

  return (
    <ListPageLayout
      breadcrumb={[{ label: 'Manajemen Peraturan' }]}
      title="Database Peraturan"
      description="Kelola database peraturan"
      toolbar={
        <SearchToolbar
          searchPlaceholder="Cari peraturan..."
          searchValue={searchQuery}
          onSearchChange={(e) => setSearchQuery(e.target.value)}
        >
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => openPeraturanDialog()}
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah Peraturan
          </Button>
        </SearchToolbar>
      }
    >
      {isLoadingPeraturan ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <PeraturanTableTab
        filteredPeraturan={filteredPeraturan}
        canEditPeraturan={canEditPeraturan}
        isPeraturanDialogOpen={isPeraturanDialogOpen}
        setIsPeraturanDialogOpen={setIsPeraturanDialogOpen}
        editingPeraturan={editingPeraturan}
        peraturanFormData={peraturanFormData}
        setPeraturanFormData={setPeraturanFormData}
        onOpenPeraturanDialog={openPeraturanDialog}
        onSavePeraturan={handleSavePeraturan}
        onDeletePeraturan={handleDeletePeraturan}
        confirmDisabled={
          !isPeraturanFormValid
        }
      />
      )}

      <ConfirmDialog
        open={deleteConfirm != null}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title="Hapus peraturan?"
        description="Peraturan yang dihapus tidak dapat dikembalikan."
        onConfirm={() => {
          if (deleteConfirm?.type === 'peraturan') {
            doDeletePeraturan(deleteConfirm.id)
            setDeleteConfirm(null)
          }
        }}
      />
    </ListPageLayout>
  )
}
