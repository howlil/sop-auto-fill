import { Module } from '@nestjs/common';
import { AuthModule } from '../../core/auth/auth.module';
import { OpdModule } from '../../core/opd/opd.module';
import { SopCatalogModule } from '../catalog/sop-catalog.module';
import { SopProsedurController } from './sop-prosedur.controller';
import { SopProsedurRepository } from './sop-prosedur.repository';
import { SopProsedurService } from './sop-prosedur.service';

@Module({
  imports: [AuthModule, OpdModule, SopCatalogModule],
  controllers: [SopProsedurController],
  providers: [SopProsedurService, SopProsedurRepository],
})
export class SopProsedurModule {}
