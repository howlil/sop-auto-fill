import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma';
import type { JwtAccessPayload } from '../../../common';
import type { CreatePeraturanDto } from './dto/create-peraturan.dto';
import type { PeraturanResponseDto } from './dto/peraturan-response.dto';
import type { UpdatePeraturanDto } from './dto/update-peraturan.dto';
import { PeraturanRepository, type PeraturanRow } from './peraturan.repository';

@Injectable()
export class PeraturanService {
  constructor(private readonly peraturanRepository: PeraturanRepository) {}

  private mapRow(row: PeraturanRow): PeraturanResponseDto {
    return {
      id: row.peraturanId,
      namaPeraturan: row.nama,
      nomor: row.nomor,
      tahun: row.tahun,
      tentang: row.tentang,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      digunakan: row.dasarHukumCount,
    };
  }

  async list(user: JwtAccessPayload): Promise<PeraturanResponseDto[]> {
    const rows = await this.peraturanRepository.findManyByOwner(user.sub);
    return rows.map((row) => this.mapRow(row));
  }

  async getById(user: JwtAccessPayload, id: string): Promise<PeraturanResponseDto> {
    const row = await this.peraturanRepository.findOwnedById(user.sub, id);
    if (row === null) {
      throw new NotFoundException('Peraturan tidak ditemukan');
    }
    return this.mapRow(row);
  }

  async create(user: JwtAccessPayload, dto: CreatePeraturanDto): Promise<PeraturanResponseDto> {
    try {
      return this.mapRow(
        await this.peraturanRepository.create({
          ownerId: user.sub,
          nama: dto.namaPeraturan,
          nomor: dto.nomor,
          tahun: dto.tahun,
          tentang: dto.tentang,
        }),
      );
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
    const existing = await this.peraturanRepository.findOwnedById(user.sub, id);
    if (existing === null) {
      throw new NotFoundException('Peraturan tidak ditemukan');
    }

    const patch: { nama?: string; nomor?: string; tahun?: number; tentang?: string } = {};
    if (dto.namaPeraturan !== undefined) patch.nama = dto.namaPeraturan;
    if (dto.nomor !== undefined) patch.nomor = dto.nomor;
    if (dto.tahun !== undefined) patch.tahun = dto.tahun;
    if (dto.tentang !== undefined) patch.tentang = dto.tentang;

    if (Object.keys(patch).length === 0) {
      return this.mapRow(existing);
    }

    try {
      return this.mapRow(await this.peraturanRepository.update(id, patch));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Nomor dan tahun peraturan sudah terdaftar');
      }
      throw err;
    }
  }

  async remove(user: JwtAccessPayload, id: string): Promise<void> {
    const existing = await this.peraturanRepository.findOwnedById(user.sub, id);
    if (existing === null) {
      throw new NotFoundException('Peraturan tidak ditemukan');
    }
    if (existing.dasarHukumCount > 0) {
      throw new ConflictException(
        `Peraturan masih digunakan sebagai dasar hukum pada ${existing.dasarHukumCount} SOP`,
      );
    }
    await this.peraturanRepository.delete(id);
  }
}
