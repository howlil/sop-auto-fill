import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../../core/auth/auth.module';
import { SopAiSnapshotRepository } from '../ai-common/sop-ai-snapshot.repository';
import { AI_REVIEW_PROVIDER } from './providers/ai-review-provider';
import { DisabledAiReviewProvider } from './providers/disabled-ai-review.provider';
import { FakeAiReviewProvider } from './providers/fake-ai-review.provider';
import { OpenAiReviewProvider } from './providers/openai-ai-review.provider';
import { SopAiReviewController } from './sop-ai-review.controller';
import { SopAiReviewService } from './sop-ai-review.service';

@Module({
  imports: [AuthModule],
  controllers: [SopAiReviewController],
  providers: [
    SopAiSnapshotRepository,
    SopAiReviewService,
    DisabledAiReviewProvider,
    FakeAiReviewProvider,
    OpenAiReviewProvider,
    {
      provide: AI_REVIEW_PROVIDER,
      inject: [ConfigService, DisabledAiReviewProvider, FakeAiReviewProvider, OpenAiReviewProvider],
      useFactory: (
        config: ConfigService,
        disabled: DisabledAiReviewProvider,
        fake: FakeAiReviewProvider,
        openai: OpenAiReviewProvider,
      ) => {
        const mode = config.get<string>('AI_REVIEW_PROVIDER') ?? 'disabled';
        if (mode === 'fake') return fake;
        if (mode === 'openai') return openai;
        return disabled;
      },
    },
  ],
})
export class SopAiReviewModule {}
