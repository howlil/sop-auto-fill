import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NavigateOptions } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/config/query-keys";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { useToast } from "@/hooks/useToast";
import { buildSopHeaderSnapshot, useSopHeaderAutosave, type SopHeaderAutosaveStatus } from "@/pages/penyusun/sop/hooks/use-sop-header-autosave";
import { buildSopProsedurSnapshot, useSopProsedurAutosave, type SopProsedurAutosaveStatus } from "@/pages/penyusun/sop/hooks/use-sop-prosedur-autosave";
import { useAppRole } from "@/hooks/useAppRole";
import { usePeraturan } from "@/api/peraturan";
import { usePenyusunWorkbench, useSop } from "@/api/sop-queries";
import { usePelaksana, useSopStatus, useUpdateSopHeader, useUpdateSopProsedur } from "@/api/sop-mutations";
import { sopApi } from "@/api/sop-client";
import { ROUTES } from "@/utils/constants";
import { transformLangkahToProsedurRow, transformSopDetailToMetadata } from "@/lib/sop/detailSop.mappers";
import { DEFAULT_SOP_STATUS } from "@/types/dto/sop.dto";
import { SOP_EVALUASI_WORKFLOW_QUERY_KEYS } from "@/lib/api/cache-invalidation";
import {
  canEditSop,
  canKirimUlangKeEvaluatorAfterRevisi,
  getKirimUlangRoleBlockingReason,
} from "@/lib/sop/sop-permissions";
import type { Peraturan } from "@/types/dto/peraturan.dto";
import type { PenyusunWorkbenchLogEdit, StatusSOP, UpdateStatusDto } from "@/types/dto/sop.dto";
import type { ProsedurRow, SOPDetailMetadata, SopEditorImplementer } from "@/types/ui/sop";
interface UseDetailSopPenyusunActionsParams {
  setSopStatusOverrideAsync: (payload: {
    sopId: string;
    status: UpdateStatusDto["status"];
  }) => Promise<unknown>;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
  isRevisionFlow: boolean;
  canKirimUlangKeEvaluator: boolean;
  /** Flush autosave header SOP sebelum aksi besar (selesai) agar tidak ada perubahan tertinggal. */
  flushHeaderAutosave: () => Promise<void>;
  /** Flush autosave prosedur (swimlane + langkah) sebelum aksi besar. */
  flushProsedurAutosave: () => Promise<void>;
}

/**
 * Aksi tingkat halaman editor: Selesai → MENUNGGU_PENGAJUAN_EVALUASI; alur revisi → POST kirim ulang ke evaluator.
 * Persistensi data (header, swimlane, langkah) seluruhnya ditangani oleh autosave.
 */
export function useDetailSopPenyusunActions({
  setSopStatusOverrideAsync,
  showToast,
  isRevisionFlow,
  canKirimUlangKeEvaluator,
  flushHeaderAutosave,
  flushProsedurAutosave,
}: UseDetailSopPenyusunActionsParams) {
  const queryClient = useQueryClient();
  const flushAll = useCallback(async () => {
    await Promise.all([flushHeaderAutosave(), flushProsedurAutosave()]);
  }, [flushHeaderAutosave, flushProsedurAutosave]);

  const kirimUlangKeEvaluatorMutation = useMutationWithToast({
    mutationFn: (sopOrDetailId: string) => sopApi.kirimUlangEvaluasiSetelahRevisi(sopOrDetailId),
    invalidateKeys: [
      ...SOP_EVALUASI_WORKFLOW_QUERY_KEYS,
    ],
    successMessage: "SOP berhasil dikirim ulang evaluasi",
    errorMessagePrefix: "Gagal mengirim ulang evaluasi",
    onSuccess: async (data, sopOrDetailId) => {
      queryClient.setQueryData(queryKeys.penyusunWorkbench(sopOrDetailId), data);
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: queryKeys.evaluasiUmpanBalik(sopOrDetailId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.sopRiwayatVersi(data.detail.sopId) }),
      ];
      if (data.detail.id !== sopOrDetailId) {
        queryClient.setQueryData(queryKeys.penyusunWorkbench(data.detail.id), data);
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: queryKeys.evaluasiUmpanBalik(data.detail.id) }),
        );
      }
      await Promise.all(invalidations);
    },
  });

  const handleComplete = useCallback(
    async (
      id: string | undefined,
      role: string | null,
      navigateFn?: (opts: NavigateOptions) => void,
    ) => {
      if (!id || !role) {
        showToast("ID SOP tidak tersedia", "error");
        return;
      }

      try {
        await flushAll();
      } catch {
        showToast(
          "Gagal menyimpan perubahan terlebih dahulu. Periksa data lalu coba lagi.",
          "error",
        );
        return;
      }
      try {
        if (isRevisionFlow) {
          if (!canKirimUlangKeEvaluator) {
            const roleBlock = getKirimUlangRoleBlockingReason(role);
            showToast(roleBlock ?? 'Anda tidak berhak mengirim ulang ke evaluator', 'error');
            return;
          }
          await kirimUlangKeEvaluatorMutation.mutateAsync(id);
        } else {
          await setSopStatusOverrideAsync({ sopId: id, status: "MENUNGGU_PENGAJUAN_EVALUASI" });
          showToast("SOP berhasil disimpan dan menunggu pengajuan evaluasi.");
        }
        if (navigateFn) {
          navigateFn({ to: ROUTES.PENYUSUN.SOP });
        }
      } catch {
        if (!isRevisionFlow) {
          showToast("Gagal menyelesaikan SOP. Periksa data yang diisi.", "error");
        }
      }
    },
    [
      flushAll,
      isRevisionFlow,
      canKirimUlangKeEvaluator,
      kirimUlangKeEvaluatorMutation,
      setSopStatusOverrideAsync,
      showToast,
    ],
  );

  return {
    handleComplete,
    isKirimUlangPending: kirimUlangKeEvaluatorMutation.isPending,
  };
}

export interface UseDetailSopPenyusunDataResult {
  metadata: SOPDetailMetadata;
  setMetadata: React.Dispatch<React.SetStateAction<SOPDetailMetadata>>;
  prosedurRows: ProsedurRow[];
  setProsedurRows: React.Dispatch<React.SetStateAction<ProsedurRow[]>>;
  implementers: SopEditorImplementer[];
  setImplementers: React.Dispatch<React.SetStateAction<SopEditorImplementer[]>>;
  auditLogs: PenyusunWorkbenchLogEdit[];
  activeTab: "flowchart" | "bpmn";
  setActiveTab: React.Dispatch<React.SetStateAction<"flowchart" | "bpmn">>;
  isEditingSteps: boolean;
  setIsEditingSteps: React.Dispatch<React.SetStateAction<boolean>>;
  isEditPanelCollapsed: boolean;
  setIsEditPanelCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  rightPanelTab: "edit" | "komentar" | "versi" | "aktivitas";
  setRightPanelTab: React.Dispatch<
    React.SetStateAction<"edit" | "komentar" | "versi" | "aktivitas">
  >;
  isLoading: boolean;
  masterPelaksanaOptions: { id: string; name: string }[];
  relatedPosOptions: string[];
  /** Opsi keterkaitan SOP id-aware (id = detailSopId terbaru per SOP). */
  relatedSopOptions: { id: string; label: string }[];
  peraturanList: Peraturan[];
  currentSopStatus: StatusSOP;
  currentSopStatusLabel: string;
  isRevisionFlow: boolean;
  primaryActionLabel: string;
  canKirimUlangKeEvaluator: boolean;
  setSopStatusOverrideAsync: ReturnType<typeof useSopStatus>["setSopStatusOverrideAsync"];
  /** Paksa flush autosave header SOP (mis. sebelum aksi besar / pindah halaman). */
  flushHeaderAutosave: () => Promise<void>;
  /** Paksa flush autosave prosedur (swimlane + langkah). */
  flushProsedurAutosave: () => Promise<void>;
  /** Status autosave header (idle/pending/saving/saved/error) untuk indikator UI. */
  autosaveStatus: SopHeaderAutosaveStatus;
  /** Error autosave header terakhir; reference baru per error agar consumer bisa toast sekali. */
  autosaveError: Error | null;
  /** Status autosave prosedur (swimlane + langkah). */
  prosedurAutosaveStatus: SopProsedurAutosaveStatus;
  /** Error autosave prosedur terakhir. */
  prosedurAutosaveError: Error | null;
  /** True jika status SOP mengizinkan mengubah dokumen (autosave dan kontrol edit aktif). */
  canEditDetail: boolean;
}

export function useDetailSopPenyusunData(
  sopDetailId: string | undefined,
  sopStatusOverride: StatusSOP | undefined,
  role: string | null | undefined,
): UseDetailSopPenyusunDataResult {
  const { setSopStatusOverrideAsync } = useSopStatus();
  const { list: sopList } = useSop();
  const { list: peraturanList } = usePeraturan();
  const { list: pelaksanaList } = usePelaksana();
  const { data: workbench, isLoading: isLoadingWorkbench } = usePenyusunWorkbench(sopDetailId);
  const updateSopHeaderMutation = useUpdateSopHeader(sopDetailId ?? "");
  const updateSopProsedurMutation = useUpdateSopProsedur(sopDetailId ?? "");

  const [metadata, setMetadata] = useState<SOPDetailMetadata>({});
  const [prosedurRows, setProsedurRows] = useState<ProsedurRow[]>([]);
  const [implementers, setImplementers] = useState<SopEditorImplementer[]>([]);
  const [activeTab, setActiveTab] = useState<"flowchart" | "bpmn">("flowchart");
  const [isEditingSteps, setIsEditingSteps] = useState(false);
  const [isEditPanelCollapsed, setIsEditPanelCollapsed] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<
    "edit" | "komentar" | "versi" | "aktivitas"
  >("edit");

  const sopDetail = workbench?.detail;
  const langkahList = useMemo(() => workbench?.langkah ?? [], [workbench?.langkah]);
  const auditLogs = workbench?.logEdit ?? [];
  const resolvedStatusForEdit = useMemo(
    (): StatusSOP =>
      (workbench?.detail.status ?? sopStatusOverride ?? DEFAULT_SOP_STATUS) as StatusSOP,
    [workbench?.detail.status, sopStatusOverride],
  );
  const canEditDetail = canEditSop(resolvedStatusForEdit);
  /* Sinkron state lokal HANYA saat berganti DetailSOP (mis. masuk halaman /:id baru).
     PATCH yang dipicu autosave akan update cache TanStack lewat setQueryData, tapi
     TIDAK boleh menimpa metadata UI yang sedang diketik user. Identitas: detailSopId. */
  const lastSyncedDetailIdRef = useRef<string | null>(null);

  const headerSnapshot = useMemo(() => buildSopHeaderSnapshot(metadata), [metadata]);
  const headerAutosave = useSopHeaderAutosave({
    detailSopId: sopDetailId,
    snapshot: headerSnapshot,
    save: updateSopHeaderMutation.mutateAsync,
    enabled: Boolean(sopDetailId) && Boolean(sopDetail) && canEditDetail,
  });

  const prosedurSnapshot = useMemo(
    () => buildSopProsedurSnapshot(implementers, prosedurRows),
    [implementers, prosedurRows],
  );
  const prosedurAutosave = useSopProsedurAutosave({
    detailSopId: sopDetailId,
    snapshot: prosedurSnapshot,
    save: updateSopProsedurMutation.mutateAsync,
    enabled: Boolean(sopDetailId) && Boolean(sopDetail) && canEditDetail,
  });

  const resetHeaderBaselineRef = useRef(headerAutosave.resetBaseline)
  resetHeaderBaselineRef.current = headerAutosave.resetBaseline
  const resetProsedurBaselineRef = useRef(prosedurAutosave.resetBaseline)
  resetProsedurBaselineRef.current = prosedurAutosave.resetBaseline

  useEffect(() => {
    if (!sopDetail) {
      return;
    }
    /* Hanya sinkron sekali per identitas DetailSOP. Jika `id` sama dengan terakhir di-sync,
       artinya kita masih di SOP yang sama dan local state adalah source of truth. */
    if (lastSyncedDetailIdRef.current === sopDetail.id) {
      return;
    }
    lastSyncedDetailIdRef.current = sopDetail.id;
    const nextMetadata = transformSopDetailToMetadata(sopDetail);
    setMetadata(nextMetadata);
    resetHeaderBaselineRef.current(buildSopHeaderSnapshot(nextMetadata));
    let nextRows: ProsedurRow[] = [];
    if (langkahList.length > 0) {
      nextRows = [...langkahList]
        .sort((a, b) => a.urutan - b.urutan)
        .map(transformLangkahToProsedurRow);
    }
    /* Sumber kebenaran kolom PELAKSANA = swimlane (DetailSOPPelaksana) yang dikembalikan
       API. Aktor di langkah yang belum di-swimlane tetap dimasukkan untuk back-compat
       data lama. Urutan: swimlane.urutan asc, lalu langkah pelaksanaIds yang baru. */
    const nextImplementers: SopEditorImplementer[] = [];
    const seenImplementerIds = new Set<string>();
    const swimlanes = sopDetail.swimlanes ?? [];
    for (const sw of [...swimlanes].sort((a, b) => a.urutan - b.urutan)) {
      if (!sw.pelaksanaId || seenImplementerIds.has(sw.pelaksanaId)) continue;
      seenImplementerIds.add(sw.pelaksanaId);
      const name =
        sw.pelaksana?.namaPelaksana ??
        pelaksanaList.find((p) => p.id === sw.pelaksanaId)?.namaPelaksana ??
        sw.pelaksanaId;
      nextImplementers.push({ id: sw.pelaksanaId, name });
    }
    for (const row of nextRows) {
      if (!row.pelaksana || seenImplementerIds.has(row.pelaksana)) continue;
      seenImplementerIds.add(row.pelaksana);
      const name =
        pelaksanaList.find((p) => p.id === row.pelaksana)?.namaPelaksana ?? row.pelaksana;
      nextImplementers.push({ id: row.pelaksana, name });
    }
    setProsedurRows(nextRows);
    setImplementers(nextImplementers);
    resetProsedurBaselineRef.current(buildSopProsedurSnapshot(nextImplementers, nextRows));
  }, [sopDetail, langkahList, pelaksanaList]);

  const masterPelaksanaOptions = useMemo(
    () =>
      pelaksanaList.map((pelaksana) => ({
        id: pelaksana.id,
        name: pelaksana.namaPelaksana,
      })),
    [pelaksanaList],
  );
  const relatedPosOptions = useMemo(
    () => sopList.map((sop) => sop.judul).filter(Boolean),
    [sopList],
  );
  const relatedSopOptions = useMemo(
    () =>
      sopList
        .filter((sop) => Boolean(sop.detailSopId) && sop.id !== sopDetail?.sopId)
        .map((sop) => ({
          id: sop.detailSopId as string,
          label: sop.judul,
        })),
    [sopList, sopDetail?.sopId],
  );

  const currentSopStatus: StatusSOP = resolvedStatusForEdit;
  const currentSopStatusLabel =
    workbench?.detail.statusLabel ?? currentSopStatus;
  const isRevisionFlow = currentSopStatus === "REVISI_DARI_EVALUATOR";
  const canKirimUlangKeEvaluator = canKirimUlangKeEvaluatorAfterRevisi(role);
  const primaryActionLabel =
    isRevisionFlow && canKirimUlangKeEvaluator ? "Kirim ulang evaluasi" : "Selesai";
  const isLoading = isLoadingWorkbench;

  return {
    metadata,
    setMetadata,
    prosedurRows,
    setProsedurRows,
    implementers,
    setImplementers,
    auditLogs,
    activeTab,
    setActiveTab,
    isEditingSteps,
    setIsEditingSteps,
    isEditPanelCollapsed,
    setIsEditPanelCollapsed,
    rightPanelTab,
    setRightPanelTab,
    isLoading,
    masterPelaksanaOptions,
    relatedPosOptions,
    relatedSopOptions,
    peraturanList,
    currentSopStatus,
    currentSopStatusLabel,
    isRevisionFlow,
    primaryActionLabel,
    canKirimUlangKeEvaluator,
    setSopStatusOverrideAsync,
    flushHeaderAutosave: headerAutosave.flush,
    flushProsedurAutosave: prosedurAutosave.flush,
    autosaveStatus: headerAutosave.status,
    autosaveError: headerAutosave.lastError,
    prosedurAutosaveStatus: prosedurAutosave.status,
    prosedurAutosaveError: prosedurAutosave.lastError,
    canEditDetail,
  };
}

export interface UseDetailSopPenyusunReturn {
  metadata: SOPDetailMetadata;
  setMetadata: React.Dispatch<React.SetStateAction<SOPDetailMetadata>>;
  prosedurRows: ProsedurRow[];
  setProsedurRows: React.Dispatch<React.SetStateAction<ProsedurRow[]>>;
  implementers: SopEditorImplementer[];
  setImplementers: React.Dispatch<React.SetStateAction<SopEditorImplementer[]>>;
  auditLogs: PenyusunWorkbenchLogEdit[];
  activeTab: "flowchart" | "bpmn";
  setActiveTab: React.Dispatch<React.SetStateAction<"flowchart" | "bpmn">>;
  isEditingSteps: boolean;
  setIsEditingSteps: React.Dispatch<React.SetStateAction<boolean>>;
  isEditPanelCollapsed: boolean;
  setIsEditPanelCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  rightPanelTab: "edit" | "komentar" | "versi" | "aktivitas";
  setRightPanelTab: React.Dispatch<
    React.SetStateAction<"edit" | "komentar" | "versi" | "aktivitas">
  >;
  isLoading: boolean;
  masterPelaksanaOptions: { id: string; name: string }[];
  relatedPosOptions: string[];
  /** Opsi keterkaitan SOP id-aware (id = detailSopId terbaru per SOP). */
  relatedSopOptions: { id: string; label: string }[];
  peraturanList: Peraturan[];
  currentSopStatus: StatusSOP;
  currentSopStatusLabel: string;
  isRevisionFlow: boolean;
  primaryActionLabel: string;
  canKirimUlangKeEvaluator: boolean;
  handleMetadataChange: <K extends keyof SOPDetailMetadata>(
    field: K,
    value: SOPDetailMetadata[K],
  ) => void;
  handleComplete: (
    id: string | undefined,
    role: string | null,
    navigate: (opts: NavigateOptions) => void,
  ) => Promise<void>;
  /** True saat POST kirim-ulang-evaluasi (alur revisi). */
  isKirimUlangKeEvaluatorPending: boolean;
  /** Status autosave header (idle/pending/saving/saved/error) untuk indikator UI. */
  autosaveStatus: SopHeaderAutosaveStatus;
  /** Error autosave header terakhir; reference baru per error agar consumer bisa toast sekali. */
  autosaveError: Error | null;
  /** Status autosave prosedur (swimlane + langkah) untuk indikator UI gabungan. */
  prosedurAutosaveStatus: SopProsedurAutosaveStatus;
  /** Error autosave prosedur terakhir; reference baru per error. */
  prosedurAutosaveError: Error | null;
  /** Paksa flush autosave header SOP (mis. sebelum aksi besar / pindah halaman). */
  flushHeaderAutosave: () => Promise<void>;
  /** Paksa flush autosave prosedur SOP. */
  flushProsedurAutosave: () => Promise<void>;
  /** Status dokumen mengizinkan penyuntingan header dan langkah. */
  canEditDetail: boolean;
}

export function useDetailSopPenyusun(
  sopDetailId: string | undefined,
  sopStatusOverride: StatusSOP | undefined,
  _isRevisionFlowOverride?: boolean,
): UseDetailSopPenyusunReturn {
  const { showToast } = useToast();
  const { role } = useAppRole();
  const data = useDetailSopPenyusunData(sopDetailId, sopStatusOverride, role);
  const setMetadata = data.setMetadata;

  const { handleComplete, isKirimUlangPending } = useDetailSopPenyusunActions({
    setSopStatusOverrideAsync: data.setSopStatusOverrideAsync,
    showToast,
    isRevisionFlow: data.isRevisionFlow,
    canKirimUlangKeEvaluator: data.canKirimUlangKeEvaluator,
    flushHeaderAutosave: data.flushHeaderAutosave,
    flushProsedurAutosave: data.flushProsedurAutosave,
  });

  const handleMetadataChange = useCallback(
    <K extends keyof SOPDetailMetadata>(field: K, value: SOPDetailMetadata[K]) => {
      setMetadata((prev) => ({ ...prev, [field]: value }));
    },
    [setMetadata],
  );

  return {
    metadata: data.metadata,
    setMetadata,
    prosedurRows: data.prosedurRows,
    setProsedurRows: data.setProsedurRows,
    implementers: data.implementers,
    setImplementers: data.setImplementers,
    auditLogs: data.auditLogs,
    activeTab: data.activeTab,
    setActiveTab: data.setActiveTab,
    isEditingSteps: data.isEditingSteps,
    setIsEditingSteps: data.setIsEditingSteps,
    isEditPanelCollapsed: data.isEditPanelCollapsed,
    setIsEditPanelCollapsed: data.setIsEditPanelCollapsed,
    rightPanelTab: data.rightPanelTab,
    setRightPanelTab: data.setRightPanelTab,
    isLoading: data.isLoading,
    masterPelaksanaOptions: data.masterPelaksanaOptions,
    relatedPosOptions: data.relatedPosOptions,
    relatedSopOptions: data.relatedSopOptions,
    peraturanList: data.peraturanList,
    currentSopStatus: data.currentSopStatus,
    currentSopStatusLabel: data.currentSopStatusLabel,
    isRevisionFlow: data.isRevisionFlow,
    primaryActionLabel: data.primaryActionLabel,
    canKirimUlangKeEvaluator: data.canKirimUlangKeEvaluator,
    handleMetadataChange,
    handleComplete,
    isKirimUlangKeEvaluatorPending: isKirimUlangPending,
    autosaveStatus: data.autosaveStatus,
    autosaveError: data.autosaveError,
    prosedurAutosaveStatus: data.prosedurAutosaveStatus,
    prosedurAutosaveError: data.prosedurAutosaveError,
    flushHeaderAutosave: data.flushHeaderAutosave,
    flushProsedurAutosave: data.flushProsedurAutosave,
    canEditDetail: data.canEditDetail,
  };
}
