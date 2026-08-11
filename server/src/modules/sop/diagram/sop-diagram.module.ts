import { Module } from '@nestjs/common';
import { AuthModule } from '../../core/auth/auth.module';
import { OpdModule } from '../../core/opd/opd.module';
import { SopCatalogModule } from '../catalog/sop-catalog.module';
import { SopDiagramController } from './sop-diagram.controller';
import { SopDiagramRepository } from './sop-diagram.repository';
import { SopDiagramService } from './sop-diagram.service';

@Module({
  imports: [AuthModule, OpdModule, SopCatalogModule],
  controllers: [SopDiagramController],
  providers: [SopDiagramService, SopDiagramRepository],
  exports: [SopDiagramRepository],
})
export class SopDiagramModule {}
