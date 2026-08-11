import { Module } from '@nestjs/common';
import { AuthModule } from '../../core/auth/auth.module';
import { OpdModule } from '../../core/opd/opd.module';
import { SopCatalogModule } from '../../sop/catalog/sop-catalog.module';
import { PengajuanEvaluasiModule } from '../pengajuan/pengajuan-evaluasi.module';
import { EvaluasiWorkspaceController } from './evaluasi-workspace.controller';
import { EvaluasiWorkspaceRepository } from './evaluasi-workspace.repository';
import { EvaluasiWorkspaceService } from './evaluasi-workspace.service';

@Module({
  imports: [AuthModule, OpdModule, PengajuanEvaluasiModule, SopCatalogModule],
  controllers: [EvaluasiWorkspaceController],
  providers: [EvaluasiWorkspaceService, EvaluasiWorkspaceRepository],
})
export class EvaluasiWorkspaceModule {}
