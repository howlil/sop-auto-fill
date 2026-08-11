import type { PenyusunWorkbenchData } from "./sop.dto";
import type { TTESignaturePayload } from "./tte.dto";

export type StatusHasilEvaluasi = "SESUAI" | "PERLU_PERBAIKAN";

/** Status tindak lanjut umpan balik evaluasi (selaras enum StatusTindakLanjut di server). */
export type StatusTindakLanjut = "TERBUKA" | "SELESAI";

/** Turunan API saat belum ada hasil di DB. */
export type HasilEvaluasiDisplay = StatusHasilEvaluasi | "DITOLAK" | "BELUM_DINILAI";
export const STATUS_HASIL_EVALUASI = {
  SESUAI: "SESUAI",
  PERLU_PERBAIKAN: "PERLU_PERBAIKAN",
} as const;

/** Skor evaluasi tingkat OPD (pengajuan EVALUASI_REQUEST_EVALUATOR) — selaras server `SelesaiEvaluasiDto`. */
export const NILAI_OPD_SKOR_MIN = 1;
export const NILAI_OPD_SKOR_MAX = 5;

export interface PengajuanEvaluasiSubmitError {
  kind: "none" | "no_selection" | "incomplete" | "blocked";
  items: { id: string; judul: string; nomorSOP: string }[];
  sopId?: string;
  message?: string;
}

export type StatusPengajuanEvaluasi =
  | "SEDANG_DIEVALUASI"
  | "DITOLAK"
  | "SELESAI_DIEVALUASI"
  | "DITANDATANGANI_PJ_EVALUATOR"
  | "DITANDATANGANI_PJ_PENYUSUN"
  | "SELESAI";
export type JenisPengajuanEvaluasi = "EVALUASI_REQUEST_EVALUATOR" | "EVALUASI_REQUEST_OPD";

export interface EvaluasiGrafikTahunanPerOpd {
  opdId: string
  opdNama: string
  jumlahEvaluasi: number
  rataRataSkor: number | null
}

export interface EvaluasiGrafikTahunanRingkasanTahun {
  tahun: number
  totalPenilaian: number
  jumlahOpdDenganPenilaian: number
  rataRataSkorOpd: number | null
  perOpd: EvaluasiGrafikTahunanPerOpd[]
}

/** GET `/evaluasi/laporan/grafik-tahunan` — payload `data`. */
export interface EvaluasiGrafikTahunanData {
  totalOpdAktif: number
  daftarOpd: Array<{ opdId: string; opdNama: string }>
  ringkasanPerTahun: EvaluasiGrafikTahunanRingkasanTahun[]
}

export interface EvaluasiGrafikTahunanQueryParams {
  /** Satu tahun; dipakai bila tidak mengirim `tahunDari` / `tahunSampai`. */
  tahun?: number
  tahunDari?: number
  tahunSampai?: number
}

export interface PengajuanEvaluasi {
  id: string;
  /** Tidak dikirim untuk PJ Penyusun (konteks OPD implisit). */
  opdId?: string;
  opdNama?: string;
  jenis: JenisPengajuanEvaluasi;
  status: StatusPengajuanEvaluasi;
  statusLabel?: string;
  nomorBA?: string;
  tanggalPermintaan?: string;
  tanggalEvaluasi?: string;
  tanggalVerifikasi?: string | null;
  namaPjEvaluator?: string;
  nilaiOPD?: number;
  diverifikasiOlehUserId?: string;
  ditandatanganiOlehPjPenyusunUserId?: string;
  namaPjPenyusun?: string;
  tanggalTTDBaPjPenyusun?: string;
  diselesaikanOlehId?: string;
  diselesaikanOleh?: {
    id?: string;
    nama?: string;
  };
  opd?: {
    id?: string;
    nama?: string;
  };
  timEvaluasi?: string;
  tteSignaturePayload?: unknown;
  nilaiEvaluasi?: NilaiEvaluasi[];
  tanggalDiselesaikan?: string;
  alasanPenolakan?: string;
  tanggalDitolak?: string;
  ditolakOlehId?: string;
  ditolakOleh?: { id: string; nama: string };
  sopList?: Array<{
    id: string;
    sopDetailId: string;
    judul: string;
    nomor: string;
    nama: string;
    nomorSOP: string;
    status: string;
    statusLabel?: string;
    hasil?: HasilEvaluasiDisplay;
    hasilLabel?: string;
  }>;
  riwayatEvaluasi?: Array<{
    id: string;
    sopDetailId: string;
    evaluatorId: string;
    evaluatorNama: string;
    hasilSebelum?: HasilEvaluasiDisplay;
    hasilSesudah?: HasilEvaluasiDisplay;
    catatanSebelum?: string;
    catatanSesudah?: string;
    createdAt: string;
  }>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** Identifier stabil selaras server: `pengajuanEvaluasiId:detailSopId`. */
export function buildNilaiEvaluasiClientId(
  pengajuanEvaluasiId: string,
  detailSopId: string,
): string {
  return `${pengajuanEvaluasiId}:${detailSopId}`;
}

/** Satu baris daftar SOP dalam pengajuan evaluasi — GET `/evaluasi/pengajuan/:id` (`sopItems`). */
export interface PengajuanSopItemShell {
  detailSopId: string;
  sopId: string;
  judul: string;
  nomorSOP: string;
  statusDetailSop: string;
  statusDetailSopLabel: string;
  hasilEvaluasi: string;
  hasilEvaluasiLabel: string;
  catatanRingkas?: string;
  evaluatorTerakhir?: { id: string; nama: string };
}

/** Entri log nilai dalam shell — paralel dengan `timelineNilai` di API. */
export interface PengajuanTimelineNilaiEntry {
  id: string;
  sopDetailId: string;
  evaluatorId: string;
  evaluatorNama: string;
  hasilSebelum?: HasilEvaluasiDisplay;
  hasilSesudah?: HasilEvaluasiDisplay;
  catatanSebelum?: string;
  catatanSesudah?: string;
  createdAt: string;
}

/** GET `/evaluasi/pengajuan/:id`. */
export interface PengajuanEvaluasiShellOpd {
  id: string;
  nama: string;
}

export interface PengajuanEvaluasiShell {
  id: string;
  /** Tidak dikirim untuk PJ Penyusun (konteks OPD implisit). */
  opdId?: string;
  opdNama?: string;
  jenis: string;
  status: string;
  statusLabel: string;
  version: number;
  nomorBA?: string;
  tanggalPermintaan?: string;
  tanggalEvaluasi?: string;
  tanggalVerifikasi?: string;
  nilaiOPD?: number;
  diverifikasiOlehUserId?: string;
  namaPjEvaluator?: string;
  ditandatanganiOlehPjPenyusunUserId?: string;
  namaPjPenyusun?: string;
  tanggalTTDBaPjPenyusun?: string;
  diselesaikanOlehId?: string;
  diselesaikanOleh?: { id: string; nama: string };
  opd?: PengajuanEvaluasiShellOpd;
  timEvaluasi?: string;
  tanggalDiselesaikan?: string;
  alasanPenolakan?: string;
  tanggalDitolak?: string;
  ditolakOlehId?: string;
  ditolakOleh?: { id: string; nama: string };
  sopItems: PengajuanSopItemShell[];
  nilaiEvaluasi: NilaiEvaluasi[];
  timelineNilai: PengajuanTimelineNilaiEntry[];
  createdAt: string;
  updatedAt: string;
}

/** GET `/evaluasi/pengajuan/:id/sop-dokumen/:detailSopId`. */
export interface PengajuanSopWorkbenchResponse {
  detailSopId: string;
  workbench: PenyusunWorkbenchData;
  /** Payload QR TTE Kepala OPD bila SOP sudah ditandatangani. */
  tteSignaturePayloadKepalaOpd?: TTESignaturePayload;
}

export interface BeritaAcaraHasilPerSopRow {
  nomorSOP: string;
  judul: string;
  hasilEvaluasi: string;
  hasilEvaluasiLabel: string;
  ringkasanCatatanEvaluator?: string;
}

/** GET `/evaluasi/pengajuan/:id/berita-acara`. */
export interface BeritaAcaraEvaluasiView {
  namaOpd: string;
  nomorBA?: string;
  tanggalEvaluasi?: string;
  tanggalVerifikasiPjEvaluator?: string;
  nilaiKeseluruhanOpd?: number;
  hasilPerSop: BeritaAcaraHasilPerSopRow[];
  timEvaluasi: {
    penanggungJawabSelesai?: { id: string; nama: string };
    evaluatorNamaUnik: string[];
  };
  tteBeritaAcara?: {
    dokumenTteId: string;
    hashDokumen: string;
    versiDokumen: number;
    adaRiwayatTandaTanganPerPeran: Record<string, boolean>;
    payloadPjEvaluator?: TTESignaturePayload;
    payloadPjPenyusun?: TTESignaturePayload;
  };
}

/** GET `/evaluasi/umpan-balik/detail/:detailSopId` */
export interface UmpanBalikEvaluasiDetail {
  pengajuanEvaluasiId: string;
  pengajuanStatus: StatusPengajuanEvaluasi;
  detailSopId: string;
  hasil: string;
  hasilLabel: string;
  catatan: string | null;
  statusTindakLanjut: StatusTindakLanjut | null;
  statusTindakLanjutLabel: string | null;
  ditindaklanjutiPada: string | null;
  version: number;
  dinilaiOleh?: { id: string; nama: string };
  ditindaklanjutiOleh?: { id: string; nama: string };
}

export interface NilaiEvaluasi {
  /** Gabungan `pengajuanEvaluasiId:detailSopId` (bukan UUID surrogate DB). */
  id: string;
  pengajuanEvaluasiId: string;
  sopDetailId: string;
  hasil?: HasilEvaluasiDisplay;
  catatan?: string;
  statusTindakLanjut?: StatusTindakLanjut;
  statusTindakLanjutLabel?: string;
  ditindaklanjutiPada?: string;
  version: number;
  dinilaiOlehId?: string;
  dinilaiOleh?: {
    id?: string;
    nama?: string;
  };
  sopDetail?: {
    id?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface LogNilaiEvaluasi {
  /** Id komposit ter-encode untuk klien (bukan UUID); memuat pengajuan, detail SOP, pengguna, dan `createdAt`. */
  id: string;
  pengajuanEvaluasiId?: string;
  sopDetailId: string;
  /** Nilai sama dengan `penggunaId` evaluator di server (nama field tetap untuk kompatibilitas API). */
  evaluatorId: string;
  evaluatorNama?: string;
  hasilSebelum?: HasilEvaluasiDisplay;
  hasilSesudah?: HasilEvaluasiDisplay;
  catatanSebelum?: string;
  catatanSesudah?: string;
  createdAt: string;
}

export interface PengajuanEvaluasiListSopItem {
  id: string;
  sopDetailId: string;
  judul: string;
  nomorSOP: string;
  status: string;
  hasil?: HasilEvaluasiDisplay;
}

export interface CreatePengajuanEvaluasiDto {
  jenis: JenisPengajuanEvaluasi;
  sopDetailIds: string[];
}

export interface SelesaiEvaluasiDto {
  /** Nomor Berita Acara yang diinputkan oleh Evaluator (wajib untuk semua evaluasi). */
  nomorBA: string;
  /** Skor evaluasi tingkat OPD (1-5). Wajib untuk EVALUASI_REQUEST_EVALUATOR, jangan kirim untuk EVALUASI_REQUEST_OPD. */
  nilaiOPD?: number;
}

export interface TolakPengajuanEvaluasiDto {
  alasan: string;
  version: number;
}

export interface IsiNilaiEvaluasiDto {
  hasil: StatusHasilEvaluasi;
  catatan?: string;
  version?: number;
}

export interface UpdatePengajuanEvaluasiDto {
  status?: StatusPengajuanEvaluasi;
  nilaiOPD?: number;
}

export interface CreateNilaiEvaluasiDto {
  pengajuanEvaluasiId: string;
  sopDetailId: string;
  hasil: StatusHasilEvaluasi;
  catatan?: string;
}

export interface UpdateNilaiEvaluasiDto {
  hasil?: StatusHasilEvaluasi;
  catatan?: string;
  version?: number;
}

export interface EvaluasiListQueryParams {
  opdId?: string;
  status?: string;
  /** Beberapa enum status (di-query sebagai `statusIn` berulang); mengalahkan `status` di server jika ada. */
  statusIn?: readonly string[];
  jenis?: string;
}

/** Meta pagination — selaras server `toPaginatedData` (`pagination` di dalam `data`). */
export interface PaginationMetaDto {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

/** Satu baris GET `/evaluasi/ringkas`. */
export interface PengajuanEvaluasiRingkasRow {
  pengajuanEvaluasiId: string;
  opdId: string;
  opdNama: string;
  jenis: string;
  status: string;
  statusLabel: string;
  tanggalEvaluasi?: string;
  createdAt: string;
  jumlahSop: number;
  jumlahSudahDinilai: number;
  nilaiOPD?: number;
}

export interface PengajuanEvaluasiRingkasPage {
  items: PengajuanEvaluasiRingkasRow[];
  pagination: PaginationMetaDto;
}

/** Query GET `/evaluasi/ringkas`. */
export interface EvaluasiRingkasQueryParams {
  page?: number;
  limit?: number;
  opdId?: string;
  status?: string;
  statusIn?: readonly string[];
  jenis?: string;
  search?: string;
}

/** GET `/evaluasi/workspace/opd/:opdId` - agregat halaman workspace evaluator. */
export type EvaluasiWorkspaceTampilanAlur =
  | "perlu_evaluasi"
  | "sedang_dievaluasi"
  | "selesai_pengajuan_ini";

export interface EvaluasiWorkspaceNilaiPerDetail {
  detailSopId: string;
  hasil: HasilEvaluasiDisplay;
  hasilLabel: string;
  catatan: string | null;
  statusTindakLanjut: StatusTindakLanjut | null;
  statusTindakLanjutLabel: string | null;
  version: number;
  ditindaklanjutiPada: string | null;
  versi: number;
  detailUpdatedAt: string;
}

export interface EvaluasiWorkspacePengajuanAktif {
  id: string;
  status: string;
  statusLabel: string;
  jenis: JenisPengajuanEvaluasi;
  version: number;
  alasanPenolakan: string | null;
  tanggalDitolak: string | null;
  nilaiPerDetail: EvaluasiWorkspaceNilaiPerDetail[];
}

export interface EvaluasiWorkspaceDaftarSopRow {
  detailSopId: string;
  sopId: string;
  judul: string;
  nomorSOP: string;
  statusDetail: string;
  statusDetailLabel: string;
  hasilEvaluasi: HasilEvaluasiDisplay;
  hasilEvaluasiLabel: string;
  tampilanAlur: EvaluasiWorkspaceTampilanAlur;
  tampilanAlurLabel: string;
  statusTindakLanjut?: StatusTindakLanjut | null;
  statusTindakLanjutLabel?: string | null;
  versi: number;
  detailUpdatedAt: string;
  ditindaklanjutiPada: string | null;
  evaluatorTerakhir: { nama: string; pada: string } | null;
}

export interface EvaluasiWorkspaceRiwayatOpdEntry {
  tanggal: string;
  evaluatorNama: string;
  nilaiOPD?: number | null;
  pengajuanEvaluasiId: string;
}

export interface EvaluasiWorkspacePreview {
  detailSopId: string;
  workbench: PenyusunWorkbenchData;
}

export interface EvaluasiWorkspaceOpdResponse {
  opd: { id: string; nama: string };
  pengajuanAktif: EvaluasiWorkspacePengajuanAktif | null;
  daftarSop: EvaluasiWorkspaceDaftarSopRow[];
  riwayatOpd: EvaluasiWorkspaceRiwayatOpdEntry[];
  preview: EvaluasiWorkspacePreview | null;
  logNilaiSopTerpilih: PengajuanTimelineNilaiEntry[];
}

export interface EvaluasiWorkspaceQueryParams {
  detailSopId?: string;
  expand?: string;
  riwayatLimit?: number;
}
