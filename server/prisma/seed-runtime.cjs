'use strict';

const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const { PrismaClient } = require('../dist/src/generated/prisma');
const {
  SYSTEM_TEMPLATES,
  seedSystemTemplates,
} = require('./system-template-seed.cjs');

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} wajib diisi untuk database seed`);
  return value;
}

function requiredPort() {
  const value = Number(process.env.DATABASE_PORT ?? '3306');
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error('DATABASE_PORT tidak valid untuk database seed');
  }
  return value;
}

async function main() {
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

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Database seed gagal: ${message}\n`);
  process.exitCode = 1;
});
