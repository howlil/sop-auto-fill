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
