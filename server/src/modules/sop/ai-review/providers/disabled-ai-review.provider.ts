import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { SopQualityReviewProviderInput } from '../sop-ai-review.types';
import type { AiReviewProvider } from './ai-review-provider';

@Injectable()
export class DisabledAiReviewProvider implements AiReviewProvider {
  async review(_input: SopQualityReviewProviderInput): Promise<never> {
    throw new ServiceUnavailableException('AI review belum tersedia');
  }
}
