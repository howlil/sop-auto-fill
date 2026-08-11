import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { OPD, Pengguna, Prisma } from '../../../generated/prisma';
import { PeranPengguna } from '../../../generated/prisma';
import {
  markRiwayatOpdTidakAktif,
  syncActiveRiwayatOpd,
} from '../pengguna/helpers/riwayat-opd.sync';

export interface CreateKepalaOpdRepoInput {
  readonly email: string;
  readonly nama: string;
  readonly nip: string;
  readonly pangkat: string;
  readonly jabatan: string;
  readonly nohp: string;
  readonly kataSandi: string;
  readonly opdId: string;
}

export interface KepalaOpdPersistUpdateInput {
  profil?: Prisma.PenggunaUpdateInput;
  pindah?: { opdAsalId: string; opdTujuanId: string };
  syncRiwayatOpdId?: string;
}

export type KepalaOpdWithCounts = Pengguna & {
  opd: OPD;
  _count: { detailSopDibuat: number };
};

@Injectable()
export class KepalaOpdRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOpdAktifById(opdId: string): Promise<OPD | null> {
    return this.prisma.oPD.findFirst({
      where: { opdId, deletedAt: null },
    });
  }

  async findKepalaById(penggunaId: string): Promise<KepalaOpdWithCounts | null> {
    const row = await this.prisma.pengguna.findFirst({
      where: { penggunaId, peran: PeranPengguna.KEPALA_OPD },
      include: {
        opd: true,
        _count: { select: { detailSopDibuat: true } },
      },
    });
    return row as KepalaOpdWithCounts | null;
  }

  async findManyKepala(search?: string): Promise<KepalaOpdWithCounts[]> {
    const trimmed = search?.trim();
    const rows = await this.prisma.pengguna.findMany({
      where: {
        peran: PeranPengguna.KEPALA_OPD,
        ...(trimmed
          ? {
              OR: [
                { nama: { contains: trimmed } },
                { nip: { contains: trimmed } },
                { email: { contains: trimmed } },
              ],
            }
          : {}),
      },
      include: {
        opd: true,
        _count: { select: { detailSopDibuat: true } },
      },
      orderBy: [{ deletedAt: 'asc' }, { nama: 'asc' }],
    });
    return rows as KepalaOpdWithCounts[];
  }

  async findRiwayatRowsForPengguna(penggunaId: string): Promise<
    {
      opdId: string;
      createdAt: Date;
      updatedAt: Date;
      isAktif: boolean;
      opd: { nama: string };
    }[]
  > {
    return this.prisma.riwayatOpdPengguna.findMany({
      where: { penggunaId },
      include: { opd: { select: { nama: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createWithRiwayatOpd(input: CreateKepalaOpdRepoInput): Promise<Pengguna> {
    return this.prisma.$transaction(async (tx) => {
      const u = await tx.pengguna.create({
        data: {
          email: input.email,
          nama: input.nama,
          nip: input.nip,
          pangkat: input.pangkat,
          jabatan: input.jabatan,
          nohp: input.nohp,
          kataSandi: input.kataSandi,
          peran: PeranPengguna.KEPALA_OPD,
          opdId: input.opdId,
        },
      });
      await syncActiveRiwayatOpd(tx, u.penggunaId, input.opdId);
      return u;
    });
  }

  async persistUpdate(penggunaId: string, input: KepalaOpdPersistUpdateInput): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (input.pindah !== undefined) {
        await markRiwayatOpdTidakAktif(tx, penggunaId, input.pindah.opdAsalId);
        await tx.pengguna.update({
          where: { penggunaId },
          data: { opdId: input.pindah.opdTujuanId },
        });
        await syncActiveRiwayatOpd(tx, penggunaId, input.pindah.opdTujuanId);
      }
      if (input.profil !== undefined && Object.keys(input.profil).length > 0) {
        await tx.pengguna.update({
          where: { penggunaId },
          data: input.profil,
        });
      }
      if (input.syncRiwayatOpdId !== undefined) {
        await syncActiveRiwayatOpd(tx, penggunaId, input.syncRiwayatOpdId);
      }
    });
  }

  async softDeleteKepalaOpd(penggunaId: string): Promise<void> {
    await this.prisma.pengguna.update({
      where: { penggunaId },
      data: { deletedAt: new Date() },
    });
  }
}
