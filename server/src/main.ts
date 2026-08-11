import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { WinstonModule } from 'nest-winston';
import { createServer } from 'node:net';
import type { NextFunction, Request } from 'express';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { WinstonLoggerConfig } from './common/logger/winston.config';
import { createDefaultValidationPipe } from './common';
import { JSON_BODY_LIMIT, URLENCODED_BODY_LIMIT } from './common/http/request-body-limits';
import { CsrfProtectionService } from './common/security/csrf-protection.service';
import {
  SecurityRateLimiterService,
  resolveSecurityRateLimitPolicy,
  type SecurityRateLimitPolicy,
} from './common/security/security-rate-limiter.service';
import {
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
} from './modules/core/auth/helpers/auth.shared';

const DEFAULT_PORT = 3001;
const CORS_MAX_AGE_SECONDS = 3600;
const LOGIN_ACCOUNT_RATE_LIMIT: SecurityRateLimitPolicy = {
  scope: 'auth-login-account',
  limit: 10,
  windowMs: 15 * 60_000,
};

function normalizeCorsOrigin(origin: string | undefined): string {
  const value = origin?.trim();
  if (!value) {
    return '';
  }

  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/+$/, '');
  }
}

function buildCorsOptions(configService: ConfigService): CorsOptions {
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const allowedOriginsRaw = configService.get<string>('ALLOWED_ORIGINS', '').trim();
  const publicAppOrigin = configService.get<string>('PUBLIC_APP_ORIGIN', '').trim();
  const allowAllOrigins = nodeEnv !== 'production';
  const allowedOrigins = new Set(
    [...allowedOriginsRaw.split(','), publicAppOrigin].map(normalizeCorsOrigin).filter(Boolean),
  );
  return {
    origin: allowAllOrigins
      ? true
      : (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
          // Request tanpa Origin dibutuhkan untuk health checks/internal service calls.
          if (!origin || allowedOrigins.has(normalizeCorsOrigin(origin))) {
            callback(null, true);
            return;
          }
          callback(null, false);
        },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-CSRF-Token'],
    credentials: true,
    maxAge: CORS_MAX_AGE_SECONDS,
  };
}

function resolveClientNetworkIdentifier(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const firstForwarded = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
  const realIp = req.headers['x-real-ip'];
  const firstRealIp = Array.isArray(realIp) ? realIp[0] : realIp;
  return (
    firstForwarded?.trim() ||
    firstRealIp?.trim() ||
    req.ip ||
    req.socket.remoteAddress ||
    'unknown-client'
  );
}

function getCookie(req: Request, name: string): string | undefined {
  const cookies: unknown = req.cookies;
  if (typeof cookies !== 'object' || cookies === null) {
    return undefined;
  }
  const value = (cookies as Record<string, unknown>)[name];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function resolveRateLimitIdentifier(req: Request, policy: SecurityRateLimitPolicy): string {
  if (policy.scope === 'tte-sensitive' || policy.scope === 'tte-setup') {
    const accessToken = getCookie(req, ACCESS_TOKEN_COOKIE_NAME);
    if (accessToken !== undefined) {
      return `session:${accessToken}`;
    }
  }
  return `network:${resolveClientNetworkIdentifier(req)}`;
}

function resolveLoginEmail(req: Request): string | undefined {
  const body: unknown = req.body;
  if (typeof body !== 'object' || body === null) {
    return undefined;
  }
  const email = (body as Record<string, unknown>).email;
  return typeof email === 'string' && email.trim() !== '' ? email.trim().toLowerCase() : undefined;
}

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '0.0.0.0');
  });
}

async function bootstrap() {
  const logger = WinstonModule.createLogger(WinstonLoggerConfig);
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger,
    bodyParser: false,
  });
  const configService = app.get(ConfigService);

  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
  app.useBodyParser('urlencoded', { extended: true, limit: URLENCODED_BODY_LIMIT });
  app.use(cookieParser());

  const csrfProtection = app.get(CsrfProtectionService);
  app.use((req: Request, _res: unknown, next: NextFunction) => {
    try {
      csrfProtection.assertRequest(req);
      next();
    } catch (error) {
      next(error);
    }
  });

  const rateLimiter = app.get(SecurityRateLimiterService);
  app.use((req: Request, _res: unknown, next: NextFunction) => {
    const policy = resolveSecurityRateLimitPolicy(req.method, req.path);
    if (policy === null) {
      next();
      return;
    }

    try {
      rateLimiter.consume(policy, resolveRateLimitIdentifier(req, policy));
      if (policy.scope === 'auth-login-ip') {
        const email = resolveLoginEmail(req);
        if (email !== undefined) {
          rateLimiter.consume(LOGIN_ACCOUNT_RATE_LIMIT, email);
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection:', reason);
  });

  app.setGlobalPrefix('api');

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalPipes(createDefaultValidationPipe());
  app.enableCors(buildCorsOptions(configService));

  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const swaggerEnabled = configService.get<boolean>('SWAGGER_ENABLED', nodeEnv !== 'production');
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('SOP Biro Organisasi API')
      .setDescription('API untuk Sistem Manajemen SOP Biro Organisasi')
      .setVersion('1.0')
      .addBearerAuth()
      .addCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
      .addCookieAuth(REFRESH_TOKEN_COOKIE_NAME)
      .addTag('Auth', 'Authentication endpoints')
      .addTag('OPD', 'Master organisasi perangkat daerah')
      .addTag('Tim Evaluasi', 'Anggota tim evaluasi (Evaluator Biro)')
      .addTag('Users', 'User management')
      .addTag('Health', 'Health check')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  app.enableShutdownHooks();

  const configuredPort = configService.get<number>('PORT', DEFAULT_PORT);
  if (!(await isPortAvailable(configuredPort))) {
    const recoveryHint =
      nodeEnv === 'development'
        ? ` Hentikan proses lain (PowerShell: netstat -ano | findstr :${configuredPort}, lalu taskkill /PID <pid> /F), lalu jalankan ulang pnpm start:dev.`
        : ' Server production tidak akan memilih port alternatif agar load balancer/service discovery tidak salah target.';
    logger.error(`Port ${configuredPort} sudah dipakai.${recoveryHint}`);
    process.exit(1);
  }

  await app.listen(configuredPort, '0.0.0.0');
  logger.log(`🚀 Server running on http://localhost:${configuredPort}/api`);
  if (swaggerEnabled) {
    logger.log(`📚 Swagger docs: http://localhost:${configuredPort}/docs`);
  }
  logger.log(`💚 Liveness: http://localhost:${configuredPort}/api/health/live`);
  logger.log(`✅ Readiness: http://localhost:${configuredPort}/api/health/ready`);
}

void bootstrap();
