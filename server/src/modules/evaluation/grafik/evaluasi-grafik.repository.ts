import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NILAI_OPD_SKOR_MAX, NILAI_OPD_SKOR_MIN } from '../nilai/nilai-opd-skor.constants';

/** Satu baris agregasi SQL per tahun × OPD. */
export type EvaluasiGrafikAggRow = {
  readonly tahun: number;
  readonly opdId: string;
  readonly opdNama: string;
  readonly jumlahEvaluasi: bigint | number;
  readonly rataRataSkor: number | null;
};

export type EvaluasiGrafikOpdAktifRow = {
  readonly opdId: string;
  readonly nama: string;
};

/** Nilai status enum di DB (MySQL); diselaraskan dengan kebijakan statistik evaluasi selesai. */
const STATUS_SELESAI_SQL_IN = Prisma.raw(
  `'SELESAI_DIEVALUASI', 'DITANDATANGANI_PJ_EVALUATOR', 'DITANDATANGANI_PJ_PENYUSUN', 'SELESAI'`,
);

@Injectable()
export class EvaluasiGrafikRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** OPD yang tidak dihapus lunak, diurutkan nama. */
  async findDaftarOpdAktif(): Promise<EvaluasiGrafikOpdAktifRow[]> {
    return this.prisma.oPD.findMany({
      where: { deletedAt: null },
      select: { opdId: true, nama: true },
      orderBy: { nama: 'asc' },
    });
  }

  /**
   * Agregasi pengajuan selesai per tahun kalender × OPD.
   * Tahun = YEAR(COALESCE(tanggalDiselesaikan, tanggalEvaluasi, createdAt)).
   */
  async findAgregasiPerTahunOpd(
    tahunDari: number,
    tahunSampai: number,
  ): Promise<EvaluasiGrafikAggRow[]> {
    const yearFilters: Prisma.Sql[] = [
      Prisma.sql`inner_t.tahun >= ${tahunDari}`,
      Prisma.sql`inner_t.tahun <= ${tahunSampai}`,
    ];
    const yearWhere = Prisma.sql`AND ${Prisma.join(yearFilters, ' AND ')}`;
    const rows = await this.prisma.$queryRaw<EvaluasiGrafikAggRow[]>(Prisma.sql`
      SELECT
        inner_t.tahun AS tahun,
        inner_t.opdId AS opdId,
        inner_t.opdNama AS opdNama,
        inner_t.jumlahEvaluasi AS jumlahEvaluasi,
        inner_t.rataRataSkor AS rataRataSkor
      FROM (
        SELECT
          YEAR(COALESCE(p.tanggalDiselesaikan, p.tanggalEvaluasi, p.createdAt)) AS tahun,
          p.opdId AS opdId,
          o.nama AS opdNama,
          CAST(COUNT(*) AS UNSIGNED) AS jumlahEvaluasi,
          AVG(
            CASE
              WHEN p.nilaiOPD IS NOT NULL
                AND p.nilaiOPD >= ${NILAI_OPD_SKOR_MIN}
                AND p.nilaiOPD <= ${NILAI_OPD_SKOR_MAX}
              THEN p.nilaiOPD
            END
          ) AS rataRataSkor
        FROM PengajuanEvaluasi p
        INNER JOIN OPD o ON o.opdId = p.opdId AND o.deletedAt IS NULL
        WHERE p.status IN (${STATUS_SELESAI_SQL_IN})
        GROUP BY
          YEAR(COALESCE(p.tanggalDiselesaikan, p.tanggalEvaluasi, p.createdAt)),
          p.opdId,
          o.nama
      ) AS inner_t
      WHERE 1 = 1
      ${yearWhere}
      ORDER BY inner_t.tahun ASC, inner_t.opdNama ASC
    `);
    return rows;
  }
}
