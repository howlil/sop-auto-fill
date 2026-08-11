import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtAccessPayload } from '../../../common';
import {
  JenisPengajuanEvaluasi,
  PeranPengguna,
  Prisma,
  StatusPengajuanEvaluasi,
  StatusSOP,
} from '../../../generated/prisma';
import {
  mapPengajuanEvaluasiRow,
  type PengajuanEvaluasiApiPayload,
} from './pengajuan-evaluasi.mapper';
import {
  resolvePagination,
  toPaginatedData,
  type PaginatedData,
} from '../../../common/utils/pagination.util';
import type { CreatePengajuanEvaluasiDto } from './dto/create-pengajuan-evaluasi.dto';
import type { PengajuanEvaluasiListQueryDto } from './dto/pengajuan-evaluasi-list-query.dto';
import type { PengajuanEvaluasiRingkasQueryDto } from './dto/pengajuan-evaluasi-ringkas-query.dto';
import { STATUS_PENGAJUAN_AKTIF_LINTAS_JOBDESK } from './pengajuan-evaluasi-status.constants';
import { UserOpdAccessService } from '../../core/opd/user-opd-access.service';
import { PengajuanEvaluasiRepository } from './pengajuan-evaluasi.repository';

/** Detail SOP yang boleh dimasukkan pengajuan evaluasi baru (alur penyusun → evaluator). */
const STATUS_DETAIL_SIAP_PENGAJUAN_EVALUASI: readonly StatusSOP[] = [
  StatusSOP.MENUNGGU_PENGAJUAN_EVALUASI,
] as const;

const statusSiapPengajuanEvaluasiSet = new Set<string>(STATUS_DETAIL_SIAP_PENGAJUAN_EVALUASI);

/** Satu baris pipeline workspace (detail terbaru per SOP) untuk bootstrap EVALUASI_REQUEST_OPD. */
export type BarisPipelineEvaluasiOpd = Readonly<{
  detailSopId: string;
  statusDetail: StatusSOP;
}>;

/**
 * Daftar & detail pengajuan evaluasi (REST) serta pembukaan pengajuan oleh PJ Penyusun.
 */
@Injectable()
export class PengajuanEvaluasiService {
  constructor(
    private readonly pengajuanEvaluasiRepository: PengajuanEvaluasiRepository,
    private readonly userOpdAccessService: UserOpdAccessService,
  ) {}

  /** Daftar pengajuan — PJ Penyusun & Kepala OPD otomatis dibatasi ke OPD-nya. */
  async findAll(
    user: JwtAccessPayload,
    query: PengajuanEvaluasiListQueryDto,
  ): Promise<PengajuanEvaluasiApiPayload[]> {
    const forcedOpdId = await this.resolveForcedOpdFilter(user);
    const whereInput = this.pengajuanEvaluasiRepository.buildWhereFromQuery(query, forcedOpdId);
    const rows = await this.pengajuanEvaluasiRepository.findManyFiltered(whereInput);
    return rows.map((r) => mapPengajuanEvaluasiRow(r, user.peran));
  }

  /** Daftar ringkas terpaginasi untuk dashboard evaluator / PJ (performa). */
  async findAllRingkas(
    user: JwtAccessPayload,
    query: PengajuanEvaluasiRingkasQueryDto,
  ): Promise<PaginatedData<Record<string, unknown>>> {
    const forcedOpdId = await this.resolveForcedOpdFilter(user);
    const whereInput = this.pengajuanEvaluasiRepository.buildWhereRingkasFromQuery(
      query,
      forcedOpdId,
    );
    const { skip, take, page, limit } = resolvePagination(query);
    const [total, rows] = await Promise.all([
      this.pengajuanEvaluasiRepository.countWhere(whereInput),
      this.pengajuanEvaluasiRepository.findRingkasPage(whereInput, skip, take),
    ]);
    return toPaginatedData(rows, total, page, limit);
  }

  /** Satu pengajuan lengkap — PJ Penyusun/Kepala OPD hanya boleh mengakses OPD sendiri. */
  async findOne(
    user: JwtAccessPayload,
    pengajuanEvaluasiId: string,
  ): Promise<PengajuanEvaluasiApiPayload> {
    const row = await this.pengajuanEvaluasiRepository.findByIdFull(pengajuanEvaluasiId);
    if (row === null) {
      throw new NotFoundException('Pengajuan evaluasi tidak ditemukan');
    }
    await this.assertCanAccessPengajuan(user, row.opdId);
    return mapPengajuanEvaluasiRow(row, user.peran);
  }

  /** Membuka pengajuan evaluasi (SEDANG_DIEVALUASI + baris nilai per dokumen). Hanya PJ Penyusun OPD terkait. */
  async create(
    user: JwtAccessPayload,
    dto: CreatePengajuanEvaluasiDto,
  ): Promise<PengajuanEvaluasiApiPayload> {
    if (user.peran !== PeranPengguna.PJ_PENYUSUN) {
      throw new ForbiddenException('Hanya PJ Penyusun yang dapat membuka pengajuan evaluasi');
    }
    const opdIdPengguna = await this.userOpdAccessService.getRequiredUserOpdId(
      user.sub,
      'OPD pengguna tidak ditemukan',
    );
    const sopDetailIds = this.uniqueSopDetailIds(dto.sopDetailIds);
    const idBaru = await this.pengajuanEvaluasiRepository.runTransaction(
      async (tx: Prisma.TransactionClient) => {
        const blocking = await tx.pengajuanEvaluasi.findFirst({
          where: {
            opdId: opdIdPengguna,
            status: {
              in: [...STATUS_PENGAJUAN_AKTIF_LINTAS_JOBDESK],
            },
          },
          select: { pengajuanEvaluasiId: true },
        });
        if (blocking !== null) {
          throw new ConflictException(
            'OPD ini masih memiliki pengajuan evaluasi aktif. Selesaikan atau tutup terlebih dahulu.',
          );
        }
        await this.assertDetailSopSiapDalamOpd(tx, sopDetailIds, opdIdPengguna, 'Anda');
        const sekarang = new Date();
        const dibuat = await tx.pengajuanEvaluasi.create({
          data: {
            opdId: opdIdPengguna,
            jenis: dto.jenis,
            status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
            tanggalPermintaan: sekarang,
            tanggalEvaluasi: sekarang,
            nilaiEvaluasi: {
              create: sopDetailIds.map((detailSopId) => ({ detailSopId })),
            },
          },
          select: { pengajuanEvaluasiId: true },
        });
        const promoted = await tx.detailSOP.updateMany({
          where: {
            detailSopId: { in: sopDetailIds },
            status: { in: [...STATUS_DETAIL_SIAP_PENGAJUAN_EVALUASI] },
          },
          data: { status: StatusSOP.SEDANG_DIEVALUASI },
        });
        if (promoted.count !== sopDetailIds.length) {
          throw new ConflictException(
            'Sebagian SOP tidak lagi berstatus MENUNGGU_PENGAJUAN_EVALUASI. Muat ulang daftar SOP lalu coba lagi.',
          );
        }
        return dibuat.pengajuanEvaluasiId;
      },
    );
    const created = await this.pengajuanEvaluasiRepository.findByIdFull(idBaru);
    if (created === null) {
      throw new ConflictException('Gagal memuat pengajuan setelah pembuatan');
    }
    return mapPengajuanEvaluasiRow(created, user.peran);
  }

  /**
   * Untuk workspace evaluator: jika belum ada pengajuan aktif dan ada dokumen eligibel,
   * buat pengajuan `EVALUASI_REQUEST_OPD` + baris `NilaiEvaluasi` (tanpa menunggu PJ membuka pengajuan evaluasi).
   * No-op jika sudah ada pengajuan aktif atau pemanggil bukan EVALUATOR.
   */
  async pastikanPengajuanRequestOpdUntukEvaluator(
    user: JwtAccessPayload,
    opdId: string,
    pipelineRows: ReadonlyArray<BarisPipelineEvaluasiOpd>,
  ): Promise<void> {
    if (user.peran !== PeranPengguna.EVALUATOR) {
      return;
    }
    const sopDetailIds = pipelineRows
      .filter((r) => statusSiapPengajuanEvaluasiSet.has(String(r.statusDetail)))
      .map((r) => r.detailSopId);
    if (sopDetailIds.length === 0) {
      return;
    }
    await this.pengajuanEvaluasiRepository.runTransaction(async (tx: Prisma.TransactionClient) => {
      const blocking = await tx.pengajuanEvaluasi.findFirst({
        where: {
          opdId,
          status: {
            in: [...STATUS_PENGAJUAN_AKTIF_LINTAS_JOBDESK],
          },
        },
        select: { pengajuanEvaluasiId: true },
      });
      if (blocking !== null) {
        return;
      }
      await this.assertDetailSopSiapDalamOpd(tx, sopDetailIds, opdId);
      const sekarang = new Date();
      await tx.pengajuanEvaluasi.create({
        data: {
          opdId,
          jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_OPD,
          status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
          tanggalPermintaan: sekarang,
          tanggalEvaluasi: sekarang,
          nilaiEvaluasi: {
            create: sopDetailIds.map((detailSopId) => ({ detailSopId })),
          },
        },
        select: { pengajuanEvaluasiId: true },
      });
      const promoted = await tx.detailSOP.updateMany({
        where: {
          detailSopId: { in: sopDetailIds },
          status: { in: [...STATUS_DETAIL_SIAP_PENGAJUAN_EVALUASI] },
        },
        data: { status: StatusSOP.SEDANG_DIEVALUASI },
      });
      if (promoted.count !== sopDetailIds.length) {
        throw new ConflictException(
          'Sebagian SOP tidak lagi berstatus MENUNGGU_PENGAJUAN_EVALUASI. Muat ulang halaman lalu coba lagi.',
        );
      }
    });
  }

  /** OPD terikat akun PJ Penyusun / Kepala OPD (untuk workspace tanpa param opdId). */
  async resolveOpdIdTerikat(user: JwtAccessPayload): Promise<string> {
    const opdId = await this.resolveForcedOpdFilter(user);
    if (opdId === undefined) {
      throw new ForbiddenException(
        'Hanya PJ Penyusun atau Kepala OPD yang dapat mengakses evaluasi OPD sendiri',
      );
    }
    return opdId;
  }

  private async resolveForcedOpdFilter(user: JwtAccessPayload): Promise<string | undefined> {
    if (user.peran === PeranPengguna.PJ_EVALUATOR || user.peran === PeranPengguna.EVALUATOR) {
      return undefined;
    }
    if (
      user.peran === PeranPengguna.PENYUSUN ||
      user.peran === PeranPengguna.PJ_PENYUSUN ||
      user.peran === PeranPengguna.KEPALA_OPD
    ) {
      return this.userOpdAccessService.getRequiredUserOpdId(
        user.sub,
        'OPD pengguna tidak ditemukan',
      );
    }
    throw new ForbiddenException('Peran tidak diizinkan mengakses daftar pengajuan evaluasi');
  }

  private uniqueSopDetailIds(sopDetailIds: readonly string[]): string[] {
    const uniqueIds = Array.from(new Set(sopDetailIds));
    if (uniqueIds.length !== sopDetailIds.length) {
      throw new BadRequestException('Daftar SOP tidak boleh berisi duplikasi');
    }
    return uniqueIds;
  }

  private async assertDetailSopSiapDalamOpd(
    tx: Prisma.TransactionClient,
    detailSopIds: readonly string[],
    opdId: string,
    ownerLabel = '',
  ): Promise<void> {
    const details = await tx.detailSOP.findMany({
      where: {
        detailSopId: { in: [...detailSopIds] },
        sop: { opdId },
      },
      select: { detailSopId: true, status: true },
    });
    const byId = new Map(details.map((detail) => [detail.detailSopId, detail]));
    for (const detailSopId of detailSopIds) {
      const detail = byId.get(detailSopId);
      if (detail === undefined) {
        const suffix = ownerLabel.length > 0 ? ` ${ownerLabel}.` : '.';
        throw new BadRequestException(
          `Detail SOP ${detailSopId} tidak ditemukan atau bukan milik OPD${suffix}`,
        );
      }
      if (!statusSiapPengajuanEvaluasiSet.has(String(detail.status))) {
        throw new BadRequestException(
          `Detail SOP ${detailSopId} berstatus ${String(detail.status)} dan tidak dapat dimasukkan pengajuan evaluasi.`,
        );
      }
    }
  }

  /**
   * Validasi akses baca pengajuan (dipakai sub-resource dokumen SOP & Berita Acara).
   */
  async assertUserCanAccessPengajuan(
    user: JwtAccessPayload,
    pengajuanOpdId: string,
  ): Promise<void> {
    await this.assertCanAccessPengajuan(user, pengajuanOpdId);
  }

  private async assertCanAccessPengajuan(
    user: JwtAccessPayload,
    pengajuanOpdId: string,
  ): Promise<void> {
    if (user.peran === PeranPengguna.PJ_EVALUATOR || user.peran === PeranPengguna.EVALUATOR) {
      return;
    }
    if (
      user.peran === PeranPengguna.PENYUSUN ||
      user.peran === PeranPengguna.PJ_PENYUSUN ||
      user.peran === PeranPengguna.KEPALA_OPD
    ) {
      await this.userOpdAccessService.assertSameOpd(
        user.sub,
        pengajuanOpdId,
        'Anda tidak dapat mengakses pengajuan evaluasi OPD lain',
      );
      return;
    }
    throw new ForbiddenException('Peran tidak diizinkan mengakses detail pengajuan evaluasi');
  }
}
