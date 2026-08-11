import { useMemo, useState } from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  Plus,
  Edit,
  Trash2,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table } from "@/components/ui/data-table";
import { SearchToolbar } from "@/components/ui/search-toolbar";
import { LoadingState } from "@/components/ui/loading-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ListPageLayout } from "@/components/layout/ListPageLayout";
import { RowActions } from "@/components/data/row-actions";
import { ExpandableGroupedTable } from "@/components/data/expandable-grouped-table";
import {
  PersonMonoCell,
  PersonNameCell,
  PersonStatusCell,
  PersonTextCell,
} from "@/components/person/person-table-cells";
import { useOpd } from "@/api/opd";
import { usePenyusun } from "@/api/penyusun";
import { PenyusunFormDialog } from "./components/PenyusunFormDialog";
import { RiwayatOpdPenyusunDialog } from "./components/RiwayatOpdPenyusunDialog";
import type { PenyusunFormData } from "./components/PenyusunFormDialog";
import { Badge } from "@/components/ui/badge";
import { ROUTES } from "@/utils/constants";
import type { PenyusunPublikItem, TimPenyusunOpdGrup } from "@/types/dto/tim.dto";

/** Baris tabel: item API + OPD induk */
type PenyusunBaris = PenyusunPublikItem & { opdId: string };

function flattenGrup(grup: TimPenyusunOpdGrup[]): PenyusunBaris[] {
  return grup.flatMap((g) =>
    g.penyusun.map((p) => ({ ...p, opdId: g.opdId })),
  );
}

const emptyForm = (): PenyusunFormData => ({
  namaLengkap: "",
  nip: "",
  jabatan: "",
  pangkat: "",
  email: "",
  nohp: "",
  peranTim: "PENYUSUN",
});

export function ManajemenPenyusun() {
  const { list: opdOptions } = useOpd();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const penyusunSearch =
    debouncedSearch.trim() !== "" ? debouncedSearch.trim() : undefined;
  const {
    grup,
    isLoading,
    tambah,
    update,
    pindah,
    hapusPermanen,
    isAdding,
    isUpdating,
    isPindah,
    isDeletingPermanent,
  } = usePenyusun(penyusunSearch);

  const opdList = opdOptions.map((o) => ({ id: o.id, name: o.nama }));

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [hapusPermanenId, setHapusPermanenId] = useState<string | null>(null);
  const [riwayatFor, setRiwayatFor] = useState<PenyusunBaris | null>(null);
  const [editingOpdId, setEditingOpdId] = useState<string | null>(null);
  const [opdTujuanId, setOpdTujuanId] = useState("");
  const [createOpdId, setCreateOpdId] = useState<string | undefined>();
  const [formData, setFormData] = useState<PenyusunFormData>(emptyForm());

  const barisFlat = useMemo(() => flattenGrup(grup), [grup]);

  const isFormValid =
    formData.namaLengkap.trim() !== "" &&
    formData.nip.trim() !== "" &&
    formData.jabatan.trim() !== "" &&
    formData.pangkat.trim() !== "" &&
    formData.email.trim() !== "" &&
    formData.nohp.trim() !== "";

  const handleCreate = async () => {
    if (!createOpdId || !isFormValid) return;
    try {
      await tambah({
        opdId: createOpdId,
        nama: formData.namaLengkap.trim(),
        nip: formData.nip.trim(),
        peran: formData.peranTim,
        pangkat: formData.pangkat.trim(),
        jabatan: formData.jabatan.trim(),
        email: formData.email.trim(),
        nohp: formData.nohp.trim(),
      });
      setIsCreateOpen(false);
      setFormData(emptyForm());
      setCreateOpdId(undefined);
    } catch {
      /* Toast error dari usePenyusun → useMutationWithToast.onError */
    }
  };

  const handleEdit = async () => {
    if (!editingId || !isFormValid) return;
    try {
      await update({
        id: editingId,
        payload: {
          nama: formData.namaLengkap.trim(),
          nip: formData.nip.trim(),
          email: formData.email.trim(),
          jabatan: formData.jabatan.trim(),
          pangkat: formData.pangkat.trim(),
          nohp: formData.nohp.trim(),
          peran: formData.peranTim,
          status: formData.statusAkun ?? "AKTIF",
        },
      });
      setIsEditOpen(false);
      setEditingId(null);
      setEditingOpdId(null);
      setFormData(emptyForm());
    } catch {
      /* Toast error dari useMutationWithToast */
    }
  };

  const handleHapusPermanen = async () => {
    if (!hapusPermanenId) return;
    try {
      await hapusPermanen(hapusPermanenId);
      setHapusPermanenId(null);
    } catch {
      /* Toast error dari useMutationWithToast */
    }
  };

  const handlePindahFromEdit = async () => {
    if (!editingId || !opdTujuanId) return;
    try {
      await pindah({ id: editingId, opdId: opdTujuanId });
      setIsEditOpen(false);
      setEditingId(null);
      setEditingOpdId(null);
      setFormData(emptyForm());
      setOpdTujuanId("");
    } catch {
      /* Toast error dari useMutationWithToast */
    }
  };

  const openEdit = (p: PenyusunBaris) => {
    setEditingId(p.id);
    setEditingOpdId(p.opdId);
    setOpdTujuanId(
      opdList.find((o) => o.id !== p.opdId)?.id ?? "",
    );
    setFormData({
      namaLengkap: p.nama,
      nip: p.nip,
      jabatan: p.jabatan,
      pangkat: p.pangkat,
      email: p.email,
      nohp: p.nohp,
      peranTim: p.peran,
      statusAkun: p.status,
    });
    setIsEditOpen(true);
  };

  return (
    <ListPageLayout
      breadcrumb={[
        {
          label: "Manajemen penyusun",
          to: ROUTES.PJ_EVALUATOR.PENYUSUN,
        },
      ]}
      title="Manajemen penyusun"
      description="Kelola pengguna peran Penyusun dan PJ Penyusun per OPD. Satu PJ Penyusun aktif per OPD."
      toolbar={
        <SearchToolbar
          searchPlaceholder="Cari nama, NIP, atau email..."
          searchValue={searchQuery}
          onSearchChange={(e) => setSearchQuery(e.target.value)}
        >
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => {
              setFormData(emptyForm());
              setCreateOpdId(undefined);
              setIsCreateOpen(true);
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah Penyusun
          </Button>
        </SearchToolbar>
      }
    >
      {isLoading ? (
        <LoadingState message="Memuat data penyusun…" />
      ) : (
        <>
          <ExpandableGroupedTable
            groups={grup}
            getGroupId={(g) => g.opdId}
            renderGroupTitle={(g) => g.namaOpd}
            renderGroupMeta={(g) => `${g.penyusun.length} penyusun`}
            renderRows={(g) => (
              <Table.Table>
                <thead>
                  <Table.HeadRow>
                    <Table.Th>OPD / Penyusun</Table.Th>
                    <Table.Th>NIP</Table.Th>
                    <Table.Th>Jabatan</Table.Th>
                    <Table.Th>Email</Table.Th>
                    <Table.Th>No. HP</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.ActionTh>Aksi</Table.ActionTh>
                  </Table.HeadRow>
                </thead>
                <tbody>
                  {g.penyusun.map((p) => {
                    const row: PenyusunBaris = { ...p, opdId: g.opdId };
                    return (
                      <Table.BodyRow key={p.id}>
                        <Table.Td>
                          <PersonNameCell name={p.nama} avatarText={p.nama[0]}>
                            <Badge variant="outline" className="text-[10px] w-fit">
                              {p.peran === "PJ_PENYUSUN"
                                ? "PJ Penyusun"
                                : "Penyusun"}
                            </Badge>
                          </PersonNameCell>
                        </Table.Td>
                        <Table.Td>
                          <PersonMonoCell value={p.nip} />
                        </Table.Td>
                        <Table.Td>
                          <PersonTextCell value={p.jabatan} />
                        </Table.Td>
                        <Table.Td>
                          <PersonTextCell value={p.email} />
                        </Table.Td>
                        <Table.Td>
                          <PersonTextCell value={p.nohp} />
                        </Table.Td>
                        <Table.Td>
                          <PersonStatusCell status={p.status} />
                        </Table.Td>
                        <Table.ActionTd>
                          <RowActions
                            wrap
                            actions={[
                              {
                                icon: History,
                                title: "Riwayat OPD",
                                onClick: () => setRiwayatFor(row),
                              },
                              {
                                icon: Edit,
                                title: "Edit",
                                onClick: () => openEdit(row),
                              },
                              {
                                icon: Trash2,
                                title: "Hapus permanen",
                                destructive: true,
                                onClick: () => setHapusPermanenId(p.id),
                              },
                            ]}
                          />
                        </Table.ActionTd>
                      </Table.BodyRow>
                    );
                  })}
                </tbody>
              </Table.Table>
            )}
          />

          {barisFlat.length === 0 && (
            <div className="py-8 text-center text-muted-foreground text-sm">
              {searchQuery.trim()
                ? "Tidak ada penyusun yang cocok dengan pencarian."
                : "Belum ada data penyusun. Klik Tambah Penyusun untuk menambah."}
            </div>
          )}
        </>
      )}

      <PenyusunFormDialog
        mode="create"
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) {
            setFormData(emptyForm());
            setCreateOpdId(undefined);
          }
        }}
        formData={formData}
        setFormData={setFormData}
        createOpdId={createOpdId ?? ""}
        setCreateOpdId={(id) => setCreateOpdId(id || undefined)}
        opdList={opdList}
        isFormValid={isFormValid}
        onConfirm={handleCreate}
        confirmDisabled={isAdding}
        confirmLabel={isAdding ? "Menyimpan..." : "Simpan"}
      />

      <PenyusunFormDialog
        mode="edit"
        open={isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) {
            setEditingId(null);
            setEditingOpdId(null);
            setFormData(emptyForm());
            setOpdTujuanId("");
          }
        }}
        formData={formData}
        setFormData={setFormData}
        createOpdId={createOpdId ?? ""}
        setCreateOpdId={(id) => setCreateOpdId(id || undefined)}
        opdList={opdList}
        isFormValid={isFormValid}
        onConfirm={handleEdit}
        confirmDisabled={isUpdating}
        confirmLabel={isUpdating ? "Menyimpan..." : "Simpan Perubahan"}
        editingOpdId={editingOpdId ?? undefined}
        opdTujuanId={opdTujuanId}
        setOpdTujuanId={setOpdTujuanId}
        onConfirmPindah={handlePindahFromEdit}
        pindahConfirmDisabled={isPindah}
      />

      <ConfirmDialog
        open={hapusPermanenId != null}
        onOpenChange={(open) => !open && setHapusPermanenId(null)}
        title="Hapus penyusun permanen?"
        description="Hanya dapat dihapus jika tidak ada data SOP, komentar, evaluasi, atau jabatan OPD yang masih mereferensi pengguna ini."
        onConfirm={handleHapusPermanen}
        confirmLabel={
          isDeletingPermanent ? "Menghapus..." : "Hapus permanen"
        }
      />

      <RiwayatOpdPenyusunDialog
        open={riwayatFor != null}
        onOpenChange={(open) => !open && setRiwayatFor(null)}
        penggunaId={riwayatFor?.id ?? null}
        namaPenyusun={riwayatFor?.nama ?? ""}
      />
    </ListPageLayout>
  );
}
