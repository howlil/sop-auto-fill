import type {
  AiDraftGenerationInput,
  AiDraftProviderOutput,
} from '../sop-ai-draft.types';

export const AI_DRAFT_PROVIDER = Symbol('AI_DRAFT_PROVIDER');

export interface AiDraftProvider {
  generate(input: AiDraftGenerationInput): Promise<AiDraftProviderOutput>;
}
