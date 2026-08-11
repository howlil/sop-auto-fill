import { Injectable } from '@nestjs/common';
import { displayStatusPengajuan } from '../../../common/status/status-display';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { toWibDateOnly } from '../../../common/date/wib-date.util';
import {
  JenisDokumenTte,
  PeranPengguna,
  Prisma,
  StatusPengajuanEvaluasi,
  StatusSOP,
} from '../../../generated/prisma';
import type { PengajuanEvaluasiListQueryDto } from './dto/pengajuan-evaluasi-list-query.dto';
import type { PengajuanEvaluasiRingkasQueryDto } from './dto/pengajuan-evaluasi-ringkas-query.dto';

const pengajuanEvaluasiDetailInclude = Prisma.validator<Prisma.PengajuanEvaluasiInclude>()({
  opd: { select: { opdId: true, nama: true } },
  nilaiEvaluasi: {
    include: {
      detailSop: {
        select: {
          detailSopId: true,
          nomorSOP: true,
          status: true,
          sop: { select: { sopId: true, judul: true } },
        },
      },
      dinilaiOleh: { select: { penggunaId: true, nama: true } },
    },
  },
  diselesaikanOleh: { select: { penggunaId: true, nama: true } },
  ditolakOleh: { select: { penggunaId: true, nama: true } },
  diverifikasiOlehUser: { select: { penggunaId: true, nama: true } },
  ditandatanganiOlehPjPenyusunUser: { select: { penggunaId: true, nama: true } },
  dokumenTte: {
    where: { jenisDokumen: JenisDokumenTte.BERITA_ACARA_EVALUASI },
    take: 1,
    orderBy: { createdAt: 'desc' },
    select: { nomorDokumen: true },
  },
  logNilaiEvaluasi: {
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      pengguna: { select: { nama: true } },
    },
  },
});

export type PengajuanEvaluasiDetailRow = Prisma.PengajuanEvaluasiGetPayload<{
  include: typeof pengajuanEvaluasiDetailInclude;
}>;

type SignedSopPengesahanRepairDetail = {
  readonly detailSopId: string;
  readonly sopId: string;
  readonly status: StatusSOP;
  readonly tanggalEfektif: Date | null;
  readonly signedByUserId: string;
  readonly signedAt: Date;
};

@Injectable()
export class PengajuanEvaluasiRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Menjalankan transaksi Prisma (alur create pengajuan evaluasi di service). */
  async runTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  async findOpdIdPengguna(penggunaId: string): Promise<string | null> {
    const row = await this.prisma.pengguna.findFirst({
      where: { penggunaId, deletedAt: null },
      select: { opdId: true },
    });
    return row?.opdId ?? null;
  }

  async findManyFiltered(
    whereInput: Prisma.PengajuanEvaluasiWhereInput,
  ): Promise<PengajuanEvaluasiDetailRow[]> {
    const rows = await this.prisma.pengajuanEvaluasi.findMany({
      where: whereInput,
      include: pengajuanEvaluasiDetailInclude,
      orderBy: [{ createdAt: 'desc' }],
    });
    const repaired = await this.repairPengesahanKepalaOpdStatusUntukRows(rows);
    if (!repaired) {
      return rows;
    }
    return this.prisma.pengajuanEvaluasi.findMany({
      where: whereInput,
      include: pengajuanEvaluasiDetailInclude,
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async findByIdFull(pengajuanEvaluasiId: string): Promise<PengajuanEvaluasiDetailRow | null> {
    await this.repairPengesahanKepalaOpdStatusJikaDokumenSudahSigned(pengajuanEvaluasiId);
    return this.prisma.pengajuanEvaluasi.findUnique({
      where: { pengajuanEvaluasiId },
      include: pengajuanEvaluasiDetailInclude,
    });
  }

  buildWhereFromQuery(
    query: PengajuanEvaluasiListQueryDto,
    forcedOpdId?: string,
  ): Prisma.PengajuanEvaluasiWhereInput {
    const and: Prisma.PengajuanEvaluasiWhereInput[] = [];
    if (forcedOpdId !== undefined) {
      and.push({ opdId: forcedOpdId });
    } else if (query.opdId !== undefined) {
      and.push({ opdId: query.opdId });
    }
    if (query.statusIn !== undefined && query.statusIn.length > 0) {
      and.push({ status: { in: [...query.statusIn] } });
    } else if (query.status !== undefined) {
      and.push({ status: query.status });
    }
    if (query.jenis !== undefined) {
      and.push({ jenis: query.jenis });
    }
    return and.length === 0 ? {} : { AND: and };
  }

  /** Filter daftar ringkas + pencarian nama OPD (substring). */
  buildWhereRingkasFromQuery(
    query: PengajuanEvaluasiRingkasQueryDto,
    forcedOpdId?: string,
  ): Prisma.PengajuanEvaluasiWhereInput {
    const listFilters = this.buildWhereFromQuery(
      {
        opdId: query.opdId,
        status: query.status,
        statusIn: query.statusIn,
        jenis: query.jenis,
      },
      forcedOpdId,
    );
    const parts: Prisma.PengajuanEvaluasiWhereInput[] = [];
    if ('AND' in listFilters && Array.isArray(listFilters.AND)) {
      parts.push(...listFilters.AND);
    } else if (Object.keys(listFilters).length > 0) {
      parts.push(listFilters);
    }
    const term = query.search?.trim();
    if (term !== undefined && term.length > 0) {
      parts.push({
        opd: { nama: { contains: term } },
      });
    }
    return parts.length === 0 ? {} : { AND: parts };
  }

  async countWhere(where: Prisma.PengajuanEvaluasiWhereInput): Promise<number> {
    return this.prisma.pengajuanEvaluasi.count({ where });
  }

  /**
   * Repair idempoten untuk kasus data sudah punya dokumen SOP resmi + TTE Kepala OPD,
   * tetapi status PengajuanEvaluasi/DetailSOP masih tertinggal di tahap sebelum finalize.
   */
  async repairPengesahanKepalaOpdStatusJikaDokumenSudahSigned(
    pengajuanEvaluasiId: string,
  ): Promise<boolean> {
    const pengajuan = await this.prisma.pengajuanEvaluasi.findUnique({
      where: { pengajuanEvaluasiId },
      select: {
        pengajuanEvaluasiId: true,
        status: true,
        opdId: true,
        nilaiEvaluasi: {
          select: {
            detailSop: {
              select: {
                detailSopId: true,
                sopId: true,
                status: true,
                tanggalEfektif: true,
                sop: { select: { opdId: true } },
                dokumenTte: {
                  where: { jenisDokumen: JenisDokumenTte.SOP_BERLAKU },
                  take: 1,
                  select: {
                    dokumenTteId: true,
                    pdfPath: true,
                    pdfSha256: true,
                    pdfStatus: true,
                    riwayatTandaTangan: {
                      where: { peran: PeranPengguna.KEPALA_OPD },
                      take: 1,
                      orderBy: { ditandatanganiPada: 'desc' },
                      select: {
                        userId: true,
                        ditandatanganiPada: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (pengajuan === null || pengajuan.nilaiEvaluasi.length === 0) {
      return false;
    }

    const signedDetails: SignedSopPengesahanRepairDetail[] = [];
    for (const nilai of pengajuan.nilaiEvaluasi) {
      const detail = nilai.detailSop;
      if (detail.sop.opdId !== pengajuan.opdId) {
        return false;
      }
      const dokumen = detail.dokumenTte[0];
      const signature = dokumen?.riwayatTandaTangan[0];
      if (
        dokumen === undefined ||
        signature === undefined ||
        dokumen.pdfPath === null ||
        dokumen.pdfSha256 === null ||
        dokumen.pdfStatus !== 'PUBLISHED'
      ) {
        return false;
      }
      signedDetails.push({
        detailSopId: detail.detailSopId,
        sopId: detail.sopId,
        status: detail.status,
        tanggalEfektif: detail.tanggalEfektif,
        signedByUserId: signature.userId,
        signedAt: signature.ditandatanganiPada,
      });
    }

    const perluUpdatePengajuan = pengajuan.status !== StatusPengajuanEvaluasi.SELESAI;
    const perluUpdateDetail = signedDetails.some(
      (detail) => detail.status !== StatusSOP.BERLAKU || detail.tanggalEfektif === null,
    );
    if (!perluUpdatePengajuan && !perluUpdateDetail) {
      return false;
    }

    await this.prisma.$transaction(async (tx) => {
      for (const detail of signedDetails) {
        if (detail.status !== StatusSOP.BERLAKU) {
          const replaced = await tx.detailSOP.findMany({
            where: {
              sopId: detail.sopId,
              detailSopId: { not: detail.detailSopId },
              status: StatusSOP.BERLAKU,
            },
            select: { detailSopId: true },
          });
          await this.gantikanVersiBerlakuLain(tx, {
            sopId: detail.sopId,
            detailSopId: detail.detailSopId,
          });
          await this.updatePdfStatusForDetailIds(
            tx,
            replaced.map((row) => row.detailSopId),
            'SUPERSEDED',
            detail.signedAt,
          );
        }
        if (detail.status !== StatusSOP.BERLAKU || detail.tanggalEfektif === null) {
          await tx.detailSOP.update({
            where: { detailSopId: detail.detailSopId },
            data: {
              status: StatusSOP.BERLAKU,
              terakhirDieditOlehId: detail.signedByUserId,
              tanggalEfektif: detail.tanggalEfektif ?? toWibDateOnly(detail.signedAt),
            },
          });
        }
      }
      if (perluUpdatePengajuan) {
        await tx.pengajuanEvaluasi.update({
          where: { pengajuanEvaluasiId },
          data: {
            status: StatusPengajuanEvaluasi.SELESAI,
            version: { increment: 1 },
          },
        });
      }
    });
    return true;
  }

  private async repairPengesahanKepalaOpdStatusUntukRows(
    rows: readonly PengajuanEvaluasiDetailRow[],
  ): Promise<boolean> {
    let repaired = false;
    for (const row of rows) {
      if (row.status === StatusPengajuanEvaluasi.SELESAI) {
        continue;
      }
      const ok = await this.repairPengesahanKepalaOpdStatusJikaDokumenSudahSigned(
        row.pengajuanEvaluasiId,
      );
      repaired = repaired || ok;
    }
    return repaired;
  }

  private async gantikanVersiBerlakuLain(
    tx: Prisma.TransactionClient,
    params: { sopId: string; detailSopId: string },
  ): Promise<void> {
    await tx.detailSOP.updateMany({
      where: {
        sopId: params.sopId,
        detailSopId: { not: params.detailSopId },
        status: StatusSOP.BERLAKU,
      },
      data: { status: StatusSOP.DIGANTIKAN },
    });
  }

  private async updatePdfStatusForDetailIds(
    tx: Prisma.TransactionClient,
    detailSopIds: string[],
    status: 'SUPERSEDED' | 'REVOKED',
    timestamp: Date,
  ): Promise<void> {
    if (detailSopIds.length === 0) {
      return;
    }
    await tx.$executeRaw`
      UPDATE DokumenTte
      SET pdfStatus = ${status},
          pdfRevokedAt = ${timestamp}
      WHERE detailSopId IN (${Prisma.join(detailSopIds)})
        AND jenisDokumen = ${JenisDokumenTte.SOP_BERLAKU}
    `;
  }

  async findRingkasPage(
    where: Prisma.PengajuanEvaluasiWhereInput,
    skip: number,
    take: number,
  ): Promise<
    {
      pengajuanEvaluasiId: string;
      opdId: string;
      opdNama: string;
      jenis: string;
      status: string;
      statusLabel: string;
      tanggalEvaluasi?: string;
      createdAt: string;
      nilaiOPD?: number;
      jumlahSop: number;
      jumlahSudahDinilai: number;
    }[]
  > {
    const rows = await this.prisma.pengajuanEvaluasi.findMany({
      where,
      skip,
      take,
      orderBy: [{ createdAt: 'desc' }],
      select: {
        pengajuanEvaluasiId: true,
        opdId: true,
        jenis: true,
        status: true,
        tanggalEvaluasi: true,
        createdAt: true,
        nilaiOPD: true,
        opd: { select: { nama: true } },
      },
    });
    const ids = rows.map((r) => r.pengajuanEvaluasiId);
    if (ids.length === 0) {
      return [];
    }
    const [totals, filled] = await Promise.all([
      this.prisma.nilaiEvaluasi.groupBy({
        by: ['pengajuanEvaluasiId'],
        where: { pengajuanEvaluasiId: { in: ids } },
        _count: { _all: true },
      }),
      this.prisma.nilaiEvaluasi.groupBy({
        by: ['pengajuanEvaluasiId'],
        where: {
          pengajuanEvaluasiId: { in: ids },
          hasil: { not: null },
        },
        _count: { _all: true },
      }),
    ]);
    const totalMap = new Map(totals.map((t) => [t.pengajuanEvaluasiId, t._count._all]));
    const filledMap = new Map(filled.map((t) => [t.pengajuanEvaluasiId, t._count._all]));
    return rows.map((r) => {
      const statusDisplay = displayStatusPengajuan(r.status);
      return {
        pengajuanEvaluasiId: r.pengajuanEvaluasiId,
        opdId: r.opdId,
        opdNama: r.opd.nama,
        jenis: String(r.jenis),
        status: statusDisplay.value,
        statusLabel: statusDisplay.label,
        tanggalEvaluasi: r.tanggalEvaluasi?.toISOString(),
        createdAt: r.createdAt.toISOString(),
        nilaiOPD: r.nilaiOPD ?? undefined,
        jumlahSop: totalMap.get(r.pengajuanEvaluasiId) ?? 0,
        jumlahSudahDinilai: filledMap.get(r.pengajuanEvaluasiId) ?? 0,
      };
    });
  }
}
