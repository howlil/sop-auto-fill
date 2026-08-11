import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PeranPengguna, type OPD, type Prisma } from '../../../generated/prisma';

export type OpdRingkasRow = {
  readonly opdId: string;
  readonly nama: string;
};

@Injectable()
export class OpdRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOpdIdByPenggunaId(penggunaId: string): Promise<string | null> {
    const row = await this.prisma.pengguna.findFirst({
      where: { penggunaId, deletedAt: null },
      select: { opdId: true },
    });
    return row?.opdId ?? null;
  }

  async findManyRingkasAktif(search?: string): Promise<OpdRingkasRow[]> {
    const trimmed = search?.trim();
    return this.prisma.oPD.findMany({
      where: {
        deletedAt: null,
        ...(trimmed ? { nama: { contains: trimmed } } : {}),
      },
      select: { opdId: true, nama: true },
      orderBy: { nama: 'asc' },
    });
  }

  async findRingkasAktifById(opdId: string): Promise<OpdRingkasRow | null> {
    return this.prisma.oPD.findFirst({
      where: { opdId, deletedAt: null },
      select: { opdId: true, nama: true },
    });
  }

  async findAktifById(opdId: string): Promise<OPD | null> {
    return this.prisma.oPD.findFirst({
      where: { opdId, deletedAt: null },
    });
  }

  /** Pengguna aktif dengan peran struktural di OPD (kepala, PJ penyusun, evaluator). */
  async countPenggunaStrukturalAktifByOpdId(opdId: string): Promise<number> {
    return this.prisma.pengguna.count({
      where: {
        opdId,
        deletedAt: null,
        peran: {
          in: [
            PeranPengguna.KEPALA_OPD,
            PeranPengguna.PJ_PENYUSUN,
            PeranPengguna.PJ_EVALUATOR,
            PeranPengguna.EVALUATOR,
          ],
        },
      },
    });
  }

  async create(data: Prisma.OPDCreateInput): Promise<OPD> {
    return this.prisma.oPD.create({ data });
  }

  async update(opdId: string, data: Prisma.OPDUpdateInput): Promise<OPD> {
    return this.prisma.oPD.update({
      where: { opdId },
      data,
    });
  }

  async softDelete(opdId: string): Promise<void> {
    await this.prisma.oPD.update({
      where: { opdId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Menghitung relasi yang menghalangi penonaktifan OPD.
   */
  async summarizeBlockingRelations(opdId: string): Promise<{
    readonly pengguna: number;
    readonly sop: number;
    readonly pengajuanEvaluasi: number;
    readonly pelaksana: number;
    readonly riwayatOpdPengguna: number;
    readonly opdPeraturan: number;
  }> {
    const [pengguna, sop, pengajuanEvaluasi, pelaksana, riwayatOpdPengguna, opdPeraturan] =
      await Promise.all([
        this.prisma.pengguna.count({ where: { opdId, deletedAt: null } }),
        this.prisma.sOP.count({ where: { opdId } }),
        this.prisma.pengajuanEvaluasi.count({ where: { opdId } }),
        this.prisma.pelaksana.count({ where: { opdId } }),
        this.prisma.riwayatOpdPengguna.count({ where: { opdId } }),
        this.prisma.oPDPeraturan.count({ where: { opdId } }),
      ]);
    return {
      pengguna,
      sop,
      pengajuanEvaluasi,
      pelaksana,
      riwayatOpdPengguna,
      opdPeraturan,
    };
  }
}
