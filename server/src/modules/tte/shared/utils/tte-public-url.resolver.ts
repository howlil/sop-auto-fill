import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import {
  buildValidasiPengesahanBaseUrl,
  extractAppOriginFromRequest,
  resolvePublicAppOrigin,
} from './tte-public-origin.util';

@Injectable()
export class TtePublicUrlResolver {
  constructor(private readonly configService: ConfigService) {}

  resolveAppOrigin(req?: Pick<Request, 'headers'>): string | null {
    return resolvePublicAppOrigin({
      configOrigin: this.configService.get<string>('PUBLIC_APP_ORIGIN'),
      requestOrigin: req === undefined ? null : extractAppOriginFromRequest(req),
    });
  }

  resolvePengesahanVerifyBaseUrl(req?: Pick<Request, 'headers'>): string | undefined {
    const origin = this.resolveAppOrigin(req);
    if (origin === null) {
      return undefined;
    }
    return buildValidasiPengesahanBaseUrl(origin);
  }

  /** Basis URL root untuk path `/tte/verifikasi-dokumen/...` pada QR dokumen. */
  resolveDocumentVerifyBaseUrl(req?: Pick<Request, 'headers'>): string | undefined {
    const origin = this.resolveAppOrigin(req);
    return origin ?? undefined;
  }
}
