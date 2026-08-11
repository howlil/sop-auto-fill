import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { ACCESS_TOKEN_COOKIE_NAME, type JwtAccessPayload } from './auth.shared';
import { AuthRepository } from '../auth.repository';

function extractAccessTokenFromCookie(req: Request): string | null {
  const raw = req?.cookies?.[ACCESS_TOKEN_COOKIE_NAME];
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly authRepository: AuthRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => extractAccessTokenFromCookie(request),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtAccessPayload): Promise<JwtAccessPayload> {
    if (typeof payload.sesiTokenVersion !== 'number') {
      throw new UnauthorizedException('Sesi tidak valid');
    }
    const row = await this.authRepository.findActivePenggunaById(payload.sub);
    if (row === null || row.sesiTokenVersion !== payload.sesiTokenVersion) {
      throw new UnauthorizedException('Sesi tidak valid');
    }
    return {
      sub: row.penggunaId,
      email: row.email,
      peran: row.peran,
      sesiTokenVersion: row.sesiTokenVersion,
    };
  }
}
