import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  HasilEvaluasi,
  Prisma,
  StatusTindakLanjut,
  StatusPengajuanEvaluasi,
} from '../../../generated/prisma';

export type NilaiRevisiAktifRow = Readonly<{
  pengajuanEvaluasiId: string;
  detailSopId: string;
  hasil: HasilEvaluasi | null;
  statusTindakLanjut: StatusTindakLanjut | null;
}>;

export type UmpanBalikEvaluasiRow = Readonly<{
  pengajuanEvaluasiId: string;
  detailSopId: string;
  hasil: HasilEvaluasi | null;
  catatan: string | null;
  statusTindakLanjut: StatusTindakLanjut | null;
  ditindaklanjutiPada: Date | null;
  version: number;
  dinilaiOleh: { penggunaId: string; nama: string } | null;
  ditindaklanjutiOleh: { penggunaId: string; nama: string } | null;
  pengajuanEvaluasi: { status: StatusPengajuanEvaluasi };
}>;

@Injectable()
export class EvaluasiNilaiRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Satu transaksi DB untuk konsistensi nilai + log + status DetailSOP. */
  async runTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  /** Baris nilai revisi aktif untuk guard kirim ulang ke evaluator. */
  async findNilaiRevisiAktifForDetail(detailSopId: string): Promise<NilaiRevisiAktifRow | null> {
    const row = await this.prisma.nilaiEvaluasi.findFirst({
      where: {
        detailSopId,
        hasil: HasilEvaluasi.PERLU_PERBAIKAN,
        pengajuanEvaluasi: {
          status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
        },
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        pengajuanEvaluasiId: true,
        detailSopId: true,
        hasil: true,
        statusTindakLanjut: true,
      },
    });
    return row;
  }

  /** Umpan balik evaluasi untuk panel penyusun (pengajuan evaluasi aktif + hasil perlu perbaikan). */
  async findUmpanBalikForDetail(
    detailSopId: string,
    opdId: string,
  ): Promise<UmpanBalikEvaluasiRow | null> {
    return this.prisma.nilaiEvaluasi.findFirst({
      where: {
        detailSopId,
        OR: [
          {
            hasil: HasilEvaluasi.PERLU_PERBAIKAN,
            pengajuanEvaluasi: {
              opdId,
              status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
            },
          },
          {
            hasil: HasilEvaluasi.DITOLAK,
            pengajuanEvaluasi: {
              opdId,
              status: StatusPengajuanEvaluasi.DITOLAK,
            },
          },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        pengajuanEvaluasiId: true,
        detailSopId: true,
        hasil: true,
        catatan: true,
        statusTindakLanjut: true,
        ditindaklanjutiPada: true,
        version: true,
        dinilaiOleh: { select: { penggunaId: true, nama: true } },
        ditindaklanjutiOleh: { select: { penggunaId: true, nama: true } },
        pengajuanEvaluasi: { select: { status: true } },
      },
    });
  }

  async findOpdIdByDetailSopId(detailSopId: string): Promise<string | null> {
    const row = await this.prisma.detailSOP.findUnique({
      where: { detailSopId },
      select: { sop: { select: { opdId: true } } },
    });
    return row?.sop.opdId ?? null;
  }
}
