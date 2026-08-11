import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { join, normalize, relative, sep } from 'path';

export type StoredSopPdf = {
  readonly relativePath: string;
  readonly absolutePath: string;
  readonly sizeBytes: number;
  readonly sha256: string;
};

@Injectable()
export class SopPdfStorageService {
  private readonly rootDir: string;

  constructor(configService: ConfigService) {
    this.rootDir = normalize(
      configService.get<string>('SOP_PDF_STORAGE_DIR') ?? join(process.cwd(), 'src', 'sop'),
    );
  }

  buildRelativePath(params: {
    opdId: string;
    sopId: string;
    detailSopId: string;
    versi: number;
  }): string {
    return [
      this.segment(params.opdId),
      this.segment(params.sopId),
      `v${params.versi}-${this.segment(params.detailSopId)}.pdf`,
    ].join('/');
  }

  async writeOfficialPdf(relativePath: string, buffer: Buffer): Promise<StoredSopPdf> {
    const absolutePath = this.resolveInsideRoot(relativePath);
    const tmpPath = `${absolutePath}.tmp-${process.pid}-${Date.now()}`;
    await fs.mkdir(join(absolutePath, '..'), { recursive: true });
    try {
      await fs.writeFile(tmpPath, buffer);
      await fs.rename(tmpPath, absolutePath);
      return {
        relativePath,
        absolutePath,
        sizeBytes: buffer.byteLength,
        sha256: createHash('sha256').update(buffer).digest('hex'),
      };
    } catch (error) {
      await fs.rm(tmpPath, { force: true }).catch(() => undefined);
      throw new InternalServerErrorException(
        error instanceof Error
          ? `Gagal menyimpan PDF SOP: ${error.message}`
          : 'Gagal menyimpan PDF SOP',
      );
    }
  }

  async readPublishedPdf(relativePath: string): Promise<{ buffer: Buffer; sizeBytes: number }> {
    const absolutePath = this.resolveInsideRoot(relativePath);
    const buffer = await fs.readFile(absolutePath);
    return { buffer, sizeBytes: buffer.byteLength };
  }

  async deleteStoredPdf(relativePath: string): Promise<void> {
    await fs.rm(this.resolveInsideRoot(relativePath), { force: true }).catch(() => undefined);
  }

  private resolveInsideRoot(relativePath: string): string {
    const absolutePath = normalize(join(this.rootDir, relativePath));
    const rel = relative(this.rootDir, absolutePath);
    if (rel.startsWith('..') || rel === '..' || rel.includes(`..${sep}`)) {
      throw new InternalServerErrorException('Path PDF SOP tidak valid');
    }
    return absolutePath;
  }

  private segment(value: string): string {
    return value.replace(/[^a-zA-Z0-9_-]/g, '-');
  }
}
