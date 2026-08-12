import { Module } from '@nestjs/common';
import { AuthModule } from '../../core/auth/auth.module';
import { WorkspaceModule } from '../../workspace/workspace.module';
import { SopCatalogModule } from '../catalog/sop-catalog.module';
import { SopProsedurController } from './sop-prosedur.controller';
import { SopProsedurRepository } from './sop-prosedur.repository';
import { SopProsedurService } from './sop-prosedur.service';

@Module({
  imports: [AuthModule, WorkspaceModule, SopCatalogModule],
  controllers: [SopProsedurController],
  providers: [SopProsedurService, SopProsedurRepository],
})
export class SopProsedurModule {}
