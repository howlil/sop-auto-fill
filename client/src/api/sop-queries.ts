import { useMemo } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { queryKeys } from "@/config/query-keys";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { STALE_TIME } from "@/utils/constants";
import { sopApi } from "@/api/sop-client";
import { SOP_EVALUASI_WORKFLOW_REFRESH_OPTIONS } from "@/lib/api/cache-invalidation";
import type { CreateSopRequestDto, SopDaftarRow, SopListQueryParams } from "@/types/dto/sop.dto";
/**
 * useSop hook - TanStack Query
 */

/** Status yang mengizinkan penyuntingan dokumen (selaras BUSINESS-SPEC §5.2). */
function sopListQueryOptions(params?: SopListQueryParams) {
  return {
    queryKey: queryKeys.sopList(params),
    queryFn: () => sopApi.findAll(params),
    ...SOP_EVALUASI_WORKFLOW_REFRESH_OPTIONS,
  } as const;
}

/** Hanya data daftar SOP (Suspense); untuk kombinasi dengan filter terpisah tanpa duplikasi mutasi. */
export function useSopListSuspenseQuery(params?: SopListQueryParams) {
  return useSuspenseQuery<SopDaftarRow[]>({
    ...sopListQueryOptions(params),
  });
}

export function useSop(params?: SopListQueryParams) {
  const {
    data: list = [],
    isLoading,
    error,
  } = useQuery<SopDaftarRow[]>({
    ...sopListQueryOptions(params),
  });

  return {
    list,
    isLoading,
    error,
  };
}

export function useSopSuspense(params?: SopListQueryParams) {
  const { data: list } = useSuspenseQuery<SopDaftarRow[]>({
    ...sopListQueryOptions(params),
  });
  const createMutation = useMutationWithToast({
    mutationFn: (payload: CreateSopRequestDto) => sopApi.create(payload),
    invalidateKeys: [queryKeys.sop],
    successMessage: "SOP berhasil dibuat",
    errorMessagePrefix: "Gagal membuat SOP",
  });
  return {
    list,
    isLoading: false,
    error: undefined,
    create: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
  };
}

/**
 * GET `/sop/penyusun-workbench/:detailSopId` — agregat detail + langkah + log
 * untuk dipakai di pratinjau SOP (header + langkah). Cache key sejajar dengan
 * mutasi header/prosedur/status di file ini sehingga refresh otomatis sinkron.
 */
export function usePenyusunWorkbench(detailSopId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.penyusunWorkbench(detailSopId ?? ''),
    queryFn: () => sopApi.getPenyusunWorkbench(detailSopId!),
    enabled: !!detailSopId,
    staleTime: STALE_TIME.SHORT,
  });
}

export function useRiwayatVersi(sopId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.sopRiwayatVersi(sopId ?? ''),
    queryFn: () => sopApi.getRiwayatVersi(sopId!),
    enabled: !!sopId,
    staleTime: STALE_TIME.SHORT,
  });
}

export interface UseDaftarSopDataParams {
  /** Daftar dari server (sudah termasuk filter status/tanggal bila dikirim ke API). */
  list: SopDaftarRow[];
  searchQuery: string;
}

/** Filter teks pencarian lokal pada daftar SOP yang sudah diambil dari server. */
export function useDaftarSopData(params: UseDaftarSopDataParams) {
  const filteredList = useMemo(() => {
    const q = params.searchQuery.trim().toLowerCase();
    if (!q) return params.list;
    return params.list.filter(
      (sop) =>
        sop.judul.toLowerCase().includes(q) ||
        (sop.nomorSop ?? "").toLowerCase().includes(q) ||
        (sop.pembuat ?? "").toLowerCase().includes(q),
    );
  }, [params.list, params.searchQuery]);
  return { filteredList };
}
