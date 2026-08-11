import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OpdController } from './opd.controller';
import { OpdRepository } from './opd.repository';
import { OpdService } from './opd.service';
import { UserOpdAccessService } from './user-opd-access.service';

@Module({
  imports: [AuthModule],
  controllers: [OpdController],
  providers: [OpdService, OpdRepository, UserOpdAccessService],
  exports: [OpdService, OpdRepository, UserOpdAccessService],
})
export class OpdModule {}
