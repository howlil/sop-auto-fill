import { Module } from '@nestjs/common';
import { TteSharedModule } from '../shared/tte-shared.module';
import { TteVerifikasiService } from './tte-verifikasi.service';

@Module({
  imports: [TteSharedModule],
  providers: [TteVerifikasiService],
  exports: [TteVerifikasiService],
})
export class TteVerifikasiModule {}
