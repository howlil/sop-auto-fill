import { useMemo, useState } from "react";
import { useParams } from "@tanstack/react-router";
import { AlertTriangle, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SopStatusBadge } from "@/components/status/sop-status-badge";
import { DetailPageLayout } from "@/components/layout/DetailPageLayout";
import { CabutSopDialog } from "@/components/sop/CabutSopDialog";
import {
  SOPPreviewTemplate,
  type SOPPreviewTemplateProps,
} from "@/components/sop/sop-preview-template";
import { useCabutSop, usePenyusunWorkbench, useSop } from "@/api/sop";
import type { StatusSOP } from "@/types/dto/sop.dto";
import { DEFAULT_SOP_STATUS } from "@/types/dto/sop.dto";
import { mapPenyusunWorkbenchToPreviewProps } from "@/lib/sop/detailSop.mappers";
import { useSopPreviewDiagramState } from "@/hooks/use-sop-preview-diagram-state";
import {
  canShowCabutSopAction,
  getCabutSopBlockingReason,
  resolveKepalaOpdWorkbenchId,
} from "@/lib/sop/cabut-sop.util";
import { ROUTES } from "@/utils/constants";

export interface DetailSOPProps {
  /** Breadcrumb (default: Daftar SOP → Detail SOP). */
  breadcrumb?: { label: string; to?: string }[];
  /** Back link (default: Daftar SOP). */
  backTo?: string;
}

/**
 * Halaman detail SOP untuk Kepala OPD: pratinjau dan cabut versi BERLAKU.
 */
export function DetailSOP(props: DetailSOPProps = {}) {
  const { breadcrumb, backTo } = props;
  const params = useParams({ strict: false });
  const id = "id" in params ? params.id : undefined;

  const [activeTab, setActiveTab] = useState<"flowchart" | "bpmn">("flowchart");
  const [cabutDialogOpen, setCabutDialogOpen] = useState(false);

  const { list: sopList } = useSop();
  const sopRow = useMemo(
    () => sopList.find((row) => row.id === id) ?? null,
    [sopList, id],
  );

  const workbenchId = useMemo(
    () => (id != null ? resolveKepalaOpdWorkbenchId(id, sopRow) : undefined),
    [id, sopRow],
  );

  const { data: workbench } = usePenyusunWorkbench(workbenchId);
  const { cabutSopAsync, isCabutPending } = useCabutSop();

  const previewProps = useMemo(
    () => (workbench ? mapPenyusunWorkbenchToPreviewProps(workbench) : null),
    [workbench],
  );

  const diagramRenderState = useSopPreviewDiagramState(
    previewProps
      ? {
          diagramKonfigurasi: previewProps.diagramKonfigurasi,
          prosedurRows: previewProps.prosedurRows,
          implementers: previewProps.implementers,
        }
      : null,
    activeTab,
  );

  const sopStatus: StatusSOP =
    (workbench?.detail.status as StatusSOP | undefined) ?? DEFAULT_SOP_STATUS;
  const sopStatusLabel = workbench?.detail.statusLabel ?? sopStatus;
  const sopName = previewProps?.name ?? sopRow?.judul ?? "";
  const sopNumber = previewProps?.number ?? sopRow?.nomorSop ?? "";

  const isDicabut = sopStatus === "DICABUT";
  const showCabutAction = canShowCabutSopAction(sopRow) && !isDicabut;
  const cabutBlockingReason = getCabutSopBlockingReason(sopRow);
  const hasRevisiInFlightBlock =
    sopRow?.versiBerlaku?.status === "BERLAKU" &&
    sopRow?.canCabutSop !== true &&
    cabutBlockingReason != null;

  const effectiveBreadcrumb = breadcrumb ?? [
    { label: "SOP", to: ROUTES.KEPALA_OPD.SOP },
    { label: "Detail SOP" },
  ];
  const effectiveBackTo = backTo ?? ROUTES.KEPALA_OPD.SOP;

  async function handleConfirmCabut() {
    if (id == null) return;
    await cabutSopAsync(id);
    setCabutDialogOpen(false);
  }

  const workspaceHeaderToolbar = (
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-secondary-foreground">
        <SopStatusBadge
          status={sopStatus}
          label={sopStatusLabel}
          showDomain={false}
          className="text-xs"
        />
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {showCabutAction ? (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5 rounded-md border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
            disabled={isCabutPending || cabutBlockingReason != null}
            title={cabutBlockingReason ?? undefined}
            onClick={() => setCabutDialogOpen(true)}
          >
            <Ban className="w-3.5 h-3.5" />
            {isCabutPending ? "Mencabut…" : "Cabut SOP"}
          </Button>
        ) : null}
      </div>
    </div>
  );

  return (
    <>
      <DetailPageLayout
        breadcrumb={effectiveBreadcrumb}
        title="Detail Dokumen SOP"
        description={sopName}
        backTo={effectiveBackTo}
        backSize="icon"
        actions={null}
        header={workspaceHeaderToolbar}
        main={
          <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-4">
            {isDicabut ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
                <AlertTriangle className="mr-1 inline h-3.5 w-3.5 align-text-bottom" aria-hidden />
                SOP ini telah dicabut dan hanya tersedia untuk kebutuhan riwayat dan audit.
              </div>
            ) : null}
            {hasRevisiInFlightBlock ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 print:hidden">
                <AlertTriangle className="mr-1 inline h-3.5 w-3.5 align-text-bottom" aria-hidden />
                {cabutBlockingReason}
              </div>
            ) : null}
            <SOPPreviewTemplate
              name={sopName}
              number={sopNumber}
              metadata={
                previewProps?.metadata as SOPPreviewTemplateProps["metadata"]
              }
              prosedurRows={previewProps?.prosedurRows ?? []}
              implementers={previewProps?.implementers ?? []}
              tteSignaturePayload={workbench?.tteSignaturePayloadKepalaOpd}
              previewOptions={{ editable: false }}
              diagramState={{
                activeTab,
                onActiveTabChange: setActiveTab,
                diagramMountEnabled: previewProps != null,
                ...diagramRenderState,
              }}
            />
          </div>
        }
        rightPanel={null}
      />
      <CabutSopDialog
        open={cabutDialogOpen}
        onOpenChange={setCabutDialogOpen}
        sopJudul={sopName}
        nomorSop={sopNumber}
        onConfirm={() => void handleConfirmCabut()}
        isPending={isCabutPending}
      />
    </>
  );
}
