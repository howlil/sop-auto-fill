import { useMemo, useState } from "react";
import { UserCog, Plus, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table } from "@/components/ui/data-table";
import { SearchToolbar } from "@/components/ui/search-toolbar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SingleTextFieldDialog } from "@/components/forms/single-text-field-dialog";
import { ListPageLayout } from "@/components/layout/ListPageLayout";
import { EmptyState } from "@/components/ui/empty-state";
import { RowActions } from "@/components/data/row-actions";
import type { Pelaksana } from "@/types/dto/sop.dto";
import { usePelaksana } from "@/api/sop";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/hooks/useToast";
import { hasRequiredStringFields } from "@/lib/forms/validation";

const REQUIRED_PELAKSANA_FIELDS = ["namaPelaksana"] as const;

export function PelaksanaSOP() {
  const { showToast } = useToast();
  const user = useAuthStore((s) => s.user);
  const { list, addPelaksana, updatePelaksana, removePelaksana } =
    usePelaksana();

  // Validate user has OPD assigned
  const userOpdId = user?.opdId;

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Pelaksana | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    namaPelaksana: "",
  });
  const isFormValid = hasRequiredStringFields(formData, REQUIRED_PELAKSANA_FIELDS);
  const [searchQuery, setSearchQuery] = useState("");
  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((item) =>
      String(item.namaPelaksana ?? "")
        .toLowerCase()
        .includes(q),
    );
  }, [list, searchQuery]);

  if (!userOpdId) {
    return (
      <ListPageLayout
        breadcrumb={[{ label: "Manajemen Pelaksana SOP" }]}
        title="Manajemen Pelaksana SOP"
        description="Master data pelaksana/aktor yang dipakai di kolom pelaksana saat menyusun prosedur SOP"
      >
        <EmptyState
          icon={<UserCog className="w-8 h-8" />}
          title="OPD tidak ditemukan"
          description="Anda belum ditetapkan ke OPD tertentu. Silakan hubungi administrator untuk ditetapkan ke OPD."
        />
      </ListPageLayout>
    );
  }

  const openEdit = (p: Pelaksana) => {
    setEditing(p);
    setFormData({
      namaPelaksana: p.namaPelaksana ?? "",
    });
    setIsEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      namaPelaksana: "",
    });
    setEditing(null);
  };

  const handleCreate = async () => {
    if (!isFormValid) {
      showToast("Nama pelaksana wajib diisi", "error");
      return;
    }
    try {
      await addPelaksana({
        namaPelaksana: formData.namaPelaksana.trim(),
        opdId: userOpdId,
      });
      setIsCreateDialogOpen(false);
      resetForm();
    } catch {
      // Toast dari useMutationWithToast (usePelaksana)
    }
  };

  const handleEdit = async () => {
    if (!editing) return;
    if (!isFormValid) {
      showToast("Nama pelaksana wajib diisi", "error");
      return;
    }
    try {
      await updatePelaksana({
        id: editing.id,
        namaPelaksana: formData.namaPelaksana.trim(),
      });
      setIsEditDialogOpen(false);
      resetForm();
    } catch {
      // Toast dari useMutationWithToast (usePelaksana)
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    try {
      await removePelaksana(deleteId);
      setDeleteId(null);
    } catch {
      // Toast error dari useMutationWithToast
    }
  };

  return (
    <ListPageLayout
      breadcrumb={[{ label: "Manajemen Pelaksana SOP" }]}
      title="Manajemen Pelaksana SOP"
      description="Master data pelaksana/aktor yang dipakai di kolom pelaksana saat menyusun prosedur SOP"
      toolbar={
        <SearchToolbar
          searchPlaceholder="Cari nama pelaksana..."
          searchValue={searchQuery}
          onSearchChange={(e) => setSearchQuery(e.target.value)}
        >
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => {
              resetForm();
              setIsCreateDialogOpen(true);
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah Pelaksana
          </Button>
        </SearchToolbar>
      }
    >
      <Table.Paginated data={filteredList} label="pelaksana">
        {(pageData) => (
          <Table.Root>
            <Table.Table>
            <thead>
              <Table.HeadRow>
                <Table.Th>Nama Pelaksana</Table.Th>
                <Table.ActionTh>Aksi</Table.ActionTh>
              </Table.HeadRow>
            </thead>
            <tbody>
              {pageData.length === 0 ? (
                <EmptyState
                  asTableRow
                  colSpan={2}
                  icon={<UserCog className="w-8 h-8" />}
                  title="Belum ada pelaksana"
                  description="Tambah pelaksana agar bisa dipilih di edit SOP (prosedur)"
                />
              ) : (
                pageData.map((p) => (
                  <Table.BodyRow key={p.id}>
                    <Table.Td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-amber-100 rounded-md flex items-center justify-center">
                          <UserCog className="w-3.5 h-3.5 text-amber-600" />
                        </div>
                        <p className="font-medium text-foreground">
                          {p.namaPelaksana}
                        </p>
                      </div>
                    </Table.Td>
                    <Table.ActionTd>
                      <RowActions
                        actions={[
                          { icon: Edit, title: "Edit", onClick: () => openEdit(p) },
                          {
                            icon: Trash2,
                            title: "Hapus",
                            destructive: true,
                            onClick: () => setDeleteId(p.id),
                          },
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

      <SingleTextFieldDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        title="Tambah Pelaksana SOP"
        description="Pelaksana ini akan muncul di dropdown kolom pelaksana saat menyusun prosedur SOP"
        confirmLabel="Simpan"
        cancelLabel="Batal"
        onConfirm={handleCreate}
        confirmDisabled={!isFormValid}
        size="lg"
        label="Nama Pelaksana"
        placeholder="Contoh: Staf Administrasi"
        value={formData.namaPelaksana}
        onValueChange={(namaPelaksana) => setFormData({ ...formData, namaPelaksana })}
      />

      <SingleTextFieldDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        title="Edit Pelaksana SOP"
        description="Perbarui data pelaksana"
        confirmLabel="Simpan Perubahan"
        cancelLabel="Batal"
        onConfirm={handleEdit}
        confirmDisabled={!isFormValid}
        size="lg"
        label="Nama Pelaksana"
        value={formData.namaPelaksana}
        onValueChange={(namaPelaksana) => setFormData({ ...formData, namaPelaksana })}
      />

      <ConfirmDialog
        open={deleteId != null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Hapus pelaksana SOP?"
        description="Pelaksana yang sudah dipakai di prosedur tidak dapat dihapus. Lanjutkan?"
        onConfirm={handleDeleteConfirm}
      />
    </ListPageLayout>
  );
}
