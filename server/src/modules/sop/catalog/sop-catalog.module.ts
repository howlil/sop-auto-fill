import { Module } from '@nestjs/common';
import { AuthModule } from '../../core/auth/auth.module';
import { WorkspaceModule } from '../../workspace/workspace.module';
import { SopTemplateController } from '../template/sop-template.controller';
import { SopTemplateRepository } from '../template/sop-template.repository';
import { SopTemplateService } from '../template/sop-template.service';
import { SopCatalogController } from './sop-catalog.controller';
import { SopCatalogRepository } from './sop-catalog.repository';
import { SopCatalogService } from './sop-catalog.service';

@Module({
  imports: [AuthModule, WorkspaceModule],
  controllers: [SopCatalogController, SopTemplateController],
  providers: [
    SopCatalogService,
    SopCatalogRepository,
    SopTemplateService,
    SopTemplateRepository,
  ],
  exports: [SopCatalogService, SopCatalogRepository],
})
export class SopCatalogModule {}
