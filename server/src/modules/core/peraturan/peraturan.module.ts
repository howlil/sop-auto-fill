import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OpdModule } from '../opd/opd.module';
import { PeraturanController } from './peraturan.controller';
import { PeraturanRepository } from './peraturan.repository';
import { PeraturanService } from './peraturan.service';

@Module({
  imports: [AuthModule, OpdModule],
  controllers: [PeraturanController],
  providers: [PeraturanService, PeraturanRepository],
})
export class PeraturanModule {}
