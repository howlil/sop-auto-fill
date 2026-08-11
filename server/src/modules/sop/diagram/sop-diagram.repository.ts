import { Injectable } from '@nestjs/common';
import { JenisDiagram, Prisma } from '../../../generated/prisma';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { DiagramPathOverridesJson } from './diagram-edge-key.util';
import {
  filterFlattenedDiagramRowsByLangkahIds,
  flattenDiagramPathOverridesToRows,
} from './diagram-edge-key.util';

export interface UpsertDiagramConfigInput {
  detailSopId: string;
  jenis: JenisDiagram;
  layoutSeed?: number;
  pathOverrides?: DiagramPathOverridesJson | null;
}

@Injectable()
export class SopDiagramRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findDetailIdByDetailOrSopId(
    detailOrSopId: string,
  ): Promise<{ detailSopId: string; sopOpdId: string } | null> {
    const direct = await this.prisma.detailSOP.findUnique({
      where: { detailSopId: detailOrSopId },
      select: { detailSopId: true, sop: { select: { opdId: true } } },
    });
    if (direct !== null) {
      return { detailSopId: direct.detailSopId, sopOpdId: direct.sop.opdId };
    }
    const header = await this.prisma.sOP.findUnique({
      where: { sopId: detailOrSopId },
      select: {
        opdId: true,
        detailSops: {
          orderBy: { versi: 'desc' },
          take: 1,
          select: { detailSopId: true },
        },
      },
    });
    const latestDetailId = header?.detailSops[0]?.detailSopId;
    if (latestDetailId === undefined || header === undefined || header === null) return null;
    return { detailSopId: latestDetailId, sopOpdId: header.opdId };
  }

  async findDetailStatus(detailSopId: string): Promise<string | null> {
    const row = await this.prisma.detailSOP.findUnique({
      where: { detailSopId },
      select: { status: true },
    });
    return row?.status ?? null;
  }

  async findConfigsByDetailSopId(detailSopId: string) {
    return this.prisma.konfigurasiDiagramSOP.findMany({
      where: { detailSopId },
      include: {
        overridePanah: {
          include: {
            titikTekuk: {
              orderBy: { urutan: 'asc' },
            },
          },
        },
        overrideLabel: true,
      },
    });
  }

  async upsertConfig(input: UpsertDiagramConfigInput) {
    return this.prisma.$transaction(async (tx) => {
      const data: Prisma.KonfigurasiDiagramSOPUpdateInput = {};
      if (input.layoutSeed !== undefined) {
        data.layoutSeed = input.layoutSeed;
      }
      const config = await tx.konfigurasiDiagramSOP.upsert({
        where: {
          detailSopId_jenis: {
            detailSopId: input.detailSopId,
            jenis: input.jenis,
          },
        },
        create: {
          detailSopId: input.detailSopId,
          jenis: input.jenis,
          layoutSeed: input.layoutSeed ?? 0,
        },
        update: data,
      });
      if (input.pathOverrides === undefined) {
        return config;
      }
      await tx.titikTekukPanahDiagramSOP.deleteMany({
        where: { detailSopId: input.detailSopId, jenis: input.jenis },
      });
      await tx.overridePanahDiagramSOP.deleteMany({
        where: { detailSopId: input.detailSopId, jenis: input.jenis },
      });
      await tx.overrideLabelDiagramSOP.deleteMany({
        where: { detailSopId: input.detailSopId, jenis: input.jenis },
      });
      if (input.pathOverrides === null) {
        return config;
      }
      const flattened = flattenDiagramPathOverridesToRows({
        detailSopId: input.detailSopId,
        jenis: input.jenis,
        pathOverrides: input.pathOverrides,
      });
      const langkahRows = await tx.langkahSOP.findMany({
        where: { detailSopId: input.detailSopId },
        select: { langkahSopId: true },
      });
      const validLangkahIds = new Set(langkahRows.map((row) => row.langkahSopId));
      const persisted = filterFlattenedDiagramRowsByLangkahIds(flattened, validLangkahIds);
      if (persisted.edges.length > 0) {
        await tx.overridePanahDiagramSOP.createMany({ data: persisted.edges });
      }
      if (persisted.bendPoints.length > 0) {
        await tx.titikTekukPanahDiagramSOP.createMany({ data: persisted.bendPoints });
      }
      if (persisted.labels.length > 0) {
        await tx.overrideLabelDiagramSOP.createMany({ data: persisted.labels });
      }
      return config;
    });
  }

  async cloneConfigsForRevision(
    sourceDetailSopId: string,
    targetDetailSopId: string,
    langkahIdMap: Map<string, string>,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const sourceConfigs = await tx.konfigurasiDiagramSOP.findMany({
      where: { detailSopId: sourceDetailSopId },
      include: {
        overridePanah: {
          include: {
            titikTekuk: {
              orderBy: { urutan: 'asc' },
            },
          },
        },
        overrideLabel: true,
      },
    });
    if (sourceConfigs.length === 0) return;
    for (const cfg of sourceConfigs) {
      await tx.konfigurasiDiagramSOP.create({
        data: {
          detailSopId: targetDetailSopId,
          jenis: cfg.jenis,
          layoutSeed: cfg.layoutSeed,
        },
      });
      for (const edge of cfg.overridePanah) {
        const newFrom = langkahIdMap.get(edge.dariLangkahSopId);
        const newTo = langkahIdMap.get(edge.keLangkahSopId);
        if (newFrom === undefined || newTo === undefined) {
          continue;
        }
        await tx.overridePanahDiagramSOP.create({
          data: {
            detailSopId: targetDetailSopId,
            jenis: cfg.jenis,
            dariLangkahSopId: newFrom,
            keLangkahSopId: newTo,
            cabang: edge.cabang,
            sSide: edge.sSide,
            eSide: edge.eSide,
            startX: edge.startX,
            startY: edge.startY,
            endX: edge.endX,
            endY: edge.endY,
          },
        });
        if (edge.titikTekuk.length > 0) {
          await tx.titikTekukPanahDiagramSOP.createMany({
            data: edge.titikTekuk.map((point) => ({
              detailSopId: targetDetailSopId,
              jenis: cfg.jenis,
              dariLangkahSopId: newFrom,
              keLangkahSopId: newTo,
              cabang: edge.cabang,
              urutan: point.urutan,
              x: point.x,
              y: point.y,
            })),
          });
        }
      }
      if (cfg.overrideLabel.length > 0) {
        await tx.overrideLabelDiagramSOP.createMany({
          data: cfg.overrideLabel.map((label) => ({
            detailSopId: targetDetailSopId,
            jenis: cfg.jenis,
            kunciLabel: label.kunciLabel,
            posisiX: label.posisiX,
            posisiY: label.posisiY,
          })),
        });
      }
    }
  }
}
