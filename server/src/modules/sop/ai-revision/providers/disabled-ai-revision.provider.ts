import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { AiRevisionProvider } from './ai-revision-provider';
import type { SopAiRevisionProviderInput } from '../sop-ai-revision.types';

@Injectable()
export class DisabledAiRevisionProvider implements AiRevisionProvider {
  async suggest(_input: SopAiRevisionProviderInput): Promise<unknown> {
    throw new ServiceUnavailableException('AI revision belum tersedia');
  }
}
