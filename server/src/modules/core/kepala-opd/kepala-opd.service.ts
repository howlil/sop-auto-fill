import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma';
import { PeranPengguna } from '../../../generated/prisma';
import {
  assertAtLeastOneUpdateField,
  assertEmailNipUniqueOnUpdate,
  hashDefaultPassword,
  requireIndonesianMobileNumber,
  rethrowPrismaUniqueViolation,
  resolveDeletedAtFromStatus,
} from '../../../common/pengguna/pengguna-admin.util';
import { CreateKepalaOpdDto } from './dto/create-kepala-opd.dto';
import { KepalaOpdPublicDto } from './dto/kepala-opd-public.dto';
import { KepalaOpdRiwayatItemDto } from './dto/kepala-opd-riwayat-item.dto';
import { UpdateKepalaOpdDto } from './dto/update-kepala-opd.dto';
import { PenggunaRepository } from '../pengguna/pengguna.repository';
import {
  KepalaOpdRepository,
  type KepalaOpdPersistUpdateInput,
  type KepalaOpdWithCounts,
} from './kepala-opd.repository';

@Injectable()
export class KepalaOpdService {
  constructor(
    private readonly kepalaOpdRepository: KepalaOpdRepository,
    private readonly penggunaRepository: PenggunaRepository,
  ) {}

  async findAll(search?: string): Promise<KepalaOpdPublicDto[]> {
    const rows = await this.kepalaOpdRepository.findManyKepala(search);
    return rows.map((r) => this.toPublic(r));
  }

  async create(dto: CreateKepalaOpdDto): Promise<KepalaOpdPublicDto> {
    const opd = await this.kepalaOpdRepository.findOpdAktifById(dto.opdId);
    if (opd === null) {
      throw new NotFoundException('OPD tidak ditemukan');
    }
    await this.assertNoOtherKepalaAktifInOpd(dto.opdId);
    const hashed = await hashDefaultPassword();
    try {
      const created = await this.kepalaOpdRepository.createWithRiwayatOpd({
        email: dto.email.trim().toLowerCase(),
        nama: dto.nama.trim(),
        nip: dto.nip.trim(),
        pangkat: dto.pangkat.trim(),
        jabatan: dto.jabatan.trim(),
        nohp: requireIndonesianMobileNumber(dto.nohp),
        kataSandi: hashed,
        opdId: dto.opdId,
      });
      const full = await this.kepalaOpdRepository.findKepalaById(created.penggunaId);
      if (full === null) {
        throw new NotFoundException('Kepala OPD tidak ditemukan setelah dibuat');
      }
      return this.toPublic(full);
    } catch (err: unknown) {
      rethrowPrismaUniqueViolation(err);
      throw err;
    }
  }

  async update(penggunaId: string, dto: UpdateKepalaOpdDto): Promise<KepalaOpdPublicDto> {
    const existing = await this.kepalaOpdRepository.findKepalaById(penggunaId);
    if (existing === null) {
      throw new NotFoundException('Kepala OPD tidak ditemukan');
    }
    assertAtLeastOneUpdateField([
      dto.opdId,
      dto.nama,
      dto.email,
      dto.nip,
      dto.jabatan,
      dto.pangkat,
      dto.nohp,
      dto.status,
    ]);
    const emailNext = dto.email !== undefined ? dto.email.trim().toLowerCase() : undefined;
    const nipNext = dto.nip !== undefined ? dto.nip.trim() : undefined;
    await assertEmailNipUniqueOnUpdate(
      this.penggunaRepository,
      penggunaId,
      existing,
      emailNext,
      nipNext,
    );
    const persistInput = await this.buildPersistUpdateInput(penggunaId, dto, existing);
    try {
      await this.kepalaOpdRepository.persistUpdate(penggunaId, persistInput);
      const full = await this.kepalaOpdRepository.findKepalaById(penggunaId);
      if (full === null) {
        throw new NotFoundException('Kepala OPD tidak ditemukan');
      }
      return this.toPublic(full);
    } catch (err: unknown) {
      rethrowPrismaUniqueViolation(err);
      throw err;
    }
  }

  async remove(penggunaId: string): Promise<void> {
    const existing = await this.kepalaOpdRepository.findKepalaById(penggunaId);
    if (existing === null) {
      throw new NotFoundException('Kepala OPD tidak ditemukan');
    }
    if (existing._count.detailSopDibuat > 0) {
      throw new ConflictException(
        'Tidak dapat menghapus Kepala OPD yang masih memiliki SOP yang dibuat.',
      );
    }
    await this.kepalaOpdRepository.softDeleteKepalaOpd(penggunaId);
  }

  async listRiwayatOpd(penggunaId: string): Promise<KepalaOpdRiwayatItemDto[]> {
    const existing = await this.kepalaOpdRepository.findKepalaById(penggunaId);
    if (existing === null) {
      throw new NotFoundException('Kepala OPD tidak ditemukan');
    }
    const rows = await this.kepalaOpdRepository.findRiwayatRowsForPengguna(penggunaId);
    return rows.map((r) => ({
      opdId: r.opdId,
      namaOpd: r.opd.nama,
      dicatatPada: r.createdAt,
      diperbaruiPada: r.updatedAt,
      isAktif: r.isAktif,
    }));
  }

  private async buildPersistUpdateInput(
    penggunaId: string,
    dto: UpdateKepalaOpdDto,
    existing: KepalaOpdWithCounts,
  ): Promise<KepalaOpdPersistUpdateInput> {
    const input: KepalaOpdPersistUpdateInput = {};
    if (dto.opdId !== undefined && dto.opdId !== existing.opdId) {
      if (existing.deletedAt !== null) {
        throw new BadRequestException(
          'Akun nonaktif tidak dapat dipindahkan. Aktifkan kembali terlebih dahulu.',
        );
      }
      const opdTujuan = await this.kepalaOpdRepository.findOpdAktifById(dto.opdId);
      if (opdTujuan === null) {
        throw new NotFoundException('OPD tujuan tidak ditemukan');
      }
      await this.assertNoOtherKepalaAktifInOpd(dto.opdId, penggunaId);
      input.pindah = { opdAsalId: existing.opdId, opdTujuanId: dto.opdId };
    }
    const profil = this.buildProfilUpdate(dto);
    if (Object.keys(profil).length > 0) {
      input.profil = profil;
    }
    if (dto.status === 'AKTIF' && existing.deletedAt !== null) {
      const opdIdSetelahProfil = dto.opdId ?? existing.opdId;
      const lain = await this.penggunaRepository.countAktifByOpdIdAndPeran(
        opdIdSetelahProfil,
        PeranPengguna.KEPALA_OPD,
        penggunaId,
      );
      if (lain > 0) {
        throw new ConflictException(
          'OPD masih memiliki Kepala OPD aktif lain. Nonaktifkan yang ada terlebih dahulu.',
        );
      }
      input.syncRiwayatOpdId = opdIdSetelahProfil;
    }
    return input;
  }

  private buildProfilUpdate(dto: UpdateKepalaOpdDto): Prisma.PenggunaUpdateInput {
    const data: Prisma.PenggunaUpdateInput = {};
    if (dto.nama !== undefined) {
      data.nama = dto.nama.trim();
    }
    if (dto.email !== undefined) {
      data.email = dto.email.trim().toLowerCase();
    }
    if (dto.nip !== undefined) {
      data.nip = dto.nip.trim();
    }
    if (dto.jabatan !== undefined) {
      data.jabatan = dto.jabatan.trim();
    }
    if (dto.pangkat !== undefined) {
      data.pangkat = dto.pangkat.trim();
    }
    if (dto.nohp !== undefined) {
      data.nohp = requireIndonesianMobileNumber(dto.nohp);
    }
    if (dto.status !== undefined) {
      data.deletedAt = resolveDeletedAtFromStatus(dto.status, null);
    }
    return data;
  }

  private async assertNoOtherKepalaAktifInOpd(
    opdId: string,
    exceptPenggunaId?: string,
  ): Promise<void> {
    const lain = await this.penggunaRepository.countAktifByOpdIdAndPeran(
      opdId,
      PeranPengguna.KEPALA_OPD,
      exceptPenggunaId,
    );
    if (lain > 0) {
      throw new ConflictException(
        exceptPenggunaId === undefined
          ? 'OPD ini sudah memiliki Kepala OPD aktif. Nonaktifkan atau akhiri jabatan yang ada terlebih dahulu.'
          : 'OPD tujuan sudah memiliki Kepala OPD aktif. Nonaktifkan atau pindahkan yang ada terlebih dahulu.',
      );
    }
  }

  private toPublic(row: KepalaOpdWithCounts): KepalaOpdPublicDto {
    return {
      id: row.penggunaId,
      nama: row.nama,
      nip: row.nip,
      email: row.email,
      nohp: row.nohp,
      jabatan: row.jabatan,
      pangkat: row.pangkat,
      opdId: row.opdId,
      namaOpd: row.opd.nama,
      isActive: row.deletedAt === null,
      updatedAt: row.updatedAt,
      dapatDihapus: row._count.detailSopDibuat === 0,
    };
  }
}
