import { useCallback, useEffect, useState } from "react";
import { useEvaluasi, useEvaluasiWorkspaceOpdSaya } from "@/api/evaluasi";
import type { JenisPengajuanEvaluasi } from "@/types/dto/evaluasi.dto";
import { FormDialog } from "@/components/ui/form-dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/utils/cn";

export interface BukaPengajuanEvaluasiDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

function toggleDetailId(
  prev: ReadonlySet<string>,
  detailSopId: string,
  checked: boolean,
): Set<string> {
  const next = new Set(prev);
  if (checked) {
    next.add(detailSopId);
  } else {
    next.delete(detailSopId);
  }
  return next;
}

const JENIS_OPTIONS: ReadonlyArray<{
  value: JenisPengajuanEvaluasi;
  label: string;
}> = [
  { value: "EVALUASI_REQUEST_EVALUATOR", label: "Request evaluator" },
  { value: "EVALUASI_REQUEST_OPD", label: "Request OPD" },
];

const STATUS_DETAIL_MENUNGGU_PENGAJUAN_EVALUASI = "MENUNGGU_PENGAJUAN_EVALUASI";

export function BukaPengajuanEvaluasiDialog({
  open,
  onOpenChange,
}: BukaPengajuanEvaluasiDialogProps) {
  const [selectedDetailIds, setSelectedDetailIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [jenis, setJenis] = useState<JenisPengajuanEvaluasi>("EVALUASI_REQUEST_EVALUATOR");
  const { create, isCreating } = useEvaluasi({ enabled: false });
  const {
    data: workspace,
    isLoading: isLoadingWorkspace,
    isFetching: isFetchingWorkspace,
  } = useEvaluasiWorkspaceOpdSaya({ enabled: open });

  useEffect(() => {
    if (!open) {
      setSelectedDetailIds(new Set());
      setJenis("EVALUASI_REQUEST_EVALUATOR");
    }
  }, [open]);

  const hasBlockingPengajuan = workspace?.pengajuanAktif != null;
  const workspaceBusy = isLoadingWorkspace || isFetchingWorkspace;
  const sopMenungguPengajuanEvaluasi =
    workspace?.daftarSop.filter(
      (row) => row.statusDetail === STATUS_DETAIL_MENUNGGU_PENGAJUAN_EVALUASI,
    ) ?? [];

  const handleConfirm = useCallback(() => {
    if (selectedDetailIds.size === 0 || hasBlockingPengajuan) {
      return;
    }
    void (async () => {
      await create({
        jenis,
        sopDetailIds: Array.from(selectedDetailIds),
      });
      onOpenChange(false);
    })();
  }, [
    create,
    hasBlockingPengajuan,
    jenis,
    onOpenChange,
    selectedDetailIds,
  ]);

  const confirmDisabled =
    selectedDetailIds.size === 0 ||
    hasBlockingPengajuan ||
    isCreating ||
    workspaceBusy;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Ajukan evaluasi SOP"
      description="Pilih SOP dan jenis pengajuan untuk dikirim ke Biro Organisasi."
      confirmLabel="Ajukan evaluasi"
      size="lg"
      onConfirm={handleConfirm}
      confirmDisabled={confirmDisabled}
      contentClassName="space-y-4"
    >
      {hasBlockingPengajuan ? (
        <div
          role="status"
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950"
        >
          Masih ada pengajuan evaluasi aktif. Selesaikan terlebih dahulu.
        </div>
      ) : null}
      <div className="space-y-1.5">
        <Label required>SOP menunggu pengajuan evaluasi</Label>
        {workspaceBusy ? (
          <p className="text-xs text-muted-foreground">Memuat daftar SOP...</p>
        ) : sopMenungguPengajuanEvaluasi.length === 0 ? (
          <p className="text-xs text-muted-foreground">Belum ada SOP menunggu pengajuan evaluasi.</p>
        ) : (
          <ul className="max-h-56 overflow-y-auto rounded-md border border-border divide-y divide-border">
            {sopMenungguPengajuanEvaluasi.map((row) => {
              const checked = selectedDetailIds.has(row.detailSopId);
              return (
                <li key={row.detailSopId}>
                  <label className="flex items-start gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-surface-subtle">
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded border-border-strong text-primary focus:ring-primary"
                      checked={checked}
                      onChange={(e) => {
                        setSelectedDetailIds((prev) =>
                          toggleDetailId(prev, row.detailSopId, e.target.checked),
                        );
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-foreground block truncate">
                        {row.judul}
                      </span>
                      <span className="text-muted-foreground">
                        {row.nomorSOP} · {row.statusDetailLabel}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <fieldset className="space-y-2 border-0 p-0 m-0">
        <legend className="text-xs font-medium text-secondary-foreground mb-1.5">
          Jenis pengajuan
        </legend>
        <div className="flex flex-wrap gap-2">
          {JENIS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                jenis === option.value
                  ? "border-blue-600 bg-blue-50 text-blue-950"
                  : "border-border-strong bg-surface text-foreground hover:bg-surface-subtle",
              )}
              onClick={() => setJenis(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>
    </FormDialog>
  );
}
