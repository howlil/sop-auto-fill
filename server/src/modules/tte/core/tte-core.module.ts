import { Module } from '@nestjs/common';
import { TteSharedModule } from '../shared/tte-shared.module';
import { TteProfilModule } from '../profil/tte-profil.module';
import { TtePenandatangananModule } from '../penandatanganan/tte-penandatanganan.module';
import { TteVerifikasiModule } from '../verifikasi/tte-verifikasi.module';
import { TteController } from './tte.controller';
import { TtePublicController } from './tte-public.controller';
import { TteService } from './tte.service';

@Module({
  imports: [TteSharedModule, TteProfilModule, TtePenandatangananModule, TteVerifikasiModule],
  controllers: [TteController, TtePublicController],
  providers: [TteService],
  exports: [TteService],
})
export class TteCoreModule {}
