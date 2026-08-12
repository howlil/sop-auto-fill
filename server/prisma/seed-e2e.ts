import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma';
import {
  E2E_IDENTITY,
  assertE2eEnvironment,
  issueE2eAccessToken,
} from '../src/common/testing/e2e-session.helper';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} wajib diisi untuk E2E seed`);
  return value;
}

function requiredPort(): number {
  const value = Number(process.env.DATABASE_PORT ?? '3306');
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error('DATABASE_PORT tidak valid untuk E2E seed');
  }
  return value;
}

async function main(): Promise<void> {
  assertE2eEnvironment(process.env);

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
    const existing = await prisma.user.findUnique({
      where: { googleSub: E2E_IDENTITY.googleSub },
      select: { userId: true },
    });
    if (existing) {
      await prisma.workspace.deleteMany({ where: { ownerId: existing.userId } });
      await prisma.peraturan.deleteMany({ where: { ownerId: existing.userId } });
    }

    const user = await prisma.user.upsert({
      where: { googleSub: E2E_IDENTITY.googleSub },
      update: {
        email: E2E_IDENTITY.email,
        name: E2E_IDENTITY.name,
        avatarUrl: null,
      },
      create: {
        googleSub: E2E_IDENTITY.googleSub,
        email: E2E_IDENTITY.email,
        name: E2E_IDENTITY.name,
        avatarUrl: null,
      },
      select: { userId: true, email: true, name: true },
    });

    const accessToken = await issueE2eAccessToken(required('JWT_SECRET'), user);
    process.stdout.write(
      `${JSON.stringify({
        user,
        accessToken,
      })}\n`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`E2E seed gagal: ${message}\n`);
  process.exitCode = 1;
});
