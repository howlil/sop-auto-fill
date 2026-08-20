import type {
  SopAiProcedureStepKind,
  SopAiProcedureTimeUnit,
  SopAiSnapshot,
  SopAiSnapshotActor,
  SopAiSnapshotStep,
} from '../ai-common/sop-ai-snapshot.types';

export type SopProcedureStepKind = SopAiProcedureStepKind;
export type SopProcedureTimeUnit = SopAiProcedureTimeUnit;

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

export type SopQualityReviewSnapshotActor = SopAiSnapshotActor;
export type SopQualityReviewSnapshotStep = SopAiSnapshotStep;
export type SopQualityReviewSnapshot = SopAiSnapshot;

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
