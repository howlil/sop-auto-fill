
import { useMemo, useState } from "react";
import { Eye, Ban, FileText } from "lucide-react";
import { Table } from "@/components/ui/data-table";
import { SearchToolbar } from "@/components/ui/search-toolbar";
import { SOPStatusFilterSelect } from "@/components/sop/sop-status-filter-select";
import { ListPageLayout } from "@/components/layout/ListPageLayout";
import { EmptyState } from "@/components/ui/empty-state";
import { CabutSopDialog } from "@/components/sop/CabutSopDialog";
import { RowActions } from "@/components/data/row-actions";
import {
  SopDateCell,
  SopNumberCell,
  SopPrimaryCell,
  SopStatusCell,
} from "@/components/sop/sop-table-cells";
import { ROUTES } from "@/utils/constants";
import { useAuthStore } from "@/stores/authStore";
import { useCabutSop, useSop } from "@/api/sop";
import type { SopDaftarRow } from "@/types/dto/sop.dto";
import { canShowCabutSopAction, getCabutSopBlockingReason } from "@/lib/sop/cabut-sop.util";
import { useOpd } from "@/api/opd";

export function PantauSOP() {
  const opdId = useAuthStore((state) => state.user?.opdId ?? "");
  const { list: allOpds } = useOpd();
  const opd = allOpds.find((o) => o.id === opdId);
  const opdName = opd?.nama ?? "OPD";

  const [filterStatus, setFilterStatus] = useState("all");
  const { list: mergedList } = useSop();
  const { cabutSopAsync, isCabutPending } = useCabutSop();
  const [cabutTarget, setCabutTarget] = useState<SopDaftarRow | null>(null);

  const listByStatus = useMemo(
    () =>
      filterStatus === "all"
        ? mergedList
        : mergedList.filter((s) => s.status === filterStatus),
    [mergedList, filterStatus],
  );

  const [searchQuery, setSearchQuery] = useState("");
  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return listByStatus;
    return listByStatus.filter((s) =>
      [s.judul, s.nomorSop ?? ""].join(" ").toLowerCase().includes(q),
    );
  }, [listByStatus, searchQuery]);

  async function handleConfirmCabutFromList() {
    if (cabutTarget == null) return;
    await cabutSopAsync(cabutTarget.id);
    setCabutTarget(null);
  }

  return (
    <>
      <ListPageLayout
        breadcrumb={[{ label: "SOP" }]}
        title="SOP"
        description={`Daftar semua SOP di ${opdName}. Hanya menampilkan SOP yang tercatat untuk OPD Anda.`}
        toolbar={
          <SearchToolbar
            searchPlaceholder="Cari judul atau nomor SOP..."
            searchValue={searchQuery}
            onSearchChange={(e) => setSearchQuery(e.target.value)}
          >
            <SOPStatusFilterSelect
              value={filterStatus}
              onValueChange={setFilterStatus}
              className="h-9 w-[200px]"
            />
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
                    <Table.Th>Terakhir diperbarui</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.ActionTh>Aksi</Table.ActionTh>
                  </Table.HeadRow>
                </thead>
                <tbody>
                  {pageData.length === 0 ? (
                    <EmptyState
                      asTableRow
                      colSpan={5}
                      icon={<FileText />}
                      title="Tidak ada SOP ditemukan"
                      description="Tidak ada SOP untuk OPD Anda atau tidak cocok dengan pencarian."
                    />
                  ) : (
                    pageData.map((sop) => {
                      const showCabut = canShowCabutSopAction(sop) && sop.versiBerlaku?.status !== "DICABUT";
                      const cabutBlockReason = getCabutSopBlockingReason(sop);
                      return (
                        <Table.BodyRow key={sop.id}>
                          <Table.Td>
                            <SopPrimaryCell title={sop.judul} />
                          </Table.Td>
                          <Table.Td>
                            <SopNumberCell value={sop.nomorSop} />
                          </Table.Td>
                          <Table.Td>
                            <SopDateCell date={sop.terakhirDiperbarui} />
                          </Table.Td>
                          <Table.Td>
                            <SopStatusCell
                              status={sop.status}
                              label={sop.statusLabel}
                            />
                          </Table.Td>
                          <Table.ActionTd>
                            <RowActions
                              align="start"
                              actions={[
                                {
                                  icon: Eye,
                                  to: ROUTES.KEPALA_OPD.DETAIL_SOP,
                                  params: { id: sop.id },
                                  title: "Lihat detail",
                                },
                                ...(showCabut
                                  ? [
                                      {
                                        icon: Ban,
                                        title: cabutBlockReason ?? "Cabut SOP",
                                        disabled: isCabutPending || cabutBlockReason != null,
                                        onClick: () => setCabutTarget(sop),
                                        className:
                                          "text-rose-700 hover:text-rose-800 hover:bg-rose-50",
                                      },
                                    ]
                                  : []),
                              ]}
                            />
                          </Table.ActionTd>
                        </Table.BodyRow>
                      );
                    })
                  )}
                </tbody>
              </Table.Table>
            </Table.Root>
          )}
        </Table.Paginated>
      </ListPageLayout>
      <CabutSopDialog
        open={cabutTarget != null}
        onOpenChange={(open) => {
          if (!open) setCabutTarget(null);
        }}
        sopJudul={cabutTarget?.judul ?? ""}
        nomorSop={cabutTarget?.versiBerlaku?.nomorSop ?? cabutTarget?.nomorSop ?? ""}
        onConfirm={() => void handleConfirmCabutFromList()}
        isPending={isCabutPending}
      />
    </>
  );
}
