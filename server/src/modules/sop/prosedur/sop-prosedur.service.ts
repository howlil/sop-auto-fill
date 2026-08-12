import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { assertDetailSopEditable } from '../../../common/status/sop-editable.util';
import type { JwtAccessPayload } from '../../../common';
import { JenisLangkahProsedur, Prisma } from '../../../generated/prisma';
import { SopCatalogService } from '../catalog/sop-catalog.service';
import type { PenyusunWorkbenchDataDto } from '../catalog/dto/penyusun-workbench-data.dto';
import type { LangkahPatchItem } from './dto/langkah-patch-item.dto';
import type { UpdateSopProsedurDto } from './dto/update-sop-prosedur.dto';
import {
  SopProsedurRepository,
  type RepoLangkahPatchItem,
  type UpdateSopProsedurRepoInput,
} from './sop-prosedur.repository';

const MAX_UPDATE_PROSEDUR_TRANSACTION_ATTEMPTS = 5;
const UPDATE_PROSEDUR_RETRY_BASE_DELAY_MS = 40;

@Injectable()
export class SopProsedurService {
  constructor(
    private readonly sopProsedurRepository: SopProsedurRepository,
    private readonly sopCatalogService: SopCatalogService,
  ) {}

  async updateProsedur(
    user: JwtAccessPayload,
    detailOrSopId: string,
    dto: UpdateSopProsedurDto,
    logsLimit?: number,
  ): Promise<PenyusunWorkbenchDataDto> {
    const resolved = await this.sopProsedurRepository.findDetailIdByDetailOrSopId(detailOrSopId);
    if (resolved === null || resolved.ownerId !== user.sub) {
      throw new NotFoundException('DetailSOP tidak ditemukan');
    }
    assertDetailSopEditable(resolved.status);

    const changedFields = this.collectChangedFields(dto);
    if (changedFields.length === 0) {
      return this.sopCatalogService.getPenyusunWorkbench(user, resolved.detailSopId, logsLimit);
    }

    const repoInput = await this.buildRepoInput(
      dto,
      resolved.detailSopId,
      resolved.workspaceId,
    );

    try {
      await this.runUpdateProsedurTransactionWithRetry({
        detailSopId: resolved.detailSopId,
        userId: user.sub,
        input: repoInput,
        changedFields,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          throw new ConflictException('Konflik unik pada langkah atau jalur pelaksana');
        }
        if (err.code === 'P2003' || err.code === 'P2025') {
          throw new BadRequestException('Referensi tidak valid pada muatan prosedur');
        }
      }
      const message = err instanceof Error ? err.message : '';
      if (message.includes('Langkah tujuan cabang')) {
        throw new BadRequestException('Langkah tujuan harus berada dalam SOP yang sama');
      }
      throw err;
    }

    return this.sopCatalogService.getPenyusunWorkbench(user, resolved.detailSopId, logsLimit);
  }

  private async runUpdateProsedurTransactionWithRetry(params: {
    detailSopId: string;
    userId: string;
    input: UpdateSopProsedurRepoInput;
    changedFields: string[];
  }): Promise<void> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_UPDATE_PROSEDUR_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        await this.sopProsedurRepository.updateProsedurTransaction(params);
        return;
      } catch (err) {
        lastError = err;
        if (
          attempt === MAX_UPDATE_PROSEDUR_TRANSACTION_ATTEMPTS ||
          !isTransientTransactionError(err)
        ) {
          throw err;
        }
        await delay(UPDATE_PROSEDUR_RETRY_BASE_DELAY_MS * attempt);
      }
    }
    throw lastError;
  }

  private collectChangedFields(dto: UpdateSopProsedurDto): string[] {
    const out: string[] = [];
    if (dto.pelaksana !== undefined) out.push('pelaksana');
    if (dto.langkah !== undefined) out.push('langkah');
    return out;
  }

  private async buildRepoInput(
    dto: UpdateSopProsedurDto,
    detailSopId: string,
    workspaceId: string,
  ): Promise<UpdateSopProsedurRepoInput> {
    const out: UpdateSopProsedurRepoInput = {};
    let allowedPelaksanaIds: Set<string> | null = null;

    if (dto.pelaksana !== undefined) {
      const seen = new Set<string>();
      const dedup: { pelaksanaId: string }[] = [];
      for (const item of dto.pelaksana) {
        if (seen.has(item.pelaksanaId)) {
          throw new BadRequestException(`Pelaksana duplikat: ${item.pelaksanaId}`);
        }
        seen.add(item.pelaksanaId);
        dedup.push({ pelaksanaId: item.pelaksanaId });
      }
      if (dedup.length > 0) {
        const valid = await this.sopProsedurRepository.findPelaksanaIdsByWorkspace(
          workspaceId,
          dedup.map((item) => item.pelaksanaId),
        );
        for (const item of dedup) {
          if (!valid.has(item.pelaksanaId)) {
            throw new BadRequestException(
              `Pelaksana ${item.pelaksanaId} harus berasal dari workspace SOP`,
            );
          }
        }
      }
      out.pelaksana = dedup;
      allowedPelaksanaIds = new Set(dedup.map((item) => item.pelaksanaId));
    }

    if (dto.langkah !== undefined) {
      const tempIds = new Set<string>();
      for (const item of dto.langkah) {
        if (tempIds.has(item.tempId)) {
          throw new BadRequestException(`tempId duplikat: ${item.tempId}`);
        }
        tempIds.add(item.tempId);
      }

      let allowedForLangkah = allowedPelaksanaIds;
      if (allowedForLangkah === null) {
        allowedForLangkah = new Set(
          await this.sopProsedurRepository.findExistingSwimlanePelaksanaIds(detailSopId),
        );
      }

      const defaultPelaksanaId =
        out.pelaksana !== undefined && out.pelaksana.length > 0
          ? out.pelaksana[0].pelaksanaId
          : (Array.from(allowedForLangkah)[0] ?? null);

      out.langkah = dto.langkah.map((item) =>
        this.toRepoLangkahItem(item, allowedForLangkah, tempIds, defaultPelaksanaId),
      );
      out.defaultPelaksanaId = defaultPelaksanaId;
    }

    return out;
  }

  private toRepoLangkahItem(
    item: LangkahPatchItem,
    allowedPelaksanaIds: Set<string>,
    knownTempIds: Set<string>,
    defaultPelaksanaId: string | null,
  ): RepoLangkahPatchItem {
    if (item.pelaksanaId !== undefined && !allowedPelaksanaIds.has(item.pelaksanaId)) {
      throw new BadRequestException(
        `pelaksanaId ${item.pelaksanaId} pada langkah '${item.tempId}' tidak ada pada jalur pelaksana`,
      );
    }

    const isKeputusan = item.jenis === JenisLangkahProsedur.KEPUTUSAN;
    let yaTempId: string | null = null;
    let tidakTempId: string | null = null;
    if (isKeputusan) {
      if (
        item.langkahSelanjutnyaYaTempId !== undefined &&
        item.langkahSelanjutnyaYaTempId !== null &&
        !knownTempIds.has(item.langkahSelanjutnyaYaTempId)
      ) {
        throw new BadRequestException(
          `Cabang Ya pada '${item.tempId}' merujuk tempId tidak dikenal`,
        );
      }
      if (
        item.langkahSelanjutnyaTidakTempId !== undefined &&
        item.langkahSelanjutnyaTidakTempId !== null &&
        !knownTempIds.has(item.langkahSelanjutnyaTidakTempId)
      ) {
        throw new BadRequestException(
          `Cabang Tidak pada '${item.tempId}' merujuk tempId tidak dikenal`,
        );
      }
      yaTempId = item.langkahSelanjutnyaYaTempId ?? null;
      tidakTempId = item.langkahSelanjutnyaTidakTempId ?? null;
    }

    const resolvedPelaksana = item.pelaksanaId ?? defaultPelaksanaId;
    if (resolvedPelaksana === null || resolvedPelaksana === undefined) {
      throw new BadRequestException(
        `Langkah '${item.tempId}' tidak mempunyai pelaksana`,
      );
    }

    return {
      tempId: item.tempId,
      jenis: item.jenis,
      kegiatan: item.kegiatan,
      kelengkapan: item.kelengkapan,
      keluaran: item.keluaran,
      waktu: item.waktu,
      satuanWaktu: item.satuanWaktu,
      keterangan: item.keterangan,
      pelaksanaId: resolvedPelaksana,
      langkahSelanjutnyaYaTempId: yaTempId,
      langkahSelanjutnyaTidakTempId: tidakTempId,
    };
  }
}

function isTransientTransactionError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return err.code === 'P2034';
  }
  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    message.includes('deadlock') ||
    message.includes('lock wait timeout') ||
    message.includes('write conflict') ||
    message.includes('transaction conflict')
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
