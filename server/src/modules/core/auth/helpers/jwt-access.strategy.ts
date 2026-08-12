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
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new UnauthorizedException('Sesi tidak valid');
    }
    const user = await this.authRepository.findById(payload.sub);
    if (user === null) {
      throw new UnauthorizedException('Sesi tidak valid');
    }
    return {
      sub: user.userId,
      email: user.email,
      name: user.name,
    };
  }
}
