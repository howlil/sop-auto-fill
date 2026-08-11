import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PeranPengguna, Prisma } from '../../../generated/prisma';
import type { JwtAccessPayload } from '../../../common';
import { UserOpdAccessService } from '../opd/user-opd-access.service';
import { PeraturanRepository } from './peraturan.repository';
import { PeraturanService } from './peraturan.service';

describe('Pengujian PeraturanService', () => {
  let service: PeraturanService;

  const repoMock = {
    findOpdIdByPenggunaId: jest.fn(),
    hasOpdLink: jest.fn(),
    countDasarHukum: jest.fn(),
    deleteOpdLink: jest.fn(),
    countOpdLinks: jest.fn(),
    deletePeraturan: jest.fn(),
    findManyByOpdId: jest.fn(),
    findByIdForOpd: jest.fn(),
    createWithOpdLink: jest.fn(),
    updateMasterWithLastEditor: jest.fn(),
  };

  const userOpdAccessMock = {
    resolveOwnOpdAllowingOptionalQuery: jest.fn(),
  };

  const user: JwtAccessPayload = {
    sub: 'pengguna-1',
    email: 'a@b.c',
    peran: PeranPengguna.PENYUSUN,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    userOpdAccessMock.resolveOwnOpdAllowingOptionalQuery.mockResolvedValue('opd-1');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PeraturanService,
        { provide: PeraturanRepository, useValue: repoMock },
        { provide: UserOpdAccessService, useValue: userOpdAccessMock },
      ],
    }).compile();
    service = module.get(PeraturanService);
  });

  describe('list()', () => {
    it('harus mengembalikan list kosong', async () => {
      repoMock.findManyByOpdId.mockResolvedValue([]);
      const result = await service.list(user);
      expect(result).toEqual([]);
      expect(repoMock.findManyByOpdId).toHaveBeenCalledWith('opd-1');
    });

    it('harus menyertakan data terakhir diedit jika ada dan menangani yang null', async () => {
      repoMock.findManyByOpdId.mockResolvedValue([
        {
          peraturanId: 'per-1',
          nama: 'Permen A',
          nomor: '1',
          tahun: 2026,
          tentang: 'Tentang A',
          lastEditedById: 'u-last',
          lastEditedBy: {
            penggunaId: 'u-last',
            nama: 'Budi',
            opd: { opdId: 'opd-1', nama: 'OPD X' },
          },
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-02T00:00:00.000Z'),
          dasarHukumCount: 3,
        },
        {
          peraturanId: 'per-2',
          nama: 'Permen B',
          nomor: '2',
          tahun: 2026,
          tentang: 'Tentang B',
          lastEditedById: null,
          lastEditedBy: null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-02T00:00:00.000Z'),
          dasarHukumCount: 0,
        },
      ]);
      const rows = await service.list(user, undefined);
      expect(rows).toHaveLength(2);
      expect(rows[0]?.lastEditedById).toBe('u-last');
      expect(rows[0]?.lastEditedBy?.nama).toBe('Budi');
      expect(rows[0]?.lastEditedBy?.opd?.nama).toBe('OPD X');
      expect(rows[1]?.lastEditedById).toBeNull();
      expect(rows[1]?.lastEditedBy).toBeNull();
    });

    it('harus melemparkan error jika resolusi OPD gagal', async () => {
      userOpdAccessMock.resolveOwnOpdAllowingOptionalQuery.mockRejectedValue(
        new Error('Akses ditolak'),
      );
      await expect(service.list(user)).rejects.toThrow('Akses ditolak');
    });
  });

  describe('getById()', () => {
    it('harus melempar NotFoundException jika peraturan tidak ditemukan', async () => {
      repoMock.findByIdForOpd.mockResolvedValue(null);
      await expect(service.getById(user, 'per-99')).rejects.toThrow(NotFoundException);
    });

    it('harus mengembalikan data peraturan jika ditemukan', async () => {
      const mockDate = new Date('2026-01-01T00:00:00.000Z');
      repoMock.findByIdForOpd.mockResolvedValue({
        peraturanId: 'per-1',
        nama: 'Permen A',
        nomor: '1',
        tahun: 2026,
        tentang: 'Tentang A',
        lastEditedById: null,
        lastEditedBy: null,
        createdAt: mockDate,
        updatedAt: mockDate,
        dasarHukumCount: 0,
      });
      const result = await service.getById(user, 'per-1');
      expect(result.id).toBe('per-1');
      expect(result.namaPeraturan).toBe('Permen A');
      expect(result.createdAt).toBe(mockDate.toISOString());
    });
  });

  describe('create()', () => {
    const createDto = { namaPeraturan: 'Baru', nomor: '10', tahun: 2024, tentang: 'Tentang Baru' };

    it('harus berhasil membuat peraturan baru', async () => {
      const mockDate = new Date();
      repoMock.createWithOpdLink.mockResolvedValue({
        peraturanId: 'per-new',
        nama: createDto.namaPeraturan,
        nomor: createDto.nomor,
        tahun: createDto.tahun,
        tentang: createDto.tentang,
        lastEditedById: user.sub,
        lastEditedBy: null,
        createdAt: mockDate,
        updatedAt: mockDate,
        dasarHukumCount: 0,
      });

      const result = await service.create(user, createDto);
      expect(result.id).toBe('per-new');
      expect(repoMock.createWithOpdLink).toHaveBeenCalledWith(
        expect.objectContaining({
          nama: 'Baru',
          opdId: 'opd-1',
          lastEditedById: user.sub,
        }),
      );
    });

    it('harus melempar ConflictException jika nomor dan tahun sudah ada (Prisma P2002)', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'x',
      });
      repoMock.createWithOpdLink.mockRejectedValue(prismaError);

      await expect(service.create(user, createDto)).rejects.toThrow(ConflictException);
    });

    it('harus melemparkan error lain selain P2002 secara langsung', async () => {
      repoMock.createWithOpdLink.mockRejectedValue(new Error('DB Error'));
      await expect(service.create(user, createDto)).rejects.toThrow('DB Error');
    });
  });

  describe('update()', () => {
    it('harus melempar NotFoundException jika hasOpdLink mengembalikan false', async () => {
      repoMock.hasOpdLink.mockResolvedValue(false);
      await expect(service.update(user, 'per-1', {})).rejects.toThrow(NotFoundException);
    });

    it('harus mengambil data master saat tidak ada patch data (DTO kosong) namun melempar NotFoundException jika tidak ditemukan', async () => {
      repoMock.hasOpdLink.mockResolvedValue(true);
      repoMock.findByIdForOpd.mockResolvedValue(null);
      await expect(service.update(user, 'per-1', {})).rejects.toThrow(NotFoundException);
    });

    it('harus mengembalikan data tanpa update ketika DTO kosong', async () => {
      repoMock.hasOpdLink.mockResolvedValue(true);
      const mockDate = new Date();
      repoMock.findByIdForOpd.mockResolvedValue({
        peraturanId: 'per-1',
        nama: 'A',
        nomor: '1',
        tahun: 2026,
        tentang: 'B',
        lastEditedById: null,
        lastEditedBy: null,
        createdAt: mockDate,
        updatedAt: mockDate,
        dasarHukumCount: 0,
      });
      const result = await service.update(user, 'per-1', {});
      expect(result.id).toBe('per-1');
      expect(repoMock.updateMasterWithLastEditor).not.toHaveBeenCalled();
    });

    it('harus memanggil updateMasterWithLastEditor jika ada patch sebagian', async () => {
      repoMock.hasOpdLink.mockResolvedValue(true);
      const mockDate = new Date();
      repoMock.updateMasterWithLastEditor.mockResolvedValue({
        peraturanId: 'per-1',
        nama: 'Nama Baru',
        nomor: '1',
        tahun: 2026,
        tentang: 'B',
        lastEditedById: user.sub,
        lastEditedBy: null,
        createdAt: mockDate,
        updatedAt: mockDate,
        dasarHukumCount: 0,
      });

      const result = await service.update(user, 'per-1', { namaPeraturan: 'Nama Baru' });
      expect(repoMock.updateMasterWithLastEditor).toHaveBeenCalledWith(
        'per-1',
        { nama: 'Nama Baru' },
        user.sub,
      );
      expect(result.namaPeraturan).toBe('Nama Baru');
    });

    it('harus memanggil updateMasterWithLastEditor jika ada patch penuh', async () => {
      repoMock.hasOpdLink.mockResolvedValue(true);
      const mockDate = new Date();
      repoMock.updateMasterWithLastEditor.mockResolvedValue({
        peraturanId: 'per-1',
        nama: 'Nama Baru',
        nomor: '2',
        tahun: 2024,
        tentang: 'Tentang Baru',
        lastEditedById: user.sub,
        lastEditedBy: null,
        createdAt: mockDate,
        updatedAt: mockDate,
        dasarHukumCount: 0,
      });

      const result = await service.update(user, 'per-1', {
        namaPeraturan: 'Nama Baru',
        nomor: '2',
        tahun: 2024,
        tentang: 'Tentang Baru',
      });
      expect(repoMock.updateMasterWithLastEditor).toHaveBeenCalledWith(
        'per-1',
        { nama: 'Nama Baru', nomor: '2', tahun: 2024, tentang: 'Tentang Baru' },
        user.sub,
      );
      expect(result.namaPeraturan).toBe('Nama Baru');
    });

    it('harus melempar ConflictException jika terjadi Prisma P2002 saat update', async () => {
      repoMock.hasOpdLink.mockResolvedValue(true);
      const prismaError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'x',
      });
      repoMock.updateMasterWithLastEditor.mockRejectedValue(prismaError);

      await expect(service.update(user, 'per-1', { nomor: '10' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('harus meneruskan error selain P2002 secara langsung saat update', async () => {
      repoMock.hasOpdLink.mockResolvedValue(true);
      repoMock.updateMasterWithLastEditor.mockRejectedValue(new Error('Update failed'));
      await expect(service.update(user, 'per-1', { nomor: '10' })).rejects.toThrow('Update failed');
    });
  });

  describe('remove()', () => {
    it('harus melempar NotFoundException jika hasOpdLink mengembalikan false', async () => {
      repoMock.hasOpdLink.mockResolvedValue(false);
      await expect(service.remove(user, 'per-1')).rejects.toThrow(NotFoundException);
    });

    it('seharusnya melempar ConflictException ketika menghapus peraturan yang masih menjadi dasar hukum', async () => {
      repoMock.hasOpdLink.mockResolvedValue(true);
      repoMock.countDasarHukum.mockResolvedValue(2);
      await expect(service.remove(user, 'per-1')).rejects.toThrow(ConflictException);
      expect(repoMock.deleteOpdLink).not.toHaveBeenCalled();
    });

    it('seharusnya menghapus relasi dan master ketika tidak ada OPD lain setelah penghapusan', async () => {
      repoMock.hasOpdLink.mockResolvedValue(true);
      repoMock.countDasarHukum.mockResolvedValue(0);
      repoMock.countOpdLinks.mockResolvedValue(0);

      await service.remove(user, 'per-1');

      expect(repoMock.deleteOpdLink).toHaveBeenCalledWith('opd-1', 'per-1');
      expect(repoMock.deletePeraturan).toHaveBeenCalledWith('per-1');
    });

    it('seharusnya tidak menghapus master ketika OPD lain masih terhubung', async () => {
      repoMock.hasOpdLink.mockResolvedValue(true);
      repoMock.countDasarHukum.mockResolvedValue(0);
      repoMock.countOpdLinks.mockResolvedValue(1);

      await service.remove(user, 'per-1');

      expect(repoMock.deleteOpdLink).toHaveBeenCalledWith('opd-1', 'per-1');
      expect(repoMock.deletePeraturan).not.toHaveBeenCalled();
    });
  });
});
