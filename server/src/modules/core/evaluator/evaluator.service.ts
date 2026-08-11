import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma';
import { PeranPengguna, type Pengguna } from '../../../generated/prisma';
import {
  assertAtLeastOneUpdateField,
  assertEmailNipUniqueOnUpdate,
  hashDefaultPassword,
  requireIndonesianMobileNumber,
  rethrowPrismaUniqueViolation,
  resolveDeletedAtFromStatus,
} from '../../../common/pengguna/pengguna-admin.util';
import type { AnggotaEvaluatorItemDto } from './dto/anggota-evaluator-item.dto';
import type { EvaluatorOpdGrupDto } from './dto/evaluator-opd-grup.dto';
import { CreateEvaluatorDto } from './dto/create-evaluator.dto';
import { UpdateEvaluatorDto } from './dto/update-evaluator.dto';
import { PenggunaRepository } from '../pengguna/pengguna.repository';

@Injectable()
export class EvaluatorService {
  constructor(private readonly penggunaRepository: PenggunaRepository) {}

  async listGrup(search?: string): Promise<EvaluatorOpdGrupDto[]> {
    const opdMaster = await this.penggunaRepository.findPjEvaluatorOrganisasiOpd();
    if (opdMaster === null) {
      throw new ServiceUnavailableException(
        'OPD PJ Evaluator Organisasi belum dikonfigurasi. Hubungi administrator sistem.',
      );
    }
    const rows = await this.penggunaRepository.findEvaluatorsByOpd(opdMaster.opdId, search);
    return [
      {
        opdId: opdMaster.opdId,
        namaOpd: opdMaster.nama,
        evaluator: rows.map((r) => this.toAnggotaDto(r)),
      },
    ];
  }

  async createAnggota(dto: CreateEvaluatorDto): Promise<AnggotaEvaluatorItemDto> {
    const opdId = await this.requireBiroOpdId();
    const hashed = await hashDefaultPassword();
    try {
      const created = await this.penggunaRepository.createPengguna({
        email: dto.email.trim().toLowerCase(),
        nama: dto.nama.trim(),
        nip: dto.nip.trim(),
        jabatan: dto.jabatan.trim(),
        pangkat: dto.pangkat.trim(),
        nohp: requireIndonesianMobileNumber(dto.nohp),
        kataSandi: hashed,
        peran: PeranPengguna.EVALUATOR,
        opd: { connect: { opdId } },
      });
      return this.toAnggotaDto(created);
    } catch (err: unknown) {
      rethrowPrismaUniqueViolation(err);
      throw err;
    }
  }

  async updateAnggota(
    penggunaId: string,
    dto: UpdateEvaluatorDto,
  ): Promise<AnggotaEvaluatorItemDto> {
    const opdId = await this.requireBiroOpdId();
    const existing = await this.penggunaRepository.findEvaluatorByIdInOpd(penggunaId, opdId);
    if (existing === null) {
      throw new NotFoundException('Evaluator tidak ditemukan');
    }
    assertAtLeastOneUpdateField([
      dto.email,
      dto.nama,
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
    const data: Prisma.PenggunaUpdateInput = {};
    if (dto.nama !== undefined) {
      data.nama = dto.nama.trim();
    }
    if (emailNext !== undefined) {
      data.email = emailNext;
    }
    if (nipNext !== undefined) {
      data.nip = nipNext;
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
      data.deletedAt = resolveDeletedAtFromStatus(dto.status, existing.deletedAt);
    }
    try {
      const updated = await this.penggunaRepository.updateEvaluator(penggunaId, data);
      return this.toAnggotaDto(updated);
    } catch (err: unknown) {
      rethrowPrismaUniqueViolation(err);
      throw err;
    }
  }

  async softDeleteAnggota(penggunaId: string): Promise<void> {
    const opdId = await this.requireBiroOpdId();
    const existing = await this.penggunaRepository.findEvaluatorAktifById(penggunaId, opdId);
    if (existing === null) {
      throw new NotFoundException('Evaluator tidak ditemukan');
    }
    await this.penggunaRepository.softDeleteEvaluator(penggunaId);
  }

  private async requireBiroOpdId(): Promise<string> {
    const opdId = await this.penggunaRepository.findPjEvaluatorOrganisasiOpdId();
    if (opdId === null) {
      throw new ServiceUnavailableException(
        'OPD PJ Evaluator Organisasi belum dikonfigurasi. Hubungi administrator sistem.',
      );
    }
    return opdId;
  }

  private toAnggotaDto(row: Pengguna): AnggotaEvaluatorItemDto {
    const aktif = row.deletedAt === null;
    return {
      id: row.penggunaId,
      userId: row.penggunaId,
      status: aktif ? 'AKTIF' : 'NONAKTIF',
      tanggalBergabung: row.createdAt,
      berakhirPada: row.deletedAt ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      user: {
        id: row.penggunaId,
        nama: row.nama,
        email: row.email,
        nip: row.nip,
        jabatan: row.jabatan,
        pangkat: row.pangkat,
        nohp: row.nohp,
        peran: row.peran,
      },
    };
  }
}
