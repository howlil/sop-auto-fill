import { Module } from '@nestjs/common';
import { TteCredentialRepository } from './repository/tte-credential.repository';
import { TteRepository } from './repository/tte.repository';
import { TtePublicUrlResolver } from './utils/tte-public-url.resolver';

@Module({
  providers: [TteRepository, TteCredentialRepository, TtePublicUrlResolver],
  exports: [TteRepository, TteCredentialRepository, TtePublicUrlResolver],
})
export class TteSharedModule {}
