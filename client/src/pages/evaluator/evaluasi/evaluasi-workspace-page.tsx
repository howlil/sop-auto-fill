/**
 * Workspace evaluasi — mode OPD (`GET …/workspace/opd/:id`) atau satu pengajuan (`GET …/workspace/pengajuan/:id`).
 */
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Send, List, XCircle } from "lucide-react";
import { SOPPreviewTemplate } from "@/components/sop/sop-preview-template";
import { PengajuanEvaluasiStatusHeader } from "@/components/evaluasi/pengajuan-evaluasi-status-header";
import { SOPListCard } from "@/components/sop/sop-list-card";
import { Button } from "@/components/ui/button";
import { DetailPageLayout } from "@/components/layout/DetailPageLayout";
import {
  CollapsedStripButton,
  CollapsibleSidePanel,
  CollapsibleSidePanelContent,
  CollapsibleSidePanelHeader,
  SimplePanelHeader,
} from "@/components/ui/collapsible-side-panel";
import {
  useEvaluasiDraft,
  useEvaluasiSubmit,
  useEvaluasiWorkspaceOpd,
  useEvaluasiWorkspacePengajuan,
  usePengajuanEvaluasiAktif,
  buildAjukanEvaluasiSnapshotRows,
  getAjukanEvaluasiBlockingReason,
  useTolakPengajuanEvaluasi,
} from "@/api/evaluasi";
import { deriveTahapPenilaianSop } from "@/lib/evaluasi/evaluasi-domain";
import { ApiError } from "@/lib/api/api-client";
import { mapPenyusunWorkbenchToPreviewProps } from "@/lib/sop/detailSop.mappers";
import { useSopPreviewDiagramState } from "@/hooks/use-sop-preview-diagram-state";
import { useCollapsiblePanels } from "@/pages/evaluator/evaluasi/hooks/use-collapsible-panels";
import { formatDateId } from "@/utils/format-date";
import type {
  EvaluasiWorkspacePengajuanAktif,
  StatusHasilEvaluasi,
  PengajuanEvaluasiSubmitError,
} from "@/types/dto/evaluasi.dto";

import { DetailEvaluasiOPDSubmitDialog } from "./components/DetailEvaluasiOPDSubmitDialog";
import { TolakPengajuanEvaluasiDialog } from "./components/TolakPengajuanEvaluasiDialog";
import { DetailEvaluasiOPDFormPanel } from "./components/DetailEvaluasiOPDFormPanel";
import type { DetailEvaluasiActiveTab } from "./components/DetailEvaluasiOPDFormPanel";
import { useDocumentTitle } from "@/hooks/use-document-title";

const POST_SUBMIT_DELAY_MS = 1500;

export type EvaluasiWorkspacePageProps =
  | {
      mode: "opd";
      opdId: string;
      preferredSopId?: string;
      listHref: string;
    }
  | {
      mode: "pengajuan";
      pengajuanEvaluasiId: string;
      preferredSopId?: string;
      listHref: string;
    };

export function EvaluasiWorkspacePage(props: EvaluasiWorkspacePageProps) {
  const navigate = useNavigate();
  const preferredSopId = props.preferredSopId;
  const listHref = props.listHref;

  const [selectedSopId, setSelectedSopId] = useState<string | null>(
    preferredSopId ?? null,
  );
  const preferredSopAppliedRef = useRef(false);

  const workspaceQueryParams = useMemo(
    () => ({
      detailSopId: selectedSopId ?? undefined,
      expand: selectedSopId ? ("preview" as const) : undefined,
      riwayatLimit: 30,
    }),
    [selectedSopId],
  );

  const opdIdArg = props.mode === "opd" ? props.opdId : "";
  const pengajuanIdArg =
    props.mode === "pengajuan" ? props.pengajuanEvaluasiId : "";

  const wOpd = useEvaluasiWorkspaceOpd(opdIdArg, {
    ...workspaceQueryParams,
    enabled: props.mode === "opd",
  });
  const wPeng = useEvaluasiWorkspacePengajuan(pengajuanIdArg, {
    ...workspaceQueryParams,
    enabled: props.mode === "pengajuan",
  });

  const workspace =
    props.mode === "opd" ? wOpd.data : wPeng.data;
  const isLoadingWorkspace =
    props.mode === "opd" ? wOpd.isLoading : wPeng.isLoading;
  const isFetchingWorkspace =
    props.mode === "opd" ? wOpd.isFetching : wPeng.isFetching;
  const workspaceError =
    props.mode === "opd" ? wOpd.error : wPeng.error;

  const opdIdUntukFallback =
    props.mode === "opd" ? props.opdId : workspace?.opd.id;

  const pengajuanFallbackState = usePengajuanEvaluasiAktif(
    opdIdUntukFallback,
    workspace === undefined ? undefined : workspace.pengajuanAktif,
  );

  /** Gabungan workspace + GET /evaluasi bila server mengembalikan pengajuan null (mis. ketidakkonsistenan cache). */
  const pengajuanAktifEffektif = useMemo(():
    | EvaluasiWorkspacePengajuanAktif
    | null
    | undefined => {
    if (workspace === undefined) {
      return undefined;
    }
    if (workspace.pengajuanAktif !== null) {
      return workspace.pengajuanAktif;
    }
    const fp = pengajuanFallbackState.pengajuan;
    if (fp === null) {
      return null;
    }
    return {
      id: fp.id,
      status: fp.status,
      statusLabel: fp.statusLabel ?? fp.status,
      jenis: fp.jenis ?? "EVALUASI_REQUEST_EVALUATOR",
      version: fp.version,
      alasanPenolakan: fp.alasanPenolakan ?? null,
      tanggalDitolak: fp.tanggalDitolak ?? null,
      nilaiPerDetail: fp.nilaiEvaluasi.map((n) => {
        const hasil =
          n.hasil === "SESUAI" ||
          n.hasil === "PERLU_PERBAIKAN" ||
          n.hasil === "DITOLAK"
            ? n.hasil
            : ("BELUM_DINILAI" as const);
        return {
          detailSopId: n.sopDetailId,
          hasil,
          hasilLabel:
            n.hasil === "SESUAI"
              ? "Sesuai"
              : n.hasil === "PERLU_PERBAIKAN"
                ? "Perlu perbaikan"
                : n.hasil === "DITOLAK"
                  ? "Ditolak"
                : "Belum dinilai",
          catatan: n.catatan ?? null,
          version: n.version,
          statusTindakLanjut: n.statusTindakLanjut ?? null,
          statusTindakLanjutLabel: n.statusTindakLanjutLabel ?? null,
          ditindaklanjutiPada: null,
          versi: 1,
          detailUpdatedAt: new Date(0).toISOString(),
        };
      }),
    };
  }, [workspace, pengajuanFallbackState.pengajuan]);

  /** Pengajuan EVALUASI_REQUEST_EVALUATOR memakai skor OPD; EVALUASI_REQUEST_OPD hanya per dokumen SOP. */
  const requiresNilaiOpd = pengajuanAktifEffektif?.jenis !== "EVALUASI_REQUEST_OPD";

  /** Hanya pengajuan SEDANG_DIEVALUASI yang boleh diedit / diajukan. */
  const isPengajuanReadOnly =
    pengajuanAktifEffektif !== undefined &&
    pengajuanAktifEffektif !== null &&
    pengajuanAktifEffektif.status !== "SEDANG_DIEVALUASI";

  const opdIdUntukDraft =
    workspace?.opd.id ?? (props.mode === "opd" ? props.opdId : undefined);

  const opd = useMemo(() => {
    if (!workspace) return null;
    return {
      id: workspace.opd.id,
      nama: workspace.opd.nama,
      kode: workspace.opd.id,
    };
  }, [workspace]);

  /** Satu baris per DetailSOP dalam pengajuan evaluasi / pipeline (server). */
  const sopsForOpd = useMemo(() => {
    if (!workspace) return [];
    return workspace.daftarSop.map((row) => ({
      id: row.detailSopId,
      judul: row.judul,
      nomorSOP: row.nomorSOP,
      status: row.statusDetail,
      alur: row.tampilanAlur,
    }));
  }, [workspace]);

  const listItems = useMemo(() => {
    if (!workspace) return [];
    return workspace.daftarSop.map((row) => {
      const tahapPenilaian = deriveTahapPenilaianSop({
        hasil: row.hasilEvaluasi,
        statusTindakLanjut: row.statusTindakLanjut ?? null,
        statusDetail: row.statusDetail,
      });
      return {
        id: row.detailSopId,
        nama: row.judul,
        nomor: row.nomorSOP,
        statusDokumen: row.statusDetail,
        statusDokumenLabel: row.statusDetailLabel,
        hasilEvaluasi: row.hasilEvaluasi,
        hasilEvaluasiLabel: row.hasilEvaluasiLabel,
        statusTindakLanjut: row.statusTindakLanjut ?? null,
        statusTindakLanjutLabel: row.statusTindakLanjutLabel ?? null,
        tahapPenilaian,
      };
    });
  }, [workspace]);

  const firstSopId = sopsForOpd[0]?.id ?? null;

  useEffect(() => {
    if (!workspace?.daftarSop.length) return;
    if (selectedSopId !== null) return;
    setSelectedSopId(workspace.daftarSop[0].detailSopId);
  }, [workspace, selectedSopId]);

  const effectiveSopId = selectedSopId ?? firstSopId;
  const selectedSop = sopsForOpd.find((s) => s.id === effectiveSopId);

  const nilaiSopTerpilih = useMemo(() => {
    if (!effectiveSopId || !pengajuanAktifEffektif) return null;
    return (
      pengajuanAktifEffektif.nilaiPerDetail.find(
        (r) => r.detailSopId === effectiveSopId,
      ) ?? null
    );
  }, [effectiveSopId, pengajuanAktifEffektif]);

  const selectedDaftarRow = useMemo(
    () =>
      workspace?.daftarSop.find((row) => row.detailSopId === effectiveSopId) ??
      null,
    [workspace?.daftarSop, effectiveSopId],
  );

  const tahapPenilaianSop = useMemo(() => {
    if (!selectedDaftarRow) return "belum_dinilai" as const;
    return deriveTahapPenilaianSop({
      hasil: selectedDaftarRow.hasilEvaluasi,
      statusTindakLanjut: selectedDaftarRow.statusTindakLanjut ?? null,
      statusDetail: selectedDaftarRow.statusDetail,
    });
  }, [selectedDaftarRow]);

  /** Form SOP hanya dikunci bila pengajuan sudah keluar dari tahap penilaian aktif. */
  const isSopReadOnly = isPengajuanReadOnly;

  const nilaiOpdTersimpan = useMemo(() => {
    if (!pengajuanAktifEffektif) return null;
    const dariRiwayat = workspace?.riwayatOpd.find(
      (r) => r.pengajuanEvaluasiId === pengajuanAktifEffektif.id,
    );
    return dariRiwayat?.nilaiOPD ?? null;
  }, [workspace?.riwayatOpd, pengajuanAktifEffektif]);

  /* Terapkan sopId dari URL search sekali saat daftar SOP siap (bukan fetch). */
  useEffect(() => {
    if (preferredSopAppliedRef.current) return;
    if (!preferredSopId) return;
    if (!sopsForOpd.some((s) => s.id === preferredSopId)) return;
    setSelectedSopId(preferredSopId);
    preferredSopAppliedRef.current = true;
  }, [preferredSopId, sopsForOpd]);

  /* Jaga selectedSopId konsisten saat daftar SOP berubah (bukan fetch). */
  useEffect(() => {
    const stillInList = sopsForOpd.some((s) => s.id === effectiveSopId);
    if (!stillInList && sopsForOpd.length > 0) {
      setSelectedSopId(sopsForOpd[0].id);
    } else if (!stillInList) {
      setSelectedSopId(null);
    }
  }, [sopsForOpd, effectiveSopId]);

  const draftReadOnly = isPengajuanReadOnly || isSopReadOnly;

  const {
    komentarEvaluasi,
    setKomentarEvaluasi,
    statusEvaluasi,
    setStatusEvaluasi,
    saveDraft,
  } = useEvaluasiDraft(
    opdIdUntukDraft,
    effectiveSopId ?? undefined,
    workspace === undefined ? undefined : pengajuanAktifEffektif,
    draftReadOnly,
    tahapPenilaianSop,
  );

  const handleSelectSop = useCallback(
    (id: string | null) => {
      saveDraft();
      setSelectedSopId(id);
    },
    [saveDraft],
  );

  /** Ubah status evaluasi. */
  const handleSetStatusEvaluasi = useCallback(
    (status: StatusHasilEvaluasi | null) => {
      setStatusEvaluasi(status);
    },
    [setStatusEvaluasi],
  );

  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [isTolakOpen, setIsTolakOpen] = useState(false);
  const [diagramPreviewTab, setDiagramPreviewTab] = useState<"flowchart" | "bpmn">("flowchart");
  const [activeFormTab, setActiveFormTab] =
    useState<DetailEvaluasiActiveTab>("sop");
  const [ratingOPD, setRatingOPD] = useState<number | null>(null);

  useEffect(() => {
    if (!requiresNilaiOpd && activeFormTab === "opd") {
      setActiveFormTab("sop");
    }
  }, [requiresNilaiOpd, activeFormTab]);

  useEffect(() => {
    if (isPengajuanReadOnly && nilaiOpdTersimpan != null) {
      setRatingOPD(nilaiOpdTersimpan);
    }
  }, [isPengajuanReadOnly, nilaiOpdTersimpan]);

  const judulByDetailId = useMemo(() => {
    const m = new Map<string, { judul: string; nomorSOP: string }>();
    for (const row of workspace?.daftarSop ?? []) {
      m.set(row.detailSopId, { judul: row.judul, nomorSOP: row.nomorSOP });
    }
    return m;
  }, [workspace?.daftarSop]);

  const blockingAjukan = useMemo(
    () =>
      getAjukanEvaluasiBlockingReason(
        pengajuanAktifEffektif,
        ratingOPD,
      ),
    [pengajuanAktifEffektif, ratingOPD],
  );

  const canAjukan = blockingAjukan === null;

  const ajukanSnapshotRows = useMemo(
    () =>
      buildAjukanEvaluasiSnapshotRows(
        pengajuanAktifEffektif ?? null,
        judulByDetailId,
      ),
    [pengajuanAktifEffektif, judulByDetailId],
  );

  const logNilaiSopTerpilih = workspace?.logNilaiSopTerpilih ?? [];

  const evaluatorSopTerpilih =
    selectedDaftarRow?.evaluatorTerakhir?.nama ??
    logNilaiSopTerpilih[0]?.evaluatorNama ??
    null;
  const tanggalTerakhirEvaluasi =
    selectedDaftarRow?.evaluatorTerakhir?.pada ??
    logNilaiSopTerpilih[0]?.createdAt ??
    null;

  const {
    leftCollapsed: leftPanelCollapsed,
    setLeftCollapsed: setLeftPanelCollapsed,
    rightCollapsed: rightPanelCollapsed,
    setRightCollapsed: setRightPanelCollapsed,
  } = useCollapsiblePanels();

  const {
    handleSubmitAll,
    evaluasiSubmitError,
    clearEvaluasiSubmitError,
    isSubmitting: isAjukanSubmitting,
  } = useEvaluasiSubmit({
    pengajuanAktifId: pengajuanAktifEffektif?.id,
    ratingOPD,
    requiresNilaiOpd,
    canSubmit: canAjukan,
    blockingMessage: blockingAjukan,
    onSuccess: () => {
      setIsSubmitOpen(false);
      setTimeout(
        () => navigate({ to: listHref }),
        POST_SUBMIT_DELAY_MS,
      );
    },
  });

  const tolakPengajuan = useTolakPengajuanEvaluasi();
  const handleTolakPengajuan = useCallback(
    async (alasan: string) => {
      if (!pengajuanAktifEffektif) return;
      await tolakPengajuan.mutateAsync({
        pengajuanEvaluasiId: pengajuanAktifEffektif.id,
        alasan,
        version: pengajuanAktifEffektif.version,
      });
      setIsTolakOpen(false);
      navigate({ to: listHref });
    },
    [listHref, navigate, pengajuanAktifEffektif, tolakPengajuan],
  );

  useDocumentTitle(opd ? `Evaluasi SOP — ${opd.nama}` : undefined);

  const riwayatOpd = useMemo(() => {
    if (!workspace?.riwayatOpd?.length) return [];
    return workspace.riwayatOpd.map((r) => ({
      tanggal: r.tanggal,
      evaluator: r.evaluatorNama,
      nilaiOPD: r.nilaiOPD ?? undefined,
    }));
  }, [workspace]);

  const previewProps = useMemo(() => {
    if (!workspace?.preview?.workbench) return null;
    try {
      return mapPenyusunWorkbenchToPreviewProps(workspace.preview.workbench);
    } catch {
      return null;
    }
  }, [workspace]);

  const diagramRenderState = useSopPreviewDiagramState(
    previewProps
      ? {
          diagramKonfigurasi: previewProps.diagramKonfigurasi,
          prosedurRows: previewProps.prosedurRows,
          implementers: previewProps.implementers,
        }
      : null,
    diagramPreviewTab,
  );

  const resourceNotFound =
    workspaceError instanceof ApiError && workspaceError.status === 404;

  /** Convert string error to PengajuanEvaluasiSubmitError shape */
  const submitErrorObj = useMemo((): PengajuanEvaluasiSubmitError => {
    if (!evaluasiSubmitError) return { kind: "none", items: [] };
    return {
      kind: "blocked",
      items: [],
      message: evaluasiSubmitError,
    };
  }, [evaluasiSubmitError]);

  const notFoundMessage =
    props.mode === "opd"
      ? "OPD tidak ditemukan."
      : "Pengajuan evaluasi tidak ditemukan.";

  if (isLoadingWorkspace && !workspace) {
    return (
      <DetailPageLayout
        breadcrumb={[
          { label: "Evaluasi SOP", to: listHref },
        ]}
        title="Evaluasi SOP"
        description=""
        backTo={listHref}
        main={
          <p className="p-4 text-sm text-secondary-foreground">Memuat data evaluasi…</p>
        }
      />
    );
  }

  if (workspaceError && !resourceNotFound) {
    return (
      <DetailPageLayout
        breadcrumb={[
          { label: "Evaluasi SOP", to: listHref },
        ]}
        title="Evaluasi SOP"
        description=""
        backTo={listHref}
        main={
          <p className="p-4 text-sm text-red-600">
            {workspaceError instanceof Error
              ? workspaceError.message
              : "Gagal memuat data evaluasi."}
          </p>
        }
      />
    );
  }

  if (resourceNotFound || (!opd && !isLoadingWorkspace)) {
    return (
      <DetailPageLayout
        breadcrumb={[
          { label: "Evaluasi SOP", to: listHref },
        ]}
        title="Evaluasi SOP"
        description=""
        backTo={listHref}
        main={<p className="p-4 text-sm text-secondary-foreground">{notFoundMessage}</p>}
      />
    );
  }

  if (!opd) {
    return (
      <DetailPageLayout
        breadcrumb={[
          { label: "Evaluasi SOP", to: listHref },
        ]}
        title="Evaluasi SOP"
        description=""
        backTo={listHref}
        main={
          <p className="p-4 text-sm text-secondary-foreground">Memuat data OPD…</p>
        }
      />
    );
  }

  return (
    <>
      <DetailPageLayout
        breadcrumb={[
          { label: "Evaluasi SOP", to: listHref },
          { label: opd.nama },
        ]}
        title={`Evaluasi SOP — ${opd.nama}`}
        description={
          pengajuanAktifEffektif?.status === "DITOLAK"
            ? "Pengajuan ditolak final. Seluruh versi SOP di dalamnya tidak dapat diajukan ulang dan penyusun wajib membuat versi baru."
            : isPengajuanReadOnly
            ? "Mode baca — pengajuan evaluasi ini sudah selesai. Lihat hasil dan riwayat di panel kanan."
            : "Pilih SOP di daftar kiri, isi form evaluasi di panel kanan."
        }
        backTo={listHref}
        backSize="icon"
        header={
          <>
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-semibold text-foreground">
                Penilaian SOP
              </h2>
              <div className="flex items-center gap-2">
                {!isPengajuanReadOnly ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 border-red-200 px-3 text-xs text-red-700 hover:bg-red-50"
                      onClick={() => setIsTolakOpen(true)}
                    >
                      <XCircle className="w-3.5 h-3.5" /> Tolak Pengajuan
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 rounded-control bg-primary px-3 text-xs text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
                      onClick={() => {
                        clearEvaluasiSubmitError();
                        setIsSubmitOpen(true);
                      }}
                    >
                      <Send className="w-3.5 h-3.5" /> Ajukan Persetujuan Evaluasi
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
            {pengajuanAktifEffektif?.status ? (
              <PengajuanEvaluasiStatusHeader
                status={pengajuanAktifEffektif.status}
                statusLabel={pengajuanAktifEffektif.statusLabel}
                role="EVALUATOR"
                className="pt-1"
              />
            ) : null}
            {pengajuanAktifEffektif?.status === "DITOLAK" &&
            pengajuanAktifEffektif.alasanPenolakan ? (
              <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
                <p className="font-medium">Alasan penolakan</p>
                <p className="mt-1 whitespace-pre-wrap break-words">
                  {pengajuanAktifEffektif.alasanPenolakan}
                </p>
              </div>
            ) : null}
            <div className="pt-2 flex flex-wrap items-center gap-3 text-xs text-secondary-foreground">
              <span>
                <span className="text-muted-foreground">Evaluator (SOP ini):</span>{" "}
                <span className="font-medium">
                  {evaluatorSopTerpilih ?? "—"}
                </span>
              </span>
              <span>
                <span className="text-muted-foreground">Terakhir evaluasi:</span>{" "}
                {tanggalTerakhirEvaluasi
                  ? formatDateId(tanggalTerakhirEvaluasi)
                  : "—"}
              </span>
            </div>
          </>
        }
        leftPanel={
          <CollapsibleSidePanel
            side="left"
            collapsed={leftPanelCollapsed}
            widthExpanded="w-full"
          >
            {leftPanelCollapsed ? (
              <CollapsedStripButton
                label="Daftar"
                icon={<List className="w-5 h-5" />}
                onClick={() => setLeftPanelCollapsed(false)}
              />
            ) : (
              <>
                <CollapsibleSidePanelHeader
                  side="left"
                  onCollapse={() => setLeftPanelCollapsed(true)}
                  className="border-border bg-surface-subtle/90 px-2 py-1.5 sm:px-2.5"
                >
                  <SimplePanelHeader
                    title="Daftar SOP"
                    subtitle={`${listItems.length} dokumen`}
                  />
                </CollapsibleSidePanelHeader>
                <CollapsibleSidePanelContent className="px-2 pb-2 pt-1 sm:px-2">
                  <div className="flex flex-col h-full min-h-0">
                    <p className="px-2 pb-2 text-[10px] text-muted-foreground leading-snug shrink-0">
                      Dokumen = status SOP di sistem; Penilaian = hasil evaluasi Anda per dokumen.
                    </p>
                    <div className="flex-1 min-h-0 overflow-auto scrollbar-hide">
                      <SOPListCard
                        items={listItems}
                        selectedId={effectiveSopId}
                        onSelect={handleSelectSop}
                        variant="compact"
                      />
                    </div>
                  </div>
                </CollapsibleSidePanelContent>
              </>
            )}
          </CollapsibleSidePanel>
        }
        main={
          <div className="flex h-full min-h-0 flex-col">
            <div className="p-2 border-b border-border bg-surface-subtle flex-shrink-0 print:hidden">
              <h3 className="text-xs font-semibold text-secondary-foreground">
                Preview SOP
              </h3>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-auto">
              {selectedSop ? (
                previewProps ? (
                  <SOPPreviewTemplate
                    metadata={previewProps.metadata}
                    prosedurRows={previewProps.prosedurRows}
                    implementers={previewProps.implementers}
                    name={previewProps.name}
                    number={previewProps.number}
                    tteSignaturePayload={workspace?.preview?.workbench?.tteSignaturePayloadKepalaOpd}
                    diagramState={{
                      activeTab: diagramPreviewTab,
                      onActiveTabChange: setDiagramPreviewTab,
                      ...diagramRenderState,
                    }}
                  />
                ) : (
                  <SOPPreviewTemplate
                    name={selectedSop.judul}
                    number={selectedSop.nomorSOP}
                  />
                )
              ) : (
                <div className="flex items-center justify-center flex-1 text-xs text-muted-foreground">
                  Pilih SOP di daftar kiri
                </div>
              )}
            </div>
          </div>
        }
        rightPanel={
          <DetailEvaluasiOPDFormPanel
            penilaianOpdDiizinkan={requiresNilaiOpd}
            panelState={{
              collapsed: rightPanelCollapsed,
              onCollapsedChange: setRightPanelCollapsed,
              activeFormTab,
              onTabChange: setActiveFormTab,
            }}
            sopForm={{
              effectiveSopId,
              readOnly: isSopReadOnly,
              tahapPenilaian: tahapPenilaianSop,
              versi:
                selectedDaftarRow?.versi ?? nilaiSopTerpilih?.versi ?? undefined,
              detailUpdatedAt:
                selectedDaftarRow?.detailUpdatedAt ??
                nilaiSopTerpilih?.detailUpdatedAt ??
                null,
              ditindaklanjutiPada:
                selectedDaftarRow?.ditindaklanjutiPada ??
                nilaiSopTerpilih?.ditindaklanjutiPada ??
                null,
              nilaiTersimpan: nilaiSopTerpilih
                ? {
                    hasil:
                      nilaiSopTerpilih.hasil === "SESUAI" ||
                      nilaiSopTerpilih.hasil === "PERLU_PERBAIKAN"
                        ? nilaiSopTerpilih.hasil
                        : null,
                    catatan: nilaiSopTerpilih.catatan,
                  }
                : null,
              statusEvaluasi,
              setStatusEvaluasi: handleSetStatusEvaluasi,
              komentarEvaluasi: komentarEvaluasi ?? "",
              setKomentarEvaluasi,
              logNilaiEntries: logNilaiSopTerpilih,
              isLogNilaiLoading: isFetchingWorkspace,
            }}
            opdForm={{
              opd,
              readOnly: isPengajuanReadOnly,
              nilaiOpdTersimpan,
              riwayatOpd,
              ratingOPD,
              setRatingOPD,
            }}
          />
        }
      />

      <DetailEvaluasiOPDSubmitDialog
        requiresNilaiOpdInCopy={requiresNilaiOpd}
        open={isSubmitOpen}
        onOpenChange={(open) => {
          setIsSubmitOpen(open);
          if (!open) clearEvaluasiSubmitError();
        }}
        snapshotRows={ajukanSnapshotRows}
        canConfirm={canAjukan}
        blockingReason={blockingAjukan}
        onConfirm={(nomorBA: string) => void handleSubmitAll(nomorBA)}
        isSubmitting={isAjukanSubmitting}
        evaluasiSubmitError={submitErrorObj}
      />
      <TolakPengajuanEvaluasiDialog
        open={isTolakOpen}
        onOpenChange={setIsTolakOpen}
        jumlahSop={pengajuanAktifEffektif?.nilaiPerDetail.length ?? 0}
        onConfirm={(alasan) => void handleTolakPengajuan(alasan)}
        isSubmitting={tolakPengajuan.isPending}
      />
    </>
  );
}
