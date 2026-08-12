import type {
  JenisLangkahProsedur,
  PenyusunWorkbenchDiagramItem,
  PenyusunWorkbenchLangkah,
  PenyusunWorkbenchResponse,
  PenyusunWorkbenchDetail,
} from '@/types/dto/sop.dto'
import type { ProsedurRow, SOPDetailMetadata } from '@/types/ui/sop'
import { SOP_INSTITUTION_LOGO_URL } from '@/lib/sop/sop-institution-logo'

const API_JENIS_TO_ROW_TYPE: Record<JenisLangkahProsedur, ProsedurRow['type']> = {
  AWAL_AKHIR: 'terminator',
  KEGIATAN: 'task',
  KEPUTUSAN: 'decision',
}

function satuanWaktuToLabel(unit: string): string {
  const map: Record<string, string> = {
    h: 'Jam',
    m: 'Menit',
    d: 'Hari',
    w: 'Minggu',
    mo: 'Bulan',
    y: 'Tahun',
  }
  return map[unit] ?? unit
}

export function namaLembagaToInstitutionLines(namaLembaga: string | undefined | null): string[] {
  if (namaLembaga == null || namaLembaga.trim() === '') return []
  return namaLembaga
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4)
}

export function transformSopDetailToMetadata(detail: PenyusunWorkbenchDetail): SOPDetailMetadata {
  const lines = namaLembagaToInstitutionLines(detail.namaLembaga)
  const lawBasisIds =
    detail.dasarHukumPeraturanIds ?? detail.dasarHukum?.map((item) => item.peraturanId) ?? []
  const lawBasisLabels =
    detail.dasarHukum?.map((item) => `${item.nomor}/${item.tahun} tentang ${item.judul}`) ?? []
  const relatedSopDetailIds =
    detail.sopTerkaitDetailIds ?? detail.relasiSopKeluar?.map((rel) => rel.sopTerkaitId) ?? []
  const relatedSopLabels =
    detail.relasiSopKeluar
      ?.map((rel) => rel.sopTerkait?.sop.judul ?? '')
      .filter(Boolean) ?? []

  return {
    id: detail.id,
    sopId: detail.sopId,
    nomorSOP: detail.nomorSOP,
    nama: detail.sop?.judul ?? '',
    judul: detail.sop?.judul,
    lembaga: detail.namaLembaga,
    institutionLines: lines.length > 0 ? lines : undefined,
    logoUrl: SOP_INSTITUTION_LOGO_URL,
    tanggalPembuatan: detail.tanggalPembuatan,
    tanggalEfektif: detail.tanggalEfektif ?? '',
    tanggalRevisi: detail.tanggalRevisi ?? '',
    version: detail.versi,
    revisiDariDetailSopId: detail.revisiDariDetailSopId ?? null,
    revisiDariVersi: detail.revisiDariVersi ?? null,
    picName: '',
    picNumber: '',
    lawBasis: lawBasisLabels,
    lawBasisIds,
    relatedSop: relatedSopLabels,
    relatedSopDetailIds,
    warning: (detail.lampiran?.peringatan ?? []).map((item) => item.teks),
    implementQualification: (detail.lampiran?.kualifikasiPelaksanaan ?? []).map((item) => item.teks),
    equipment: (detail.lampiran?.peralatanPerlengkapan ?? []).map((item) => item.teks),
    recordData: (detail.lampiran?.pencatatanPendataan ?? []).map((item) => item.teks),
  }
}

export function transformLangkahToProsedurRow(langkah: PenyusunWorkbenchLangkah): ProsedurRow {
  const waktu = Number.isFinite(langkah.waktu) ? Math.max(0, langkah.waktu) : 0
  const satuanWaktu = String(langkah.satuanWaktu)
  const satuanLabel = satuanWaktuToLabel(satuanWaktu)
  return {
    id: langkah.id,
    urutan: langkah.urutan,
    no: langkah.urutan,
    kegiatan: langkah.kegiatan,
    pelaksana: langkah.pelaksanaId,
    waktu,
    time: waktu,
    satuanWaktu,
    time_unit: satuanWaktu,
    mutu_waktu: waktu > 0 ? `${waktu} ${satuanLabel}` : '',
    kelengkapan: langkah.kelengkapan,
    mutu_kelengkapan: langkah.kelengkapan,
    keluaran: langkah.keluaran,
    output: langkah.keluaran,
    type: API_JENIS_TO_ROW_TYPE[langkah.jenis as JenisLangkahProsedur] ?? 'task',
    id_next_step_if_yes: langkah.langkahSelanjutnyaYaId ?? undefined,
    id_next_step_if_no: langkah.langkahSelanjutnyaTidakId ?? undefined,
    keterangan: langkah.keterangan ?? '',
    pelaksanaMapping: langkah.pelaksanaId ? { [langkah.pelaksanaId]: '√' } : {},
  }
}

export function mapPenyusunWorkbenchToPreviewProps(data: PenyusunWorkbenchResponse): {
  metadata: SOPDetailMetadata
  prosedurRows: ProsedurRow[]
  implementers: { id: string; name: string }[]
  name?: string
  number?: string
  diagramKonfigurasi?: PenyusunWorkbenchResponse['diagramKonfigurasi']
} {
  const detail = data.detail
  const metadata = transformSopDetailToMetadata(detail)
  const prosedurRows = data.langkah.map(transformLangkahToProsedurRow)
  const lanes = [...(detail.swimlanes ?? [])].sort((a, b) => a.urutan - b.urutan)
  const implementers = lanes.map((lane) => ({
    id: lane.pelaksanaId,
    name: lane.pelaksana?.namaPelaksana ?? lane.pelaksanaId,
  }))
  return {
    name: detail.sop?.judul,
    number: detail.nomorSOP,
    metadata,
    prosedurRows,
    implementers,
    diagramKonfigurasi: data.diagramKonfigurasi as PenyusunWorkbenchDiagramItem[] | undefined,
  }
}
