import { Eye, FileSignature } from "lucide-react";
import { ListPageLayout } from "@/components/layout/ListPageLayout";
import { RowActions } from "@/components/data/row-actions";
import {
  PengajuanBaNumberCell,
  PengajuanDateCell,
  PengajuanTabbedTable,
} from "@/components/pengajuan/pengajuan-tabbed-table";
import { PengajuanStatusBadge } from "@/components/status/pengajuan-status-badge";
import { useKepalaOpdPengajuan } from "@/api/evaluasi";
import { ROUTES } from "@/utils/constants";
import { formatDateIdFull } from "@/utils/format-date";

export function PengajuanSOPPage() {
  const {
    belumDitandatangani,
    sudahBerlaku,
    isLoading,
  } = useKepalaOpdPengajuan();

  return (
    <ListPageLayout
      breadcrumb={[{ label: "Pengajuan SOP" }]}
      title="Pengajuan SOP"
      description="Pengajuan SOP OPD Anda, dipisahkan berdasarkan status tanda tangan Kepala OPD."
    >
      <PengajuanTabbedTable
        defaultValue="belum"
        label="pengajuan SOP"
        isLoading={isLoading}
        loadingRows={6}
        emptyIcon={<FileSignature />}
        tabs={[
          {
            value: "belum",
            label: "Belum Ditandatangani",
            rows: belumDitandatangani,
            emptyTitle: "Belum ada pengajuan menunggu tanda tangan",
            emptyDescription:
              "Pengajuan akan muncul setelah Berita Acara ditandatangani PJ Penyusun.",
          },
          {
            value: "sudah",
            label: "Sudah Berlaku",
            rows: sudahBerlaku,
            emptyTitle: "Belum ada pengajuan selesai",
            emptyDescription:
              "Pengajuan yang seluruh SOP-nya sudah ditandatangani Kepala OPD akan tampil di sini.",
          },
        ]}
        columns={[
          {
            id: "jenis",
            header: "Jenis",
            className: "text-secondary-foreground",
            render: (item) => item.jenis,
          },
          {
            id: "status",
            header: "Status",
            render: (item) => (
              <PengajuanStatusBadge
                status={item.status}
                label={item.statusLabel ?? item.status}
                showDomain={false}
              />
            ),
          },
          {
            id: "jumlah-sop",
            header: "Jumlah SOP",
            className: "text-secondary-foreground",
            render: (item) => `${item.sopList?.length ?? 0} SOP`,
          },
          {
            id: "nomor-ba",
            header: "Nomor BA",
            render: (item) => <PengajuanBaNumberCell value={item.nomorBA} />,
          },
          {
            id: "tanggal-verifikasi",
            header: "Tanggal Tanda Tangan",
            render: (item) => (
              <PengajuanDateCell
                value={item.tanggalTTDBaPjPenyusun ?? item.updatedAt}
                formatter={formatDateIdFull}
              />
            ),
          },
        ]}
        getRowId={(item) => item.id}
        renderAction={(item) => (
          <RowActions
            actions={[
              {
                icon: Eye,
                to: ROUTES.KEPALA_OPD.DETAIL_PENGAJUAN,
                params: { id: item.id },
                title: "Lihat detail pengajuan",
              },
            ]}
          />
        )}
      />
    </ListPageLayout>
  );
}
