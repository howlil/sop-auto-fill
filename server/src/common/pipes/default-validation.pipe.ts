import { ValidationPipe } from '@nestjs/common';

/**
 * Konfigurasi `ValidationPipe` tunggal untuk aplikasi.
 * Dipakai di `main.ts` via `useGlobalPipes` (pola resmi Nest).
 */
export function createDefaultValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  });
}
