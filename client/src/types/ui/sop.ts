export interface SOPDetailMetadata {
  id?: string;
  sopId?: string;
  judul?: string;
  nomor?: string;
  nomorSOP?: string;
  nama?: string;
  tahun?: number;
  tentang?: string;
  opdId?: string;
  lembaga?: string;
  logoUrl?: string;
  tanggalEfektif?: string;
  tanggalRevisi?: string;
  /** ISO 8601 dari API (`tanggalPembuatan` DetailSOP). */
  tanggalPembuatan?: string;
  version?: number;
  revisiDariDetailSopId?: string | null;
  revisiDariVersi?: number | null;
  name?: string;
  number?: string;
  institutionLogo?: string;
  institutionLines?: string[];
  lawBasis?: string[];
  /** ID kanonis peraturan untuk PATCH header (sejajar urutan dengan `lawBasis`). */
  lawBasisIds?: string[];
  relatedSop?: string[];
  /** ID kanonis DetailSOP terkait untuk PATCH header (sejajar urutan dengan `relatedSop`). */
  relatedSopDetailIds?: string[];
  warning?: string | string[];
  implementQualification?: string | string[];
  equipment?: string | string[];
  recordData?: string | string[];
  /** Nama untuk blok DISAHKAN OLEH (Kepala OPD). */
  picName?: string;
  /** NIP untuk blok DISAHKAN OLEH. */
  picNumber?: string;
}

export interface ProsedurRow {
  id: string;
  urutan: number;
  no?: number;
  kegiatan: string;
  pelaksana: string;
  waktu?: number;
  satuanWaktu?: string;
  time?: number;
  time_unit?: string;
  mutu_kelengkapan?: string;
  kelengkapan?: string;
  mutu_waktu?: string;
  keluaran?: string;
  output?: string;
  keterangan?: string;
  type?: "terminator" | "task" | "decision";
  /** UI-only: pilihan user antara Mulai vs Selesai untuk row terminator.
   *  Tidak dipersist (server hanya kenal AWAL_AKHIR). Setelah refresh,
   *  diagram tetap melabel Mulai/Selesai berdasarkan posisi. */
  terminatorRole?: "start" | "end";
  id_next_step_if_yes?: string;
  id_next_step_if_no?: string;
  pelaksanaIds?: string[];
  pelaksanaMapping?: Record<string, string>;
}

export interface SopEditorImplementer {
  id: string;
  name: string;
}

export interface SopEditorMasterPelaksana {
  id: string;
  name: string;
  jabatan?: string;
  pangkat?: string;
  email?: string;
  nohp?: string;
}

export interface SopEditorRelatedSopOption {
  id: string;
  label: string;
}

export interface SopItem {
  id: string;
  judul: string;
  opdId: string;
  status: string;
  nomorSOP?: string;
  author?: string;
  peraturanId?: string;
  tanggal?: string;
  terakhirDiperbarui?: string;
  lastEditedBy?: string;
  lastEditedAt?: string;
  versi?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PelaksanaRow {
  id: string;
  nama: string;
  opdId?: string;
  urutan?: number;
}

export interface SOPTemplate {
  id?: string;
  judul: string;
  opdId: string;
  kode?: string;
  opd?: string;
  kategori?: string;
  versi?: number;
  logoInstansi?: string;
  namaLembaga?: string;
}
