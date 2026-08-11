import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { JwtAccessPayload } from '../../../common';
import type { PeraturanResponseDto } from './dto/peraturan-response.dto';
import type { CreatePeraturanDto } from './dto/create-peraturan.dto';
import type { UpdatePeraturanDto } from './dto/update-peraturan.dto';
import { UserOpdAccessService } from '../opd/user-opd-access.service';
import { PeraturanRepository, type PeraturanRow } from './peraturan.repository';
import { Prisma } from '../../../generated/prisma';

@Injectable()
export class PeraturanService {
  constructor(
    private readonly peraturanRepository: PeraturanRepository,
    private readonly userOpdAccessService: UserOpdAccessService,
  ) {}

  private mapRow(row: PeraturanRow, opdId: string): PeraturanResponseDto {
    return {
      id: row.peraturanId,
      opdId,
      namaPeraturan: row.nama,
      nomor: row.nomor,
      tahun: row.tahun,
      tentang: row.tentang,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      lastEditedById: row.lastEditedById,
      lastEditedBy:
        row.lastEditedBy === null
          ? null
          : {
              id: row.lastEditedBy.penggunaId,
              nama: row.lastEditedBy.nama,
              opd: { id: row.lastEditedBy.opd.opdId, nama: row.lastEditedBy.opd.nama },
            },
      digunakan: row.dasarHukumCount,
    };
  }

  private async resolveOpdIdOrThrow(user: JwtAccessPayload, queryOpdId?: string): Promise<string> {
    return this.userOpdAccessService.resolveOwnOpdAllowingOptionalQuery(user.sub, queryOpdId);
  }

  async list(user: JwtAccessPayload, queryOpdId?: string): Promise<PeraturanResponseDto[]> {
    const opdId = await this.resolveOpdIdOrThrow(user, queryOpdId);
    const rows = await this.peraturanRepository.findManyByOpdId(opdId);
    return rows.map((r) => this.mapRow(r, opdId));
  }

  async getById(
    user: JwtAccessPayload,
    id: string,
    queryOpdId?: string,
  ): Promise<PeraturanResponseDto> {
    const opdId = await this.resolveOpdIdOrThrow(user, queryOpdId);
    const row = await this.peraturanRepository.findByIdForOpd(id, opdId);
    if (row === null) {
      throw new NotFoundException('Peraturan tidak ditemukan');
    }
    return this.mapRow(row, opdId);
  }

  async create(user: JwtAccessPayload, dto: CreatePeraturanDto): Promise<PeraturanResponseDto> {
    const opdId = await this.resolveOpdIdOrThrow(user, undefined);
    try {
      const row = await this.peraturanRepository.createWithOpdLink({
        nama: dto.namaPeraturan,
        nomor: dto.nomor,
        tahun: dto.tahun,
        tentang: dto.tentang,
        opdId,
        lastEditedById: user.sub,
      });
      return this.mapRow(row, opdId);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Nomor dan tahun peraturan sudah terdaftar');
      }
      throw err;
    }
  }

  async update(
    user: JwtAccessPayload,
    id: string,
    dto: UpdatePeraturanDto,
  ): Promise<PeraturanResponseDto> {
    const opdId = await this.resolveOpdIdOrThrow(user, undefined);
    const linked = await this.peraturanRepository.hasOpdLink(id, opdId);
    if (!linked) {
      throw new NotFoundException('Peraturan tidak ditemukan');
    }
    const patch: { nama?: string; nomor?: string; tahun?: number; tentang?: string } = {};
    if (dto.namaPeraturan !== undefined) {
      patch.nama = dto.namaPeraturan;
    }
    if (dto.nomor !== undefined) {
      patch.nomor = dto.nomor;
    }
    if (dto.tahun !== undefined) {
      patch.tahun = dto.tahun;
    }
    if (dto.tentang !== undefined) {
      patch.tentang = dto.tentang;
    }
    if (Object.keys(patch).length === 0) {
      const row = await this.peraturanRepository.findByIdForOpd(id, opdId);
      if (row === null) {
        throw new NotFoundException('Peraturan tidak ditemukan');
      }
      return this.mapRow(row, opdId);
    }
    try {
      const row = await this.peraturanRepository.updateMasterWithLastEditor(id, patch, user.sub);
      return this.mapRow(row, opdId);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Nomor dan tahun peraturan sudah terdaftar');
      }
      throw err;
    }
  }

  async remove(user: JwtAccessPayload, id: string): Promise<void> {
    const opdId = await this.resolveOpdIdOrThrow(user, undefined);
    const linked = await this.peraturanRepository.hasOpdLink(id, opdId);
    if (!linked) {
      throw new NotFoundException('Peraturan tidak ditemukan');
    }
    const used = await this.peraturanRepository.countDasarHukum(id);
    if (used > 0) {
      throw new ConflictException(`Peraturan masih digunakan sebagai dasar hukum pada ${used} SOP`);
    }
    await this.peraturanRepository.deleteOpdLink(opdId, id);
    const remainingLinks = await this.peraturanRepository.countOpdLinks(id);
    if (remainingLinks === 0) {
      await this.peraturanRepository.deletePeraturan(id);
    }
  }
}
