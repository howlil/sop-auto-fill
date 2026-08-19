import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../../core/auth/auth.module';
import { WorkspaceModule } from '../../workspace/workspace.module';
import { SopCatalogModule } from '../catalog/sop-catalog.module';
import { AI_DRAFT_PROVIDER } from './providers/ai-draft-provider';
import { DisabledAiDraftProvider } from './providers/disabled-ai-draft.provider';
import { FakeAiDraftProvider } from './providers/fake-ai-draft.provider';
import { SopAiDraftController } from './sop-ai-draft.controller';
import { SopAiDraftRepository } from './sop-ai-draft.repository';
import { SopAiDraftService } from './sop-ai-draft.service';

@Module({
  imports: [AuthModule, WorkspaceModule, SopCatalogModule],
  controllers: [SopAiDraftController],
  providers: [
    SopAiDraftRepository,
    SopAiDraftService,
    DisabledAiDraftProvider,
    FakeAiDraftProvider,
    {
      provide: AI_DRAFT_PROVIDER,
      inject: [ConfigService, DisabledAiDraftProvider, FakeAiDraftProvider],
      useFactory: (
        config: ConfigService,
        disabled: DisabledAiDraftProvider,
        fake: FakeAiDraftProvider,
      ) => (config.get<string>('AI_DRAFT_PROVIDER') === 'fake' ? fake : disabled),
    },
  ],
})
export class SopAiDraftModule {}
