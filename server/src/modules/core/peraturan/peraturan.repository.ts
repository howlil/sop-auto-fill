import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

export type PeraturanRow = {
  peraturanId: string;
  ownerId: string;
  nama: string;
  nomor: string;
  tahun: number;
  tentang: string;
  createdAt: Date;
  updatedAt: Date;
  dasarHukumCount: number;
};

@Injectable()
export class PeraturanRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findManyByOwner(ownerId: string): Promise<PeraturanRow[]> {
    const rows = await this.prisma.peraturan.findMany({
      where: { ownerId },
      include: { _count: { select: { dasarHukum: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => ({
      peraturanId: row.peraturanId,
      ownerId: row.ownerId,
      nama: row.nama,
      nomor: row.nomor,
      tahun: row.tahun,
      tentang: row.tentang,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      dasarHukumCount: row._count.dasarHukum,
    }));
  }

  async findOwnedById(ownerId: string, peraturanId: string): Promise<PeraturanRow | null> {
    const row = await this.prisma.peraturan.findFirst({
      where: { ownerId, peraturanId },
      include: { _count: { select: { dasarHukum: true } } },
    });
    if (row === null) return null;
    return {
      peraturanId: row.peraturanId,
      ownerId: row.ownerId,
      nama: row.nama,
      nomor: row.nomor,
      tahun: row.tahun,
      tentang: row.tentang,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      dasarHukumCount: row._count.dasarHukum,
    };
  }

  async create(params: {
    ownerId: string;
    nama: string;
    nomor: string;
    tahun: number;
    tentang: string;
  }): Promise<PeraturanRow> {
    const row = await this.prisma.peraturan.create({
      data: params,
      include: { _count: { select: { dasarHukum: true } } },
    });
    return { ...row, dasarHukumCount: row._count.dasarHukum };
  }

  async update(
    peraturanId: string,
    data: { nama?: string; nomor?: string; tahun?: number; tentang?: string },
  ): Promise<PeraturanRow> {
    const row = await this.prisma.peraturan.update({
      where: { peraturanId },
      data,
      include: { _count: { select: { dasarHukum: true } } },
    });
    return { ...row, dasarHukumCount: row._count.dasarHukum };
  }

  async delete(peraturanId: string): Promise<void> {
    await this.prisma.peraturan.delete({ where: { peraturanId } });
  }
}
