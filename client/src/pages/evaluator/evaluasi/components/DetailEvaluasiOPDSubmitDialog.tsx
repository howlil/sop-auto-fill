import { useState, useEffect } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { AjukanEvaluasiSnapshotRow } from "@/api/evaluasi";
import type { PengajuanEvaluasiSubmitError } from "@/types/dto/evaluasi.dto";

export interface DetailEvaluasiOPDSubmitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshotRows: AjukanEvaluasiSnapshotRow[];
  canConfirm: boolean;
  blockingReason: string | null;
  onConfirm: (nomorBA: string) => void;
  isSubmitting?: boolean;
  /** false untuk pengajuan EVALUASI_REQUEST_OPD — teks bantuan tanpa syarat skor OPD. */
  requiresNilaiOpdInCopy?: boolean;
  /** Error validasi / server terakhir (ditampilkan di dalam dialog). */
  evaluasiSubmitError?: PengajuanEvaluasiSubmitError;
}

export function DetailEvaluasiOPDSubmitDialog({
  open,
  onOpenChange,
  snapshotRows,
  canConfirm,
  blockingReason,
  onConfirm,
  isSubmitting = false,
  evaluasiSubmitError = { kind: "none", items: [] },
}: DetailEvaluasiOPDSubmitDialogProps) {
  const [nomorBA, setNomorBA] = useState("");

  useEffect(() => {
    if (!open) {
      setNomorBA("");
    }
  }, [open]);

  const serverMessage =
    evaluasiSubmitError.kind === "blocked" || evaluasiSubmitError.kind === "incomplete"
      ? evaluasiSubmitError.message
      : null;
  const alertMessage = serverMessage ?? (!canConfirm ? blockingReason : null);

  const isValid = canConfirm && snapshotRows.length > 0 && nomorBA.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Ajukan tanda tangan Berita Acara</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {alertMessage ? (
            <p className="text-xs text-amber-900 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
              {alertMessage}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="nomorBA" className="text-xs text-secondary-foreground">
              Nomor Berita Acara (BA) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="nomorBA"
              placeholder="Contoh: BA/EVAL/2026/01"
              value={nomorBA}
              onChange={(e) => setNomorBA(e.target.value)}
              className="h-8 text-xs"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-secondary-foreground">Ringkasan Dokumen</Label>
            {snapshotRows.length === 0 ? (
              <p className="text-xs text-muted-foreground">Tidak ada dokumen dalam pengajuan ini.</p>
            ) : (
              <ul className="max-h-40 overflow-auto rounded-md border border-border divide-y divide-border text-xs scrollbar-hide">
                {snapshotRows.map((row) => (
                  <li
                    key={row.detailSopId}
                    className="flex items-start justify-between gap-3 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{row.judul}</p>
                      <p className="truncate text-xs text-muted-foreground">{row.nomorSOP}</p>
                    </div>
                    <span className="shrink-0 text-[10px] font-medium text-secondary-foreground">
                      {row.hasilLabel}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Batal
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => onConfirm(nomorBA.trim())}
            disabled={!isValid || isSubmitting}
          >
            <Send className="w-3.5 h-3.5" /> Ya, ajukan BA
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
