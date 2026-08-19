import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma';

type SeedTemplate = {
  key: string;
  steps: Array<{ kegiatan: string; keterangan?: string }>;
};

const { SYSTEM_TEMPLATES, seedSystemTemplates } = require('./system-template-seed.cjs') as {
  SYSTEM_TEMPLATES: SeedTemplate[];
  seedSystemTemplates: (prisma: PrismaClient) => Promise<void>;
};
const { normalizeSystemTemplateSteps } = require('./normalize-system-template-seed.cjs') as {
  normalizeSystemTemplateSteps: (templates: SeedTemplate[]) => SeedTemplate[];
};

normalizeSystemTemplateSteps(SYSTEM_TEMPLATES);

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} wajib diisi untuk database seed`);
  return value;
}

function requiredPort(): number {
  const value = Number(process.env.DATABASE_PORT ?? '3306');
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error('DATABASE_PORT tidak valid untuk database seed');
  }
  return value;
}

async function main(): Promise<void> {
  const adapter = new PrismaMariaDb({
    host: required('DATABASE_HOST'),
    port: requiredPort(),
    user: required('DATABASE_USER'),
    password: required('DATABASE_PASSWORD'),
    database: required('DATABASE_NAME'),
    connectionLimit: 2,
    connectTimeout: 15_000,
    allowPublicKeyRetrieval: true,
  });
  const prisma = new PrismaClient({ adapter });

  try {
    await seedSystemTemplates(prisma);
    process.stdout.write(
      `Seed template sistem selesai: ${SYSTEM_TEMPLATES.length} template.\n`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Database seed gagal: ${message}\n`);
  process.exitCode = 1;
});
