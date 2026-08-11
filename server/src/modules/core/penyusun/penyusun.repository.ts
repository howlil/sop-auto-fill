import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { Pengguna, Prisma } from '../../../generated/prisma';
import { PeranPengguna } from '../../../generated/prisma';
import {
  markRiwayatOpdTidakAktif,
  syncActiveRiwayatOpd,
} from '../pengguna/helpers/riwayat-opd.sync';

export type PenyusunDeleteGuardRow = Pengguna & {
  _count: {
    detailSopDibuat: number;
    detailSopDiedit: number;
    logEditSop: number;
    logNilaiEvaluasi: number;
    nilaiEvaluasiDiisi: number;
    pengajuanEvaluasiDiselesaikan: number;
    pengajuanEvaluasiDitandatangani: number;
    pengajuanEvaluasiDiverifikasi: number;
    riwayatOpd: number;
    tandaTangan: number;
  };
};

export interface CreatePenyusunRepoInput {
  readonly email: string;
  readonly nama: string;
  readonly nip: string;
  readonly pangkat: string;
  readonly jabatan: string;
  readonly nohp: string;
  readonly kataSandi: string;
  readonly peran: PeranPengguna;
  readonly opdId: string;
}

@Injectable()
export class PenyusunRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOpdsWithPenyusun(
    search?: string,
  ): Promise<Array<{ opdId: string; nama: string; pengguna: Pengguna[] }>> {
    const trimmed = search?.trim();
    const rows = await this.prisma.oPD.findMany({
      where: { deletedAt: null },
      orderBy: { nama: 'asc' },
      select: {
        opdId: true,
        nama: true,
        pengguna: {
          where: {
            peran: { in: [PeranPengguna.PENYUSUN, PeranPengguna.PJ_PENYUSUN] },
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
          orderBy: [{ deletedAt: 'asc' }, { nama: 'asc' }],
        },
      },
    });
    return rows;
  }

  async findPenyusunById(penggunaId: string): Promise<Pengguna | null> {
    return this.prisma.pengguna.findFirst({
      where: {
        penggunaId,
        peran: { in: [PeranPengguna.PENYUSUN, PeranPengguna.PJ_PENYUSUN] },
      },
    });
  }

  async findPenyusunAktifById(penggunaId: string): Promise<Pengguna | null> {
    return this.prisma.pengguna.findFirst({
      where: {
        penggunaId,
        peran: { in: [PeranPengguna.PENYUSUN, PeranPengguna.PJ_PENYUSUN] },
        deletedAt: null,
      },
    });
  }

  async findOpdById(opdId: string): Promise<{ opdId: string; nama: string } | null> {
    const row = await this.prisma.oPD.findFirst({
      where: { opdId, deletedAt: null },
      select: { opdId: true, nama: true },
    });
    return row;
  }

  /**
   * Riwayat OPD untuk satu penyusun: semua pasangan (pengguna, OPD) yang pernah tercatat,
   * diurutkan dari pembaruan terbaru.
   */
  async findRiwayatOpdByPenggunaId(penggunaId: string): Promise<
    Array<{
      opdId: string;
      namaOpd: string;
      pertamaDicatat: Date;
      terakhirDiperbarui: Date;
      isAktif: boolean;
    }>
  > {
    const rows = await this.prisma.riwayatOpdPengguna.findMany({
      where: { penggunaId },
      include: { opd: { select: { nama: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((r) => ({
      opdId: r.opdId,
      namaOpd: r.opd.nama,
      pertamaDicatat: r.createdAt,
      terakhirDiperbarui: r.updatedAt,
      isAktif: r.isAktif,
    }));
  }

  async findOtherPjPenyusunAktif(
    opdId: string,
    exceptPenggunaId?: string,
  ): Promise<Pengguna | null> {
    return this.prisma.pengguna.findFirst({
      where: {
        opdId,
        peran: PeranPengguna.PJ_PENYUSUN,
        deletedAt: null,
        ...(exceptPenggunaId !== undefined ? { NOT: { penggunaId: exceptPenggunaId } } : {}),
      },
    });
  }

  async createWithRiwayatOpd(input: CreatePenyusunRepoInput): Promise<Pengguna> {
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
          peran: input.peran,
          opdId: input.opdId,
        },
      });
      await syncActiveRiwayatOpd(tx, u.penggunaId, input.opdId);
      return u;
    });
  }

  async updatePenyusun(penggunaId: string, data: Prisma.PenggunaUpdateInput): Promise<Pengguna> {
    return this.prisma.$transaction(async (tx) => {
      return tx.pengguna.update({ where: { penggunaId }, data });
    });
  }

  async softDeletePenyusun(penggunaId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.pengguna.update({
        where: { penggunaId },
        data: { deletedAt: new Date() },
      });
    });
  }

  async aktifkanPenyusun(penggunaId: string): Promise<Pengguna> {
    return this.prisma.$transaction(async (tx) => {
      return tx.pengguna.update({
        where: { penggunaId },
        data: { deletedAt: null },
      });
    });
  }

  async pindahPenyusun(
    penggunaId: string,
    opdAsalId: string,
    opdTujuanId: string,
  ): Promise<Pengguna> {
    return this.prisma.$transaction(async (tx) => {
      await markRiwayatOpdTidakAktif(tx, penggunaId, opdAsalId);
      await tx.pengguna.update({
        where: { penggunaId },
        data: { opdId: opdTujuanId },
      });
      await syncActiveRiwayatOpd(tx, penggunaId, opdTujuanId);
      return tx.pengguna.findFirstOrThrow({ where: { penggunaId } });
    });
  }

  async findDeleteGuardRow(penggunaId: string): Promise<PenyusunDeleteGuardRow | null> {
    const row = await this.prisma.pengguna.findUnique({
      where: { penggunaId },
      include: {
        _count: {
          select: {
            detailSopDibuat: true,
            detailSopDiedit: true,
            logEditSop: true,
            logNilaiEvaluasi: true,
            nilaiEvaluasiDiisi: true,
            pengajuanEvaluasiDiselesaikan: true,
            pengajuanEvaluasiDitandatangani: true,
            pengajuanEvaluasiDiverifikasi: true,
            riwayatOpd: true,
            tandaTangan: true,
          },
        },
      },
    });
    return row as PenyusunDeleteGuardRow | null;
  }

  async deletePenyusunPermanen(penggunaId: string): Promise<void> {
    await this.prisma.pengguna.delete({ where: { penggunaId } });
  }
}
