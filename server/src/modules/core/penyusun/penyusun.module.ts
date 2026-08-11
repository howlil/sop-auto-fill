import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PenggunaModule } from '../pengguna/pengguna.module';
import { PenyusunController } from './penyusun.controller';
import { PenyusunRepository } from './penyusun.repository';
import { PenyusunService } from './penyusun.service';

@Module({
  imports: [AuthModule, PenggunaModule],
  controllers: [PenyusunController],
  providers: [PenyusunService, PenyusunRepository],
  exports: [PenyusunService, PenyusunRepository],
})
export class PenyusunModule {}
