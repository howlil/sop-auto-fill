import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { AiDraftProvider } from './ai-draft-provider';
import type { AiDraftGenerationInput, AiDraftProviderOutput } from '../sop-ai-draft.types';

@Injectable()
export class DisabledAiDraftProvider implements AiDraftProvider {
  async generate(_input: AiDraftGenerationInput): Promise<AiDraftProviderOutput> {
    throw new ServiceUnavailableException('AI drafting belum tersedia');
  }
}
