import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { CommonModule } from './common/common.module';
import { WinstonLoggerConfig } from './common/logger/winston.config';
import { PrismaModule } from './common/prisma/prisma.module';
import { validateEnv } from './config/env.validation';
import { AuthModule } from './modules/core/auth/auth.module';
import { PeraturanModule } from './modules/core/peraturan/peraturan.module';
import { SopAiDraftModule } from './modules/sop/ai-draft/sop-ai-draft.module';
import { SopAiReviewModule } from './modules/sop/ai-review/sop-ai-review.module';
import { SopCatalogModule } from './modules/sop/catalog/sop-catalog.module';
import { SopDiagramModule } from './modules/sop/diagram/sop-diagram.module';
import { PelaksanaModule } from './modules/sop/pelaksana/pelaksana.module';
import { SopProsedurModule } from './modules/sop/prosedur/sop-prosedur.module';
import { WorkspaceModule } from './modules/workspace/workspace.module';

@Module({
  imports: [
    CommonModule,
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: [
        '.env',
        `.env.${process.env.NODE_ENV ?? 'development'}`,
        `.env.${process.env.NODE_ENV ?? 'development'}.local`,
      ],
      validate: validateEnv,
    }),
    WinstonModule.forRoot(WinstonLoggerConfig),
    PrismaModule,
    AuthModule,
    WorkspaceModule,
    SopCatalogModule,
    SopAiDraftModule,
    SopAiReviewModule,
    SopProsedurModule,
    SopDiagramModule,
    PeraturanModule,
    PelaksanaModule,
  ],
})
export class AppModule {}
