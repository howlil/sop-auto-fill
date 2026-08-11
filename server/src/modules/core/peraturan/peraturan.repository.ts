import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

export type PeraturanRow = {
  peraturanId: string;
  nama: string;
  nomor: string;
  tahun: number;
  tentang: string;
  lastEditedById: string | null;
  lastEditedBy: null | {
    penggunaId: string;
    nama: string;
    opd: { opdId: string; nama: string };
  };
  createdAt: Date;
  updatedAt: Date;
  dasarHukumCount: number;
};

@Injectable()
export class PeraturanRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOpdIdByPenggunaId(penggunaId: string): Promise<string | null> {
    const row = await this.prisma.pengguna.findFirst({
      where: { penggunaId, deletedAt: null },
      select: { opdId: true },
    });
    return row?.opdId ?? null;
  }

  async findManyByOpdId(opdId: string): Promise<PeraturanRow[]> {
    const rows = await this.prisma.peraturan.findMany({
      where: {
        opdPemakai: { some: { opdId } },
      },
      select: {
        peraturanId: true,
        nama: true,
        nomor: true,
        tahun: true,
        tentang: true,
        lastEditedById: true,
        lastEditedBy: {
          select: { penggunaId: true, nama: true, opd: { select: { opdId: true, nama: true } } },
        },
        createdAt: true,
        updatedAt: true,
        _count: { select: { dasarHukum: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((r) => ({
      peraturanId: r.peraturanId,
      nama: r.nama,
      nomor: r.nomor,
      tahun: r.tahun,
      tentang: r.tentang,
      lastEditedById: r.lastEditedById ?? null,
      lastEditedBy: r.lastEditedBy ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      dasarHukumCount: r._count.dasarHukum,
    }));
  }

  async hasOpdLink(peraturanId: string, opdId: string): Promise<boolean> {
    const link = await this.prisma.oPDPeraturan.findUnique({
      where: {
        opdId_peraturanId: { opdId, peraturanId },
      },
      select: { peraturanId: true },
    });
    return link !== null;
  }

  async findByIdForOpd(peraturanId: string, opdId: string): Promise<PeraturanRow | null> {
    const row = await this.prisma.peraturan.findFirst({
      where: {
        peraturanId,
        opdPemakai: { some: { opdId } },
      },
      select: {
        peraturanId: true,
        nama: true,
        nomor: true,
        tahun: true,
        tentang: true,
        lastEditedById: true,
        lastEditedBy: {
          select: { penggunaId: true, nama: true, opd: { select: { opdId: true, nama: true } } },
        },
        createdAt: true,
        updatedAt: true,
        _count: { select: { dasarHukum: true } },
      },
    });
    if (row === null) {
      return null;
    }
    return {
      peraturanId: row.peraturanId,
      nama: row.nama,
      nomor: row.nomor,
      tahun: row.tahun,
      tentang: row.tentang,
      lastEditedById: row.lastEditedById ?? null,
      lastEditedBy: row.lastEditedBy ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      dasarHukumCount: row._count.dasarHukum,
    };
  }

  async countDasarHukum(peraturanId: string): Promise<number> {
    return this.prisma.dasarHukum.count({ where: { peraturanId } });
  }

  async countOpdLinks(peraturanId: string): Promise<number> {
    return this.prisma.oPDPeraturan.count({ where: { peraturanId } });
  }

  async createWithOpdLink(params: {
    nama: string;
    nomor: string;
    tahun: number;
    tentang: string;
    opdId: string;
    lastEditedById: string;
  }): Promise<PeraturanRow> {
    const created = await this.prisma.$transaction(async (tx) => {
      const p = await tx.peraturan.create({
        data: {
          nama: params.nama,
          nomor: params.nomor,
          tahun: params.tahun,
          tentang: params.tentang,
          lastEditedById: params.lastEditedById,
        },
      });
      await tx.oPDPeraturan.create({
        data: { opdId: params.opdId, peraturanId: p.peraturanId },
      });
      const full = await tx.peraturan.findUniqueOrThrow({
        where: { peraturanId: p.peraturanId },
        select: {
          peraturanId: true,
          nama: true,
          nomor: true,
          tahun: true,
          tentang: true,
          lastEditedById: true,
          lastEditedBy: {
            select: { penggunaId: true, nama: true, opd: { select: { opdId: true, nama: true } } },
          },
          createdAt: true,
          updatedAt: true,
          _count: { select: { dasarHukum: true } },
        },
      });
      return full;
    });
    return {
      peraturanId: created.peraturanId,
      nama: created.nama,
      nomor: created.nomor,
      tahun: created.tahun,
      tentang: created.tentang,
      lastEditedById: created.lastEditedById ?? null,
      lastEditedBy: created.lastEditedBy ?? null,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      dasarHukumCount: created._count.dasarHukum,
    };
  }

  async updateMaster(
    peraturanId: string,
    data: { nama?: string; nomor?: string; tahun?: number; tentang?: string },
  ): Promise<PeraturanRow> {
    const updated = await this.prisma.peraturan.update({
      where: { peraturanId },
      data,
      select: {
        peraturanId: true,
        nama: true,
        nomor: true,
        tahun: true,
        tentang: true,
        lastEditedById: true,
        lastEditedBy: {
          select: { penggunaId: true, nama: true, opd: { select: { opdId: true, nama: true } } },
        },
        createdAt: true,
        updatedAt: true,
        _count: { select: { dasarHukum: true } },
      },
    });
    return {
      peraturanId: updated.peraturanId,
      nama: updated.nama,
      nomor: updated.nomor,
      tahun: updated.tahun,
      tentang: updated.tentang,
      lastEditedById: updated.lastEditedById ?? null,
      lastEditedBy: updated.lastEditedBy ?? null,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      dasarHukumCount: updated._count.dasarHukum,
    };
  }

  async updateMasterWithLastEditor(
    peraturanId: string,
    data: { nama?: string; nomor?: string; tahun?: number; tentang?: string },
    lastEditedById: string,
  ): Promise<PeraturanRow> {
    const updated = await this.prisma.peraturan.update({
      where: { peraturanId },
      data: { ...data, lastEditedById },
      select: {
        peraturanId: true,
        nama: true,
        nomor: true,
        tahun: true,
        tentang: true,
        lastEditedById: true,
        lastEditedBy: {
          select: { penggunaId: true, nama: true, opd: { select: { opdId: true, nama: true } } },
        },
        createdAt: true,
        updatedAt: true,
        _count: { select: { dasarHukum: true } },
      },
    });
    return {
      peraturanId: updated.peraturanId,
      nama: updated.nama,
      nomor: updated.nomor,
      tahun: updated.tahun,
      tentang: updated.tentang,
      lastEditedById: updated.lastEditedById ?? null,
      lastEditedBy: updated.lastEditedBy ?? null,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      dasarHukumCount: updated._count.dasarHukum,
    };
  }

  async deleteOpdLink(opdId: string, peraturanId: string): Promise<void> {
    await this.prisma.oPDPeraturan.delete({
      where: { opdId_peraturanId: { opdId, peraturanId } },
    });
  }

  async deletePeraturan(peraturanId: string): Promise<void> {
    await this.prisma.peraturan.delete({ where: { peraturanId } });
  }
}
