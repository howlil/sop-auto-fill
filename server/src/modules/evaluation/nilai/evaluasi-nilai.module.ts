import { Module } from '@nestjs/common';
import { AuthModule } from '../../core/auth/auth.module';
import { OpdModule } from '../../core/opd/opd.module';
import { PengajuanEvaluasiModule } from '../pengajuan/pengajuan-evaluasi.module';
import { EvaluasiNilaiController } from './evaluasi-nilai.controller';
import { EvaluasiNilaiRepository } from './evaluasi-nilai.repository';
import { EvaluasiNilaiService } from './evaluasi-nilai.service';

@Module({
  imports: [AuthModule, OpdModule, PengajuanEvaluasiModule],
  controllers: [EvaluasiNilaiController],
  providers: [EvaluasiNilaiService, EvaluasiNilaiRepository],
  exports: [EvaluasiNilaiService],
})
export class EvaluasiNilaiModule {}
