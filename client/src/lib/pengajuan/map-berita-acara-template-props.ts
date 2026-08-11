import type { BeritaAcaraTemplateProps } from '@/components/pengajuan/berita-acara-template'
import type { BeritaAcaraEvaluasiView } from '@/types/dto/evaluasi.dto'

export interface MapBeritaAcaraPengajuanInput {
  opdNama?: string | null
  nomorBA?: string | null
  tanggalVerifikasi?: string | null
  namaPjEvaluator?: string | null
  namaPjPenyusun?: string | null
  nilaiOPD?: number | null
  opd?: { nama?: string } | null
}

export interface MapBeritaAcaraTemplateInput {
  pengajuan: MapBeritaAcaraPengajuanInput
  baView?: BeritaAcaraEvaluasiView | null
  overrides?: Partial<BeritaAcaraTemplateProps>
}

export function mapBeritaAcaraTemplateProps({
  pengajuan,
  baView,
  overrides,
}: MapBeritaAcaraTemplateInput): BeritaAcaraTemplateProps {
  const base: BeritaAcaraTemplateProps = {
    forPrint: true,
    opd: baView?.namaOpd ?? pengajuan.opdNama ?? pengajuan.opd?.nama ?? '',
    nomorBA: baView?.nomorBA ?? pengajuan.nomorBA ?? undefined,
    tanggalVerifikasi:
      baView?.tanggalVerifikasiPjEvaluator ?? pengajuan.tanggalVerifikasi ?? undefined,
    namaBiro:
      pengajuan.namaPjEvaluator ?? baView?.timEvaluasi.penanggungJawabSelesai?.nama ?? undefined,
    namaPjPenyusun: pengajuan.namaPjPenyusun ?? 'PJ Penyusun OPD',
    ringkasanHasilPerSop: baView?.hasilPerSop ?? undefined,
    nilaiKeseluruhanOpd: baView?.nilaiKeseluruhanOpd ?? pengajuan.nilaiOPD ?? undefined,
    tteSignaturePayloadPjEvaluator: baView?.tteBeritaAcara?.payloadPjEvaluator ?? undefined,
    tteSignaturePayloadPjPenyusun: baView?.tteBeritaAcara?.payloadPjPenyusun ?? undefined,
  }
  return {
    ...base,
    ...overrides,
    forPrint: overrides?.forPrint ?? base.forPrint,
  }
}
