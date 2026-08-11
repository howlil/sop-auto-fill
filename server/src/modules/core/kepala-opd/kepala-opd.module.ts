import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PenggunaModule } from '../pengguna/pengguna.module';
import { KepalaOpdController } from './kepala-opd.controller';
import { KepalaOpdRepository } from './kepala-opd.repository';
import { KepalaOpdService } from './kepala-opd.service';

@Module({
  imports: [AuthModule, PenggunaModule],
  controllers: [KepalaOpdController],
  providers: [KepalaOpdService, KepalaOpdRepository],
  exports: [KepalaOpdService],
})
export class KepalaOpdModule {}
