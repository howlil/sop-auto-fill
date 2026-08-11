import { Module } from '@nestjs/common';
import { PenggunaRepository } from './pengguna.repository';

@Module({
  providers: [PenggunaRepository],
  exports: [PenggunaRepository],
})
export class PenggunaModule {}
