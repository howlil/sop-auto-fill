import { Module } from '@nestjs/common';
import { AuthModule } from '../../core/auth/auth.module';
import { OpdModule } from '../../core/opd/opd.module';
import { SopCatalogModule } from '../../sop/catalog/sop-catalog.module';
import { PengajuanEvaluasiModule } from '../pengajuan/pengajuan-evaluasi.module';
import { PengajuanEvaluasiDetailController } from './pengajuan-evaluasi-detail.controller';
import { PengajuanEvaluasiDetailRepository } from './pengajuan-evaluasi-detail.repository';
import { PengajuanEvaluasiDetailService } from './pengajuan-evaluasi-detail.service';

@Module({
  imports: [AuthModule, OpdModule, PengajuanEvaluasiModule, SopCatalogModule],
  controllers: [PengajuanEvaluasiDetailController],
  providers: [PengajuanEvaluasiDetailService, PengajuanEvaluasiDetailRepository],
})
export class PengajuanEvaluasiDetailModule {}
