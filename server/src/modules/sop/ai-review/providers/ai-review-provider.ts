import type { SopQualityReviewProviderInput } from '../sop-ai-review.types';

export const AI_REVIEW_PROVIDER = Symbol('AI_REVIEW_PROVIDER');

export interface AiReviewProvider {
  review(input: SopQualityReviewProviderInput): Promise<unknown>;
}
