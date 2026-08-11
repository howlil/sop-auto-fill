import { Module } from '@nestjs/common';
import { AuthModule } from '../../core/auth/auth.module';
import { EvaluasiNilaiModule } from '../nilai/evaluasi-nilai.module';
import { PengajuanEvaluasiModule } from '../pengajuan/pengajuan-evaluasi.module';
import { EvaluasiUmpanBalikController } from './evaluasi-umpan-balik.controller';
import { EvaluasiUmpanBalikService } from './evaluasi-umpan-balik.service';

@Module({
  imports: [AuthModule, EvaluasiNilaiModule, PengajuanEvaluasiModule],
  controllers: [EvaluasiUmpanBalikController],
  providers: [EvaluasiUmpanBalikService],
})
export class EvaluasiUmpanBalikModule {}
