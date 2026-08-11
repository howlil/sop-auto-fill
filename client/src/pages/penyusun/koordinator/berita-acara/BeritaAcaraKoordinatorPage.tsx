import { useNavigate } from '@tanstack/react-router'
import { useBeritaAcaraPjPenyusun } from '@/api/evaluasi'
import { ListPageLayout } from '@/components/layout/ListPageLayout'
import { RowActions } from '@/components/data/row-actions'
import {
  PengajuanBaNumberCell,
  PengajuanDateCell,
  PengajuanTabbedTable,
} from '@/components/pengajuan/pengajuan-tabbed-table'
import { PengajuanStatusBadge } from '@/components/status/pengajuan-status-badge'
import { Button } from '@/components/ui/button'
import { FileText, Eye, AlertCircle, RefreshCw } from 'lucide-react'
import { ROUTES } from '@/utils/constants'
import { formatDateIdFull } from '@/utils/format-date'

export function BeritaAcaraKoordinatorPage() {
  const navigate = useNavigate()
  const { perluTindakan, riwayat, isLoading, error } = useBeritaAcaraPjPenyusun()

  return (
    <ListPageLayout
      breadcrumb={[{ label: 'PJ Penyusun' }, { label: 'Berita Acara' }]}
      title="Berita Acara Evaluasi"
      description="Kelola tanda tangan Berita Acara dan akses arsip pengajuan evaluasi yang sudah selesai."
    >
      <div className="space-y-4">
        {error && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 py-12 text-center">
            <AlertCircle className="mb-3 h-12 w-12 text-red-600" />
            <h3 className="mb-1 text-sm text-foreground">Gagal Memuat Data</h3>
            <p className="mb-4 max-w-md text-xs text-muted-foreground">
              Terjadi kesalahan saat mengambil data berita acara. Periksa koneksi Anda dan coba lagi.
            </p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Coba Lagi
            </Button>
          </div>
        )}

        {!error && (
          <PengajuanTabbedTable
            defaultValue="perlu"
            label="berita acara"
            pageSize={15}
            isLoading={isLoading}
            loadingRows={5}
            emptyIcon={<FileText />}
            tabs={[
              {
                value: 'perlu',
                label: 'Perlu Tanda Tangan',
                rows: perluTindakan,
                emptyTitle: 'Belum ada BA menunggu tanda tangan',
                emptyDescription:
                  'Berita Acara akan muncul setelah PJ Evaluator menandatangani evaluasi.',
              },
              {
                value: 'riwayat',
                label: 'Riwayat',
                rows: riwayat,
                emptyTitle: 'Belum ada riwayat Berita Acara',
                emptyDescription:
                  'BA yang sudah Anda tandatangani atau pengajuan evaluasi yang sudah selesai total akan tampil di sini.',
              },
            ]}
            columns={[
              {
                id: 'status',
                header: 'Status',
                render: (pengajuan) => (
                  <PengajuanStatusBadge
                    status={pengajuan.status}
                    label={pengajuan.statusLabel ?? pengajuan.status}
                    showDomain={false}
                  />
                ),
              },
              {
                id: 'nomor-ba',
                header: 'Nomor BA',
                render: (pengajuan) => <PengajuanBaNumberCell value={pengajuan.nomorBA} />,
              },
              {
                id: 'tanggal-evaluasi',
                header: 'Tanggal Evaluasi',
                render: (pengajuan) => (
                  <PengajuanDateCell value={pengajuan.tanggalVerifikasi} formatter={formatDateIdFull} />
                ),
              },
              {
                id: 'evaluator',
                header: 'Evaluator',
                className: 'max-w-[280px] text-secondary-foreground',
                render: (pengajuan) => pengajuan.timEvaluasi ?? '-',
              },
            ]}
            getRowId={(pengajuan) => pengajuan.id}
            renderAction={(pengajuan) => (
              <RowActions
                actions={[
                  {
                    icon: Eye,
                    title: 'Lihat Detail',
                    onClick: () =>
                      navigate({
                        to: ROUTES.PENYUSUN.DETAIL_BERITA_ACARA,
                        params: { id: pengajuan.id },
                      }),
                  },
                ]}
              />
            )}
          />
        )}
      </div>
    </ListPageLayout>
  )
}
