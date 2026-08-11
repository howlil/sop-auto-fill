import { Module } from '@nestjs/common';
import { TteSharedModule } from '../shared/tte-shared.module';
import { TteProfilService } from './tte-profil.service';

@Module({
  imports: [TteSharedModule],
  providers: [TteProfilService],
  exports: [TteProfilService],
})
export class TteProfilModule {}
