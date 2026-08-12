import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { AuthRepository, type AuthUserRecord } from './auth.repository';
import { GoogleIdTokenVerifierService } from './google-id-token-verifier.service';
import {
  resolveAccessTokenExpiry,
  type JwtAccessPayload,
  type PublicUser,
} from './helpers/auth.shared';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly googleVerifier: GoogleIdTokenVerifierService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async loginWithGoogle(credential: string): Promise<{
    accessToken: string;
    user: PublicUser;
    cookieMaxAgeMs: number;
  }> {
    const claims = await this.googleVerifier.verify(credential);
    if (typeof claims.email !== 'string' || claims.email.length === 0) {
      throw new UnauthorizedException('Akun Google tidak memiliki email yang dapat digunakan');
    }

    const user = await this.authRepository.upsertGoogleUser({
      googleSub: claims.sub,
      email: claims.email,
      name:
        typeof claims.name === 'string' && claims.name.trim() !== ''
          ? claims.name.trim()
          : claims.email,
      avatarUrl:
        typeof claims.picture === 'string' && claims.picture.trim() !== ''
          ? claims.picture
          : null,
    });
    const { accessToken, cookieMaxAgeMs } = await this.signAccessToken(user);
    return {
      accessToken,
      cookieMaxAgeMs,
      user: this.toPublicUser(user),
    };
  }

  async getMe(userId: string): Promise<PublicUser> {
    const user = await this.authRepository.findById(userId);
    if (user === null) {
      throw new NotFoundException('User tidak ditemukan');
    }
    return this.toPublicUser(user);
  }

  private async signAccessToken(user: AuthUserRecord): Promise<{
    accessToken: string;
    cookieMaxAgeMs: number;
  }> {
    const payload: JwtAccessPayload = {
      sub: user.userId,
      email: user.email,
      name: user.name,
    };
    const { expiresInSeconds, maxAgeMs } = resolveAccessTokenExpiry(
      this.config.get('JWT_EXPIRATION'),
    );
    const signOptions: JwtSignOptions = { expiresIn: expiresInSeconds };
    const accessToken = await this.jwtService.signAsync(payload, signOptions);
    return { accessToken, cookieMaxAgeMs: maxAgeMs };
  }

  private toPublicUser(user: AuthUserRecord): PublicUser {
    return {
      userId: user.userId,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    };
  }
}
