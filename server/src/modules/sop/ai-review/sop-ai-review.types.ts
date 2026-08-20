export type SopProcedureStepKind = 'AWAL_AKHIR' | 'KEGIATAN' | 'KEPUTUSAN';
export type SopProcedureTimeUnit = 'm' | 'h' | 'd' | 'w' | 'mo' | 'y';

export type SopQualityFindingSeverity = 'ERROR' | 'WARNING' | 'SUGGESTION';
export type SopQualityReviewStatus = 'PERLU_PERBAIKAN' | 'CUKUP_BAIK' | 'SIAP_DIREVIEW';
export type SopQualityFindingCategory =
  | 'PROCESS_STRUCTURE'
  | 'ACTOR_RESPONSIBILITY'
  | 'INPUT_OUTPUT'
  | 'DECISION_ROUTING'
  | 'CLARITY'
  | 'SUPPORTING_FIELD'
  | 'TIME_PLAUSIBILITY'
  | 'COMPLETENESS';

export type SopQualityFindingLocation =
  | { kind: 'HEADER' }
  | { kind: 'PERINGATAN' }
  | { kind: 'KUALIFIKASI_PELAKSANAAN' }
  | { kind: 'PERALATAN_PERLENGKAPAN' }
  | { kind: 'PENCATATAN_PENDATAAN' }
  | { kind: 'ACTOR'; actorName: string }
  | { kind: 'STEP'; stepOrder: number };

export interface SopQualityFinding {
  severity: SopQualityFindingSeverity;
  category: SopQualityFindingCategory;
  location: SopQualityFindingLocation;
  title: string;
  explanation: string;
  recommendation: string;
}

export interface SopQualityReviewResult {
  status: SopQualityReviewStatus;
  summary: string;
  findings: SopQualityFinding[];
}

export interface SopQualityReviewSnapshotActor {
  pelaksanaId: string;
  name: string;
  order: number;
}

export interface SopQualityReviewSnapshotStep {
  langkahSopId: string;
  urutan: number;
  kegiatan: string;
  jenis: SopProcedureStepKind;
  kelengkapan: string;
  keluaran: string;
  waktu: number;
  satuanWaktu: SopProcedureTimeUnit;
  keterangan: string;
  actorName: string;
  targetYaUrutan: number | null;
  targetTidakUrutan: number | null;
}

export interface SopQualityReviewSnapshot {
  detailSopId: string;
  versi: number;
  judul: string;
  nomorSop: string;
  namaLembaga: string;
  peringatan: string[];
  kualifikasiPelaksanaan: string[];
  peralatanPerlengkapan: string[];
  pencatatanPendataan: string[];
  actors: SopQualityReviewSnapshotActor[];
  steps: SopQualityReviewSnapshotStep[];
}

export interface SopQualityReviewProviderActor {
  name: string;
  order: number;
}

export type SopQualityReviewProviderStep = Omit<SopQualityReviewSnapshotStep, 'langkahSopId'>;

export interface SopQualityReviewProviderInput {
  versi: number;
  judul: string;
  nomorSop: string;
  namaLembaga: string;
  peringatan: string[];
  kualifikasiPelaksanaan: string[];
  peralatanPerlengkapan: string[];
  pencatatanPendataan: string[];
  actors: SopQualityReviewProviderActor[];
  steps: SopQualityReviewProviderStep[];
}
