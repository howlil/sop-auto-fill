import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { CommonModule } from './common/common.module';
import { WinstonLoggerConfig } from './common/logger/winston.config';
import { PrismaModule } from './common/prisma/prisma.module';
import { validateEnv } from './config/env.validation';
import { AuthModule } from './modules/core/auth/auth.module';
import { EvaluatorModule } from './modules/core/evaluator/evaluator.module';
import { KepalaOpdModule } from './modules/core/kepala-opd/kepala-opd.module';
import { OpdModule } from './modules/core/opd/opd.module';
import { PenggunaModule } from './modules/core/pengguna/pengguna.module';
import { PenyusunModule } from './modules/core/penyusun/penyusun.module';
import { PeraturanModule } from './modules/core/peraturan/peraturan.module';
import { EvaluasiGrafikModule } from './modules/evaluation/grafik/evaluasi-grafik.module';
import { EvaluasiNilaiModule } from './modules/evaluation/nilai/evaluasi-nilai.module';
import { EvaluasiUmpanBalikModule } from './modules/evaluation/umpan-balik/evaluasi-umpan-balik.module';
import { EvaluasiWorkspaceModule } from './modules/evaluation/workspace/evaluasi-workspace.module';
import { PengajuanEvaluasiDetailModule } from './modules/evaluation/pengajuan-detail/pengajuan-evaluasi-detail.module';
import { PengajuanEvaluasiModule } from './modules/evaluation/pengajuan/pengajuan-evaluasi.module';
import { SopCatalogModule } from './modules/sop/catalog/sop-catalog.module';
import { SopProsedurModule } from './modules/sop/prosedur/sop-prosedur.module';
import { SopDiagramModule } from './modules/sop/diagram/sop-diagram.module';
import { SopPublicModule } from './modules/sop/public/sop-public.module';
import { PelaksanaModule } from './modules/sop/pelaksana/pelaksana.module';
import { TteSharedModule } from './modules/tte/shared/tte-shared.module';
import { TteProfilModule } from './modules/tte/profil/tte-profil.module';
import { TtePenandatangananModule } from './modules/tte/penandatanganan/tte-penandatanganan.module';
import { TteVerifikasiModule } from './modules/tte/verifikasi/tte-verifikasi.module';
import { TteCoreModule } from './modules/tte/core/tte-core.module';
import { NotificationModule } from './modules/notifications/reminders/notification.module';

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
    OpdModule,
    PenggunaModule,
    EvaluatorModule,
    KepalaOpdModule,
    PenyusunModule,
    SopCatalogModule,
    SopPublicModule,
    SopProsedurModule,
    SopDiagramModule,
    PeraturanModule,
    PelaksanaModule,
    EvaluasiNilaiModule,
    PengajuanEvaluasiModule,
    PengajuanEvaluasiDetailModule,
    EvaluasiWorkspaceModule,
    EvaluasiUmpanBalikModule,
    EvaluasiGrafikModule,
    TteSharedModule,
    TteProfilModule,
    TtePenandatangananModule,
    TteVerifikasiModule,
    TteCoreModule,
    NotificationModule,
  ],
})
export class AppModule {}
