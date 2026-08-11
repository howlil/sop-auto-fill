import type {
  JenisLangkahProsedur,
  LangkahSOP,
  PenyusunWorkbenchData,
  PenyusunWorkbenchDiagramKonfigurasi,
  SopDetail,
} from "@/types/dto/sop.dto";
import type { ProsedurRow, SOPDetailMetadata } from "@/types/ui/sop";
import { SOP_INSTITUTION_LOGO_URL } from "@/lib/sop/sop-institution-logo";

const API_JENIS_TO_ROW_TYPE: Record<JenisLangkahProsedur, ProsedurRow["type"]> = {
  AWAL_AKHIR: "terminator",
  KEGIATAN: "task",
  KEPUTUSAN: "decision",
};

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

/** Memecah `namaLembaga` API (boleh multi-baris) jadi maks. 4 baris untuk header SOP. */
export function namaLembagaToInstitutionLines(namaLembaga: string | undefined | null): string[] {
  if (namaLembaga == null || namaLembaga.trim() === "") {
    return [];
  }
  return namaLembaga
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 4);
}

/** Transform API SopDetail -> UI SOPDetailMetadata */
export function transformSopDetailToMetadata(detail: SopDetail): SOPDetailMetadata {
  const lines = namaLembagaToInstitutionLines(detail.namaLembaga);
  const lawBasisIds =
    detail.dasarHukumPeraturanIds ??
    detail.dasarHukum?.map((d) => d.id.includes("-") ? d.id.split("-").slice(-1)[0] : d.id) ??
    [];
  const lawBasisLabels =
    detail.dasarHukum?.map((d) => `${d.nomor}/${d.tahun} tentang ${d.judul}`) ?? [];
  const relatedSopDetailIds =
    detail.sopTerkaitDetailIds ??
    detail.relasiSopKeluar?.map((rel) => rel.sopTerkaitId) ??
    [];
  const relatedSopLabels =
    detail.relasiSopKeluar
      ?.map((rel) => {
        const nested = rel.sopTerkait as { sop?: { judul?: string } } | undefined;
        return nested?.sop?.judul ?? "";
      })
      .filter((j) => j.length > 0) ?? [];
  return {
    id: detail.id,
    sopId: detail.sopId,
    nomorSOP: detail.nomorSOP,
    nama: detail.sop?.judul ?? "",
    judul: detail.sop?.judul,
    lembaga: detail.namaLembaga,
    institutionLines: lines.length > 0 ? lines : undefined,
    logoUrl: SOP_INSTITUTION_LOGO_URL,
    tanggalPembuatan: detail.tanggalPembuatan,
    tanggalEfektif: detail.tanggalEfektif ?? "",
    tanggalRevisi: detail.tanggalRevisi ?? "",
    version: detail.versi,
    revisiDariDetailSopId: detail.revisiDariDetailSopId ?? null,
    revisiDariVersi: detail.revisiDariVersi ?? null,
    picName: detail.kepalaOpd?.nama?.trim() ?? "",
    picNumber: detail.kepalaOpd?.nip?.trim() ?? "",
    lawBasis: lawBasisLabels,
    lawBasisIds,
    relatedSop: relatedSopLabels,
    relatedSopDetailIds,
    warning: (detail.lampiran?.peringatan ?? []).map((i) => i.teks),
    implementQualification: (detail.lampiran?.kualifikasiPelaksanaan ?? []).map((i) => i.teks),
    equipment: (detail.lampiran?.peralatanPerlengkapan ?? []).map((i) => i.teks),
    recordData: (detail.lampiran?.pencatatanPendataan ?? []).map((i) => i.teks),
  };
}

/** Transform API LangkahSOP -> UI ProsedurRow */
export function transformLangkahToProsedurRow(langkah: LangkahSOP): ProsedurRow {
  const waktu = Number.isFinite(langkah.waktu) ? Math.max(0, langkah.waktu) : 0
  const satuanWaktu = langkah.satuanWaktu
  const satuanLabel = satuanWaktuToLabel(satuanWaktu)
  const mutuWaktu = waktu > 0 ? `${waktu} ${satuanLabel}` : ''
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
    mutu_waktu: mutuWaktu,
    kelengkapan: langkah.kelengkapan,
    mutu_kelengkapan: langkah.kelengkapan,
    keluaran: langkah.keluaran,
    output: langkah.keluaran,
    type: API_JENIS_TO_ROW_TYPE[langkah.jenis] ?? "task",
    id_next_step_if_yes: langkah.langkahSelanjutnyaYaId ?? undefined,
    id_next_step_if_no: langkah.langkahSelanjutnyaTidakId ?? undefined,
    keterangan: langkah.keterangan ?? "",
    pelaksanaMapping: langkah.pelaksanaId ? { [langkah.pelaksanaId]: '√' } : {},
  };
}

/** Memetakan payload workbench API ke props pratinjau dokumen (SOPPreviewTemplate). */
export function mapPenyusunWorkbenchToPreviewProps(data: PenyusunWorkbenchData): {
  metadata: SOPDetailMetadata;
  prosedurRows: ProsedurRow[];
  implementers: { id: string; name: string }[];
  name?: string;
  number?: string;
  diagramKonfigurasi?: PenyusunWorkbenchDiagramKonfigurasi;
} {
  const detail = data.detail as SopDetail;
  const metadata = transformSopDetailToMetadata(detail);
  const prosedurRows = data.langkah.map((step) =>
    transformLangkahToProsedurRow(step as LangkahSOP),
  );
  const lanes = [...(detail.swimlanes ?? [])].sort((a, b) => a.urutan - b.urutan);
  const implementers = lanes.map((lane) => ({
    id: lane.pelaksanaId,
    name: lane.pelaksana?.namaPelaksana ?? lane.pelaksanaId,
  }));
  return {
    name: detail.sop?.judul,
    number: detail.nomorSOP,
    metadata,
    prosedurRows,
    implementers,
    diagramKonfigurasi: data.diagramKonfigurasi,
  };
}
