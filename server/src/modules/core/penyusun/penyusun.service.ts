import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  assertAtLeastOneUpdateField,
  assertEmailNipUniqueOnUpdate,
  hashDefaultPassword,
  requireIndonesianMobileNumber,
  rethrowPrismaUniqueViolation,
  resolveDeletedAtFromStatus,
} from '../../../common/pengguna/pengguna-admin.util';
import type { Prisma } from '../../../generated/prisma';
import { PeranPengguna, type Pengguna } from '../../../generated/prisma';
import { PenggunaRepository } from '../pengguna/pengguna.repository';
import type { PenyusunOpdGrupDto } from './dto/penyusun-opd-grup.dto';
import type { PenyusunPublikItemDto } from './dto/penyusun-publik-item.dto';
import type { RiwayatOpdPenyusunItemDto } from './dto/riwayat-opd-penyusun-item.dto';
import { CreatePenyusunDto } from './dto/create-penyusun.dto';
import { UpdatePenyusunDto } from './dto/update-penyusun.dto';
import { PenyusunRepository } from './penyusun.repository';

/** Pesan ketika OPD sudah punya PJ Penyusun aktif dan slot tidak boleh didobel. */
const PJ_PENYUSUN_SLOT_TAKEN_MESSAGE =
  'OPD ini sudah memiliki PJ Penyusun aktif. Ubah peran atau nonaktifkan PJ yang ada terlebih dahulu.' as const;

@Injectable()
export class PenyusunService {
  constructor(
    private readonly penyusunRepository: PenyusunRepository,
    private readonly penggunaRepository: PenggunaRepository,
  ) {}

  async listGrup(search?: string): Promise<PenyusunOpdGrupDto[]> {
    const rows = await this.penyusunRepository.findOpdsWithPenyusun(search);
    const trimmed = search?.trim();
    const mapped = rows.map((r) => ({
      opdId: r.opdId,
      namaOpd: r.nama,
      penyusun: r.pengguna.map((p) => this.toPublikItem(p)),
    }));
    if (trimmed) {
      return mapped.filter((g) => g.penyusun.length > 0);
    }
    return mapped;
  }

  async create(dto: CreatePenyusunDto): Promise<PenyusunPublikItemDto> {
    const opd = await this.penyusunRepository.findOpdById(dto.opdId);
    if (opd === null) {
      throw new NotFoundException('OPD tidak ditemukan');
    }
    if (dto.peran === PeranPengguna.PJ_PENYUSUN) {
      await this.assertNoOtherPjPenyusunInOpd(dto.opdId);
    }
    const hashed = await hashDefaultPassword();
    try {
      const created = await this.penyusunRepository.createWithRiwayatOpd({
        email: dto.email.trim().toLowerCase(),
        nama: dto.nama.trim(),
        nip: dto.nip.trim(),
        pangkat: dto.pangkat.trim(),
        jabatan: dto.jabatan.trim(),
        nohp: requireIndonesianMobileNumber(dto.nohp),
        kataSandi: hashed,
        peran: dto.peran as PeranPengguna,
        opdId: dto.opdId,
      });
      return this.toPublikItem(created);
    } catch (err: unknown) {
      rethrowPrismaUniqueViolation(err);
      throw err;
    }
  }

  async update(penggunaId: string, dto: UpdatePenyusunDto): Promise<PenyusunPublikItemDto> {
    const existing = await this.penyusunRepository.findPenyusunById(penggunaId);
    if (existing === null) {
      throw new NotFoundException('Penyusun tidak ditemukan');
    }
    assertAtLeastOneUpdateField([
      dto.email,
      dto.nama,
      dto.nip,
      dto.peran,
      dto.pangkat,
      dto.jabatan,
      dto.nohp,
      dto.status,
    ]);
    const nextDeletedAt = resolveDeletedAtFromStatus(dto.status, existing.deletedAt);
    const willBeActive = nextDeletedAt === null;
    const peranNext = dto.peran ?? existing.peran;
    const emailNext = dto.email !== undefined ? dto.email.trim().toLowerCase() : undefined;
    const nipNext = dto.nip !== undefined ? dto.nip.trim() : undefined;
    await assertEmailNipUniqueOnUpdate(
      this.penggunaRepository,
      penggunaId,
      existing,
      emailNext,
      nipNext,
    );
    if (
      !willBeActive &&
      peranNext === PeranPengguna.PJ_PENYUSUN &&
      existing.peran !== PeranPengguna.PJ_PENYUSUN
    ) {
      throw new BadRequestException(
        'Tidak dapat menjadikan PJ Penyusun selagi akun nonaktif. Aktifkan akun terlebih dahulu.',
      );
    }
    if (
      willBeActive &&
      peranNext === PeranPengguna.PJ_PENYUSUN &&
      existing.peran !== PeranPengguna.PJ_PENYUSUN
    ) {
      await this.assertNoOtherPjPenyusunInOpd(existing.opdId, penggunaId);
    }
    try {
      const data: Prisma.PenggunaUpdateInput = {};
      if (dto.nama !== undefined) data.nama = dto.nama.trim();
      if (emailNext !== undefined) data.email = emailNext;
      if (nipNext !== undefined) data.nip = nipNext;
      if (dto.pangkat !== undefined) data.pangkat = dto.pangkat.trim();
      if (dto.jabatan !== undefined) data.jabatan = dto.jabatan.trim();
      if (dto.nohp !== undefined) data.nohp = requireIndonesianMobileNumber(dto.nohp);
      if (dto.peran !== undefined) data.peran = dto.peran as PeranPengguna;
      if (dto.status !== undefined) {
        data.deletedAt = nextDeletedAt;
      }
      const updated = await this.penyusunRepository.updatePenyusun(penggunaId, data);
      return this.toPublikItem(updated);
    } catch (err: unknown) {
      rethrowPrismaUniqueViolation(err);
      throw err;
    }
  }

  async nonaktifkan(penggunaId: string): Promise<void> {
    const existing = await this.penyusunRepository.findPenyusunAktifById(penggunaId);
    if (existing === null) {
      throw new NotFoundException('Penyusun tidak ditemukan');
    }
    await this.penyusunRepository.softDeletePenyusun(penggunaId);
  }

  async aktifkan(penggunaId: string): Promise<PenyusunPublikItemDto> {
    const existing = await this.penyusunRepository.findPenyusunById(penggunaId);
    if (existing === null) {
      throw new NotFoundException('Penyusun tidak ditemukan');
    }
    if (existing.deletedAt === null) {
      throw new BadRequestException('Penyusun sudah aktif');
    }
    if (existing.peran === PeranPengguna.PJ_PENYUSUN) {
      await this.assertNoOtherPjPenyusunInOpd(existing.opdId, penggunaId);
    }
    try {
      const restored = await this.penyusunRepository.aktifkanPenyusun(penggunaId);
      return this.toPublikItem(restored);
    } catch (err: unknown) {
      rethrowPrismaUniqueViolation(err);
      throw err;
    }
  }

  async pindah(penggunaId: string, opdTujuanId: string): Promise<PenyusunPublikItemDto> {
    const existing = await this.penyusunRepository.findPenyusunAktifById(penggunaId);
    if (existing === null) {
      throw new NotFoundException('Penyusun tidak ditemukan');
    }
    const opdTujuan = await this.penyusunRepository.findOpdById(opdTujuanId);
    if (opdTujuan === null) {
      throw new NotFoundException('OPD tujuan tidak ditemukan');
    }
    if (existing.opdId === opdTujuanId) {
      throw new ConflictException('Penyusun sudah berada di OPD tersebut');
    }
    if (existing.peran === PeranPengguna.PJ_PENYUSUN) {
      await this.assertNoOtherPjPenyusunInOpd(opdTujuanId);
    }
    try {
      const moved = await this.penyusunRepository.pindahPenyusun(
        penggunaId,
        existing.opdId,
        opdTujuanId,
      );
      return this.toPublikItem(moved);
    } catch (err: unknown) {
      rethrowPrismaUniqueViolation(err);
      throw err;
    }
  }

  async listRiwayatOpdPenyusun(penggunaId: string): Promise<RiwayatOpdPenyusunItemDto[]> {
    const row = await this.penyusunRepository.findPenyusunById(penggunaId);
    if (row === null) {
      throw new NotFoundException('Penyusun tidak ditemukan');
    }
    const items = await this.penyusunRepository.findRiwayatOpdByPenggunaId(penggunaId);
    return items.map((r) => ({
      opdId: r.opdId,
      namaOpd: r.namaOpd,
      pertamaDicatat: r.pertamaDicatat,
      terakhirDiperbarui: r.terakhirDiperbarui,
      isAktif: r.isAktif,
    }));
  }

  async hapusPermanen(penggunaId: string): Promise<void> {
    const row = await this.penyusunRepository.findPenyusunById(penggunaId);
    if (row === null) {
      throw new NotFoundException('Penyusun tidak ditemukan');
    }
    await this.assertCanDeletePermanently(penggunaId);
    await this.penyusunRepository.deletePenyusunPermanen(penggunaId);
  }

  private async assertCanDeletePermanently(penggunaId: string): Promise<void> {
    const row = await this.penyusunRepository.findDeleteGuardRow(penggunaId);
    if (row === null) {
      throw new NotFoundException('Pengguna tidak ditemukan');
    }
    const c = row._count;
    const sum =
      c.detailSopDibuat +
      c.detailSopDiedit +
      c.logEditSop +
      c.logNilaiEvaluasi +
      c.nilaiEvaluasiDiisi +
      c.pengajuanEvaluasiDiselesaikan +
      c.pengajuanEvaluasiDitandatangani +
      c.pengajuanEvaluasiDiverifikasi +
      c.riwayatOpd +
      c.tandaTangan;
    if (sum > 0 || row.ttePinHash !== null) {
      throw new ConflictException(
        'Tidak dapat menghapus pengguna: masih ada data yang terikat (SOP, evaluasi, atau jabatan OPD).',
      );
    }
    if (row.peran === PeranPengguna.PJ_PENYUSUN) {
      throw new ConflictException(
        'Tidak dapat menghapus pengguna: masih terdaftar sebagai PJ Penyusun pada OPD.',
      );
    }
  }

  private async assertNoOtherPjPenyusunInOpd(
    opdId: string,
    exceptPenggunaId?: string,
  ): Promise<void> {
    const lain = await this.penyusunRepository.findOtherPjPenyusunAktif(opdId, exceptPenggunaId);
    if (lain !== null) {
      throw new ConflictException(PJ_PENYUSUN_SLOT_TAKEN_MESSAGE);
    }
  }

  private toPublikItem(row: Pengguna): PenyusunPublikItemDto {
    const aktif = row.deletedAt === null;
    return {
      id: row.penggunaId,
      nama: row.nama,
      nip: row.nip,
      jabatan: row.jabatan,
      pangkat: row.pangkat,
      email: row.email,
      nohp: row.nohp,
      peran: row.peran as 'PENYUSUN' | 'PJ_PENYUSUN',
      status: aktif ? 'AKTIF' : 'NONAKTIF',
    };
  }
}
