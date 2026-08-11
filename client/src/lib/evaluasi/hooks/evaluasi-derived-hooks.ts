import { useMemo } from "react";
import { useEvaluasi } from "@/api/evaluasi-queries";
import type {
  EvaluasiListQueryParams,
  EvaluasiWorkspacePengajuanAktif,
  JenisPengajuanEvaluasi,
  NilaiEvaluasi,
  PengajuanEvaluasi,
} from "@/types/dto/evaluasi.dto";

/** Status pengajuan yang masih berjalan di sisi evaluator. */
export const STATUS_PENGAJUAN_BERJALAN_EVALUATOR = [
  "SEDANG_DIEVALUASI",
] as const satisfies readonly PengajuanEvaluasi["status"][];

/** Status pengajuan yang siap aksi TTD oleh PJ Evaluator. */
export const STATUS_PENGAJUAN_SIAP_TTD_PJ_EVALUATOR = [
  "SELESAI_DIEVALUASI",
] as const satisfies readonly PengajuanEvaluasi["status"][];

/** Riwayat final (arsip selesai total). */
export const STATUS_RIWAYAT_FINAL_EVALUASI = [
  "DITOLAK",
  "SELESAI",
] as const satisfies readonly PengajuanEvaluasi["status"][];

/** Halaman Berita Acara PJ Penyusun — tab Perlu TTE. */
export const STATUS_BERITA_ACARA_PERLU_TTE = [
  "DITANDATANGANI_PJ_EVALUATOR",
] as const satisfies readonly PengajuanEvaluasi["status"][];

/** Halaman Berita Acara PJ Penyusun — tab Riwayat. */
export const STATUS_BERITA_ACARA_RIWAYAT = [
  "DITANDATANGANI_PJ_PENYUSUN",
  "SELESAI",
] as const satisfies readonly PengajuanEvaluasi["status"][];

/** Semua status yang ditampilkan di halaman Berita Acara PJ Penyusun. */
export const STATUS_BERITA_ACARA_SEMUA = [
  ...STATUS_BERITA_ACARA_PERLU_TTE,
  ...STATUS_BERITA_ACARA_RIWAYAT,
] as const satisfies readonly PengajuanEvaluasi["status"][];

const BERITA_ACARA_PERLU_TTE_SET = new Set<string>(STATUS_BERITA_ACARA_PERLU_TTE);
const BERITA_ACARA_RIWAYAT_SET = new Set<string>(STATUS_BERITA_ACARA_RIWAYAT);

const KEPALA_OPD_PENDING_SIGN_STATUSES: readonly PengajuanEvaluasi["status"][] = [
  "DITANDATANGANI_PJ_PENYUSUN",
];
const KEPALA_OPD_SIGNED_STATUSES: readonly PengajuanEvaluasi["status"][] = [
  "SELESAI",
];
const KEPALA_OPD_PENGAJUAN_STATUSES: readonly PengajuanEvaluasi["status"][] = [
  ...KEPALA_OPD_PENDING_SIGN_STATUSES,
  ...KEPALA_OPD_SIGNED_STATUSES,
];

export interface KepalaOpdPengajuanBuckets {
  belumDitandatangani: PengajuanEvaluasi[];
  sudahBerlaku: PengajuanEvaluasi[];
}

export function buildKepalaOpdPengajuanQueryParams(
  opdId?: string,
): EvaluasiListQueryParams & { enabled: true } {
  const normalizedOpdId = opdId?.trim();
  return {
    ...(normalizedOpdId ? { opdId: normalizedOpdId } : {}),
    statusIn: [...KEPALA_OPD_PENGAJUAN_STATUSES],
    enabled: true,
  };
}

export function useKepalaOpdPengajuan(opdId?: string) {
  const { list, isLoading, error } = useEvaluasi(
    buildKepalaOpdPengajuanQueryParams(opdId),
  );

  const buckets = useMemo<KepalaOpdPengajuanBuckets>(() => {
    const belumDitandatangani = list.filter((item) =>
      KEPALA_OPD_PENDING_SIGN_STATUSES.includes(item.status),
    );
    const sudahBerlaku = list.filter((item) =>
      KEPALA_OPD_SIGNED_STATUSES.includes(item.status),
    );
    return { belumDitandatangani, sudahBerlaku };
  }, [list]);

  return {
    ...buckets,
    isLoading,
    error,
  };
}

export interface BeritaAcaraPjPenyusunBuckets {
  perluTindakan: PengajuanEvaluasi[];
  riwayat: PengajuanEvaluasi[];
}

/** Daftar Berita Acara PJ Penyusun — tab Perlu TTE vs Riwayat (satu fetch, bucket di client). */
export function useBeritaAcaraPjPenyusun() {
  const { list, isLoading, error } = useEvaluasi({
    statusIn: [...STATUS_BERITA_ACARA_SEMUA],
  });

  const buckets = useMemo<BeritaAcaraPjPenyusunBuckets>(() => {
    const perluTindakan = list.filter((item) =>
      BERITA_ACARA_PERLU_TTE_SET.has(item.status),
    );
    const riwayat = list.filter((item) => BERITA_ACARA_RIWAYAT_SET.has(item.status));
    return { perluTindakan, riwayat };
  }, [list]);

  return {
    ...buckets,
    isLoading,
    error,
  };
}

export interface RiwayatEvaluasiEntry {
  tanggal: string;
  evaluator: string;
  hasil?: string;
  catatan?: string;
  nilaiOPD?: number;
}

export interface UsePengajuanEvaluasiAktifReturn {
  /** Pengajuan ID (null if no active pengajuan) */
  pengajuanId: string | null;
  /** Full pengajuan data */
  pengajuan: {
    id: string;
    status: string;
    statusLabel: string;
    jenis: JenisPengajuanEvaluasi;
    version: number;
    alasanPenolakan: string | null;
    tanggalDitolak: string | null;
    nilaiEvaluasi: NilaiEvaluasi[];
  } | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Get current version for a SOP detail */
  getCurrentVersion: (sopDetailId: string) => number;
}

function pickPengajuanAktifUntukEvaluator(
  list: PengajuanEvaluasi[],
): PengajuanEvaluasi | null {
  const aktif = list.filter((p) => p.status === "SEDANG_DIEVALUASI");
  if (aktif.length === 0) {
    return null;
  }
  return (
    [...aktif].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
  );
}

export function usePengajuanEvaluasiAktif(
  opdId?: string,
  workspacePengajuanAktif?: EvaluasiWorkspacePengajuanAktif | null,
): UsePengajuanEvaluasiAktifReturn {
  /** Hanya pakai bundel workspace bila server mengirim objek pengajuan; `null` = muat ulang via GET /evaluasi. */
  const fromWorkspace =
    workspacePengajuanAktif !== undefined && workspacePengajuanAktif !== null;
  const {
    list: pengajuanList,
    isLoading,
    error,
  } = useEvaluasi({
    opdId,
    enabled: Boolean(opdId) && !fromWorkspace,
  });

  const activePengajuan = useMemo(() => {
    if (fromWorkspace) {
      const p = workspacePengajuanAktif!;
      return {
        id: p.id,
        status: p.status,
        statusLabel: p.statusLabel,
        jenis: p.jenis,
        version: p.version,
        alasanPenolakan: p.alasanPenolakan,
        tanggalDitolak: p.tanggalDitolak,
        nilaiEvaluasi: p.nilaiPerDetail.map(
          (n): NilaiEvaluasi => ({
            id: `ws-${n.detailSopId}`,
            pengajuanEvaluasiId: p.id,
            sopDetailId: n.detailSopId,
            hasil:
              n.hasil === "SESUAI" ||
              n.hasil === "PERLU_PERBAIKAN" ||
              n.hasil === "DITOLAK"
                ? n.hasil
                : undefined,
            catatan: n.catatan ?? undefined,
            version: n.version,
            createdAt: "",
            updatedAt: "",
          }),
        ),
      };
    }
    if (!pengajuanList || pengajuanList.length === 0) {
      return null;
    }
    const picked = pickPengajuanAktifUntukEvaluator(pengajuanList);
    if (!picked) {
      return null;
    }
    return {
      id: picked.id,
      status: picked.status,
      statusLabel: picked.statusLabel ?? picked.status,
      jenis: picked.jenis,
      version: picked.version,
      alasanPenolakan: picked.alasanPenolakan ?? null,
      tanggalDitolak: picked.tanggalDitolak ?? null,
      nilaiEvaluasi: picked.nilaiEvaluasi ?? [],
    };
  }, [fromWorkspace, workspacePengajuanAktif, pengajuanList]);

  const getCurrentVersion = (detailId: string): number => {
    if (!activePengajuan?.nilaiEvaluasi) {
      return 0;
    }
    const nilai = activePengajuan.nilaiEvaluasi.find((n) => n.sopDetailId === detailId);
    return nilai?.version ?? 0;
  };

  return {
    pengajuanId: activePengajuan?.id ?? null,
    pengajuan: activePengajuan
      ? {
          id: activePengajuan.id,
          status: activePengajuan.status,
          statusLabel: activePengajuan.statusLabel,
          jenis: activePengajuan.jenis ?? "EVALUASI_REQUEST_EVALUATOR",
          version: activePengajuan.version,
          alasanPenolakan: activePengajuan.alasanPenolakan,
          tanggalDitolak: activePengajuan.tanggalDitolak,
          nilaiEvaluasi: activePengajuan.nilaiEvaluasi ?? [],
        }
      : null,
    isLoading: fromWorkspace ? false : isLoading,
    error: fromWorkspace ? null : error,
    getCurrentVersion,
  };
}
