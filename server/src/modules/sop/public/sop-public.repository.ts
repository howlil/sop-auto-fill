import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { JenisDokumenTte, Prisma, StatusSOP } from '../../../generated/prisma';

export type PublicOpdDbRow = {
  readonly opdId: string;
  readonly nama: string;
  readonly jumlahSopBerlaku: number;
};

export type PublicSopDbRow = {
  readonly detailSopId: string;
  readonly sopId: string;
  readonly opdId: string;
  readonly judul: string;
  readonly nomorSOP: string;
  readonly versi: number;
  readonly tanggalEfektif: Date | null;
  readonly opdNama: string;
  readonly pdfPath: string;
};

export type PublicSopPdfDbRow = {
  readonly detailSopId: string;
  readonly judul: string;
  readonly nomorSOP: string;
  readonly versi: number;
  readonly pdfPath: string;
  readonly pdfSha256: string | null;
};

@Injectable()
export class SopPublicRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOpdAktifById(opdId: string): Promise<{ opdId: string; nama: string } | null> {
    return this.prisma.oPD.findFirst({
      where: { opdId, deletedAt: null },
      select: { opdId: true, nama: true },
    });
  }

  async countOpdWithBerlakuSop(search?: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ total: bigint | number }>>`
      SELECT COUNT(DISTINCT o.opdId) AS total
      FROM OPD o
      WHERE o.deletedAt IS NULL
        ${search ? Prisma.sql`AND o.nama LIKE ${`%${search}%`}` : Prisma.empty}
        AND EXISTS (
          SELECT 1
          FROM SOP s
          JOIN DetailSOP d ON d.sopId = s.sopId
          JOIN DokumenTte dt ON dt.detailSopId = d.detailSopId
          WHERE s.opdId = o.opdId
            AND d.status = ${StatusSOP.BERLAKU}
            AND dt.jenisDokumen = ${JenisDokumenTte.SOP_BERLAKU}
            AND dt.pdfStatus = ${'PUBLISHED'}
            AND dt.pdfPath IS NOT NULL
        )
    `;
    return this.toCount(rows);
  }

  async findOpdWithBerlakuSop(params: {
    search?: string;
    skip: number;
    take: number;
  }): Promise<PublicOpdDbRow[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{ opdId: string; nama: string; jumlahSopBerlaku: bigint | number }>
    >`
      SELECT o.opdId, o.nama, COUNT(DISTINCT s.sopId) AS jumlahSopBerlaku
      FROM OPD o
      JOIN SOP s ON s.opdId = o.opdId
      JOIN DetailSOP d ON d.sopId = s.sopId
      JOIN DokumenTte dt ON dt.detailSopId = d.detailSopId
      WHERE o.deletedAt IS NULL
        AND d.status = ${StatusSOP.BERLAKU}
        AND dt.jenisDokumen = ${JenisDokumenTte.SOP_BERLAKU}
        AND dt.pdfStatus = ${'PUBLISHED'}
        AND dt.pdfPath IS NOT NULL
        ${params.search ? Prisma.sql`AND o.nama LIKE ${`%${params.search}%`}` : Prisma.empty}
      GROUP BY o.opdId, o.nama
      ORDER BY o.nama ASC
      LIMIT ${params.take} OFFSET ${params.skip}
    `;
    return rows.map((row) => ({
      opdId: row.opdId,
      nama: row.nama,
      jumlahSopBerlaku: Number(row.jumlahSopBerlaku),
    }));
  }

  async countBerlakuSopByOpd(opdId: string, search?: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ total: bigint | number }>>`
      SELECT COUNT(*) AS total
      FROM DetailSOP d
      JOIN SOP s ON s.sopId = d.sopId
      JOIN OPD o ON o.opdId = s.opdId
      JOIN DokumenTte dt ON dt.detailSopId = d.detailSopId
      WHERE s.opdId = ${opdId}
        AND o.deletedAt IS NULL
        AND d.status = ${StatusSOP.BERLAKU}
        AND dt.jenisDokumen = ${JenisDokumenTte.SOP_BERLAKU}
        AND dt.pdfStatus = ${'PUBLISHED'}
        AND dt.pdfPath IS NOT NULL
        ${this.searchSql(search)}
    `;
    return this.toCount(rows);
  }

  async findBerlakuSopByOpd(params: {
    opdId: string;
    search?: string;
    skip: number;
    take: number;
  }): Promise<PublicSopDbRow[]> {
    return this.findPublishedSopRows(
      Prisma.sql`s.opdId = ${params.opdId}`,
      params.search,
      params.skip,
      params.take,
    );
  }

  async countBerlakuSopGlobal(search?: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ total: bigint | number }>>`
      SELECT COUNT(*) AS total
      FROM DetailSOP d
      JOIN SOP s ON s.sopId = d.sopId
      JOIN OPD o ON o.opdId = s.opdId
      JOIN DokumenTte dt ON dt.detailSopId = d.detailSopId
      WHERE o.deletedAt IS NULL
        AND d.status = ${StatusSOP.BERLAKU}
        AND dt.jenisDokumen = ${JenisDokumenTte.SOP_BERLAKU}
        AND dt.pdfStatus = ${'PUBLISHED'}
        AND dt.pdfPath IS NOT NULL
        ${this.searchSql(search, true)}
    `;
    return this.toCount(rows);
  }

  async findBerlakuSopGlobal(params: {
    search?: string;
    skip: number;
    take: number;
  }): Promise<PublicSopDbRow[]> {
    return this.findPublishedSopRows(
      Prisma.sql`1 = 1`,
      params.search,
      params.skip,
      params.take,
      true,
    );
  }

  async findPublishedPdfByDetailSopId(detailSopId: string): Promise<PublicSopPdfDbRow | null> {
    const rows = await this.prisma.$queryRaw<PublicSopPdfDbRow[]>`
      SELECT d.detailSopId, s.judul, d.nomorSOP, d.versi, dt.pdfPath, dt.pdfSha256
      FROM DetailSOP d
      JOIN SOP s ON s.sopId = d.sopId
      JOIN OPD o ON o.opdId = s.opdId
      JOIN DokumenTte dt ON dt.detailSopId = d.detailSopId
      WHERE d.detailSopId = ${detailSopId}
        AND o.deletedAt IS NULL
        AND d.status = ${StatusSOP.BERLAKU}
        AND dt.jenisDokumen = ${JenisDokumenTte.SOP_BERLAKU}
        AND dt.pdfStatus = ${'PUBLISHED'}
        AND dt.pdfPath IS NOT NULL
      LIMIT 1
    `;
    return rows[0] ?? null;
  }

  private async findPublishedSopRows(
    extraWhere: Prisma.Sql,
    search: string | undefined,
    skip: number,
    take: number,
    includeOpdInSearch = false,
  ): Promise<PublicSopDbRow[]> {
    return this.prisma.$queryRaw<PublicSopDbRow[]>`
      SELECT
        d.detailSopId,
        d.sopId,
        s.opdId,
        s.judul,
        d.nomorSOP,
        d.versi,
        d.tanggalEfektif,
        o.nama AS opdNama,
        dt.pdfPath
      FROM DetailSOP d
      JOIN SOP s ON s.sopId = d.sopId
      JOIN OPD o ON o.opdId = s.opdId
      JOIN DokumenTte dt ON dt.detailSopId = d.detailSopId
      WHERE ${extraWhere}
        AND o.deletedAt IS NULL
        AND d.status = ${StatusSOP.BERLAKU}
        AND dt.jenisDokumen = ${JenisDokumenTte.SOP_BERLAKU}
        AND dt.pdfStatus = ${'PUBLISHED'}
        AND dt.pdfPath IS NOT NULL
        ${this.searchSql(search, includeOpdInSearch)}
      ORDER BY s.judul ASC
      LIMIT ${take} OFFSET ${skip}
    `;
  }

  private searchSql(search?: string, includeOpd = false): Prisma.Sql {
    if (search === undefined) {
      return Prisma.empty;
    }
    const like = `%${search}%`;
    return includeOpd
      ? Prisma.sql`AND (d.nomorSOP LIKE ${like} OR s.judul LIKE ${like} OR o.nama LIKE ${like})`
      : Prisma.sql`AND (d.nomorSOP LIKE ${like} OR s.judul LIKE ${like})`;
  }

  private toCount(rows: Array<{ total: bigint | number }>): number {
    return Number(rows[0]?.total ?? 0);
  }
}
