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
import { ACCESS_TOKEN_COOKIE_NAME } from './modules/core/auth/helpers/auth.shared';

const DEFAULT_PORT = 3001;
const CORS_MAX_AGE_SECONDS = 3600;

function normalizeCorsOrigin(origin: string | undefined): string {
  const value = origin?.trim();
  if (!value) return '';
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

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '0.0.0.0');
  });
}

async function bootstrap(): Promise<void> {
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

  process.on('uncaughtException', (err) => logger.error('Uncaught Exception:', err));
  process.on('unhandledRejection', (reason) => logger.error('Unhandled Rejection:', reason));

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(createDefaultValidationPipe());
  app.enableCors(buildCorsOptions(configService));

  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const swaggerEnabled = configService.get<boolean>('SWAGGER_ENABLED', nodeEnv !== 'production');
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('SOPFlow API')
      .setDescription('API Google-authenticated workspace dan authoring SOP')
      .setVersion('2.0')
      .addCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
      .addTag('Auth', 'Google authentication')
      .addTag('Workspace', 'Private project workspaces')
      .addTag('SOP', 'SOP authoring, versioning, Flowchart, and BPMN')
      .addTag('Peraturan', 'Regulation library')
      .addTag('Pelaksana', 'SOP performers/swimlanes')
      .addTag('Health', 'Health check')
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));
  }

  app.enableShutdownHooks();
  const port = configService.get<number>('PORT', DEFAULT_PORT);
  if (!(await isPortAvailable(port))) {
    logger.error(`Port ${port} sudah dipakai.`);
    process.exit(1);
  }

  await app.listen(port, '0.0.0.0');
  logger.log(`Server running on http://localhost:${port}/api/v1`);
  if (swaggerEnabled) logger.log(`Swagger docs: http://localhost:${port}/docs`);
}

void bootstrap();
