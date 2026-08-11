import { Module } from '@nestjs/common';
import { AuthModule } from '../../core/auth/auth.module';
import { OpdModule } from '../../core/opd/opd.module';
import { EvaluasiNilaiModule } from '../../evaluation/nilai/evaluasi-nilai.module';
import { SopCatalogController } from './sop-catalog.controller';
import { SopCatalogRepository } from './sop-catalog.repository';
import { SopCatalogService } from './sop-catalog.service';

@Module({
  imports: [AuthModule, OpdModule, EvaluasiNilaiModule],
  controllers: [SopCatalogController],
  providers: [SopCatalogService, SopCatalogRepository],
  exports: [SopCatalogService, SopCatalogRepository],
})
export class SopCatalogModule {}
