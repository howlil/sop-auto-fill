import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, PeranPengguna, type Pengguna } from '../../../generated/prisma';
import { PenggunaRepository } from '../pengguna/pengguna.repository';
import { PenyusunRepository } from './penyusun.repository';
import { PenyusunService } from './penyusun.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

describe('Pengujian PenyusunService', () => {
  let service: PenyusunService;

  const penyusunRepoMock = {
    findOpdsWithPenyusun: jest.fn().mockResolvedValue([
      {
        opdId: 'opd-1',
        nama: 'Dinas A',
        pengguna: [
          {
            penggunaId: 'u1',
            nama: 'A',
            nip: '1',
            jabatan: 'J',
            pangkat: 'P',
            email: 'a@b.c',
            nohp: '6281234567890',
            peran: PeranPengguna.PENYUSUN,
            deletedAt: null,
          } as Pengguna,
        ],
      },
    ]),
    findPenyusunById: jest.fn(),
    findPenyusunAktifById: jest.fn(),
    findOpdById: jest.fn().mockResolvedValue({ opdId: 'opd-1', nama: 'X' }),
    findOtherPjPenyusunAktif: jest.fn().mockResolvedValue(null),
    createWithRiwayatOpd: jest.fn(),
    updatePenyusun: jest.fn(),
    aktifkanPenyusun: jest.fn(),
    pindahPenyusun: jest.fn(),
    softDeletePenyusun: jest.fn(),
    findRiwayatOpdByPenggunaId: jest.fn(),
    findDeleteGuardRow: jest.fn(),
    deletePenyusunPermanen: jest.fn(),
  };

  const penggunaRepoMock = {
    existsEmailOtherThan: jest.fn().mockResolvedValue(false),
    existsNipOtherThan: jest.fn().mockResolvedValue(false),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    penyusunRepoMock.findOtherPjPenyusunAktif.mockResolvedValue(null);
    penyusunRepoMock.findOpdById.mockResolvedValue({ opdId: 'opd-1', nama: 'X' });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PenyusunService,
        { provide: PenyusunRepository, useValue: penyusunRepoMock },
        { provide: PenggunaRepository, useValue: penggunaRepoMock },
      ],
    }).compile();
    service = module.get(PenyusunService);
  });

  it('seharusnya memetakan daftar grup dengan status', async () => {
    const grup = await service.listGrup();
    expect(grup).toHaveLength(1);
    expect(grup[0].namaOpd).toBe('Dinas A');
    expect(grup[0].penyusun[0].status).toBe('AKTIF');
    expect(grup[0].penyusun[0].peran).toBe('PENYUSUN');
  });

  it('seharusnya melempar ConflictException ketika OPD sudah memiliki PJ', async () => {
    penyusunRepoMock.findOtherPjPenyusunAktif.mockResolvedValueOnce({
      penggunaId: 'pj-existing',
      peran: PeranPengguna.PJ_PENYUSUN,
    } as Pengguna);
    await expect(
      service.create({
        opdId: 'opd-1',
        nama: 'B',
        nip: '2',
        peran: 'PJ_PENYUSUN',
        pangkat: 'IV/a',
        jabatan: 'Analis',
        email: 'b@x.id',
        nohp: '081',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(penyusunRepoMock.createWithRiwayatOpd).not.toHaveBeenCalled();
  });

  it('seharusnya melempar ConflictException ketika mempromosikan menjadi PJ tetapi PJ lain masih ada', async () => {
    penyusunRepoMock.findPenyusunById.mockResolvedValueOnce({
      penggunaId: 'u-promote',
      email: 'u@x.id',
      nip: '9',
      opdId: 'opd-1',
      peran: PeranPengguna.PENYUSUN,
      nama: 'U',
      pangkat: 'IV/a',
      jabatan: 'J',
      nohp: '6281234567890',
      deletedAt: null,
    } as Pengguna);
    penyusunRepoMock.findOtherPjPenyusunAktif.mockResolvedValueOnce({
      penggunaId: 'pj-lain',
      peran: PeranPengguna.PJ_PENYUSUN,
    } as Pengguna);
    await expect(service.update('u-promote', { peran: 'PJ_PENYUSUN' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(penyusunRepoMock.updatePenyusun).not.toHaveBeenCalled();
  });

  it('seharusnya melempar ConflictException ketika mengaktifkan PJ tetapi slot sudah terisi', async () => {
    penyusunRepoMock.findPenyusunById.mockResolvedValueOnce({
      penggunaId: 'pj-inaktif',
      email: 'pj@x.id',
      nip: '7',
      opdId: 'opd-1',
      peran: PeranPengguna.PJ_PENYUSUN,
      nama: 'PJ',
      pangkat: 'IV/a',
      jabatan: 'J',
      nohp: '6281234567890',
      deletedAt: new Date(),
    } as Pengguna);
    penyusunRepoMock.findOtherPjPenyusunAktif.mockResolvedValueOnce({
      penggunaId: 'pj-aktif-lain',
      peran: PeranPengguna.PJ_PENYUSUN,
    } as Pengguna);
    await expect(service.aktifkan('pj-inaktif')).rejects.toBeInstanceOf(ConflictException);
    expect(penyusunRepoMock.aktifkanPenyusun).not.toHaveBeenCalled();
  });

  it('seharusnya melempar ConflictException ketika memindahkan PJ ke OPD yang sudah memiliki PJ', async () => {
    penyusunRepoMock.findPenyusunAktifById.mockResolvedValueOnce({
      penggunaId: 'pj-move',
      email: 'm@x.id',
      nip: '3',
      opdId: 'opd-asal',
      peran: PeranPengguna.PJ_PENYUSUN,
      nama: 'M',
      pangkat: 'IV/a',
      jabatan: 'J',
      nohp: '6281234567890',
      deletedAt: null,
    } as Pengguna);
    penyusunRepoMock.findOpdById.mockResolvedValueOnce({ opdId: 'opd-tujuan', nama: 'Tujuan' });
    penyusunRepoMock.findOtherPjPenyusunAktif.mockResolvedValueOnce({
      penggunaId: 'pj-di-tujuan',
      peran: PeranPengguna.PJ_PENYUSUN,
    } as Pengguna);
    await expect(service.pindah('pj-move', 'opd-tujuan')).rejects.toBeInstanceOf(ConflictException);
    expect(penyusunRepoMock.pindahPenyusun).not.toHaveBeenCalled();
  });

  it('seharusnya membuat penyusun melalui repository', async () => {
    const createdUser = {
      penggunaId: 'new-u',
      email: 'n@x.id',
      nip: '99',
      opdId: 'opd-1',
      peran: PeranPengguna.PENYUSUN,
      nama: 'N',
      pangkat: 'IV/a',
      jabatan: 'J',
      nohp: '6281234567890',
      deletedAt: null,
    } as Pengguna;
    penyusunRepoMock.createWithRiwayatOpd.mockResolvedValueOnce(createdUser);
    const actual = await service.create({
      opdId: 'opd-1',
      nama: 'N',
      nip: '99',
      peran: 'PENYUSUN',
      pangkat: 'IV/a',
      jabatan: 'J',
      email: 'n@x.id',
      nohp: '6281234567890',
    });
    expect(actual.id).toBe('new-u');
    expect(penyusunRepoMock.createWithRiwayatOpd).toHaveBeenCalledWith(
      expect.objectContaining({ opdId: 'opd-1', email: 'n@x.id' }),
    );
  });

  it('seharusnya memindahkan penyusun melalui repository', async () => {
    penyusunRepoMock.findPenyusunAktifById.mockResolvedValueOnce({
      penggunaId: 'u-move',
      email: 'mv@x.id',
      nip: '88',
      opdId: 'opd-asal',
      peran: PeranPengguna.PENYUSUN,
      nama: 'MV',
      pangkat: 'IV/a',
      jabatan: 'J',
      nohp: '6281234567890',
      deletedAt: null,
    } as Pengguna);
    penyusunRepoMock.findOpdById.mockResolvedValueOnce({ opdId: 'opd-tujuan', nama: 'Tujuan' });
    penyusunRepoMock.pindahPenyusun.mockResolvedValueOnce({
      penggunaId: 'u-move',
      opdId: 'opd-tujuan',
      peran: PeranPengguna.PENYUSUN,
      nama: 'MV',
      nip: '88',
      email: 'mv@x.id',
      pangkat: 'IV/a',
      jabatan: 'J',
      nohp: '6281234567890',
      deletedAt: null,
    } as Pengguna);
    await service.pindah('u-move', 'opd-tujuan');
    expect(penyusunRepoMock.pindahPenyusun).toHaveBeenCalledWith(
      'u-move',
      'opd-asal',
      'opd-tujuan',
    );
  });

  // --- COMPREHENSIVE TESTS (FALSE, WORST, EDGE CASES) ---

  describe('create (Tambahan Kasus)', () => {
    it('seharusnya membersihkan spasi dan mengecilkan huruf email (Worst Case)', async () => {
      penyusunRepoMock.createWithRiwayatOpd.mockResolvedValueOnce({
        penggunaId: 'new',
        email: 'e@x.id',
      } as Pengguna);
      await service.create({
        opdId: 'opd-1',
        nama: ' X ',
        nip: ' 1 ',
        peran: 'PENYUSUN',
        pangkat: ' P ',
        jabatan: ' J ',
        email: ' E@X.ID ',
        nohp: ' 081234567890 ',
      });
      expect(penyusunRepoMock.createWithRiwayatOpd).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'e@x.id',
          nama: 'X',
          nip: '1',
          pangkat: 'P',
          jabatan: 'J',
          nohp: '6281234567890',
        }),
      );
    });

    it('seharusnya melempar NotFoundException jika OPD tidak ditemukan saat create (False Case)', async () => {
      penyusunRepoMock.findOpdById.mockResolvedValueOnce(null);
      await expect(
        service.create({
          opdId: 'invalid',
          nama: 'X',
          nip: '1',
          peran: 'PENYUSUN',
          pangkat: 'P',
          jabatan: 'J',
          email: 'e@x.id',
          nohp: '6281234567890',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('seharusnya melempar ConflictException jika terjadi Prisma P2002 pada create (False Case)', async () => {
      const prismaErr = new Prisma.PrismaClientKnownRequestError('err', {
        code: 'P2002',
        clientVersion: '1',
      });
      penyusunRepoMock.createWithRiwayatOpd.mockRejectedValueOnce(prismaErr);
      await expect(
        service.create({
          opdId: 'opd-1',
          nama: 'X',
          nip: '1',
          peran: 'PENYUSUN',
          pangkat: 'P',
          jabatan: 'J',
          email: 'e@x.id',
          nohp: '6281234567890',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('seharusnya meneruskan error general pada create (False Case)', async () => {
      penyusunRepoMock.createWithRiwayatOpd.mockRejectedValueOnce(new Error('DB Error'));
      await expect(
        service.create({
          opdId: 'opd-1',
          nama: 'X',
          nip: '1',
          peran: 'PENYUSUN',
          pangkat: 'P',
          jabatan: 'J',
          email: 'e@x.id',
          nohp: '6281234567890',
        }),
      ).rejects.toThrow('DB Error');
    });
  });

  describe('update (Tambahan Kasus)', () => {
    it('seharusnya melempar NotFoundException jika penyusun tidak ada (False Case)', async () => {
      penyusunRepoMock.findPenyusunById.mockResolvedValueOnce(null);
      await expect(service.update('invalid', {})).rejects.toBeInstanceOf(NotFoundException);
    });

    it('seharusnya melempar BadRequestException jika payload update kosong (Edge Case)', async () => {
      penyusunRepoMock.findPenyusunById.mockResolvedValueOnce({ penggunaId: 'u' } as Pengguna);
      await expect(service.update('u', {})).rejects.toBeInstanceOf(BadRequestException);
    });

    it('seharusnya tidak memanggil fungsi unik jika email/nip sama persis (Edge Case)', async () => {
      penyusunRepoMock.findPenyusunById.mockResolvedValueOnce({
        penggunaId: 'u',
        email: 'e@x.id',
        nip: '1',
      } as Pengguna);
      penyusunRepoMock.updatePenyusun.mockResolvedValueOnce({
        penggunaId: 'u',
        email: 'e@x.id',
        nip: '1',
      } as Pengguna);
      await service.update('u', { email: 'e@x.id', nip: '1' });
      expect(penggunaRepoMock.existsEmailOtherThan).not.toHaveBeenCalled();
      expect(penggunaRepoMock.existsNipOtherThan).not.toHaveBeenCalled();
    });

    it('seharusnya melempar BadRequestException ketika mempromosikan PJ pada akun nonaktif (Edge Case)', async () => {
      penyusunRepoMock.findPenyusunById.mockResolvedValueOnce({
        penggunaId: 'u',
        peran: PeranPengguna.PENYUSUN,
        deletedAt: new Date(),
      } as Pengguna);
      await expect(service.update('u', { peran: 'PJ_PENYUSUN' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('seharusnya set deletedAt ke tanggal saat status NONAKTIF (Edge Case)', async () => {
      penyusunRepoMock.findPenyusunById.mockResolvedValueOnce({
        penggunaId: 'u',
        deletedAt: null,
      } as Pengguna);
      penyusunRepoMock.updatePenyusun.mockResolvedValueOnce({
        penggunaId: 'u',
        deletedAt: new Date(),
      } as Pengguna);
      await service.update('u', { status: 'NONAKTIF' });
      expect(penyusunRepoMock.updatePenyusun).toHaveBeenCalledWith(
        'u',
        expect.objectContaining({ deletedAt: expect.any(Date) }),
      );
    });

    it('seharusnya set deletedAt ke null saat status AKTIF (Edge Case)', async () => {
      penyusunRepoMock.findPenyusunById.mockResolvedValueOnce({
        penggunaId: 'u',
        deletedAt: new Date(),
      } as Pengguna);
      penyusunRepoMock.updatePenyusun.mockResolvedValueOnce({
        penggunaId: 'u',
        deletedAt: null,
      } as Pengguna);
      await service.update('u', { status: 'AKTIF' });
      expect(penyusunRepoMock.updatePenyusun).toHaveBeenCalledWith(
        'u',
        expect.objectContaining({ deletedAt: null }),
      );
    });

    it('seharusnya melempar ConflictException jika terjadi Prisma P2002 pada update (False Case)', async () => {
      penyusunRepoMock.findPenyusunById.mockResolvedValueOnce({ penggunaId: 'u' } as Pengguna);
      const prismaErr = new Prisma.PrismaClientKnownRequestError('err', {
        code: 'P2002',
        clientVersion: '1',
      });
      penyusunRepoMock.updatePenyusun.mockRejectedValueOnce(prismaErr);
      await expect(service.update('u', { nama: 'X' })).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('nonaktifkan (Tambahan Kasus)', () => {
    it('seharusnya melempar NotFoundException jika tidak aktif atau tidak ditemukan (False Case)', async () => {
      penyusunRepoMock.findPenyusunAktifById.mockResolvedValueOnce(null);
      await expect(service.nonaktifkan('invalid')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('seharusnya memanggil softDeletePenyusun jika ditemukan (Success/Edge Case)', async () => {
      penyusunRepoMock.findPenyusunAktifById.mockResolvedValueOnce({ penggunaId: 'u' } as Pengguna);
      await service.nonaktifkan('u');
      expect(penyusunRepoMock.softDeletePenyusun).toHaveBeenCalledWith('u');
    });
  });

  describe('aktifkan (Tambahan Kasus)', () => {
    it('seharusnya melempar NotFoundException jika pengguna tidak ditemukan (False Case)', async () => {
      penyusunRepoMock.findPenyusunById.mockResolvedValueOnce(null);
      await expect(service.aktifkan('invalid')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('seharusnya melempar BadRequestException jika pengguna sudah aktif (False Case)', async () => {
      penyusunRepoMock.findPenyusunById.mockResolvedValueOnce({
        penggunaId: 'u',
        deletedAt: null,
      } as Pengguna);
      await expect(service.aktifkan('u')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('seharusnya melempar ConflictException jika terjadi Prisma P2002 pada aktifkan (False Case)', async () => {
      penyusunRepoMock.findPenyusunById.mockResolvedValueOnce({
        penggunaId: 'u',
        deletedAt: new Date(),
      } as Pengguna);
      const prismaErr = new Prisma.PrismaClientKnownRequestError('err', {
        code: 'P2002',
        clientVersion: '1',
      });
      penyusunRepoMock.aktifkanPenyusun.mockRejectedValueOnce(prismaErr);
      await expect(service.aktifkan('u')).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('pindah (Tambahan Kasus)', () => {
    it('seharusnya melempar NotFoundException jika penyusun aktif tidak ditemukan (False Case)', async () => {
      penyusunRepoMock.findPenyusunAktifById.mockResolvedValueOnce(null);
      await expect(service.pindah('invalid', 'opd')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('seharusnya melempar NotFoundException jika OPD tujuan tidak ditemukan (False Case)', async () => {
      penyusunRepoMock.findPenyusunAktifById.mockResolvedValueOnce({ penggunaId: 'u' } as Pengguna);
      penyusunRepoMock.findOpdById.mockResolvedValueOnce(null);
      await expect(service.pindah('u', 'invalid-opd')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('seharusnya melempar ConflictException jika dipindah ke OPD yang sama (Edge Case)', async () => {
      penyusunRepoMock.findPenyusunAktifById.mockResolvedValueOnce({
        penggunaId: 'u',
        opdId: 'opd-1',
      } as Pengguna);
      penyusunRepoMock.findOpdById.mockResolvedValueOnce({ opdId: 'opd-1', nama: 'OPD 1' });
      await expect(service.pindah('u', 'opd-1')).rejects.toBeInstanceOf(ConflictException);
    });

    it('seharusnya melempar ConflictException jika terjadi Prisma P2002 pada pindah (False Case)', async () => {
      penyusunRepoMock.findPenyusunAktifById.mockResolvedValueOnce({
        penggunaId: 'u',
        opdId: 'opd-lama',
      } as Pengguna);
      penyusunRepoMock.findOpdById.mockResolvedValueOnce({ opdId: 'opd-baru', nama: 'OPD Baru' });
      const prismaErr = new Prisma.PrismaClientKnownRequestError('err', {
        code: 'P2002',
        clientVersion: '1',
      });
      penyusunRepoMock.pindahPenyusun.mockRejectedValueOnce(prismaErr);
      await expect(service.pindah('u', 'opd-baru')).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('listRiwayatOpdPenyusun (Tambahan Kasus)', () => {
    it('seharusnya melempar NotFoundException jika pengguna tidak ditemukan (False Case)', async () => {
      penyusunRepoMock.findPenyusunById.mockResolvedValueOnce(null);
      await expect(service.listRiwayatOpdPenyusun('invalid')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('seharusnya mengembalikan array kosong jika riwayat belum ada (Edge Case)', async () => {
      penyusunRepoMock.findPenyusunById.mockResolvedValueOnce({ penggunaId: 'u' } as Pengguna);
      penyusunRepoMock.findRiwayatOpdByPenggunaId.mockResolvedValueOnce([]);
      const res = await service.listRiwayatOpdPenyusun('u');
      expect(res).toEqual([]);
    });

    it('seharusnya memetakan riwayat dengan benar (Success Case)', async () => {
      penyusunRepoMock.findPenyusunById.mockResolvedValueOnce({ penggunaId: 'u' } as Pengguna);
      const d = new Date();
      penyusunRepoMock.findRiwayatOpdByPenggunaId.mockResolvedValueOnce([
        {
          opdId: 'opd-1',
          namaOpd: 'Dinas A',
          pertamaDicatat: d,
          terakhirDiperbarui: d,
          isAktif: true,
        },
      ]);
      const res = await service.listRiwayatOpdPenyusun('u');
      expect(res).toEqual([
        {
          opdId: 'opd-1',
          namaOpd: 'Dinas A',
          pertamaDicatat: d,
          terakhirDiperbarui: d,
          isAktif: true,
        },
      ]);
    });
  });

  describe('hapusPermanen (Tambahan Kasus)', () => {
    it('seharusnya melempar NotFoundException jika pengguna tidak ditemukan (False Case)', async () => {
      penyusunRepoMock.findPenyusunById.mockResolvedValueOnce(null);
      await expect(service.hapusPermanen('invalid')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('seharusnya melempar NotFoundException jika delete guard row mengembalikan null (False Case)', async () => {
      penyusunRepoMock.findPenyusunById.mockResolvedValueOnce({ penggunaId: 'u' } as Pengguna);
      penyusunRepoMock.findDeleteGuardRow.mockResolvedValueOnce(null);
      await expect(service.hapusPermanen('u')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('seharusnya melempar ConflictException jika masih ada referensi tabel terkait > 0 (False Case)', async () => {
      penyusunRepoMock.findPenyusunById.mockResolvedValueOnce({ penggunaId: 'u' } as Pengguna);
      penyusunRepoMock.findDeleteGuardRow.mockResolvedValueOnce({
        penggunaId: 'u',
        peran: PeranPengguna.PENYUSUN,
        ttePinHash: null,
        _count: {
          detailSopDibuat: 1,
          detailSopDiedit: 0,
          logEditSop: 0,
          logNilaiEvaluasi: 0,
          nilaiEvaluasiDiisi: 0,
          pengajuanEvaluasiDiselesaikan: 0,
          pengajuanEvaluasiDitandatangani: 0,
          pengajuanEvaluasiDiverifikasi: 0,
          riwayatOpd: 0,
          tandaTangan: 0,
        },
      });
      await expect(service.hapusPermanen('u')).rejects.toBeInstanceOf(ConflictException);
    });

    it('seharusnya melempar ConflictException jika memiliki ttePinHash (False Case)', async () => {
      penyusunRepoMock.findPenyusunById.mockResolvedValueOnce({ penggunaId: 'u' } as Pengguna);
      penyusunRepoMock.findDeleteGuardRow.mockResolvedValueOnce({
        penggunaId: 'u',
        peran: PeranPengguna.PENYUSUN,
        ttePinHash: 'hashed-pin',
        _count: {
          detailSopDibuat: 0,
          detailSopDiedit: 0,
          logEditSop: 0,
          logNilaiEvaluasi: 0,
          nilaiEvaluasiDiisi: 0,
          pengajuanEvaluasiDiselesaikan: 0,
          pengajuanEvaluasiDitandatangani: 0,
          pengajuanEvaluasiDiverifikasi: 0,
          riwayatOpd: 0,
          tandaTangan: 0,
        },
      });
      await expect(service.hapusPermanen('u')).rejects.toBeInstanceOf(ConflictException);
    });

    it('seharusnya melempar ConflictException jika pengguna masih memiliki peran PJ_PENYUSUN (False Case)', async () => {
      penyusunRepoMock.findPenyusunById.mockResolvedValueOnce({ penggunaId: 'u' } as Pengguna);
      penyusunRepoMock.findDeleteGuardRow.mockResolvedValueOnce({
        penggunaId: 'u',
        peran: PeranPengguna.PJ_PENYUSUN,
        ttePinHash: null,
        _count: {
          detailSopDibuat: 0,
          detailSopDiedit: 0,
          logEditSop: 0,
          logNilaiEvaluasi: 0,
          nilaiEvaluasiDiisi: 0,
          pengajuanEvaluasiDiselesaikan: 0,
          pengajuanEvaluasiDitandatangani: 0,
          pengajuanEvaluasiDiverifikasi: 0,
          riwayatOpd: 0,
          tandaTangan: 0,
        },
      });
      await expect(service.hapusPermanen('u')).rejects.toBeInstanceOf(ConflictException);
    });

    it('seharusnya berhasil memanggil deletePenyusunPermanen jika memenuhi syarat (Success/Edge Case)', async () => {
      penyusunRepoMock.findPenyusunById.mockResolvedValueOnce({ penggunaId: 'u' } as Pengguna);
      penyusunRepoMock.findDeleteGuardRow.mockResolvedValueOnce({
        penggunaId: 'u',
        peran: PeranPengguna.PENYUSUN,
        ttePinHash: null,
        _count: {
          detailSopDibuat: 0,
          detailSopDiedit: 0,
          logEditSop: 0,
          logNilaiEvaluasi: 0,
          nilaiEvaluasiDiisi: 0,
          pengajuanEvaluasiDiselesaikan: 0,
          pengajuanEvaluasiDitandatangani: 0,
          pengajuanEvaluasiDiverifikasi: 0,
          riwayatOpd: 0,
          tandaTangan: 0,
        },
      });
      await service.hapusPermanen('u');
      expect(penyusunRepoMock.deletePenyusunPermanen).toHaveBeenCalledWith('u');
    });
  });
});
