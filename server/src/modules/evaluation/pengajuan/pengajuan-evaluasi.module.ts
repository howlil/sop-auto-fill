import { Module } from '@nestjs/common';
import { AuthModule } from '../../core/auth/auth.module';
import { OpdModule } from '../../core/opd/opd.module';
import { PengajuanEvaluasiController } from './pengajuan-evaluasi.controller';
import { PengajuanEvaluasiRepository } from './pengajuan-evaluasi.repository';
import { PengajuanEvaluasiService } from './pengajuan-evaluasi.service';

@Module({
  imports: [AuthModule, OpdModule],
  controllers: [PengajuanEvaluasiController],
  providers: [PengajuanEvaluasiService, PengajuanEvaluasiRepository],
  exports: [PengajuanEvaluasiService, PengajuanEvaluasiRepository],
})
export class PengajuanEvaluasiModule {}
