import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OpdRepository } from './opd.repository';
import { OpdService } from './opd.service';
import { PeranPengguna } from '../../../generated/prisma';

describe('Pengujian OpdService', () => {
  let service: OpdService;
  let opdRepository: jest.Mocked<
    Pick<
      OpdRepository,
      | 'findOpdIdByPenggunaId'
      | 'findManyRingkasAktif'
      | 'findRingkasAktifById'
      | 'findAktifById'
      | 'create'
      | 'update'
      | 'softDelete'
      | 'summarizeBlockingRelations'
      | 'countPenggunaStrukturalAktifByOpdId'
    >
  >;

  beforeEach(async () => {
    opdRepository = {
      findOpdIdByPenggunaId: jest.fn(),
      findManyRingkasAktif: jest.fn(),
      findRingkasAktifById: jest.fn(),
      findAktifById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      summarizeBlockingRelations: jest.fn(),
      countPenggunaStrukturalAktifByOpdId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpdService,
        {
          provide: OpdRepository,
          useValue: opdRepository,
        },
      ],
    }).compile();

    service = module.get(OpdService);
  });

  describe('listRingkas', () => {
    it('seharusnya mengembalikan seluruh opd untuk peran PJ_EVALUATOR', async () => {
      opdRepository.findManyRingkasAktif.mockResolvedValue([{ opdId: '1', nama: 'OPD 1' }]);
      const result = await service.listRingkas(
        { sub: 'u1', email: 'u@test.com', peran: PeranPengguna.PJ_EVALUATOR },
        'cari',
      );
      expect(opdRepository.findManyRingkasAktif).toHaveBeenCalledWith('cari');
      expect(result).toEqual([{ id: '1', nama: 'OPD 1' }]);
    });

    it('seharusnya mengembalikan [] ketika pengguna bukan PJ_EVALUATOR dan belum terhubung dengan OPD manapun (Worst case)', async () => {
      opdRepository.findOpdIdByPenggunaId.mockResolvedValue(null);
      const result = await service.listRingkas({
        sub: 'u2',
        email: 'u2@test.com',
        peran: PeranPengguna.PENYUSUN,
      });
      expect(result).toEqual([]);
    });

    it('seharusnya mengembalikan [] ketika OPD pengguna tidak ditemukan atau tidak aktif (Edge case)', async () => {
      opdRepository.findOpdIdByPenggunaId.mockResolvedValue('opd-1');
      opdRepository.findRingkasAktifById.mockResolvedValue(null);
      const result = await service.listRingkas({
        sub: 'u3',
        email: 'u3@test.com',
        peran: PeranPengguna.PENYUSUN,
      });
      expect(result).toEqual([]);
    });

    it('seharusnya mengembalikan OPD milik pengguna ketika ditemukan', async () => {
      opdRepository.findOpdIdByPenggunaId.mockResolvedValue('opd-1');
      opdRepository.findRingkasAktifById.mockResolvedValue({
        opdId: 'opd-1',
        nama: 'OPD Pengguna',
      });
      const result = await service.listRingkas({
        sub: 'u4',
        email: 'u4@test.com',
        peran: PeranPengguna.PENYUSUN,
      });
      expect(result).toEqual([{ id: 'opd-1', nama: 'OPD Pengguna' }]);
    });
  });

  describe('create', () => {
    it('seharusnya dapat membuat OPD baru dan membersihkan spasi', async () => {
      const date = new Date();
      opdRepository.create.mockResolvedValue({
        opdId: 'opd-new',
        nama: 'OPD Baru',
        createdAt: date,
        updatedAt: date,
        deletedAt: null,
      });
      const result = await service.create({ nama: '  OPD Baru  ' });
      expect(opdRepository.create).toHaveBeenCalledWith({ nama: 'OPD Baru' });
      expect(result).toEqual({ id: 'opd-new', nama: 'OPD Baru', createdAt: date, updatedAt: date });
    });
  });

  describe('update', () => {
    it('seharusnya melempar NotFoundException jika OPD tidak ditemukan (False case)', async () => {
      opdRepository.findAktifById.mockResolvedValue(null);
      await expect(service.update('tidak-ada', { nama: 'Test' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('seharusnya memperbarui nama OPD dan memotong spasi', async () => {
      const date = new Date();
      opdRepository.findAktifById.mockResolvedValue({
        opdId: 'opd-1',
        nama: 'Lama',
        createdAt: date,
        updatedAt: date,
        deletedAt: null,
      });
      opdRepository.update.mockResolvedValue({
        opdId: 'opd-1',
        nama: 'Baru',
        createdAt: date,
        updatedAt: date,
        deletedAt: null,
      });
      const result = await service.update('opd-1', { nama: ' Baru ' });
      expect(opdRepository.update).toHaveBeenCalledWith('opd-1', { nama: 'Baru' });
      expect(result.nama).toBe('Baru');
    });
  });

  describe('softDelete', () => {
    const now = new Date();

    it('seharusnya melempar NotFoundException jika OPD yang akan dihapus tidak ditemukan (False case)', async () => {
      opdRepository.findAktifById.mockResolvedValue(null);
      await expect(service.softDelete('tidak-ada')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('seharusnya melempar ConflictException ketika soft delete dan pengguna struktural masih ada', async () => {
      opdRepository.findAktifById.mockResolvedValue({
        opdId: 'opd-b',
        nama: 'OPD B',
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      opdRepository.countPenggunaStrukturalAktifByOpdId.mockResolvedValue(1);

      await expect(service.softDelete('opd-b')).rejects.toBeInstanceOf(ConflictException);
      expect(opdRepository.summarizeBlockingRelations).not.toHaveBeenCalled();
      expect(opdRepository.softDelete).not.toHaveBeenCalled();
    });

    it('seharusnya melempar ConflictException ketika soft delete dan OPD masih memiliki baris terkait', async () => {
      opdRepository.findAktifById.mockResolvedValue({
        opdId: 'opd-a',
        nama: 'OPD A',
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      opdRepository.countPenggunaStrukturalAktifByOpdId.mockResolvedValue(0);
      opdRepository.summarizeBlockingRelations.mockResolvedValue({
        pengguna: 1,
        sop: 0,
        pengajuanEvaluasi: 0,
        pelaksana: 0,
        riwayatOpdPengguna: 0,
        opdPeraturan: 0,
      });

      await expect(service.softDelete('opd-a')).rejects.toBeInstanceOf(ConflictException);
      expect(opdRepository.softDelete).not.toHaveBeenCalled();
    });

    it('seharusnya melakukan softDelete jika tidak ada konflik atau halangan', async () => {
      opdRepository.findAktifById.mockResolvedValue({
        opdId: 'opd-a',
        nama: 'OPD A',
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      opdRepository.countPenggunaStrukturalAktifByOpdId.mockResolvedValue(0);
      opdRepository.summarizeBlockingRelations.mockResolvedValue({
        pengguna: 0,
        sop: 0,
        pengajuanEvaluasi: 0,
        pelaksana: 0,
        riwayatOpdPengguna: 0,
        opdPeraturan: 0,
      });

      await service.softDelete('opd-a');
      expect(opdRepository.softDelete).toHaveBeenCalledWith('opd-a');
    });
  });
});
