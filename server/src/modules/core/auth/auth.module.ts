import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { GoogleIdTokenVerifierService } from './google-id-token-verifier.service';
import { resolveAccessTokenExpiry } from './helpers/auth.shared';
import { JwtAccessStrategy } from './helpers/jwt-access.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: resolveAccessTokenExpiry(config.get('JWT_EXPIRATION')).expiresInSeconds,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRepository,
    GoogleIdTokenVerifierService,
    JwtAccessStrategy,
  ],
  exports: [AuthService, JwtModule, JwtAccessStrategy],
})
export class AuthModule {}
