import { NestFactory } from '@nestjs/core';
import { SeedModule } from '../src/database/seed/seed.module';
import { SeedService } from '../src/database/seed/seed.service';

/**
 * Entry Prisma (`package.json` → `prisma.seed`): bootstrap konteks Nest tanpa HTTP,
 * agar seed memakai PrismaService + konfigurasi yang sama dengan aplikasi.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(SeedModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const seedService: SeedService = app.get(SeedService);
    await seedService.run();
  } finally {
    await app.close();
  }
}

void bootstrap().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
