import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { constants as fsConstants, promises as fs } from 'node:fs';
import { normalize } from 'node:path';
import { PrismaService } from './prisma/prisma.service';

export type HealthCheckResult = {
  readonly status: 'ok';
  readonly timestamp: string;
};

export type ReadinessCheckResult = HealthCheckResult & {
  readonly checks: {
    readonly database: 'ok';
    readonly storage: 'ok';
  };
};

@Injectable()
export class HealthService {
  private readonly storageDir: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.storageDir = normalize(config.get<string>('SOP_PDF_STORAGE_DIR', '/app/storage/sop-pdf'));
  }

  live(): HealthCheckResult {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  async ready(): Promise<ReadinessCheckResult> {
    const failed: string[] = [];

    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
    } catch {
      failed.push('database');
    }

    try {
      await fs.mkdir(this.storageDir, { recursive: true });
      await fs.access(this.storageDir, fsConstants.R_OK | fsConstants.W_OK);
    } catch {
      failed.push('storage');
    }

    if (failed.length > 0) {
      throw new ServiceUnavailableException({
        status: 'unavailable',
        timestamp: new Date().toISOString(),
        failedChecks: failed,
      });
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'ok',
        storage: 'ok',
      },
    };
  }
}
