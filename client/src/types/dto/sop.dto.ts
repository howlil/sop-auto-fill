import type { TTESignaturePayload } from "./tte.dto";

export type StatusSOP =
  | "DRAFT"
  | "SEDANG_DISUSUN"
  | "MENUNGGU_PENGAJUAN_EVALUASI"
  | "DIAJUKAN_EVALUASI"
  | "SEDANG_DIEVALUASI"
  | "REVISI_DARI_EVALUATOR"
  | "DITOLAK_EVALUATOR"
  | "MENUNGGU_TTD_PJ_EVALUATOR"
  | "DIVERIFIKASI_PJ_EVALUATOR_ORGANISASI"
  | "BERLAKU"
  | "DIGANTIKAN"
  | "DICABUT";

export type JenisLangkahProsedur = "AWAL_AKHIR" | "KEGIATAN" | "KEPUTUSAN";
export type SatuanWaktu = "m" | "h" | "d" | "w" | "mo" | "y";
/** Selaras dengan enum `BagianSOP` di server (sumber log aktivitas + komentar). */
export type BagianSOP = "HEADER" | "LANGKAH" | "STATUS" | "UMPAN_BALIK" | "EVALUASI";

/** Baris daftar dari GET /sop (versi DetailSOP terbaru per header). */
export interface TerakhirDieditRingkas {
  nama: string | null;
  waktu: string | null;
}

export interface SopDaftarVersiSlice {
  detailSopId: string;
  versi: number;
  nomorSop: string;
  status: string;
  statusLabel: string;
}

export interface SopDaftarRow {
  id: string;
  opdId: string;
  detailSopId: string | null;
  judul: string;
  nomorSop: string | null;
  /** Nomor versi DetailSOP terbaru (selaras GET /sop). */
  versi?: number | null;
  pembuat: string | null;
  terakhirDiedit: TerakhirDieditRingkas;
  status: string;
  statusLabel: string;
  peraturanId: string | null;
  terakhirDiperbarui: string | null;
  versiBerlaku?: SopDaftarVersiSlice | null;
  canBuatVersiBaru?: boolean;
  canCabutSop?: boolean;
}

export interface SopRiwayatVersiRow {
  detailSopId: string;
  versi: number;
  nomorSOP: string;
  status: string;
  statusLabel: string;
  revisiDariDetailSopId: string | null;
  revisiDariVersi: number | null;
  updatedAt: string;
  canHapusDraft: boolean;
  canBuatVersiBaru: boolean;
}

/** Header SOP + meta lama (POST/PATCH detail, mock); daftar penyusun memakai `SopDaftarRow`. */
export interface Sop {
  id: string;
  opdId: string;
  judul: string;
  createdAt: string;
  updatedAt: string;
  totalVersi?: number;
  statusAktif?: StatusSOP;
  opd?: { nama: string };
  nomorSOP?: string;
  status?: StatusSOP | string;
  author?: string;
  versi?: number;
  lastEditedBy?: string;
  lastEditedAt?: string;
  terakhirDiperbarui?: string;
  peraturanId?: string;
  tanggal?: string;
  detailSopId?: string;
}

export interface SopDetail {
  id: string;
  sopId: string;
  status: StatusSOP;
  statusLabel?: string;
  versi: number;
  revisiDariDetailSopId?: string | null;
  revisiDariVersi?: number | null;
  nomorSOP: string;
  tanggalPembuatan: string;
  tanggalRevisi?: string;
  tanggalEfektif?: string;
  logoInstansi: string;
  namaLembaga: string;
  dibuatOlehId?: string;
  terakhirDieditOlehId?: string;
  createdAt: string;
  updatedAt: string;
  sop?: Sop;
  dibuatOleh?: { id: string; nama: string };
  terakhirDieditOleh?: { id: string; nama: string };
  lampiran?: {
    peringatan: Array<{ id: string; teks: string; createdAt: string }>;
    kualifikasiPelaksanaan: Array<{ id: string; teks: string; createdAt: string }>;
    peralatanPerlengkapan: Array<{ id: string; teks: string; createdAt: string }>;
    pencatatanPendataan: Array<{ id: string; teks: string; createdAt: string }>;
  };
  dasarHukum?: DasarHukum[];
  relasiSopKeluar?: SopTerkait[];
  relasiSopMasuk?: SopTerkait[];
  langkahSOP?: LangkahSOP[];
  swimlanes?: DetailSOPPelaksana[];
  nilaiEvaluasi?: { id: string; hasil?: string; catatan?: string }[];
  /** Kepala OPD OPD pemilik SOP (mis. dari GET workbench); blok DISAHKAN OLEH. */
  kepalaOpd?: { nama: string | null; nip: string | null } | null;
  /** ID peraturan dasar hukum (urut createdAt asc), dari GET workbench. */
  dasarHukumPeraturanIds?: string[];
  /** ID DetailSOP terkait (relasi keluar), dari GET workbench. */
  sopTerkaitDetailIds?: string[];
}

/** Metadata sesi log (Google Docs style): field union + jumlah event tergabung. */
export interface PenyusunWorkbenchLogEditMeta {
  fields: string[];
  count: number;
}

/** Satu entri log pada GET workbench. Sesi yang masih berlangsung: `closedAt = null`. `id` bukan UUID — lihat encode komposit server. */
export interface PenyusunWorkbenchLogEdit {
  /** Identitas stabil dari server (gabungan detailSopId + userId + createdAt), bukan UUID. */
  id: string;
  sopDetailId: string;
  userId: string;
  bagian: BagianSOP;
  keterangan?: string | null;
  meta?: PenyusunWorkbenchLogEditMeta | null;
  aktorRole: string;
  createdAt: string;
  closedAt?: string | null;
  user?: { id: string; nama: string; email: string };
}

/** Respons GET `/sop/penyusun-workbench/:detailSopId`. */
export interface PenyusunWorkbenchData {
  detail: SopDetail;
  langkah: LangkahSOP[];
  logEdit: PenyusunWorkbenchLogEdit[];
  diagramKonfigurasi?: PenyusunWorkbenchDiagramKonfigurasi;
  tteSignaturePayloadKepalaOpd?: TTESignaturePayload;
}

export type JenisDiagram = 'FLOWCHART' | 'BPMN';

export interface DiagramPathPointDto {
  x: number;
  y: number;
}

export interface DiagramArrowConnectionDto {
  sSide: 'top' | 'bottom' | 'left' | 'right';
  eSide: 'top' | 'bottom' | 'left' | 'right';
  startPoint: DiagramPathPointDto;
  endPoint: DiagramPathPointDto;
  bendPoints: DiagramPathPointDto[];
}

export interface DiagramPathOverridesDto {
  edges?: Record<string, DiagramArrowConnectionDto>;
  labels?: Record<string, { x: number; y: number }>;
}

export interface PenyusunWorkbenchDiagramSlice {
  layoutSeed: number;
  pathOverrides: DiagramPathOverridesDto | null;
}

export interface PenyusunWorkbenchDiagramKonfigurasi {
  flowchart?: PenyusunWorkbenchDiagramSlice;
  bpmn?: PenyusunWorkbenchDiagramSlice;
}

export interface UpdateSopDiagramDto {
  jenis: JenisDiagram;
  layoutSeed?: number;
  pathOverrides?: DiagramPathOverridesDto | null;
}

export interface PenyusunWorkbenchQueryParams {
  logsLimit?: number;
}

export interface DasarHukum {
  id: string;
  sopDetailId: string;
  judul: string;
  nomor: string;
  tahun: string;
  createdAt: string;
  updatedAt: string;
}

export interface SopTerkait {
  id: string;
  sopDetailId: string;
  sopTerkaitId: string;
  createdAt: string;
  updatedAt: string;
  sopDetail?: SopDetail;
  sopTerkait?: SopDetail;
}

export interface LangkahSOP {
  id: string;
  sopDetailId: string;
  urutan: number;
  kegiatan: string;
  jenis: JenisLangkahProsedur;
  kelengkapan: string;
  keluaran: string;
  waktu: number;
  satuanWaktu: SatuanWaktu;
  keterangan: string;
  pelaksanaId: string;
  langkahSelanjutnyaYaId?: string | null;
  langkahSelanjutnyaTidakId?: string | null;
  createdAt: string;
  updatedAt: string;
  pelaksana?: { id: string; namaPelaksana: string };
}

export interface DetailSOPPelaksana {
  id: string;
  sopDetailId: string;
  pelaksanaId: string;
  urutan: number;
  createdAt: string;
  updatedAt: string;
  pelaksana?: { id: string; opdId: string; namaPelaksana: string };
}

export interface Pelaksana {
  id: string;
  opdId: string;
  namaPelaksana: string;
  createdAt: string;
  updatedAt: string;
}

export interface SopListQueryParams {
  opdId?: string;
  /** Status DetailSOP terbaru (bukan `all`). */
  status?: string;
  /** Batas bawah tanggal `updatedAt` (YYYY-MM-DD, UTC). */
  tanggalDari?: string;
  /** Batas atas tanggal `updatedAt` (YYYY-MM-DD, UTC). */
  tanggalSampai?: string;
}

/** Payload POST `/sop` — opdId & pembuat di-set server dari JWT. */
export interface CreateSopRequest {
  judul: string;
  nomorSop: string;
  namaLembaga?: string;
}

export interface CreateSopRequestDto {
  judul: string;
  nomorSop: string;
  namaLembaga?: string;
}

export interface UpdateMetadataDto {
  logoInstansi?: string;
  namaLembaga?: string;
  tanggalRevisi?: string;
  tanggalEfektif?: string;
}

/** Payload PATCH `/sop/header/:detailSopId` — semua field opsional, hanya yang dikirim yang disimpan. */
export interface UpdateSopHeaderDto {
  judul?: string;
  nomorSOP?: string;
  namaLembaga?: string;
  dasarHukumPeraturanIds?: string[];
  sopTerkaitDetailIds?: string[];
  lampiran?: {
    peringatan?: string[];
    kualifikasiPelaksanaan?: string[];
    peralatanPerlengkapan?: string[];
    pencatatanPendataan?: string[];
  };
}

export interface UpdateSopHeaderMutationDto {
  detailSopId: string;
  payload: UpdateSopHeaderDto;
}

/** Satu entri swimlane pada PATCH `/sop/langkah/:detailSopId`. Urutan = posisi index. */
export interface PelaksanaPatchItem {
  pelaksanaId: string;
}

/** Satu langkah prosedur pada PATCH `/sop/langkah/:detailSopId`. */
export interface LangkahPatchItem {
  /** ID stabil di payload (existing UUID langkahSopId atau client-generated). */
  tempId: string;
  jenis: JenisLangkahProsedur;
  kegiatan: string;
  kelengkapan?: string;
  keluaran?: string;
  waktu?: number;
  satuanWaktu?: SatuanWaktu;
  keterangan?: string;
  /** Pelaksana eksekutor langkah ini; harus muncul di `pelaksana[]` payload atau swimlane existing. */
  pelaksanaId?: string;
  /** Cabang Ya — merujuk `tempId` entri lain. Hanya berlaku untuk jenis KEPUTUSAN. */
  langkahSelanjutnyaYaTempId?: string | null;
  /** Cabang Tidak — merujuk `tempId` entri lain. Hanya berlaku untuk jenis KEPUTUSAN. */
  langkahSelanjutnyaTidakTempId?: string | null;
}

/**
 * Payload PATCH `/sop/langkah/:detailSopId` — replace-all per section yang dikirim.
 * Hanya field yang di-set yang dieksekusi; debounce autosave-friendly.
 */
export interface UpdateSopProsedurDto {
  pelaksana?: PelaksanaPatchItem[];
  langkah?: LangkahPatchItem[];
}

export interface UpdateStatusDto {
  status: StatusSOP;
}

export interface CreateLangkahSOPDto {
  kegiatan: string;
  jenis?: JenisLangkahProsedur;
  urutan: number;
  kelengkapan: string;
  keluaran: string;
  waktu: number;
  satuanWaktu: SatuanWaktu;
  keterangan?: string;
  pelaksanaId: string;
  langkahSelanjutnyaYaId?: string;
  langkahSelanjutnyaTidakId?: string;
}

export interface UpdateLangkahSOPDto {
  kegiatan?: string;
  jenis?: JenisLangkahProsedur;
  urutan?: number;
  kelengkapan?: string;
  keluaran?: string;
  waktu?: number;
  satuanWaktu?: SatuanWaktu;
  keterangan?: string;
  pelaksanaId?: string;
  langkahSelanjutnyaYaId?: string | null;
  langkahSelanjutnyaTidakId?: string | null;
}

export interface CreatePelaksanaDto {
  opdId: string;
  namaPelaksana: string;
}

export interface CreateDetailSOPPelaksanaDto {
  pelaksanaId: string;
  urutan?: number;
}

// Catatan: DTO create lampiran spesifik belum diekspos; lampiran dimutasi via PATCH header (`UpdateSopHeaderDto.lampiran`).

export interface CreateDasarHukumDto {
  judul: string;
  nomor: string;
  tahun: string;
}

export interface CreateSopTerkaitDto {
  sopTerkaitId: string;
}

export interface UpdateMetadataMutationDto {
  id: string;
  payload: UpdateMetadataDto;
}

export interface SetSopStatusOverrideMutationDto {
  sopId: string;
  status: StatusSOP;
}

export interface UpdateLangkahMutationDto {
  id: string;
  payload: UpdateLangkahSOPDto;
}

export interface UpdateLampiranMutationDto {
  lampiranId: string;
  teks: string;
}

export interface CreatePelaksanaMutationDto {
  namaPelaksana: string;
  opdId?: string;
}

export interface UpdatePelaksanaMutationDto {
  id: string;
  namaPelaksana: string;
}

export const DEFAULT_SOP_STATUS = "DRAFT";
