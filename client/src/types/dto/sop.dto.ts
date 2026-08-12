export type StatusSOP = 'DRAFT' | 'COMPLETED' | 'ARCHIVED'
export type JenisLangkahProsedur = 'AWAL_AKHIR' | 'KEGIATAN' | 'KEPUTUSAN'
export type SatuanWaktu = 'm' | 'h' | 'd' | 'w' | 'mo' | 'y'
export type JenisDiagram = 'FLOWCHART' | 'BPMN'

export interface SopListQueryParams {
  workspaceId?: string
  status?: StatusSOP | 'all'
  tanggalDari?: string
  tanggalSampai?: string
}

export interface CreateSopRequestDto {
  workspaceId: string
  judul: string
  nomorSop: string
  namaLembaga?: string
}

export interface SopDaftarRow {
  id: string
  workspaceId: string
  detailSopId: string | null
  judul: string
  nomorSop: string | null
  versi: number | null
  pembuat: string | null
  terakhirDiedit: { nama: string | null; waktu: string | null }
  status: StatusSOP
  statusLabel: string
  peraturanId: string | null
  terakhirDiperbarui: string | null
  canBuatVersiBaru: boolean
  canHapusSopDraft: boolean
  versionCount: number
}

export interface LampiranItemDto {
  id: string
  teks: string
  createdAt: string
}

export interface DasarHukumWorkbenchDto {
  id: string
  sopDetailId: string
  peraturanId: string
  judul: string
  nomor: string
  tahun: string
  createdAt: string
  updatedAt: string
}

export interface SopTerkaitWorkbenchDto {
  id: string
  sopDetailId: string
  sopTerkaitId: string
  createdAt: string
  updatedAt: string
  sopTerkait?: { id: string; sopId: string; nomorSOP: string; sop: { judul: string } }
  sop?: { id: string; sopId: string; nomorSOP: string; sop: { judul: string } }
}

export interface SwimlaneWorkbenchDto {
  id: string
  sopDetailId: string
  pelaksanaId: string
  urutan: number
  createdAt: string
  updatedAt: string
  pelaksana: { id: string; workspaceId?: string; namaPelaksana: string }
}

export interface PenyusunWorkbenchDetail {
  id: string
  sopId: string
  status: StatusSOP
  statusLabel: string
  versi: number
  revisiDariDetailSopId?: string | null
  revisiDariVersi?: number | null
  nomorSOP: string
  tanggalPembuatan: string
  tanggalRevisi?: string | null
  tanggalEfektif?: string | null
  logoInstansi: string
  namaLembaga: string
  dibuatOlehId?: string | null
  terakhirDieditOlehId?: string | null
  createdAt: string
  updatedAt: string
  sop?: { id: string; workspaceId: string; judul: string; createdAt: string; updatedAt: string }
  dibuatOleh?: { id: string; nama: string }
  terakhirDieditOleh?: { id: string; nama: string }
  lampiran?: {
    peringatan: LampiranItemDto[]
    kualifikasiPelaksanaan: LampiranItemDto[]
    peralatanPerlengkapan: LampiranItemDto[]
    pencatatanPendataan: LampiranItemDto[]
  }
  dasarHukum?: DasarHukumWorkbenchDto[]
  relasiSopKeluar?: SopTerkaitWorkbenchDto[]
  relasiSopMasuk?: SopTerkaitWorkbenchDto[]
  swimlanes?: SwimlaneWorkbenchDto[]
  dasarHukumPeraturanIds?: string[]
  sopTerkaitDetailIds?: string[]
}

export interface PenyusunWorkbenchLangkah {
  id: string
  sopDetailId: string
  urutan: number
  kegiatan: string
  jenis: JenisLangkahProsedur | string
  kelengkapan: string
  keluaran: string
  waktu: number
  satuanWaktu: SatuanWaktu | string
  keterangan: string
  pelaksanaId: string
  langkahSelanjutnyaYaId?: string | null
  langkahSelanjutnyaTidakId?: string | null
  createdAt: string
  updatedAt: string
  pelaksana: { id: string; namaPelaksana: string }
}

export interface PenyusunWorkbenchLogEdit {
  id: string
  sopDetailId: string
  userId: string
  bagian: 'HEADER' | 'LANGKAH' | 'STATUS'
  keterangan?: string | null
  meta?: { fields: string[]; count: number } | null
  createdAt: string
  closedAt?: string | null
  user?: { id: string; nama: string; email: string }
}

export interface DiagramEdgeOverrideDto {
  dariLangkahSopId: string
  keLangkahSopId: string
  cabang: 'UTAMA' | 'YA' | 'TIDAK'
  sSide: 'top' | 'bottom' | 'left' | 'right'
  eSide: 'top' | 'bottom' | 'left' | 'right'
  startX: number
  startY: number
  endX: number
  endY: number
  titikTekuk?: Array<{ urutan: number; x: number; y: number }>
}

export interface DiagramLabelOverrideDto {
  kunciLabel: string
  posisiX: number
  posisiY: number
}

export interface PenyusunWorkbenchDiagramItem {
  jenis: JenisDiagram
  layoutSeed: number
  overridePanah?: DiagramEdgeOverrideDto[]
  overrideLabel?: DiagramLabelOverrideDto[]
  pathOverrides?: Record<string, unknown> | null
}

export interface PenyusunWorkbenchResponse {
  detail: PenyusunWorkbenchDetail
  langkah: PenyusunWorkbenchLangkah[]
  logEdit: PenyusunWorkbenchLogEdit[]
  diagramKonfigurasi?: PenyusunWorkbenchDiagramItem[] | Partial<Record<JenisDiagram, PenyusunWorkbenchDiagramItem>>
}

export interface UpdateDetailSopStatusDto { status: StatusSOP }

export interface UpdateSopHeaderDto {
  judul?: string
  nomorSOP?: string
  namaLembaga?: string
  dasarHukumPeraturanIds?: string[]
  sopTerkaitDetailIds?: string[]
  lampiran?: {
    peringatan?: string[]
    kualifikasiPelaksanaan?: string[]
    peralatanPerlengkapan?: string[]
    pencatatanPendataan?: string[]
  }
}

export interface UpdateSopProsedurDto {
  pelaksana?: Array<{ pelaksanaId: string }>
  langkah?: Array<{
    tempId: string
    jenis: JenisLangkahProsedur
    kegiatan: string
    kelengkapan?: string
    keluaran?: string
    waktu?: number
    satuanWaktu?: SatuanWaktu
    keterangan?: string
    pelaksanaId?: string | null
    langkahSelanjutnyaYaTempId?: string | null
    langkahSelanjutnyaTidakTempId?: string | null
  }>
}

export interface UpdateSopDiagramDto {
  jenis: JenisDiagram
  layoutSeed?: number
  pathOverrides?: Record<string, unknown> | null
}

export interface SopRiwayatVersiRow {
  detailSopId: string
  versi: number
  nomorSOP: string
  status: StatusSOP
  statusLabel: string
  revisiDariDetailSopId: string | null
  revisiDariVersi: number | null
  updatedAt: string
  canHapusDraft: boolean
  canBuatVersiBaru: boolean
}
