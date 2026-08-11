import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtAccessPayload } from '../../../common';
import { PeranPengguna, Prisma, StatusSOP } from '../../../generated/prisma';
import { displayStatusSop } from '../../../common/status/status-display';
import { extractDbInvariantMessage } from '../../../common/prisma/prisma-db-invariant.util';
import {
  assertDetailSopEditable,
  hasRevisiInFlight,
  TERMINAL_DETAIL_STATUSES,
} from '../../../common/status/sop-editable.util';
import { UserOpdAccessService } from '../../core/opd/user-opd-access.service';
import type { CreateSopDto } from './dto/create-sop.dto';
import type { PenyusunWorkbenchDataDto } from './dto/penyusun-workbench-data.dto';
import type { SopRiwayatVersiRowDto } from './dto/sop-riwayat-versi-row.dto';
import type { SopDaftarRowDto } from './dto/sop-daftar-row.dto';
import type { UpdateDetailSopStatusDto } from './dto/update-detail-sop-status.dto';
import type { UpdateSopHeaderDto } from './dto/update-sop-header.dto';
import type { ListSopQueryDto } from './dto/list-sop-query.dto';
import type { PublicSopDokumenDto } from '../public/dto/public-sop-dokumen.dto';
import { assertSopCatalogRepoOk } from './sop-catalog-repo-error.util';
import { assertSopWorkbenchCompleteForSiapDievaluasi } from './sop-completeness.validator';
import { mapDaftarRow, mapWorkbenchPayload } from './sop-catalog.mapper';
import { assertAllowedSopStatusTransition } from './sop-status-policy';
import {
  SopCatalogRepository,
  type SopDaftarListFilters,
  type UpdateSopHeaderRepoInput,
} from './sop-catalog.repository';

const DEFAULT_WORKBENCH_LOG_LIMIT = 100;
const MAX_WORKBENCH_LOG_LIMIT = 500;

@Injectable()
export class SopCatalogService {
  constructor(
    private readonly sopCatalogRepository: SopCatalogRepository,
    private readonly userOpdAccessService: UserOpdAccessService,
  ) {}

  private clampLogsLimit(raw: number | undefined): number {
    if (raw === undefined || Number.isNaN(raw)) {
      return DEFAULT_WORKBENCH_LOG_LIMIT;
    }
    const n = Math.floor(raw);
    if (n < 1) {
      return 1;
    }
    if (n > MAX_WORKBENCH_LOG_LIMIT) {
      return MAX_WORKBENCH_LOG_LIMIT;
    }
    return n;
  }

  private async assertOpdAccessForWorkbench(
    user: JwtAccessPayload,
    sopOpdId: string,
  ): Promise<void> {
    await this.userOpdAccessService.assertWorkbenchAccess(user, sopOpdId);
  }

  async getPenyusunWorkbench(
    user: JwtAccessPayload,
    detailSopId: string,
    logsLimitRaw?: number,
  ): Promise<PenyusunWorkbenchDataDto> {
    const logsLimit = this.clampLogsLimit(logsLimitRaw);
    const row = await this.sopCatalogRepository.findWorkbenchPayloadByDetailOrSopId(
      detailSopId,
      logsLimit,
    );
    if (row === null) {
      throw new NotFoundException('DetailSOP tidak ditemukan');
    }
    await this.assertOpdAccessForWorkbench(user, row.sop.opdId);
    return mapWorkbenchPayload(row);
  }

  /**
   * Workbench untuk pratinjau SOP dalam konteks pengajuan evaluasi (batch).
   * Keanggotaan batch dan akses pengajuan sudah divalidasi di modul evaluation;
   * tanpa assert OPD agar PJ/Evaluator lintas OPD dapat memuat dokumen lengkap.
   */
  async getPenyusunWorkbenchForEvaluasiContext(
    detailSopId: string,
    logsLimitRaw?: number,
  ): Promise<PenyusunWorkbenchDataDto> {
    const logsLimit = this.clampLogsLimit(logsLimitRaw);
    const row = await this.sopCatalogRepository.findWorkbenchPayloadByDetailOrSopId(
      detailSopId,
      logsLimit,
    );
    if (row === null) {
      throw new NotFoundException('DetailSOP tidak ditemukan');
    }
    return mapWorkbenchPayload(row);
  }

  /**
   * Dokumen SOP berlaku untuk arsip publik (tanpa log audit dan umpan balik evaluasi).
   */
  async getPublicDokumenBerlaku(detailSopId: string): Promise<PublicSopDokumenDto> {
    const row = await this.sopCatalogRepository.findWorkbenchPayloadByDetailOrSopId(detailSopId, 0);
    if (row === null) {
      throw new NotFoundException('DetailSOP tidak ditemukan');
    }
    if (row.status !== StatusSOP.BERLAKU) {
      throw new NotFoundException('Hanya dokumen SOP berstatus berlaku yang dapat diakses publik');
    }
    const workbench = mapWorkbenchPayload(row);
    return {
      opd: {
        id: row.sop.opdId,
        nama: row.sop.opd.nama,
      },
      detail: {
        ...workbench.detail,
        nilaiEvaluasi: [],
      },
      langkah: workbench.langkah,
      diagramKonfigurasi: workbench.diagramKonfigurasi,
    };
  }

  /**
   * Kepala OPD: cabut versi BERLAKU SOP (bukan versi terbaru bila ada revisi yang sedang berjalan).
   * Ditolak bila masih ada revisi yang sedang berjalan pada header SOP yang sama.
   */
  async cabutSopBerlaku(
    user: JwtAccessPayload,
    detailOrSopId: string,
    logsLimitRaw?: number,
  ): Promise<PenyusunWorkbenchDataDto> {
    if (user.peran !== PeranPengguna.KEPALA_OPD) {
      throw new ForbiddenException('Hanya Kepala OPD yang dapat mencabut SOP');
    }
    const resolved = await this.sopCatalogRepository.findDetailIdByDetailOrSopId(detailOrSopId);
    if (resolved === null) {
      throw new NotFoundException('DetailSOP tidak ditemukan');
    }
    const ctx = await this.sopCatalogRepository.findLatestDetailStatusContext(resolved.sopId);
    if (ctx === null) {
      throw new NotFoundException('SOP tidak ditemukan');
    }
    await this.assertOpdAccessForWorkbench(user, ctx.sopOpdId);
    const riwayat = await this.sopCatalogRepository.findRiwayatVersiBySopId(resolved.sopId);
    const allStatuses = riwayat.map((r) => r.status);
    if (hasRevisiInFlight(allStatuses)) {
      throw new ConflictException(
        'Tidak dapat mencabut SOP karena masih ada revisi yang sedang berjalan. Selesaikan atau batalkan revisi terlebih dahulu.',
      );
    }
    const berlaku = riwayat.find((r) => r.status === StatusSOP.BERLAKU);
    if (berlaku === undefined) {
      throw new ConflictException('SOP tidak memiliki versi berlaku yang dapat dicabut');
    }
    const logsLimit = this.clampLogsLimit(logsLimitRaw);
    await this.sopCatalogRepository.updateDetailSopStatus({
      detailSopId: berlaku.detailSopId,
      status: StatusSOP.DICABUT,
      userId: user.sub,
    });
    const refreshed = await this.sopCatalogRepository.findWorkbenchPayloadByDetailOrSopId(
      berlaku.detailSopId,
      logsLimit,
    );
    if (refreshed === null) {
      throw new NotFoundException('DetailSOP tidak ditemukan setelah pencabutan');
    }
    return mapWorkbenchPayload(refreshed);
  }

  /**
   * Ubah status DetailSOP terbaru (param boleh detailSopId atau sopId header).
   * Mengembalikan area kerja penyusun terbaru.
   */
  async transitionDetailSopStatus(
    user: JwtAccessPayload,
    detailOrSopId: string,
    dto: UpdateDetailSopStatusDto,
    logsLimitRaw?: number,
  ): Promise<PenyusunWorkbenchDataDto> {
    if (dto.status === StatusSOP.DICABUT) {
      return this.cabutSopBerlaku(user, detailOrSopId, logsLimitRaw);
    }
    const ctx = await this.sopCatalogRepository.findLatestDetailStatusContext(detailOrSopId);
    if (ctx === null) {
      throw new NotFoundException('DetailSOP tidak ditemukan');
    }
    await this.assertOpdAccessForWorkbench(user, ctx.sopOpdId);
    assertAllowedSopStatusTransition({
      role: user.peran,
      current: ctx.status,
      target: dto.status,
    });
    const logsLimit = this.clampLogsLimit(logsLimitRaw);
    if (dto.status === StatusSOP.MENUNGGU_PENGAJUAN_EVALUASI) {
      const draftPayload = await this.sopCatalogRepository.findWorkbenchPayloadByDetailOrSopId(
        ctx.detailSopId,
        logsLimit,
      );
      if (draftPayload === null) {
        throw new NotFoundException('DetailSOP tidak ditemukan');
      }
      assertSopWorkbenchCompleteForSiapDievaluasi(draftPayload);
    }
    await this.sopCatalogRepository.updateDetailSopStatus({
      detailSopId: ctx.detailSopId,
      status: dto.status,
      userId: user.sub,
    });
    const refreshed = await this.sopCatalogRepository.findWorkbenchPayloadByDetailOrSopId(
      ctx.detailSopId,
      logsLimit,
    );
    if (refreshed === null) {
      throw new NotFoundException('DetailSOP tidak ditemukan setelah ubah status');
    }
    return mapWorkbenchPayload(refreshed);
  }

  /**
   * PJ Penyusun: satu aksi dari `REVISI_DARI_EVALUATOR` setelah perbaikan penyusun —
   * validasi kelengkapan seperti Siap Dievaluasi, lalu transaksi MENUNGGU_PENGAJUAN_EVALUASI → SEDANG_DIEVALUASI.
   * Berbeda dari `PATCH /sop/status` ke `DIAJUKAN_EVALUASI` yang hanya untuk PJ pada SOP sudah SIAP.
   */
  async kirimUlangKeEvaluatorSetelahRevisi(
    user: JwtAccessPayload,
    detailOrSopId: string,
    logsLimitRaw?: number,
  ): Promise<PenyusunWorkbenchDataDto> {
    if (user.peran !== PeranPengguna.PJ_PENYUSUN) {
      throw new ForbiddenException(
        'Hanya PJ Penyusun yang dapat mengirim ulang ke evaluator setelah revisi',
      );
    }
    const ctx = await this.sopCatalogRepository.findLatestDetailStatusContext(detailOrSopId);
    if (ctx === null) {
      throw new NotFoundException('DetailSOP tidak ditemukan');
    }
    if (ctx.status !== StatusSOP.REVISI_DARI_EVALUATOR) {
      throw new ConflictException(
        `Hanya SOP berstatus REVISI_DARI_EVALUATOR yang dapat dikirim ulang ke evaluator (status saat ini: ${String(ctx.status)})`,
      );
    }
    await this.assertOpdAccessForWorkbench(user, ctx.sopOpdId);
    const logsLimit = this.clampLogsLimit(logsLimitRaw);
    const draftPayload = await this.sopCatalogRepository.findWorkbenchPayloadByDetailOrSopId(
      ctx.detailSopId,
      logsLimit,
    );
    if (draftPayload === null) {
      throw new NotFoundException('DetailSOP tidak ditemukan');
    }
    assertSopWorkbenchCompleteForSiapDievaluasi(draftPayload);
    await this.sopCatalogRepository.transitionDetailSopRevisiToSedangDievaluasi({
      detailSopId: ctx.detailSopId,
      userId: user.sub,
    });
    const refreshed = await this.sopCatalogRepository.findWorkbenchPayloadByDetailOrSopId(
      ctx.detailSopId,
      logsLimit,
    );
    if (refreshed === null) {
      throw new NotFoundException('DetailSOP tidak ditemukan setelah kirim ulang evaluasi');
    }
    return mapWorkbenchPayload(refreshed);
  }

  private collectChangedHeaderFields(dto: UpdateSopHeaderDto): string[] {
    const out: string[] = [];
    if (dto.judul !== undefined) out.push('judul');
    if (dto.nomorSOP !== undefined) out.push('nomorSOP');
    if (dto.namaLembaga !== undefined) out.push('namaLembaga');
    if (dto.dasarHukumPeraturanIds !== undefined) out.push('dasarHukumPeraturanIds');
    if (dto.sopTerkaitDetailIds !== undefined) out.push('sopTerkaitDetailIds');
    if (dto.lampiran?.peringatan !== undefined) out.push('peringatan');
    if (dto.lampiran?.kualifikasiPelaksanaan !== undefined) out.push('kualifikasiPelaksanaan');
    if (dto.lampiran?.peralatanPerlengkapan !== undefined) out.push('peralatanPerlengkapan');
    if (dto.lampiran?.pencatatanPendataan !== undefined) out.push('pencatatanPendataan');
    return out;
  }

  private toRepoInput(dto: UpdateSopHeaderDto): UpdateSopHeaderRepoInput {
    return {
      judul: dto.judul,
      nomorSOP: dto.nomorSOP,
      namaLembaga: dto.namaLembaga,
      dasarHukumPeraturanIds: dto.dasarHukumPeraturanIds,
      sopTerkaitDetailIds: dto.sopTerkaitDetailIds,
      lampiran: dto.lampiran,
    };
  }

  /**
   * PATCH header SOP untuk panel kanan editor penyusun. Param `detailOrSopId`
   * boleh berupa `detailSopId` atau `sopId` (header) — versi terbaru dipakai bila header.
   * Mengembalikan area kerja terbaru sehingga klien bisa `setQueryData` tanpa GET ulang.
   */
  async updatePenyusunHeader(
    user: JwtAccessPayload,
    detailOrSopId: string,
    dto: UpdateSopHeaderDto,
    logsLimitRaw?: number,
  ): Promise<PenyusunWorkbenchDataDto> {
    const resolved = await this.sopCatalogRepository.findDetailIdByDetailOrSopId(detailOrSopId);
    if (resolved === null) {
      throw new NotFoundException('DetailSOP tidak ditemukan');
    }
    const logsLimit = this.clampLogsLimit(logsLimitRaw);
    const existing = await this.sopCatalogRepository.findWorkbenchPayloadByDetailOrSopId(
      resolved.detailSopId,
      logsLimit,
    );
    if (existing === null) {
      throw new NotFoundException('DetailSOP tidak ditemukan');
    }
    await this.assertOpdAccessForWorkbench(user, existing.sop.opdId);
    assertDetailSopEditable(existing.status);
    const changedFields = this.collectChangedHeaderFields(dto);
    if (changedFields.length > 0) {
      try {
        const headerResult = await this.sopCatalogRepository.updateSopHeaderTransaction({
          detailSopId: resolved.detailSopId,
          sopId: resolved.sopId,
          userId: user.sub,
          input: this.toRepoInput(dto),
          changedFields,
        });
        assertSopCatalogRepoOk(headerResult);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new ConflictException('Nomor SOP sudah digunakan');
        }
        const invariant = extractDbInvariantMessage(err);
        if (invariant) {
          throw new BadRequestException(invariant);
        }
        throw err;
      }
    }
    const refreshed = await this.sopCatalogRepository.findWorkbenchPayloadByDetailOrSopId(
      resolved.detailSopId,
      logsLimit,
    );
    if (refreshed === null) {
      throw new NotFoundException('DetailSOP tidak ditemukan setelah update');
    }
    return mapWorkbenchPayload(refreshed);
  }

  private normalizeListFilters(query?: ListSopQueryDto): SopDaftarListFilters {
    if (query === undefined) {
      return {};
    }
    const statusRaw = query.status?.trim();
    const status =
      statusRaw === undefined || statusRaw.length === 0 || statusRaw === 'all'
        ? undefined
        : statusRaw;
    const tanggalDari = query.tanggalDari?.trim() || undefined;
    const tanggalSampai = query.tanggalSampai?.trim() || undefined;
    if (tanggalDari !== undefined && tanggalSampai !== undefined && tanggalDari > tanggalSampai) {
      throw new BadRequestException('tanggalDari tidak boleh lebih besar dari tanggalSampai');
    }
    return { status, tanggalDari, tanggalSampai };
  }

  async listForCurrentUser(
    user: JwtAccessPayload,
    query?: ListSopQueryDto,
  ): Promise<SopDaftarRowDto[]> {
    const filters = this.normalizeListFilters(query);
    if (this.userOpdAccessService.isEvaluatorRole(user.peran)) {
      const rows = await this.sopCatalogRepository.findDaftarAll(filters);
      return rows.map((r) => mapDaftarRow(r));
    }
    const opdId = await this.userOpdAccessService.getRequiredUserOpdId(user.sub);
    const rows = await this.sopCatalogRepository.findDaftarByOpdId(opdId, filters);
    return rows.map((r) => mapDaftarRow(r));
  }

  async createForPenyusun(user: JwtAccessPayload, dto: CreateSopDto): Promise<SopDaftarRowDto> {
    const opdId = await this.userOpdAccessService.getRequiredUserOpdId(user.sub);
    const trimmedJudul = dto.judul.trim();
    /** Hanya diisi bila klien mengirim nilai; tidak mengambil nama OPD/judul otomatis. */
    const namaLembaga =
      dto.namaLembaga === undefined || dto.namaLembaga === null ? '' : dto.namaLembaga.trim();
    try {
      const row = await this.sopCatalogRepository.createSopWithInitialDetail({
        judul: trimmedJudul,
        nomorSOP: dto.nomorSop.trim(),
        opdId,
        penggunaId: user.sub,
        namaLembaga,
      });
      return mapDaftarRow(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Nomor SOP sudah digunakan');
      }
      throw err;
    }
  }

  private assertPenyusunOrPj(user: JwtAccessPayload): void {
    if (user.peran !== PeranPengguna.PENYUSUN && user.peran !== PeranPengguna.PJ_PENYUSUN) {
      throw new ForbiddenException('Hanya Penyusun atau PJ Penyusun yang dapat melakukan aksi ini');
    }
  }

  async buatVersiBaruDariSumber(
    user: JwtAccessPayload,
    detailOrSopId: string,
    logsLimitRaw?: number,
  ): Promise<PenyusunWorkbenchDataDto> {
    this.assertPenyusunOrPj(user);
    const resolved = await this.sopCatalogRepository.findDetailIdByDetailOrSopId(detailOrSopId);
    if (resolved === null) {
      throw new NotFoundException('DetailSOP tidak ditemukan');
    }
    const source = await this.sopCatalogRepository.findLatestDetailStatusContext(
      resolved.detailSopId,
    );
    if (source === null) {
      throw new NotFoundException('DetailSOP tidak ditemukan');
    }
    await this.assertOpdAccessForWorkbench(user, source.sopOpdId);
    try {
      const cloned = assertSopCatalogRepoOk(
        await this.sopCatalogRepository.cloneDetailSopFromSource({
          sourceDetailSopId: source.detailSopId,
          penggunaId: user.sub,
        }),
      );
      return this.getPenyusunWorkbench(user, cloned.detailSopId, logsLimitRaw);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(
          'Versi baru lain telah dibuat secara bersamaan. Muat ulang riwayat versi.',
        );
      }
      throw err;
    }
  }

  async getRiwayatVersi(user: JwtAccessPayload, sopId: string): Promise<SopRiwayatVersiRowDto[]> {
    const header = await this.sopCatalogRepository.findDetailIdByDetailOrSopId(sopId);
    const resolvedSopId = header?.sopId ?? sopId;
    const firstDetail =
      await this.sopCatalogRepository.findLatestDetailStatusContext(resolvedSopId);
    if (firstDetail === null) {
      throw new NotFoundException('SOP tidak ditemukan');
    }
    await this.assertOpdAccessForWorkbench(user, firstDetail.sopOpdId);
    const rows = await this.sopCatalogRepository.findRiwayatVersiBySopId(resolvedSopId);
    const hasActiveRevision = hasRevisiInFlight(rows.map((r) => r.status));
    return rows.map((r) => {
      const statusDisplay = displayStatusSop(r.status);
      return {
        detailSopId: r.detailSopId,
        versi: r.versi,
        nomorSOP: r.nomorSOP,
        status: statusDisplay.value,
        statusLabel: statusDisplay.label,
        revisiDariDetailSopId: r.revisiDariDetailSopId,
        revisiDariVersi: r.revisiDariVersi,
        updatedAt: r.updatedAt.toISOString(),
        canHapusDraft: r.canHapusDraft,
        canBuatVersiBaru: !hasActiveRevision && TERMINAL_DETAIL_STATUSES.has(r.status),
      };
    });
  }

  async hapusVersiDraft(user: JwtAccessPayload, detailSopId: string): Promise<void> {
    this.assertPenyusunOrPj(user);
    const ctx = await this.sopCatalogRepository.findLatestDetailStatusContext(detailSopId);
    if (ctx === null) {
      throw new NotFoundException('DetailSOP tidak ditemukan');
    }
    await this.assertOpdAccessForWorkbench(user, ctx.sopOpdId);
    assertSopCatalogRepoOk(await this.sopCatalogRepository.deleteVersiDraft(ctx.detailSopId));
  }

  async hapusSopDraftAwal(user: JwtAccessPayload, detailSopId: string): Promise<void> {
    this.assertPenyusunOrPj(user);
    const ctx = await this.sopCatalogRepository.findLatestDetailStatusContext(detailSopId);
    if (ctx === null) {
      throw new NotFoundException('DetailSOP tidak ditemukan');
    }
    await this.assertOpdAccessForWorkbench(user, ctx.sopOpdId);
    assertSopCatalogRepoOk(await this.sopCatalogRepository.deleteSopDraftAwal(ctx.detailSopId));
  }
}
