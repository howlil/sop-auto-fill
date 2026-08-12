import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma, StatusSOP } from '../../../generated/prisma';
import { BagianSOP, JenisLangkahProsedur, SatuanWaktu } from '../../../generated/prisma';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { appendOrCreateLogSession } from '../collaboration/log-edit-session.helper';

export interface RepoLangkahPatchItem {
  tempId: string;
  jenis: JenisLangkahProsedur;
  kegiatan: string;
  kelengkapan?: string;
  keluaran?: string;
  waktu?: number;
  satuanWaktu?: SatuanWaktu;
  keterangan?: string;
  pelaksanaId?: string | null;
  langkahSelanjutnyaYaTempId?: string | null;
  langkahSelanjutnyaTidakTempId?: string | null;
}

export interface RepoPelaksanaPatchItem {
  pelaksanaId: string;
}

export interface UpdateSopProsedurRepoInput {
  pelaksana?: RepoPelaksanaPatchItem[];
  langkah?: RepoLangkahPatchItem[];
  defaultPelaksanaId?: string | null;
}

@Injectable()
export class SopProsedurRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findDetailIdByDetailOrSopId(
    detailOrSopId: string,
  ): Promise<{
    detailSopId: string;
    workspaceId: string;
    ownerId: string;
    status: StatusSOP;
  } | null> {
    const direct = await this.prisma.detailSOP.findUnique({
      where: { detailSopId: detailOrSopId },
      select: {
        detailSopId: true,
        sop: {
          select: {
            workspaceId: true,
            status: true,
            workspace: { select: { ownerId: true } },
          },
        },
      },
    });
    if (direct !== null) {
      return {
        detailSopId: direct.detailSopId,
        workspaceId: direct.sop.workspaceId,
        ownerId: direct.sop.workspace.ownerId,
        status: direct.sop.status,
      };
    }

    const header = await this.prisma.sOP.findUnique({
      where: { sopId: detailOrSopId },
      select: {
        workspaceId: true,
        status: true,
        workspace: { select: { ownerId: true } },
        detailSops: {
          orderBy: { versi: 'desc' },
          take: 1,
          select: { detailSopId: true },
        },
      },
    });
    const latest = header?.detailSops[0]?.detailSopId;
    if (header === null || latest === undefined) return null;
    return {
      detailSopId: latest,
      workspaceId: header.workspaceId,
      ownerId: header.workspace.ownerId,
      status: header.status,
    };
  }

  async findPelaksanaIdsByWorkspace(workspaceId: string, ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set<string>();
    const rows = await this.prisma.pelaksana.findMany({
      where: { workspaceId, pelaksanaId: { in: Array.from(new Set(ids)) } },
      select: { pelaksanaId: true },
    });
    return new Set(rows.map((row) => row.pelaksanaId));
  }

  async findExistingSwimlanePelaksanaIds(detailSopId: string): Promise<string[]> {
    const rows = await this.prisma.detailSOPPelaksana.findMany({
      where: { detailSopId },
      select: { pelaksanaId: true },
      orderBy: { urutan: 'asc' },
    });
    return rows.map((row) => row.pelaksanaId);
  }

  async updateProsedurTransaction(params: {
    detailSopId: string;
    userId: string;
    input: UpdateSopProsedurRepoInput;
    changedFields: string[];
  }): Promise<void> {
    const { detailSopId, userId, input, changedFields } = params;
    await this.prisma.$transaction(async (tx) => {
      if (input.pelaksana !== undefined) {
        await tx.detailSOPPelaksana.deleteMany({ where: { detailSopId } });
        if (input.pelaksana.length > 0) {
          await tx.detailSOPPelaksana.createMany({
            data: input.pelaksana.map((item, index) => ({
              detailSopId,
              pelaksanaId: item.pelaksanaId,
              urutan: index + 1,
            })),
          });
        }
      }

      if (input.langkah !== undefined) {
        await this.replaceLangkahInTx(tx, detailSopId, input);
      }

      await tx.detailSOP.update({
        where: { detailSopId },
        data: { terakhirDieditOlehId: userId },
      });

      await appendOrCreateLogSession({
        tx,
        detailSopId,
        penggunaId: userId,
        bagian: BagianSOP.LANGKAH,
        fields: changedFields,
      });
    });
  }

  private async replaceLangkahInTx(
    tx: Prisma.TransactionClient,
    detailSopId: string,
    input: UpdateSopProsedurRepoInput,
  ): Promise<void> {
    const langkah = input.langkah ?? [];
    const existingCount = await tx.langkahSOP.count({ where: { detailSopId } });
    if (existingCount > 0) {
      await tx.langkahSOP.updateMany({
        where: { detailSopId },
        data: { langkahSelanjutnyaYaId: null, langkahSelanjutnyaTidakId: null },
      });
      await tx.langkahSOP.deleteMany({ where: { detailSopId } });
    }
    if (langkah.length === 0) return;

    const tempToId = new Map<string, string>();
    for (const [index, item] of langkah.entries()) {
      const id = randomUUID();
      tempToId.set(item.tempId, id);
      const pelaksanaId = item.pelaksanaId ?? input.defaultPelaksanaId ?? null;
      if (pelaksanaId === null) {
        throw new Error('pelaksanaId tidak dapat diresolusi untuk langkah');
      }
      await tx.langkahSOP.create({
        data: {
          langkahSopId: id,
          detailSopId,
          urutan: index + 1,
          jenis: item.jenis,
          kegiatan: item.kegiatan,
          kelengkapan: item.kelengkapan ?? '',
          keluaran: item.keluaran ?? '',
          waktu: item.waktu ?? 0,
          satuanWaktu: item.satuanWaktu ?? SatuanWaktu.m,
          keterangan: item.keterangan ?? '',
          pelaksanaId,
        },
      });
    }

    for (const item of langkah) {
      const sourceId = tempToId.get(item.tempId);
      if (sourceId === undefined) continue;
      const ya = item.langkahSelanjutnyaYaTempId
        ? (tempToId.get(item.langkahSelanjutnyaYaTempId) ?? null)
        : null;
      const tidak = item.langkahSelanjutnyaTidakTempId
        ? (tempToId.get(item.langkahSelanjutnyaTidakTempId) ?? null)
        : null;
      if (ya === null && tidak === null) continue;
      await tx.langkahSOP.update({
        where: { langkahSopId: sourceId },
        data: { langkahSelanjutnyaYaId: ya, langkahSelanjutnyaTidakId: tidak },
      });
    }
  }
}
