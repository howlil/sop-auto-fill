import type {
  SopAiProcedureStepKind,
  SopAiProcedureTimeUnit,
} from '../ai-common/sop-ai-snapshot.types';
import type { SopQualityFinding } from '../ai-review/sop-ai-review.types';

export type SopAiRevisionTarget =
  | { kind: 'HEADER'; field: 'JUDUL' }
  | { kind: 'PERINGATAN'; itemIndex: number }
  | {
      kind: 'STEP';
      stepOrder: number;
      field: 'KEGIATAN' | 'KELENGKAPAN' | 'KELUARAN' | 'KETERANGAN';
    };

export interface AiRevisionProviderResult {
  target: SopAiRevisionTarget;
  after: string;
  rationale: string;
}

export interface SopAiRevisionSuggestion extends AiRevisionProviderResult {
  before: string;
}

export interface SuggestAiRevisionRequest {
  finding: SopQualityFinding;
}

export interface SopAiRevisionProviderStep {
  urutan: number;
  kegiatan: string;
  jenis: SopAiProcedureStepKind;
  kelengkapan: string;
  keluaran: string;
  waktu: number;
  satuanWaktu: SopAiProcedureTimeUnit;
  keterangan: string;
  actorName: string;
  targetYaUrutan: number | null;
  targetTidakUrutan: number | null;
}

export interface SopAiRevisionProviderInput {
  versi: number;
  judul: string;
  peringatan: string[];
  actors: Array<{ name: string; order: number }>;
  steps: SopAiRevisionProviderStep[];
  finding: SopQualityFinding;
  allowedTargets: SopAiRevisionTarget[];
}

export interface SuggestAiRevisionResponse {
  sourceDetailSopId: string;
  sourceVersion: number;
  suggestion: SopAiRevisionSuggestion;
}
