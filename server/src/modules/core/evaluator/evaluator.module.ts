import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PenggunaModule } from '../pengguna/pengguna.module';
import { EvaluatorController } from './evaluator.controller';
import { EvaluatorService } from './evaluator.service';

@Module({
  imports: [AuthModule, PenggunaModule],
  controllers: [EvaluatorController],
  providers: [EvaluatorService],
  exports: [EvaluatorService],
})
export class EvaluatorModule {}
