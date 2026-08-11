import { useState, useMemo } from "react";
import {
  Eye,
  Edit,
  Send,
  Plus,
  FileText,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table } from "@/components/ui/data-table";
import { SearchToolbar } from "@/components/ui/search-toolbar";
import { ListPageLayout } from "@/components/layout/ListPageLayout";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { FilterDropdownButton } from "@/components/data/filter-dropdown-button";
import { DateRangeFilterFields } from "@/pages/penyusun/sop/components/date-range-filter-fields";
import { RowActions } from "@/components/data/row-actions";
import {
  SopNumberCell,
  SopPrimaryCell,
  SopStatusCell,
  SopUpdatedByCell,
  SopVersionCell,
} from "@/components/sop/sop-table-cells";
import { ROUTES } from "@/utils/constants";
import type { StatusSOP } from "@/types/dto/sop.dto";
import { SOPStatusFilterSelect } from "@/components/sop/sop-status-filter-select";
import { BuatSOPDialog } from "@/pages/penyusun/sop/components/BuatSOPDialog";
import { BukaPengajuanEvaluasiDialog } from "@/pages/penyusun/sop/components/BukaPengajuanEvaluasiDialog";
import {
  canEditSop,
  canPjPenyusunRunCoordinatorActions,
  useDaftarSopData,
  useSopSuspense,
} from "@/api/sop";
import type { SopListQueryParams } from "@/types/dto/sop.dto";
import { useDaftarSopFilters } from "@/pages/penyusun/sop/hooks/use-daftar-sop-filters";
import { useAppRole } from "@/hooks/useAppRole";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { SopDaftarRow } from "@/types/dto/sop.dto";
import { canHapusSopDraftAwal, useHapusSopDraftAwal } from "@/api/sop";

export function ManajemenSOP() {
  useDocumentTitle("Manajemen SOP — Penyusun");
  const filterStatusId = "filter-status-sop";
  const filterTanggalDariId = "filter-tanggal-dari-sop";
  const filterTanggalSampaiId = "filter-tanggal-sampai-sop";
  const { role } = useAppRole();
  const filters = useDaftarSopFilters();
  const sopListParams = useMemo((): SopListQueryParams | undefined => {
    const status =
      filters.filterStatus && filters.filterStatus !== "all"
        ? filters.filterStatus
        : undefined;
    const tanggalDari = filters.filterTanggalDari?.trim() || undefined;
    const tanggalSampai = filters.filterTanggalSampai?.trim() || undefined;
    if (!status && !tanggalDari && !tanggalSampai) {
      return undefined;
    }
    return { status, tanggalDari, tanggalSampai };
  }, [filters.filterStatus, filters.filterTanggalDari, filters.filterTanggalSampai]);
  const { list: listFilteredByServer, create } = useSopSuspense(sopListParams);
  const { filteredList } = useDaftarSopData({
    list: listFilteredByServer,
    searchQuery: filters.searchQuery,
  });

  const [isBukaPengajuanEvaluasiDialogOpen, setIsBukaPengajuanEvaluasiDialogOpen] =
    useState(false);
  const [isBuatSOPDialogOpen, setIsBuatSOPDialogOpen] = useState(false);
  const [sopDraftToDelete, setSopDraftToDelete] = useState<SopDaftarRow | null>(null);
  const hapusSopDraft = useHapusSopDraftAwal();

  return (
    <ListPageLayout
      breadcrumb={[{ label: "Manajemen SOP" }]}
      title="Manajemen SOP"
      description="Daftar SOP yang Anda kelola. Penyusun menyelesaikan penyusunan lewat tombol Selesai di editor (status Menunggu pengajuan evaluasi). PJ Penyusun membuka pengajuan evaluasi ke Biro lewat tombol di halaman ini. Klik baris untuk melihat atau mengedit detail SOP."
      toolbar={
        <SearchToolbar
          searchPlaceholder="Cari judul atau nomor SOP..."
          searchValue={filters.searchQuery}
          onSearchChange={(e) => filters.setSearchQuery(e.target.value)}
        >
          <FilterDropdownButton
            open={filters.isFilterOpen}
            onOpenChange={filters.setIsFilterOpen}
            activeCount={filters.activeFilterCount}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-foreground">
                  Filter SOP
                </p>
                {filters.activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-blue-600"
                    onClick={filters.clearFilters}
                  >
                    Reset
                  </Button>
                )}
              </div>
              <FormField label="Status" htmlFor={filterStatusId}>
                <SOPStatusFilterSelect
                  id={filterStatusId}
                  value={filters.filterStatus ?? "all"}
                  onValueChange={filters.setStatusFilter}
                />
              </FormField>
              <FormField label="Terakhir diperbarui">
                <DateRangeFilterFields
                  fromId={filterTanggalDariId}
                  toId={filterTanggalSampaiId}
                  fromValue={filters.filterTanggalDari ?? ""}
                  toValue={filters.filterTanggalSampai ?? ""}
                  onFromChange={filters.setFilterTanggalDari}
                  onToChange={filters.setFilterTanggalSampai}
                />
              </FormField>
            </div>
          </FilterDropdownButton>
          {canPjPenyusunRunCoordinatorActions(role ?? "") && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => setIsBukaPengajuanEvaluasiDialogOpen(true)}
            >
              <Send className="w-3.5 h-3.5" />
              Ajukan evaluasi SOP
            </Button>
          )}
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => setIsBuatSOPDialogOpen(true)}
          >
            <Plus className="w-3.5 h-3.5" />
            Buat SOP Baru
          </Button>
        </SearchToolbar>
      }
    >
      <Table.Paginated data={filteredList} label="SOP">
        {(pageData) => (
          <Table.Root>
            <Table.Table>
              <thead>
                <Table.HeadRow>
                  <Table.Th>Judul SOP</Table.Th>
                  <Table.Th>Nomor SOP</Table.Th>
                  <Table.Th>Versi</Table.Th>
                  <Table.Th>Pembuat</Table.Th>
                  <Table.Th>Terakhir diedit</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.ActionTh>Aksi</Table.ActionTh>
                </Table.HeadRow>
              </thead>
              <tbody>
                {pageData.length === 0 ? (
                  <EmptyState
                    asTableRow
                    colSpan={7}
                    icon={<FileText />}
                    title="Tidak ada SOP ditemukan"
                    description="Coba ubah filter atau kata kunci pencarian"
                  />
                ) : (
                  pageData.map((sop) => (
                    <Table.BodyRow key={sop.id}>
                      <Table.Td>
                        <SopPrimaryCell title={sop.judul} />
                      </Table.Td>
                      <Table.Td>
                        <SopNumberCell value={sop.nomorSop} />
                      </Table.Td>
                      <Table.Td>
                        <SopVersionCell value={sop.versi} />
                      </Table.Td>
                      <Table.Td>
                        <p className="text-secondary-foreground">{sop.pembuat ?? "—"}</p>
                      </Table.Td>
                      <Table.Td>
                        <SopUpdatedByCell
                          name={sop.terakhirDiedit.nama}
                          date={sop.terakhirDiedit.waktu}
                        />
                      </Table.Td>
                      <Table.Td>
                        <SopStatusCell
                          status={sop.status}
                          label={sop.statusLabel}
                        />
                      </Table.Td>
                      <Table.ActionTd>
                        <RowActions
                          actions={[
                            sop.status && canEditSop(sop.status as StatusSOP)
                              ? {
                                  icon: Edit,
                                  to: ROUTES.PENYUSUN.DETAIL_SOP,
                                  params: { id: sop.detailSopId ?? sop.id },
                                  title: "Edit",
                                }
                              : {
                                  icon: Eye,
                                  to: ROUTES.PENYUSUN.DETAIL_SOP,
                                  params: { id: sop.detailSopId ?? sop.id },
                                  title: "Lihat",
                                },
                            ...(canHapusSopDraftAwal(sop)
                              ? [
                                  {
                                    icon: Trash2,
                                    title: "Hapus draft SOP",
                                    destructive: true,
                                    onClick: () => setSopDraftToDelete(sop),
                                  },
                                ]
                              : []),
                          ]}
                        />
                      </Table.ActionTd>
                    </Table.BodyRow>
                  ))
                )}
              </tbody>
            </Table.Table>
          </Table.Root>
        )}
      </Table.Paginated>

      <BukaPengajuanEvaluasiDialog
        open={isBukaPengajuanEvaluasiDialogOpen}
        onOpenChange={setIsBukaPengajuanEvaluasiDialogOpen}
      />

      <BuatSOPDialog
        open={isBuatSOPDialogOpen}
        onOpenChange={setIsBuatSOPDialogOpen}
        onCreate={async (data) => {
          await create({
            judul: data.judul,
            nomorSop: data.nomorSop,
          });
        }}
      />

      <ConfirmDialog
        open={sopDraftToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setSopDraftToDelete(null);
        }}
        title="Hapus draft SOP?"
        description="Draft SOP akan dihapus permanen beserta data yang sudah diisi. Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Hapus draft"
        destructive
        onConfirm={() => {
          if (sopDraftToDelete?.detailSopId == null) return;
          hapusSopDraft.mutate(sopDraftToDelete.detailSopId, {
            onSuccess: () => setSopDraftToDelete(null),
          });
        }}
      />
    </ListPageLayout>
  );
}
