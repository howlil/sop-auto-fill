import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { BagianSOP, Prisma, StatusSOP } from '../../../generated/prisma';
import { appendOrCreateLogSession } from '../collaboration/log-edit-session.helper';
import {
  sopCatalogRepoFail,
  sopCatalogRepoOk,
  type SopCatalogRepoResult,
} from './sop-catalog.repo-result';

export interface UpdateSopHeaderRepoInput {
  judul?: string;
  nomorSOP?: string;
  namaLembaga?: string;
  dasarHukumPeraturanIds?: string[];
  sopTerkaitDetailIds?: string[];
  lampiran?: {
    peringatan?: string[];
    kualifikasiPelaksanaan?: string[];
    peralatanPerlengkapan?: string[];
    pencatatanPendataan?: string[];
  };
}

export type SopWorkbenchDbPayload = Prisma.DetailSOPGetPayload<{
  include: {
    sop: { include: { workspace: true } };
    dibuatOleh: { select: { userId: true; name: true } };
    terakhirDieditOleh: { select: { userId: true; name: true } };
    revisiDari: { select: { detailSopId: true; versi: true } };
    lampiranPeringatan: true;
    lampiranKualifikasiPelaksanaan: true;
    lampiranPeralatanPerlengkapan: true;
    lampiranPencatatanPendataan: true;
    dasarHukum: { include: { peraturan: true } };
    relasiSopKeluar: {
      include: { sopTerkait: { include: { sop: { select: { judul: true; sopId: true } } } } };
    };
    relasiSopMasuk: {
      include: { sop: { include: { sop: { select: { judul: true; sopId: true } } } } };
    };
    swimlanes: { include: { pelaksana: true } };
    langkahSOP: { orderBy: { urutan: 'asc' }; include: { pelaksana: true } };
    logEditSop: {
      orderBy: { createdAt: 'desc' };
      take: number;
      include: {
        domainFields: true;
        pengguna: { select: { userId: true; name: true; email: true } };
      };
    };
    konfigurasiDiagram: {
      include: {
        overridePanah: { include: { titikTekuk: { orderBy: { urutan: 'asc' } } } };
        overrideLabel: true;
      };
    };
  };
}>;

export type SopDaftarDetailSlice = {
  detailSopId: string;
  nomorSOP: string;
  versi: number;
  updatedAt: Date;
  pembuatNama: string | null;
  editorNama: string | null;
  peraturanId: string | null;
};

export type SopDaftarDbRow = {
  sopId: string;
  workspaceId: string;
  judul: string;
  status: StatusSOP;
  detail: SopDaftarDetailSlice | undefined;
  versionCount: number;
};

export type SopRiwayatVersiDbRow = {
  detailSopId: string;
  versi: number;
  nomorSOP: string;
  status: StatusSOP;
  revisiDariDetailSopId: string | null;
  revisiDariVersi: number | null;
  updatedAt: Date;
  canHapusDraft: boolean;
};

export interface SopDaftarListFilters {
  readonly status?: string;
  readonly tanggalDari?: string;
  readonly tanggalSampai?: string;
}

@Injectable()
export class SopCatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  private static isoDateUtc(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private static deriveNomorSopVersiBaru(nomorLama: string, versiBaru: number): string {
    const match = nomorLama.match(/^(.+)-V\d+$/i);
    const base = match !== null ? match[1] : nomorLama;
    return `${base}-V${versiBaru}`;
  }

  async createSopWithInitialDetail(params: {
    judul: string;
    nomorSOP: string;
    workspaceId: string;
    userId: string;
    namaLembaga: string;
  }): Promise<SopDaftarDbRow> {
    const created = await this.prisma.$transaction(async (tx) => {
      const sop = await tx.sOP.create({
        data: {
          judul: params.judul.trim(),
          workspaceId: params.workspaceId,
          status: StatusSOP.DRAFT,
        },
      });
      const detail = await tx.detailSOP.create({
        data: {
          sopId: sop.sopId,
          nomorSOP: params.nomorSOP.trim(),
          versi: 1,
          dibuatOlehId: params.userId,
          terakhirDieditOlehId: params.userId,
          namaLembaga: params.namaLembaga,
        },
        include: {
          dibuatOleh: { select: { name: true } },
          terakhirDieditOleh: { select: { name: true } },
        },
      });
      await appendOrCreateLogSession({
        tx,
        detailSopId: detail.detailSopId,
        penggunaId: params.userId,
        bagian: BagianSOP.HEADER,
        fields: ['create'],
        discrete: true,
      });
      return { sop, detail };
    });

    return {
      sopId: created.sop.sopId,
      workspaceId: created.sop.workspaceId,
      judul: created.sop.judul,
      status: created.sop.status,
      versionCount: 1,
      detail: {
        detailSopId: created.detail.detailSopId,
        nomorSOP: created.detail.nomorSOP,
        versi: created.detail.versi,
        updatedAt: created.detail.updatedAt,
        pembuatNama: created.detail.dibuatOleh?.name ?? null,
        editorNama: created.detail.terakhirDieditOleh?.name ?? null,
        peraturanId: null,
      },
    };
  }

  async findDaftarByWorkspaceId(
    workspaceId: string,
    filters: SopDaftarListFilters = {},
  ): Promise<SopDaftarDbRow[]> {
    const rows = await this.prisma.sOP.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
      include: {
        detailSops: {
          orderBy: { versi: 'desc' },
          include: {
            dibuatOleh: { select: { name: true } },
            terakhirDieditOleh: { select: { name: true } },
            dasarHukum: {
              orderBy: { createdAt: 'asc' },
              take: 1,
              select: { peraturanId: true },
            },
          },
        },
      },
    });

    const mapped: SopDaftarDbRow[] = rows.map((row) => {
      const latest = row.detailSops[0];
      return {
        sopId: row.sopId,
        workspaceId: row.workspaceId,
        judul: row.judul,
        status: row.status,
        versionCount: row.detailSops.length,
        detail:
          latest === undefined
            ? undefined
            : {
                detailSopId: latest.detailSopId,
                nomorSOP: latest.nomorSOP,
                versi: latest.versi,
                updatedAt: latest.updatedAt,
                pembuatNama: latest.dibuatOleh?.name ?? null,
                editorNama: latest.terakhirDieditOleh?.name ?? null,
                peraturanId: latest.dasarHukum[0]?.peraturanId ?? null,
              },
      };
    });

    return mapped.filter((row) => {
      if (filters.status && filters.status !== 'all' && row.status !== filters.status) return false;
      if (row.detail === undefined) return true;
      const day = SopCatalogRepository.isoDateUtc(row.detail.updatedAt);
      if (filters.tanggalDari && day < filters.tanggalDari) return false;
      if (filters.tanggalSampai && day > filters.tanggalSampai) return false;
      return true;
    });
  }

  async findWorkbenchPayload(
    detailSopId: string,
    logsLimit: number,
  ): Promise<SopWorkbenchDbPayload | null> {
    return this.prisma.detailSOP.findUnique({
      where: { detailSopId },
      include: {
        sop: { include: { workspace: true } },
        dibuatOleh: { select: { userId: true, name: true } },
        terakhirDieditOleh: { select: { userId: true, name: true } },
        revisiDari: { select: { detailSopId: true, versi: true } },
        lampiranPeringatan: true,
        lampiranKualifikasiPelaksanaan: true,
        lampiranPeralatanPerlengkapan: true,
        lampiranPencatatanPendataan: true,
        dasarHukum: { include: { peraturan: true } },
        relasiSopKeluar: {
          include: {
            sopTerkait: { include: { sop: { select: { judul: true, sopId: true } } } },
          },
        },
        relasiSopMasuk: {
          include: { sop: { include: { sop: { select: { judul: true, sopId: true } } } } },
        },
        swimlanes: { include: { pelaksana: true } },
        langkahSOP: { orderBy: { urutan: 'asc' }, include: { pelaksana: true } },
        logEditSop: {
          orderBy: { createdAt: 'desc' },
          take: logsLimit,
          include: {
            domainFields: true,
            pengguna: { select: { userId: true, name: true, email: true } },
          },
        },
        konfigurasiDiagram: {
          include: {
            overridePanah: {
              include: { titikTekuk: { orderBy: { urutan: 'asc' } } },
            },
            overrideLabel: true,
          },
        },
      },
    });
  }

  async findWorkbenchPayloadByDetailOrSopId(
    detailOrSopId: string,
    logsLimit: number,
  ): Promise<SopWorkbenchDbPayload | null> {
    const direct = await this.findWorkbenchPayload(detailOrSopId, logsLimit);
    if (direct !== null) return direct;

    const header = await this.prisma.sOP.findUnique({
      where: { sopId: detailOrSopId },
      select: {
        detailSops: {
          orderBy: { versi: 'desc' },
          take: 1,
          select: { detailSopId: true },
        },
      },
    });
    const latestId = header?.detailSops[0]?.detailSopId;
    return latestId === undefined ? null : this.findWorkbenchPayload(latestId, logsLimit);
  }

  async findDetailIdByDetailOrSopId(
    detailOrSopId: string,
  ): Promise<{ detailSopId: string; sopId: string } | null> {
    const direct = await this.prisma.detailSOP.findUnique({
      where: { detailSopId: detailOrSopId },
      select: { detailSopId: true, sopId: true },
    });
    if (direct !== null) return direct;

    const header = await this.prisma.sOP.findUnique({
      where: { sopId: detailOrSopId },
      select: {
        sopId: true,
        detailSops: {
          orderBy: { versi: 'desc' },
          take: 1,
          select: { detailSopId: true },
        },
      },
    });
    const latestId = header?.detailSops[0]?.detailSopId;
    if (header === null || latestId === undefined) return null;
    return { detailSopId: latestId, sopId: header.sopId };
  }

  async findProjectContext(detailOrSopId: string): Promise<{
    detailSopId: string;
    sopId: string;
    status: StatusSOP;
    workspaceId: string;
    ownerId: string;
  } | null> {
    const resolved = await this.findDetailIdByDetailOrSopId(detailOrSopId);
    if (resolved === null) return null;
    const row = await this.prisma.detailSOP.findUnique({
      where: { detailSopId: resolved.detailSopId },
      select: {
        detailSopId: true,
        sopId: true,
        sop: {
          select: {
            status: true,
            workspaceId: true,
            workspace: { select: { ownerId: true } },
          },
        },
      },
    });
    if (row === null) return null;
    return {
      detailSopId: row.detailSopId,
      sopId: row.sopId,
      status: row.sop.status,
      workspaceId: row.sop.workspaceId,
      ownerId: row.sop.workspace.ownerId,
    };
  }

  async updateSopStatus(params: {
    detailOrSopId: string;
    status: StatusSOP;
    userId: string;
  }): Promise<SopCatalogRepoResult<void>> {
    const context = await this.findProjectContext(params.detailOrSopId);
    if (context === null) return sopCatalogRepoFail('NOT_FOUND', 'SOP tidak ditemukan');
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.sOP.update({
        where: { sopId: context.sopId },
        data: { status: params.status },
      });
      await tx.detailSOP.update({
        where: { detailSopId: context.detailSopId },
        data: { terakhirDieditOlehId: params.userId },
      });
      await appendOrCreateLogSession({
        tx,
        detailSopId: context.detailSopId,
        penggunaId: params.userId,
        bagian: BagianSOP.STATUS,
        fields: ['status'],
        discrete: true,
        now,
      });
    });
    return sopCatalogRepoOk(undefined);
  }

  async updateSopHeaderTransaction(params: {
    detailSopId: string;
    sopId: string;
    userId: string;
    input: UpdateSopHeaderRepoInput;
    changedFields: string[];
  }): Promise<SopCatalogRepoResult<void>> {
    const { detailSopId, sopId, userId, input, changedFields } = params;
    await this.prisma.$transaction(async (tx) => {
      if (input.judul !== undefined) {
        await tx.sOP.update({ where: { sopId }, data: { judul: input.judul.trim() } });
      }

      const detailData: Prisma.DetailSOPUncheckedUpdateInput = {
        terakhirDieditOlehId: userId,
      };
      if (input.nomorSOP !== undefined) detailData.nomorSOP = input.nomorSOP.trim();
      if (input.namaLembaga !== undefined) detailData.namaLembaga = input.namaLembaga;
      await tx.detailSOP.update({ where: { detailSopId }, data: detailData });

      if (input.dasarHukumPeraturanIds !== undefined) {
        await tx.dasarHukum.deleteMany({ where: { detailSopId } });
        const ids = [...new Set(input.dasarHukumPeraturanIds)];
        if (ids.length > 0) {
          await tx.dasarHukum.createMany({
            data: ids.map((peraturanId) => ({ detailSopId, peraturanId })),
            skipDuplicates: true,
          });
        }
      }

      if (input.sopTerkaitDetailIds !== undefined) {
        await tx.sopTerkait.deleteMany({ where: { detailSopId } });
        const ids = [...new Set(input.sopTerkaitDetailIds.filter((id) => id !== detailSopId))];
        if (ids.length > 0) {
          await tx.sopTerkait.createMany({
            data: ids.map((detailSopTerkaitId) => ({ detailSopId, detailSopTerkaitId })),
            skipDuplicates: true,
          });
        }
      }

      await this.replaceLampiran(tx, 'lampiranPeringatan', detailSopId, input.lampiran?.peringatan);
      await this.replaceLampiran(
        tx,
        'lampiranKualifikasiPelaksanaan',
        detailSopId,
        input.lampiran?.kualifikasiPelaksanaan,
      );
      await this.replaceLampiran(
        tx,
        'lampiranPeralatanPerlengkapan',
        detailSopId,
        input.lampiran?.peralatanPerlengkapan,
      );
      await this.replaceLampiran(
        tx,
        'lampiranPencatatanPendataan',
        detailSopId,
        input.lampiran?.pencatatanPendataan,
      );

      if (changedFields.length > 0) {
        await appendOrCreateLogSession({
          tx,
          detailSopId,
          penggunaId: userId,
          bagian: BagianSOP.HEADER,
          fields: changedFields,
        });
      }
    });
    return sopCatalogRepoOk(undefined);
  }

  private async replaceLampiran(
    tx: Prisma.TransactionClient,
    model:
      | 'lampiranPeringatan'
      | 'lampiranKualifikasiPelaksanaan'
      | 'lampiranPeralatanPerlengkapan'
      | 'lampiranPencatatanPendataan',
    detailSopId: string,
    values: string[] | undefined,
  ): Promise<void> {
    if (values === undefined) return;
    const cleaned = values.map((value) => value.trim()).filter(Boolean);
    const delegate = tx[model] as unknown as {
      deleteMany(args: { where: { detailSopId: string } }): Promise<unknown>;
      createMany(args: { data: Array<{ detailSopId: string; teks: string }> }): Promise<unknown>;
    };
    await delegate.deleteMany({ where: { detailSopId } });
    if (cleaned.length > 0) {
      await delegate.createMany({ data: cleaned.map((teks) => ({ detailSopId, teks })) });
    }
  }

  async findRiwayatVersiBySopId(sopId: string): Promise<SopRiwayatVersiDbRow[]> {
    const sop = await this.prisma.sOP.findUnique({
      where: { sopId },
      select: {
        status: true,
        detailSops: {
          orderBy: { versi: 'asc' },
          select: {
            detailSopId: true,
            versi: true,
            nomorSOP: true,
            revisiDariDetailSopId: true,
            updatedAt: true,
            revisiDari: { select: { versi: true } },
          },
        },
      },
    });
    if (sop === null) return [];
    const latestVersion = sop.detailSops.at(-1)?.versi ?? 0;
    return sop.detailSops.map((row) => ({
      detailSopId: row.detailSopId,
      versi: row.versi,
      nomorSOP: row.nomorSOP,
      status: row.versi === latestVersion ? sop.status : StatusSOP.COMPLETED,
      revisiDariDetailSopId: row.revisiDariDetailSopId,
      revisiDariVersi: row.revisiDari?.versi ?? null,
      updatedAt: row.updatedAt,
      canHapusDraft:
        row.versi === latestVersion &&
        sop.status === StatusSOP.DRAFT &&
        row.revisiDariDetailSopId !== null,
    }));
  }

  async cloneDetailSopFromSource(params: {
    sourceDetailSopId: string;
    userId: string;
  }): Promise<SopCatalogRepoResult<{ detailSopId: string; versi: number }>> {
    const source = await this.prisma.detailSOP.findUnique({
      where: { detailSopId: params.sourceDetailSopId },
      include: {
        sop: true,
        lampiranPeringatan: true,
        lampiranKualifikasiPelaksanaan: true,
        lampiranPeralatanPerlengkapan: true,
        lampiranPencatatanPendataan: true,
        dasarHukum: true,
        swimlanes: true,
        relasiSopKeluar: true,
        relasiSopMasuk: true,
        langkahSOP: { orderBy: { urutan: 'asc' } },
        konfigurasiDiagram: {
          include: {
            overridePanah: { include: { titikTekuk: { orderBy: { urutan: 'asc' } } } },
            overrideLabel: true,
          },
        },
      },
    });
    if (source === null) return sopCatalogRepoFail('NOT_FOUND', 'Versi sumber tidak ditemukan');
    if (source.sop.status !== StatusSOP.COMPLETED) {
      return sopCatalogRepoFail('CONFLICT', 'Versi baru hanya dapat dibuat dari SOP yang sudah selesai');
    }

    const latest = await this.prisma.detailSOP.findFirst({
      where: { sopId: source.sopId },
      orderBy: { versi: 'desc' },
      select: { detailSopId: true, versi: true },
    });
    if (latest === null || latest.detailSopId !== source.detailSopId) {
      return sopCatalogRepoFail('CONFLICT', 'Versi baru harus dibuat dari versi terbaru SOP');
    }

    const versiBaru = latest.versi + 1;
    const nomorSOP = SopCatalogRepository.deriveNomorSopVersiBaru(source.nomorSOP, versiBaru);
    const now = new Date();

    const cloned = await this.prisma.$transaction(async (tx) => {
      const created = await tx.detailSOP.create({
        data: {
          sopId: source.sopId,
          versi: versiBaru,
          nomorSOP,
          namaLembaga: source.namaLembaga,
          tanggalPembuatan: now,
          tanggalRevisi: now,
          tanggalEfektif: null,
          dibuatOlehId: params.userId,
          terakhirDieditOlehId: params.userId,
          revisiDariDetailSopId: source.detailSopId,
        },
      });
      const newDetailId = created.detailSopId;

      if (source.lampiranPeringatan.length > 0) {
        await tx.lampiranPeringatan.createMany({
          data: source.lampiranPeringatan.map(({ teks }) => ({ detailSopId: newDetailId, teks })),
        });
      }
      if (source.lampiranKualifikasiPelaksanaan.length > 0) {
        await tx.lampiranKualifikasiPelaksanaan.createMany({
          data: source.lampiranKualifikasiPelaksanaan.map(({ teks }) => ({ detailSopId: newDetailId, teks })),
        });
      }
      if (source.lampiranPeralatanPerlengkapan.length > 0) {
        await tx.lampiranPeralatanPerlengkapan.createMany({
          data: source.lampiranPeralatanPerlengkapan.map(({ teks }) => ({ detailSopId: newDetailId, teks })),
        });
      }
      if (source.lampiranPencatatanPendataan.length > 0) {
        await tx.lampiranPencatatanPendataan.createMany({
          data: source.lampiranPencatatanPendataan.map(({ teks }) => ({ detailSopId: newDetailId, teks })),
        });
      }
      if (source.dasarHukum.length > 0) {
        await tx.dasarHukum.createMany({
          data: source.dasarHukum.map(({ peraturanId }) => ({ detailSopId: newDetailId, peraturanId })),
        });
      }
      if (source.swimlanes.length > 0) {
        await tx.detailSOPPelaksana.createMany({
          data: source.swimlanes.map(({ pelaksanaId, urutan }) => ({
            detailSopId: newDetailId,
            pelaksanaId,
            urutan,
          })),
        });
      }
      if (source.relasiSopKeluar.length > 0) {
        await tx.sopTerkait.createMany({
          data: source.relasiSopKeluar.map(({ detailSopTerkaitId }) => ({
            detailSopId: newDetailId,
            detailSopTerkaitId,
          })),
          skipDuplicates: true,
        });
      }

      const langkahIdMap = new Map<string, string>();
      for (const step of source.langkahSOP) {
        const clonedStep = await tx.langkahSOP.create({
          data: {
            detailSopId: newDetailId,
            urutan: step.urutan,
            kegiatan: step.kegiatan,
            jenis: step.jenis,
            kelengkapan: step.kelengkapan,
            keluaran: step.keluaran,
            waktu: step.waktu,
            satuanWaktu: step.satuanWaktu,
            keterangan: step.keterangan,
            pelaksanaId: step.pelaksanaId,
          },
        });
        langkahIdMap.set(step.langkahSopId, clonedStep.langkahSopId);
      }
      for (const step of source.langkahSOP) {
        const clonedId = langkahIdMap.get(step.langkahSopId);
        if (clonedId === undefined) continue;
        await tx.langkahSOP.update({
          where: { langkahSopId: clonedId },
          data: {
            langkahSelanjutnyaYaId:
              step.langkahSelanjutnyaYaId === null
                ? null
                : (langkahIdMap.get(step.langkahSelanjutnyaYaId) ?? null),
            langkahSelanjutnyaTidakId:
              step.langkahSelanjutnyaTidakId === null
                ? null
                : (langkahIdMap.get(step.langkahSelanjutnyaTidakId) ?? null),
          },
        });
      }

      for (const cfg of source.konfigurasiDiagram) {
        await tx.konfigurasiDiagramSOP.create({
          data: { detailSopId: newDetailId, jenis: cfg.jenis, layoutSeed: cfg.layoutSeed },
        });
        for (const edge of cfg.overridePanah) {
          const newFrom = langkahIdMap.get(edge.dariLangkahSopId);
          const newTo = langkahIdMap.get(edge.keLangkahSopId);
          if (newFrom === undefined || newTo === undefined) continue;
          await tx.overridePanahDiagramSOP.create({
            data: {
              detailSopId: newDetailId,
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
                detailSopId: newDetailId,
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
              detailSopId: newDetailId,
              jenis: cfg.jenis,
              kunciLabel: label.kunciLabel,
              posisiX: label.posisiX,
              posisiY: label.posisiY,
            })),
          });
        }
      }

      await tx.sOP.update({
        where: { sopId: source.sopId },
        data: { status: StatusSOP.DRAFT },
      });
      await appendOrCreateLogSession({
        tx,
        detailSopId: newDetailId,
        penggunaId: params.userId,
        bagian: BagianSOP.STATUS,
        fields: ['create', 'revisiDariDetailSopId'],
        discrete: true,
        now,
      });

      return { detailSopId: newDetailId, versi: versiBaru };
    });
    return sopCatalogRepoOk(cloned);
  }

  async deleteVersiDraft(detailSopId: string): Promise<SopCatalogRepoResult<void>> {
    const row = await this.prisma.detailSOP.findUnique({
      where: { detailSopId },
      select: {
        sopId: true,
        versi: true,
        revisiDariDetailSopId: true,
        sop: { select: { status: true } },
      },
    });
    if (row === null) return sopCatalogRepoFail('NOT_FOUND', 'Versi SOP tidak ditemukan');
    if (row.sop.status !== StatusSOP.DRAFT || row.revisiDariDetailSopId === null) {
      return sopCatalogRepoFail('CONFLICT', 'Hanya versi revisi DRAFT yang dapat dihapus');
    }
    const latest = await this.prisma.detailSOP.findFirst({
      where: { sopId: row.sopId },
      orderBy: { versi: 'desc' },
      select: { detailSopId: true },
    });
    if (latest?.detailSopId !== detailSopId) {
      return sopCatalogRepoFail('CONFLICT', 'Hanya versi terbaru yang dapat dihapus');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.detailSOP.delete({ where: { detailSopId } });
      await tx.sOP.update({ where: { sopId: row.sopId }, data: { status: StatusSOP.COMPLETED } });
    });
    return sopCatalogRepoOk(undefined);
  }

  async deleteSopDraftAwal(detailSopId: string): Promise<SopCatalogRepoResult<void>> {
    const row = await this.prisma.detailSOP.findUnique({
      where: { detailSopId },
      select: {
        sopId: true,
        versi: true,
        revisiDariDetailSopId: true,
        sop: { select: { status: true, _count: { select: { detailSops: true } } } },
      },
    });
    if (
      row === null ||
      row.sop.status !== StatusSOP.DRAFT ||
      row.versi !== 1 ||
      row.revisiDariDetailSopId !== null ||
      row.sop._count.detailSops !== 1
    ) {
      return sopCatalogRepoFail(
        'CONFLICT',
        'SOP hanya dapat dihapus ketika masih berupa draft awal dan belum memiliki versi lain',
      );
    }
    await this.prisma.sOP.delete({ where: { sopId: row.sopId } });
    return sopCatalogRepoOk(undefined);
  }
}
