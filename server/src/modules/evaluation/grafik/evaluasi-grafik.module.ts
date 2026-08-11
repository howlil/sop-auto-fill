import { Module } from '@nestjs/common';
import { AuthModule } from '../../core/auth/auth.module';
import { OpdModule } from '../../core/opd/opd.module';
import { EvaluasiGrafikController } from './evaluasi-grafik.controller';
import { EvaluasiGrafikRepository } from './evaluasi-grafik.repository';
import { EvaluasiGrafikService } from './evaluasi-grafik.service';

@Module({
  imports: [AuthModule, OpdModule],
  controllers: [EvaluasiGrafikController],
  providers: [EvaluasiGrafikService, EvaluasiGrafikRepository],
})
export class EvaluasiGrafikModule {}
