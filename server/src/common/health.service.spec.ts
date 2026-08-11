import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PrismaService } from './prisma/prisma.service';
import { HealthService } from './health.service';

function config(storageDir: string): ConfigService {
  return {
    get: jest.fn((key: string, fallback?: unknown) =>
      key === 'SOP_PDF_STORAGE_DIR' ? storageDir : fallback,
    ),
  } as unknown as ConfigService;
}

function prisma(queryImplementation: () => Promise<unknown>): PrismaService {
  return {
    $queryRawUnsafe: jest.fn(queryImplementation),
  } as unknown as PrismaService;
}

describe('HealthService', () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(join(tmpdir(), 'sopflow-health-'));
  });

  afterEach(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  it('liveness tidak bergantung pada database', () => {
    const service = new HealthService(
      prisma(() => Promise.reject(new Error('database unavailable'))),
      config(rootDir),
    );

    expect(service.live()).toMatchObject({ status: 'ok' });
  });

  it('ready ketika database dan storage dapat digunakan', async () => {
    const service = new HealthService(
      prisma(() => Promise.resolve([{ ok: 1 }])),
      config(rootDir),
    );

    await expect(service.ready()).resolves.toMatchObject({
      status: 'ok',
      checks: { database: 'ok', storage: 'ok' },
    });
  });

  it('mengembalikan unavailable ketika database gagal', async () => {
    const service = new HealthService(
      prisma(() => Promise.reject(new Error('database unavailable'))),
      config(rootDir),
    );

    await expect(service.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('mengembalikan unavailable ketika storage path tidak dapat dipakai sebagai directory', async () => {
    const filePath = join(rootDir, 'not-a-directory');
    await fs.writeFile(filePath, 'x');
    const service = new HealthService(
      prisma(() => Promise.resolve([{ ok: 1 }])),
      config(filePath),
    );

    await expect(service.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
