import type { SopAiRevisionProviderInput } from '../sop-ai-revision.types';

export const AI_REVISION_PROVIDER = Symbol('AI_REVISION_PROVIDER');

export interface AiRevisionProvider {
  suggest(input: SopAiRevisionProviderInput): Promise<unknown>;
}
