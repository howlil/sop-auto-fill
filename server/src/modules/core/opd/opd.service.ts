import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PeranPengguna } from '../../../generated/prisma';
import type { JwtAccessPayload } from '../auth/helpers/auth.shared';
import { CreateOpdDto } from './dto/create-opd.dto';
import { UpdateOpdDto } from './dto/update-opd.dto';
import type { OpdMutasiResponseDto } from './dto/opd-mutasi-response.dto';
import type { OpdRingkasResponseDto } from './dto/opd-ringkas-response.dto';
import { OpdRepository } from './opd.repository';

@Injectable()
export class OpdService {
  constructor(private readonly opdRepository: OpdRepository) {}

  async listRingkas(user: JwtAccessPayload, search?: string): Promise<OpdRingkasResponseDto[]> {
    if (user.peran === PeranPengguna.PJ_EVALUATOR) {
      const rows = await this.opdRepository.findManyRingkasAktif(search);
      return rows.map((r) => ({ id: r.opdId, nama: r.nama }));
    }
    const opdId = await this.opdRepository.findOpdIdByPenggunaId(user.sub);
    if (opdId === null) {
      return [];
    }
    const row = await this.opdRepository.findRingkasAktifById(opdId);
    if (row === null) {
      return [];
    }
    return [{ id: row.opdId, nama: row.nama }];
  }

  async create(dto: CreateOpdDto): Promise<OpdMutasiResponseDto> {
    const created = await this.opdRepository.create({
      nama: dto.nama.trim(),
    });
    return this.toMutasiResponse(created);
  }

  async update(opdId: string, dto: UpdateOpdDto): Promise<OpdMutasiResponseDto> {
    const existing = await this.opdRepository.findAktifById(opdId);
    if (existing === null) {
      throw new NotFoundException('OPD tidak ditemukan');
    }
    const updated = await this.opdRepository.update(opdId, { nama: dto.nama.trim() });
    return this.toMutasiResponse(updated);
  }

  async softDelete(opdId: string): Promise<void> {
    const existing = await this.opdRepository.findAktifById(opdId);
    if (existing === null) {
      throw new NotFoundException('OPD tidak ditemukan');
    }
    const struktural = await this.opdRepository.countPenggunaStrukturalAktifByOpdId(opdId);
    if (struktural > 0) {
      throw new ConflictException(
        'OPD masih memiliki jabatan struktural (Kepala OPD, PJ Penyusun, atau tim evaluator). Pindahkan atau nonaktifkan pengguna terlebih dahulu.',
      );
    }
    const rel = await this.opdRepository.summarizeBlockingRelations(opdId);
    const totalBlockers =
      rel.pengguna +
      rel.sop +
      rel.pengajuanEvaluasi +
      rel.pelaksana +
      rel.riwayatOpdPengguna +
      rel.opdPeraturan;
    if (totalBlockers > 0) {
      throw new ConflictException(
        'OPD tidak dapat dihapus karena masih memiliki data terkait (pengguna, SOP, evaluasi, pelaksana, peraturan, atau riwayat OPD).',
      );
    }
    await this.opdRepository.softDelete(opdId);
  }

  private toMutasiResponse(row: {
    opdId: string;
    nama: string;
    createdAt: Date;
    updatedAt: Date;
  }): OpdMutasiResponseDto {
    return {
      id: row.opdId,
      nama: row.nama,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
