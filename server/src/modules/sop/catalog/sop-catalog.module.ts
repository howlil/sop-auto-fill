import { Module } from '@nestjs/common';
import { AuthModule } from '../../core/auth/auth.module';
import { WorkspaceModule } from '../../workspace/workspace.module';
import { SopCatalogController } from './sop-catalog.controller';
import { SopCatalogRepository } from './sop-catalog.repository';
import { SopCatalogService } from './sop-catalog.service';

@Module({
  imports: [AuthModule, WorkspaceModule],
  controllers: [SopCatalogController],
  providers: [SopCatalogService, SopCatalogRepository],
  exports: [SopCatalogService, SopCatalogRepository],
})
export class SopCatalogModule {}
