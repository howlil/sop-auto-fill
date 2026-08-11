import { RiwayatOpdDialog } from '@/components/organisasi/riwayat-opd-dialog'
import { useKepalaOpdRiwayat } from '@/api/kepala-opd'
import { formatDateIdLong } from '@/utils/format-date'

export interface KepalaOpdRiwayatDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  penggunaId: string | null
  namaKepala: string
}

export function KepalaOpdRiwayatDialog({
  open,
  onOpenChange,
  penggunaId,
  namaKepala,
}: KepalaOpdRiwayatDialogProps) {
  const { data: rows, isLoading } = useKepalaOpdRiwayat(penggunaId, open)

  return (
    <RiwayatOpdDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Riwayat penugasan OPD"
      subtitle={namaKepala}
      rows={rows?.map((row) => ({
        id: row.opdId,
        namaOpd: row.namaOpd,
        isAktif: row.isAktif,
        primaryDate: formatDateIdLong(row.diperbaruiPada),
      }))}
      isLoading={isLoading}
      loadingMessage="Memuat."
      emptyMessage="Belum ada riwayat OPD tercatat."
      className="max-w-md"
      listClassName="text-xs"
    />
  )
}
