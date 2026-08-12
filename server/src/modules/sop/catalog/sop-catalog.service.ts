import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtAccessPayload } from '../../../common';
import { assertDetailSopEditable } from '../../../common/status/sop-editable.util';
import { displayStatusSop } from '../../../common/status/status-display';
import { Prisma, StatusSOP } from '../../../generated/prisma';
import { WorkspaceService } from '../../workspace/workspace.service';
import type { CreateSopDto } from './dto/create-sop.dto';
import type { ListSopQueryDto } from './dto/list-sop-query.dto';
import type { PenyusunWorkbenchDataDto } from './dto/penyusun-workbench-data.dto';
import type { SopDaftarRowDto } from './dto/sop-daftar-row.dto';
import type { SopRiwayatVersiRowDto } from './dto/sop-riwayat-versi-row.dto';
import type { UpdateDetailSopStatusDto } from './dto/update-detail-sop-status.dto';
import type { UpdateSopHeaderDto } from './dto/update-sop-header.dto';
import { assertSopCatalogRepoOk } from './sop-catalog-repo-error.util';
import { mapDaftarRow, mapWorkbenchPayload } from './sop-catalog.mapper';
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
    private readonly workspaceService: WorkspaceService,
  ) {}

  private clampLogsLimit(raw: number | undefined): number {
    if (raw === undefined || Number.isNaN(raw)) return DEFAULT_WORKBENCH_LOG_LIMIT;
    return Math.min(MAX_WORKBENCH_LOG_LIMIT, Math.max(1, Math.floor(raw)));
  }

  private async assertOwnedContext(user: JwtAccessPayload, detailOrSopId: string) {
    const context = await this.sopCatalogRepository.findProjectContext(detailOrSopId);
    if (context === null || context.ownerId !== user.sub) {
      throw new NotFoundException('SOP tidak ditemukan');
    }
    return context;
  }

  async getPenyusunWorkbench(
    user: JwtAccessPayload,
    detailOrSopId: string,
    logsLimitRaw?: number,
  ): Promise<PenyusunWorkbenchDataDto> {
    const row = await this.sopCatalogRepository.findWorkbenchPayloadByDetailOrSopId(
      detailOrSopId,
      this.clampLogsLimit(logsLimitRaw),
    );
    if (row === null || row.sop.workspace.ownerId !== user.sub) {
      throw new NotFoundException('SOP tidak ditemukan');
    }
    return mapWorkbenchPayload(row);
  }

  async listForCurrentUser(
    user: JwtAccessPayload,
    query: ListSopQueryDto,
  ): Promise<SopDaftarRowDto[]> {
    await this.workspaceService.assertOwner(user.sub, query.workspaceId);
    if (
      query.tanggalDari !== undefined &&
      query.tanggalSampai !== undefined &&
      query.tanggalDari > query.tanggalSampai
    ) {
      throw new BadRequestException('tanggalDari tidak boleh lebih besar dari tanggalSampai');
    }
    const filters: SopDaftarListFilters = {
      status: query.status,
      tanggalDari: query.tanggalDari,
      tanggalSampai: query.tanggalSampai,
    };
    const rows = await this.sopCatalogRepository.findDaftarByWorkspaceId(query.workspaceId, filters);
    return rows.map((row) => mapDaftarRow(row));
  }

  async createForPenyusun(user: JwtAccessPayload, dto: CreateSopDto): Promise<SopDaftarRowDto> {
    await this.workspaceService.assertOwner(user.sub, dto.workspaceId);
    try {
      const row = await this.sopCatalogRepository.createSopWithInitialDetail({
        judul: dto.judul,
        nomorSOP: dto.nomorSop,
        workspaceId: dto.workspaceId,
        userId: user.sub,
        namaLembaga: dto.namaLembaga?.trim() ?? '',
      });
      return mapDaftarRow(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Nomor SOP sudah digunakan');
      }
      throw err;
    }
  }

  async updatePenyusunHeader(
    user: JwtAccessPayload,
    detailOrSopId: string,
    dto: UpdateSopHeaderDto,
    logsLimitRaw?: number,
  ): Promise<PenyusunWorkbenchDataDto> {
    const context = await this.assertOwnedContext(user, detailOrSopId);
    assertDetailSopEditable(context.status);
    const changedFields = this.collectChangedHeaderFields(dto);
    if (changedFields.length > 0) {
      try {
        assertSopCatalogRepoOk(
          await this.sopCatalogRepository.updateSopHeaderTransaction({
            detailSopId: context.detailSopId,
            sopId: context.sopId,
            userId: user.sub,
            input: this.toRepoInput(dto),
            changedFields,
          }),
        );
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new ConflictException('Nomor SOP sudah digunakan');
        }
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
          throw new BadRequestException('Referensi dasar hukum atau SOP terkait tidak valid');
        }
        throw err;
      }
    }
    return this.getPenyusunWorkbench(user, context.detailSopId, logsLimitRaw);
  }

  async transitionDetailSopStatus(
    user: JwtAccessPayload,
    detailOrSopId: string,
    dto: UpdateDetailSopStatusDto,
    logsLimitRaw?: number,
  ): Promise<PenyusunWorkbenchDataDto> {
    const context = await this.assertOwnedContext(user, detailOrSopId);
    const target = dto.status;
    if (target === context.status) {
      throw new ConflictException('Status SOP sudah sama dengan status tujuan');
    }
    if (target === StatusSOP.DRAFT) {
      throw new ConflictException('Status DRAFT hanya dibuat melalui aksi Buat Versi Baru');
    }
    if (target === StatusSOP.COMPLETED && context.status !== StatusSOP.DRAFT) {
      throw new ConflictException('Hanya SOP DRAFT yang dapat diselesaikan');
    }
    if (
      target === StatusSOP.ARCHIVED &&
      context.status !== StatusSOP.DRAFT &&
      context.status !== StatusSOP.COMPLETED
    ) {
      throw new ConflictException('SOP tidak dapat diarsipkan dari status saat ini');
    }

    assertSopCatalogRepoOk(
      await this.sopCatalogRepository.updateSopStatus({
        detailOrSopId: context.detailSopId,
        status: target,
        userId: user.sub,
      }),
    );
    return this.getPenyusunWorkbench(user, context.detailSopId, logsLimitRaw);
  }

  async getRiwayatVersi(
    user: JwtAccessPayload,
    detailOrSopId: string,
  ): Promise<SopRiwayatVersiRowDto[]> {
    const context = await this.assertOwnedContext(user, detailOrSopId);
    const rows = await this.sopCatalogRepository.findRiwayatVersiBySopId(context.sopId);
    const latestVersion = rows.at(-1)?.versi ?? 0;
    return rows.map((row) => {
      const display = displayStatusSop(row.status);
      return {
        detailSopId: row.detailSopId,
        versi: row.versi,
        nomorSOP: row.nomorSOP,
        status: display.value,
        statusLabel: display.label,
        revisiDariDetailSopId: row.revisiDariDetailSopId,
        revisiDariVersi: row.revisiDariVersi,
        updatedAt: row.updatedAt.toISOString(),
        canHapusDraft: row.canHapusDraft,
        canBuatVersiBaru:
          row.versi === latestVersion && context.status === StatusSOP.COMPLETED,
      };
    });
  }

  async buatVersiBaru(
    user: JwtAccessPayload,
    detailOrSopId: string,
    logsLimitRaw?: number,
  ): Promise<PenyusunWorkbenchDataDto> {
    const context = await this.assertOwnedContext(user, detailOrSopId);
    if (context.status !== StatusSOP.COMPLETED) {
      throw new ConflictException('Versi baru hanya dapat dibuat dari SOP yang sudah selesai');
    }
    const result = await this.sopCatalogRepository.cloneDetailSopFromSource({
      sourceDetailSopId: context.detailSopId,
      userId: user.sub,
    });
    assertSopCatalogRepoOk(result);
    return this.getPenyusunWorkbench(user, result.value.detailSopId, logsLimitRaw);
  }

  async hapusVersiDraft(user: JwtAccessPayload, detailSopId: string): Promise<void> {
    await this.assertOwnedContext(user, detailSopId);
    assertSopCatalogRepoOk(await this.sopCatalogRepository.deleteVersiDraft(detailSopId));
  }

  async hapusSopDraftAwal(user: JwtAccessPayload, detailOrSopId: string): Promise<void> {
    const context = await this.assertOwnedContext(user, detailOrSopId);
    assertSopCatalogRepoOk(
      await this.sopCatalogRepository.deleteSopDraftAwal(context.detailSopId),
    );
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
}
