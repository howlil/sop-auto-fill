import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../../core/auth/auth.module';
import { SopAiSnapshotRepository } from '../ai-common/sop-ai-snapshot.repository';
import { AI_REVISION_PROVIDER } from './providers/ai-revision-provider';
import { DisabledAiRevisionProvider } from './providers/disabled-ai-revision.provider';
import { FakeAiRevisionProvider } from './providers/fake-ai-revision.provider';
import { SopAiRevisionController } from './sop-ai-revision.controller';
import { SopAiRevisionService } from './sop-ai-revision.service';

@Module({
  imports: [AuthModule],
  controllers: [SopAiRevisionController],
  providers: [
    SopAiSnapshotRepository,
    SopAiRevisionService,
    DisabledAiRevisionProvider,
    FakeAiRevisionProvider,
    {
      provide: AI_REVISION_PROVIDER,
      inject: [ConfigService, DisabledAiRevisionProvider, FakeAiRevisionProvider],
      useFactory: (
        config: ConfigService,
        disabled: DisabledAiRevisionProvider,
        fake: FakeAiRevisionProvider,
      ) => {
        const mode = config.get<string>('AI_REVISION_PROVIDER') ?? 'disabled';
        if (mode === 'fake') return fake;
        return disabled;
      },
    },
  ],
})
export class SopAiRevisionModule {}
