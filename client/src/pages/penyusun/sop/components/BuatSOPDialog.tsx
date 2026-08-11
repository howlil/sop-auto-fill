/**
 * Dialog Buat SOP Baru — judul + nomor SOP; server membuat header + DetailSOP v1 (DRAFT).
 */
import { useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/useToast";

export interface BuatSOPDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pemanggilan mutasi create SOP (toast/error di parent). */
  onCreate: (data: { judul: string; nomorSop: string }) => Promise<void>;
}

export function BuatSOPDialog({
  open,
  onOpenChange,
  onCreate,
}: BuatSOPDialogProps) {
  const [formData, setFormData] = useState({
    judulSOP: "",
    nomorSop: "",
  });

  const { showToast } = useToast();

  const handleSubmit = async () => {
    if (!formData.judulSOP?.trim() || !formData.nomorSop?.trim()) {
      showToast("Mohon lengkapi Judul SOP dan Nomor SOP", "error");
      return;
    }

    const data = {
      judul: formData.judulSOP.trim(),
      nomorSop: formData.nomorSop.trim(),
    };

    try {
      await onCreate(data);
      onOpenChange(false);
      setFormData({ judulSOP: "", nomorSop: "" });
    } catch {
      // Error toast sudah ditangani useMutationWithToast di parent
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setFormData({ judulSOP: "", nomorSop: "" });
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Buat SOP Baru</DialogTitle>
          <DialogDescription className="text-xs">
            Isi judul dan nomor SOP. SOP baru dibuat dengan status Draft (versi 1).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <FormField label="Judul SOP" required>
            <Input
              className="h-9 text-xs"
              placeholder="Contoh: SOP Pelayanan Penerimaan Siswa Baru"
              value={formData.judulSOP}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, judulSOP: e.target.value }))
              }
            />
          </FormField>
          <FormField label="Nomor SOP" required>
            <Input
              className="h-9 text-xs"
              placeholder="Contoh: T.001/UN15/KP.01.00/2024"
              value={formData.nomorSop}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, nomorSop: e.target.value }))
              }
            />
          </FormField>
        </div>
        <DialogFooter className="gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => handleOpenChange(false)}
          >
            Batal
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={handleSubmit}
          >
            <FileText className="w-3.5 h-3.5" />
            Buat SOP
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
