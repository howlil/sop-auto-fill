import { useMemo, useState } from "react";
import { useParams } from "@tanstack/react-router";
import { CheckCircle, FileText, History } from "lucide-react";
import { LoadingState } from "@/components/ui/loading-state";
import { PengajuanCetakArsipButtons } from "@/components/pengajuan/PengajuanCetakArsipButtons";
import { usePengajuanCetakArsip } from "@/components/pengajuan/hooks/use-pengajuan-cetak-arsip";
import { canCetakBeritaAcaraPengajuan, canCetakSopArsipPengajuan } from "@/lib/print/pengajuan-print";
import { BeritaAcaraPreviewPane } from "@/components/pengajuan/berita-acara-preview-pane";
import { SopDocumentPreviewPane } from "@/components/pengajuan/sop-document-preview-pane";
import { mapBeritaAcaraTemplateProps } from "@/lib/pengajuan/map-berita-acara-template-props";
import { SOPListCard } from "@/components/sop/sop-list-card";
import { formatDateId } from "@/utils/format-date";
import { PinVerificationDialog } from "@/components/tte/pin-verification-dialog";
import { TteSetupRequiredDialog } from "@/components/tte/tte-setup-required-dialog";
import { createPinConfirmHandler } from "@/api/tte";
import { useTandaTanganiBA } from "@/api/tte";
import {
  usePengajuanBeritaAcaraView,
  usePengajuanEvaluasiDetail,
  usePengajuanSopDokumenWorkbench,
} from "@/api/evaluasi";
import { mapPenyusunWorkbenchToPreviewProps } from "@/lib/sop/detailSop.mappers";
import { parseTTESignaturePayload } from "@/lib/tte/parse-tte-signature-payload";
import { RiwayatEvaluasiTimeline } from "@/pages/pj-evaluator/evaluasi/components/RiwayatEvaluasiTimeline";
import { ROUTES } from "@/utils/constants";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";
import { NotFoundWithBack } from "@/components/ui/not-found";
import { DetailPageLayout } from "@/components/layout/DetailPageLayout";
import {
  CollapsedStripButton,
  CollapsibleSidePanel,
  CollapsibleSidePanelContent,
  CollapsibleSidePanelHeader,
  SimplePanelHeader,
} from "@/components/ui/collapsible-side-panel";
import { PengajuanEvaluasiStatusHeader } from "@/components/evaluasi/pengajuan-evaluasi-status-header";
import { InfoField } from "@/components/ui/info-field";
import { DocumentPreviewTabs } from "@/components/pengajuan/document-preview-tabs";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useRequireTteSetup } from "@/hooks/use-require-tte-setup";
import { IA } from "@/utils/constants";

export function DetailPengajuanEvaluasi() {
  const { id } = useParams({
    from: "/pj-evaluator/evaluasi/$id",
  });
  const { pengajuan, canVerify, loading } = usePengajuanEvaluasiDetail(id);
  const [previewMainTab, setPreviewMainTab] = useState<"sop" | "ba">("sop");
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [selectedSopId, setSelectedSopId] = useState<string | null>(null);
  const [tteDialogOpen, setTteDialogOpen] = useState(false);
  const {
    tteSetupDialogOpen,
    setTteSetupDialogOpen,
    requireTteReady,
    handleTteSigningError,
  } = useRequireTteSetup();

  const tandaTanganiBA = useTandaTanganiBA({
    successMessage:
      "Tanda Tangan Berita Acara oleh PJ Evaluator berhasil. PJ Penyusun dapat melanjutkan tanda tangan BA.",
    suppressSetupRequiredToast: true,
  });

  const handlePinConfirm = createPinConfirmHandler(
    tandaTanganiBA.mutateAsync,
    (pin) => ({
      pengajuanId: pengajuan?.id ?? "",
      payload: {
        pin,
        nomorDokumen: pengajuan?.nomorBA ?? `BA-${pengajuan?.opdNama ?? ""}`,
        judulDokumen: `Berita Acara Evaluasi - ${pengajuan?.opdNama ?? ""}`,
      },
    }),
    undefined,
    (error) => handleTteSigningError(error, () => setTteDialogOpen(false)),
  );
  const handleOpenTteDialog = () => {
    void requireTteReady(() => setTteDialogOpen(true));
  };

  const sopList = pengajuan?.sopList ?? [];
  const canCetakBa = canCetakBeritaAcaraPengajuan(pengajuan?.status);
  const canCetakSopArsip = canCetakSopArsipPengajuan(pengajuan?.status);
  const firstSopDetailId = sopList[0]?.sopDetailId ?? null;
  const effectiveSopDetailId = selectedSopId ?? firstSopDetailId;
  const displaySop = sopList.find(
    (s) => s.sopDetailId === effectiveSopDetailId,
  );

  const sopWorkbenchEnabled = Boolean(
    pengajuan && effectiveSopDetailId && (previewMainTab === "sop" || canCetakSopArsip),
  );
  const { data: sopDokumen, isFetching: sopWorkbenchLoading } =
    usePengajuanSopDokumenWorkbench(id, effectiveSopDetailId, {
      enabled: sopWorkbenchEnabled,
    });

  const sopPreviewProps = useMemo(() => {
    const wb = sopDokumen?.workbench;
    if (wb === undefined) {
      return null;
    }
    return mapPenyusunWorkbenchToPreviewProps(wb);
  }, [sopDokumen]);

  const tteSignaturePayloadKepalaOpd = useMemo(
    () => parseTTESignaturePayload(sopDokumen?.tteSignaturePayloadKepalaOpd),
    [sopDokumen?.tteSignaturePayloadKepalaOpd],
  );

  const baViewEnabled = Boolean(pengajuan && (previewMainTab === "ba" || canCetakBa));
  const { data: baView, isFetching: baViewLoading } = usePengajuanBeritaAcaraView(
    id,
    { enabled: baViewEnabled },
  );

  const baTemplateProps = useMemo(
    () =>
      pengajuan != null
        ? mapBeritaAcaraTemplateProps({ pengajuan, baView })
        : null,
    [pengajuan, baView],
  );

  const { handleCetak, cetakLoading } = usePengajuanCetakArsip({
    pengajuanId: id,
    pengajuan,
    effectiveSopDetailId,
    baTemplateProps,
    sopPreviewProps,
    tteSignaturePayload: tteSignaturePayloadKepalaOpd ?? null,
  });

  useDocumentTitle(
    pengajuan
      ? `${IA.REQUEST_EVALUATOR_EVALUASI_OPD} — ${pengajuan.opdNama}`
      : undefined,
  );

  if (loading && pengajuan === null) {
    return (
      <LoadingState className="min-h-[320px]" message="Memuat pengajuan evaluasi…" />
    );
  }

  if (pengajuan === null) {
    return (
      <NotFoundWithBack
        message="Pengajuan evaluasi tidak ditemukan."
        backAction={
          <BackButton to={ROUTES.PJ_EVALUATOR.EVALUASI}>
            Kembali
          </BackButton>
        }
      />
    );
  }

  return (
    <>
      <DetailPageLayout
        breadcrumb={[
          {
            label: IA.NAV_BIRO_EVALUASI_REQUEST_EVALUATOR,
            to: ROUTES.PJ_EVALUATOR.EVALUASI,
          },
          { label: pengajuan.opdNama ?? "" },
        ]}
        title={`${IA.REQUEST_EVALUATOR_EVALUASI_OPD} — ${pengajuan.opdNama}`}
        description={`${IA.VERIFIKASI_BA_BIRO} pada dokumen ${IA.BERITA_ACARA}. Setelah ini: PJ Penyusun → ${IA.PENGESAHAN_SOP} oleh Kepala OPD.`}
        backTo={ROUTES.PJ_EVALUATOR.EVALUASI}
        backSize="icon"
        header={
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">
                Informasi OPD & Evaluasi
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <PengajuanCetakArsipButtons
                  printScope="pj-evaluator"
                  pengajuanStatus={pengajuan.status}
                  effectiveSopDetailId={effectiveSopDetailId}
                  sopCount={sopList.length}
                  cetakLoading={cetakLoading}
                  onCetak={handleCetak}
                />
                {canVerify && (
                  <Button
                    variant="default"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={handleOpenTteDialog}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Tanda Tangan BA
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
              <InfoField label="OPD">{pengajuan.opdNama}</InfoField>
              <InfoField label="Jenis">{pengajuan.jenis}</InfoField>
              <InfoField label="Tanggal Evaluasi">
                {pengajuan.tanggalEvaluasi
                  ? formatDateId(pengajuan.tanggalEvaluasi)
                  : ""}
              </InfoField>
              {pengajuan.nilaiOPD && (
                <InfoField label="Nilai OPD">
                  {pengajuan.nilaiOPD.toString()}
                </InfoField>
              )}
            </div>
            <PengajuanEvaluasiStatusHeader
              status={pengajuan.status}
              statusLabel={pengajuan.statusLabel ?? pengajuan.status}
              role="PJ_EVALUATOR"
            />
          </div>
        }
        leftPanel={
          <CollapsibleSidePanel
            side="left"
            collapsed={leftPanelCollapsed}
            widthCollapsed="w-10"
            widthExpanded="w-[min(380px,40vw)]"
          >
            {leftPanelCollapsed ? (
              <CollapsedStripButton
                label="SOP"
                icon={<FileText className="w-4 h-4" />}
                onClick={() => setLeftPanelCollapsed(false)}
              />
            ) : (
              <>
                <CollapsibleSidePanelHeader
                  side="left"
                  onCollapse={() => setLeftPanelCollapsed(true)}
                  className="border-border bg-surface-subtle/90 px-2 py-1.5 sm:px-2.5"
                >
                  <SimplePanelHeader title="Daftar SOP" />
                </CollapsibleSidePanelHeader>
                <CollapsibleSidePanelContent className="px-2 pb-2 pt-1 sm:px-2">
                  <SOPListCard
                    items={sopList.map((sop) => ({
                      id: sop.sopDetailId,
                      nama: sop.nama,
                      nomor: sop.nomor,
                      statusDokumen: sop.status,
                      statusDokumenLabel: sop.statusLabel ?? sop.status,
                      hasilEvaluasi: sop.hasil,
                      hasilEvaluasiLabel: sop.hasilLabel,
                    }))}
                    selectedId={effectiveSopDetailId}
                    onSelect={setSelectedSopId}
                  />
                </CollapsibleSidePanelContent>
              </>
            )}
          </CollapsibleSidePanel>
        }
        rightPanel={
          <CollapsibleSidePanel
            side="right"
            collapsed={rightPanelCollapsed}
            widthCollapsed="w-10"
            widthExpanded="w-[min(320px,28vw)]"
          >
            {rightPanelCollapsed ? (
              <CollapsedStripButton
                label="Riwayat"
                icon={<History className="w-4 h-4" />}
                onClick={() => setRightPanelCollapsed(false)}
              />
            ) : (
              <>
                <CollapsibleSidePanelHeader
                  side="right"
                  onCollapse={() => setRightPanelCollapsed(true)}
                  className="border-border bg-surface-subtle/90 px-2 py-1.5 sm:px-2.5"
                >
                  <SimplePanelHeader title="Riwayat evaluasi" />
                </CollapsibleSidePanelHeader>
                <CollapsibleSidePanelContent className="px-2 pb-2 pt-1 sm:px-2">
                  <RiwayatEvaluasiTimeline logs={pengajuan.riwayatEvaluasi ?? []} />
                </CollapsibleSidePanelContent>
              </>
            )}
          </CollapsibleSidePanel>
        }
      >
        <div className="flex h-full min-h-0 min-w-0 flex-col">
        <DocumentPreviewTabs
          value={previewMainTab}
          onValueChange={setPreviewMainTab}
          headerClassName="px-0 py-1"
          listClassName="h-7 gap-1"
          triggerClassName="h-7 px-2.5"
          tabs={[
            {
              value: "sop",
              label: "Pratinjau SOP",
              contentClassName:
                "mt-1 flex min-h-0 flex-1 flex-col overflow-auto px-0 pb-0.5 sm:px-0.5",
              content: (
                <SopDocumentPreviewPane
                  selectedSop={displaySop}
                  isLoading={sopWorkbenchLoading}
                  sopPreviewProps={sopPreviewProps}
                  tteSignaturePayload={tteSignaturePayloadKepalaOpd ?? null}
                  loadingMessage="Memuat dokumen SOP…"
                />
              ),
            },
            {
              value: "ba",
              label: "Berita Acara",
              contentClassName:
                "mt-1 flex min-h-0 flex-1 flex-col overflow-auto px-0 pb-0.5 sm:px-0.5",
              content:
                baTemplateProps != null ? (
                  <BeritaAcaraPreviewPane
                    isLoading={baViewLoading}
                    templateProps={baTemplateProps}
                    loadingMessage="Memuat Berita Acara…"
                  />
                ) : null,
            },
          ]}
        />
        </div>
      </DetailPageLayout>

      <PinVerificationDialog
        open={tteDialogOpen}
        onOpenChange={setTteDialogOpen}
        title="Tanda Tangan Berita Acara"
        onConfirm={handlePinConfirm}
      />
      <TteSetupRequiredDialog
        open={tteSetupDialogOpen}
        onOpenChange={setTteSetupDialogOpen}
      />
    </>
  );
}
