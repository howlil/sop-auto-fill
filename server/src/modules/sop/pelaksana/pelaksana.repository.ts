import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

export type PelaksanaRow = {
  pelaksanaId: string;
  opdId: string;
  nama: string;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PelaksanaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOpdIdByPenggunaId(penggunaId: string): Promise<string | null> {
    const row = await this.prisma.pengguna.findFirst({
      where: { penggunaId, deletedAt: null },
      select: { opdId: true },
    });
    return row?.opdId ?? null;
  }

  async findManyByOpdId(opdId: string): Promise<PelaksanaRow[]> {
    return this.prisma.pelaksana.findMany({
      where: { opdId },
      select: {
        pelaksanaId: true,
        opdId: true,
        nama: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { nama: 'asc' },
    });
  }

  async findByIdAndOpd(pelaksanaId: string, opdId: string): Promise<PelaksanaRow | null> {
    return this.prisma.pelaksana.findFirst({
      where: { pelaksanaId, opdId },
      select: {
        pelaksanaId: true,
        opdId: true,
        nama: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async create(opdId: string, nama: string): Promise<PelaksanaRow> {
    return this.prisma.pelaksana.create({
      data: { opdId, nama },
      select: {
        pelaksanaId: true,
        opdId: true,
        nama: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateNama(pelaksanaId: string, nama: string): Promise<PelaksanaRow> {
    return this.prisma.pelaksana.update({
      where: { pelaksanaId },
      data: { nama },
      select: {
        pelaksanaId: true,
        opdId: true,
        nama: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async delete(pelaksanaId: string): Promise<void> {
    await this.prisma.pelaksana.delete({ where: { pelaksanaId } });
  }

  async countLangkahReferences(pelaksanaId: string): Promise<number> {
    return this.prisma.langkahSOP.count({ where: { pelaksanaId } });
  }

  async countSwimlaneReferences(pelaksanaId: string): Promise<number> {
    return this.prisma.detailSOPPelaksana.count({ where: { pelaksanaId } });
  }
}
