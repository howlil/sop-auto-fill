import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, PeranPengguna, type Pengguna } from '../../../generated/prisma';
import { PenggunaRepository } from '../pengguna/pengguna.repository';
import { KepalaOpdRepository, type KepalaOpdWithCounts } from './kepala-opd.repository';
import { KepalaOpdService } from './kepala-opd.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

describe('Pengujian KepalaOpdService', () => {
  let service: KepalaOpdService;

  const penggunaRepoMock = {
    countAktifByOpdIdAndPeran: jest.fn(),
    existsEmailOtherThan: jest.fn(),
    existsNipOtherThan: jest.fn(),
  };

  const kepalaRepoMock = {
    findOpdAktifById: jest.fn().mockResolvedValue({ opdId: 'opd-1', nama: 'Dinas A' }),
    findKepalaById: jest.fn(),
    findManyKepala: jest.fn().mockResolvedValue([]),
    createWithRiwayatOpd: jest.fn(),
    persistUpdate: jest.fn(),
    softDeleteKepalaOpd: jest.fn(),
    findRiwayatRowsForPengguna: jest.fn().mockResolvedValue([]),
  };

  const baseKepala = (overrides: Partial<KepalaOpdWithCounts> = {}): KepalaOpdWithCounts =>
    ({
      penggunaId: 'kepala-1',
      email: 'k@x.id',
      nip: '1',
      opdId: 'opd-1',
      peran: PeranPengguna.KEPALA_OPD,
      nama: 'Kepala',
      pangkat: 'IV/a',
      jabatan: 'Kepala',
      nohp: '6281234567890',
      kataSandi: 'x',
      sesiTokenVersion: 0,
      refreshTokenHash: null,
      refreshTokenExpiresAt: null,
      passwordChangedAt: null,
      ttePinHash: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      opd: {
        opdId: 'opd-1',
        nama: 'Dinas A',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      _count: { detailSopDibuat: 0 },
      ...overrides,
    }) as KepalaOpdWithCounts;

  beforeEach(async () => {
    jest.clearAllMocks();
    kepalaRepoMock.findKepalaById.mockReset();
    kepalaRepoMock.findOpdAktifById.mockReset();
    kepalaRepoMock.findOpdAktifById.mockResolvedValue({ opdId: 'opd-1', nama: 'Dinas A' });
    penggunaRepoMock.countAktifByOpdIdAndPeran.mockResolvedValue(0);
    penggunaRepoMock.existsEmailOtherThan.mockResolvedValue(false);
    penggunaRepoMock.existsNipOtherThan.mockResolvedValue(false);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KepalaOpdService,
        { provide: KepalaOpdRepository, useValue: kepalaRepoMock },
        { provide: PenggunaRepository, useValue: penggunaRepoMock },
      ],
    }).compile();
    service = module.get(KepalaOpdService);
  });

  it('seharusnya membuat kepala OPD ketika belum ada kepala aktif', async () => {
    const created = {
      penggunaId: 'new-kepala',
      email: 'n@x.id',
      nip: '99',
      opdId: 'opd-1',
      peran: PeranPengguna.KEPALA_OPD,
      nama: 'Baru',
      pangkat: 'IV/a',
      jabatan: 'Kepala',
      nohp: '6281234567890',
      deletedAt: null,
    } as Pengguna;
    kepalaRepoMock.createWithRiwayatOpd.mockResolvedValueOnce(created);
    kepalaRepoMock.findKepalaById.mockResolvedValueOnce(baseKepala({ penggunaId: 'new-kepala' }));
    const actual = await service.create({
      opdId: 'opd-1',
      nama: 'Baru',
      nip: '99',
      email: 'n@x.id',
      jabatan: 'Kepala',
      pangkat: 'IV/a',
      nohp: '081234567890',
    });
    expect(actual.id).toBe('new-kepala');
    expect(penggunaRepoMock.countAktifByOpdIdAndPeran).toHaveBeenCalledWith(
      'opd-1',
      PeranPengguna.KEPALA_OPD,
      undefined,
    );
    expect(kepalaRepoMock.createWithRiwayatOpd).toHaveBeenCalled();
  });

  it('seharusnya melempar ConflictException ketika OPD sudah memiliki kepala', async () => {
    penggunaRepoMock.countAktifByOpdIdAndPeran.mockResolvedValueOnce(1);
    await expect(
      service.create({
        opdId: 'opd-1',
        nama: 'B',
        nip: '2',
        email: 'b@x.id',
        jabatan: 'Kepala',
        pangkat: 'IV/a',
        nohp: '081234567890',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(kepalaRepoMock.createWithRiwayatOpd).not.toHaveBeenCalled();
  });

  it('seharusnya melempar ConflictException ketika mengaktifkan ulang tetapi kepala lain masih aktif', async () => {
    kepalaRepoMock.findKepalaById
      .mockResolvedValueOnce(baseKepala({ penggunaId: 'kepala-nonaktif', deletedAt: new Date() }))
      .mockResolvedValueOnce(baseKepala({ penggunaId: 'kepala-nonaktif', deletedAt: null }));
    penggunaRepoMock.countAktifByOpdIdAndPeran.mockResolvedValueOnce(1);
    await expect(service.update('kepala-nonaktif', { status: 'AKTIF' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(kepalaRepoMock.persistUpdate).not.toHaveBeenCalled();
  });

  it('seharusnya melempar ConflictException ketika pindah ke OPD yang sudah memiliki kepala', async () => {
    kepalaRepoMock.findKepalaById.mockResolvedValueOnce(
      baseKepala({ penggunaId: 'kepala-move', opdId: 'opd-asal' }),
    );
    kepalaRepoMock.findOpdAktifById.mockResolvedValueOnce({ opdId: 'opd-tujuan', nama: 'Tujuan' });
    penggunaRepoMock.countAktifByOpdIdAndPeran.mockResolvedValueOnce(1);
    await expect(service.update('kepala-move', { opdId: 'opd-tujuan' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(kepalaRepoMock.persistUpdate).not.toHaveBeenCalled();
  });

  it('seharusnya melempar BadRequestException ketika nonaktif pindah OPD', async () => {
    kepalaRepoMock.findKepalaById.mockResolvedValue(
      baseKepala({ penggunaId: 'kepala-x', deletedAt: new Date() }),
    );
    await expect(service.update('kepala-x', { opdId: 'opd-tujuan' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(kepalaRepoMock.persistUpdate).not.toHaveBeenCalled();
  });

  it('seharusnya melempar ConflictException ketika menghapus kepala OPD yang masih memiliki SOP', async () => {
    kepalaRepoMock.findKepalaById.mockResolvedValueOnce(
      baseKepala({ _count: { detailSopDibuat: 2 } }),
    );
    await expect(service.remove('kepala-1')).rejects.toBeInstanceOf(ConflictException);
    expect(kepalaRepoMock.softDeleteKepalaOpd).not.toHaveBeenCalled();
  });

  it('seharusnya melempar NotFoundException ketika OPD tidak ditemukan pada membuat', async () => {
    kepalaRepoMock.findOpdAktifById.mockResolvedValueOnce(null);
    await expect(
      service.create({
        opdId: 'opd-x',
        nama: 'B',
        nip: '2',
        email: 'b@x.id',
        jabatan: 'Kepala',
        pangkat: 'IV/a',
        nohp: '081234567890',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('seharusnya melempar ConflictException ketika email sudah digunakan', async () => {
    kepalaRepoMock.findKepalaById.mockResolvedValueOnce(baseKepala());
    penggunaRepoMock.existsEmailOtherThan.mockResolvedValueOnce(true);
    await expect(service.update('kepala-1', { email: 'lain@x.id' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(kepalaRepoMock.persistUpdate).not.toHaveBeenCalled();
  });

  it('seharusnya melempar ConflictException ketika NIP sudah digunakan', async () => {
    kepalaRepoMock.findKepalaById.mockResolvedValueOnce(baseKepala());
    penggunaRepoMock.existsNipOtherThan.mockResolvedValueOnce(true);
    await expect(service.update('kepala-1', { nip: '999' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(kepalaRepoMock.persistUpdate).not.toHaveBeenCalled();
  });

  // --- COMPREHENSIVE TESTS (FALSE, WORST, EDGE CASES) ---

  describe('create (Tambahan Kasus)', () => {
    it('seharusnya membersihkan input spasi dan kapitalisasi pada email (Worst Case)', async () => {
      const created = baseKepala({ penggunaId: 'new-id' });
      kepalaRepoMock.createWithRiwayatOpd.mockResolvedValueOnce(created);
      kepalaRepoMock.findKepalaById.mockResolvedValueOnce(created);

      await service.create({
        opdId: 'opd-1',
        nama: '  Spasi Nama  ',
        nip: ' 12345 ',
        email: '  KaPiTal@x.Id  ',
        jabatan: ' Jabatan ',
        pangkat: ' Pangkat ',
        nohp: ' 081234567890 ',
      });

      expect(kepalaRepoMock.createWithRiwayatOpd).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'kapital@x.id',
          nama: 'Spasi Nama',
          nip: '12345',
          jabatan: 'Jabatan',
          pangkat: 'Pangkat',
          nohp: '6281234567890',
        }),
      );
    });

    it('seharusnya melempar ConflictException jika terjadi Prisma P2002 pada create (False Case)', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError('err', {
        code: 'P2002',
        clientVersion: '1',
      });
      kepalaRepoMock.createWithRiwayatOpd.mockRejectedValueOnce(prismaError);

      await expect(
        service.create({
          opdId: 'opd-1',
          nama: 'X',
          nip: '1',
          email: 'e@e.c',
          jabatan: 'J',
          pangkat: 'P',
          nohp: '6281234567890',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('seharusnya meneruskan error tak terduga selain P2002 pada create (False Case)', async () => {
      kepalaRepoMock.createWithRiwayatOpd.mockRejectedValueOnce(new Error('Unknown DB Error'));

      await expect(
        service.create({
          opdId: 'opd-1',
          nama: 'X',
          nip: '1',
          email: 'e@e.c',
          jabatan: 'J',
          pangkat: 'P',
          nohp: '6281234567890',
        }),
      ).rejects.toThrow('Unknown DB Error');
    });

    it('seharusnya melempar NotFoundException jika data kepala tidak ditemukan sesaat setelah dibuat (False Case)', async () => {
      const created = baseKepala({ penggunaId: 'new-id' });
      kepalaRepoMock.createWithRiwayatOpd.mockResolvedValueOnce(created);
      kepalaRepoMock.findKepalaById.mockResolvedValueOnce(null);

      await expect(
        service.create({
          opdId: 'opd-1',
          nama: 'X',
          nip: '1',
          email: 'e@e.c',
          jabatan: 'J',
          pangkat: 'P',
          nohp: '6281234567890',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findAll (Tambahan Kasus)', () => {
    it('seharusnya meneruskan search ke repository dan memetakan status aktif serta dapatDihapus', async () => {
      const activeUpdatedAt = new Date('2026-05-01T00:00:00.000Z');
      const inactiveUpdatedAt = new Date('2026-05-02T00:00:00.000Z');
      kepalaRepoMock.findManyKepala.mockResolvedValueOnce([
        baseKepala({
          penggunaId: 'aktif',
          nama: 'Aktif',
          updatedAt: activeUpdatedAt,
          _count: { detailSopDibuat: 0 },
        }),
        baseKepala({
          penggunaId: 'nonaktif',
          nama: 'Nonaktif',
          deletedAt: new Date('2026-05-03T00:00:00.000Z'),
          updatedAt: inactiveUpdatedAt,
          _count: { detailSopDibuat: 3 },
        }),
      ]);

      const actual = await service.findAll(' kepala ');

      expect(kepalaRepoMock.findManyKepala).toHaveBeenCalledWith(' kepala ');
      expect(actual).toEqual([
        expect.objectContaining({
          id: 'aktif',
          nama: 'Aktif',
          isActive: true,
          dapatDihapus: true,
          updatedAt: activeUpdatedAt,
        }),
        expect.objectContaining({
          id: 'nonaktif',
          nama: 'Nonaktif',
          isActive: false,
          dapatDihapus: false,
          updatedAt: inactiveUpdatedAt,
        }),
      ]);
    });
  });

  describe('update (Tambahan Kasus)', () => {
    it('seharusnya melempar NotFoundException jika kepala tidak ada saat update (False Case)', async () => {
      kepalaRepoMock.findKepalaById.mockResolvedValueOnce(null);
      await expect(service.update('invalid', { nama: 'X' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('seharusnya melempar BadRequestException jika payload kosong (Edge Case)', async () => {
      kepalaRepoMock.findKepalaById.mockResolvedValueOnce(baseKepala());
      await expect(service.update('kepala-1', {})).rejects.toBeInstanceOf(BadRequestException);
    });

    it('seharusnya tidak memanggil existsEmailOtherThan atau existsNipOtherThan jika email dan nip tidak berubah (Edge Case)', async () => {
      kepalaRepoMock.findKepalaById.mockResolvedValueOnce(
        baseKepala({ email: 'k@x.id', nip: '1' }),
      );
      kepalaRepoMock.findKepalaById.mockResolvedValueOnce(
        baseKepala({ email: 'k@x.id', nip: '1' }),
      ); // for read-after-write

      await service.update('kepala-1', { email: 'k@x.id', nip: '1' });

      expect(penggunaRepoMock.existsEmailOtherThan).not.toHaveBeenCalled();
      expect(penggunaRepoMock.existsNipOtherThan).not.toHaveBeenCalled();
    });

    it('seharusnya mengecek uniqueness dengan email ternormalisasi dan nip trim ketika berubah (Worst Case)', async () => {
      kepalaRepoMock.findKepalaById.mockResolvedValueOnce(
        baseKepala({ email: 'lama@x.id', nip: '1' }),
      );
      kepalaRepoMock.findKepalaById.mockResolvedValueOnce(baseKepala());

      await service.update('kepala-1', { email: '  BARU@X.ID  ', nip: '  999  ' });

      expect(penggunaRepoMock.existsEmailOtherThan).toHaveBeenCalledWith('baru@x.id', 'kepala-1');
      expect(penggunaRepoMock.existsNipOtherThan).toHaveBeenCalledWith('999', 'kepala-1');
      expect(kepalaRepoMock.persistUpdate).toHaveBeenCalledWith(
        'kepala-1',
        expect.objectContaining({
          profil: expect.objectContaining({
            email: 'baru@x.id',
            nip: '999',
          }),
        }),
      );
    });

    it('seharusnya melempar NotFoundException ketika OPD tujuan tidak ada (False Case)', async () => {
      kepalaRepoMock.findKepalaById.mockResolvedValueOnce(baseKepala({ opdId: 'opd-lama' }));
      kepalaRepoMock.findOpdAktifById.mockResolvedValueOnce(null);

      await expect(service.update('kepala-1', { opdId: 'opd-baru' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('seharusnya memindahkan kepala OPD aktif ke OPD tujuan kosong dan sinkron riwayat (Success/Worst Case)', async () => {
      kepalaRepoMock.findKepalaById
        .mockResolvedValueOnce(baseKepala({ opdId: 'opd-lama' }))
        .mockResolvedValueOnce(
          baseKepala({
            opdId: 'opd-baru',
            opd: {
              opdId: 'opd-baru',
              nama: 'Dinas Baru',
              deletedAt: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          }),
        );
      kepalaRepoMock.findOpdAktifById.mockResolvedValueOnce({
        opdId: 'opd-baru',
        nama: 'Dinas Baru',
      });
      penggunaRepoMock.countAktifByOpdIdAndPeran.mockResolvedValueOnce(0);

      const actual = await service.update('kepala-1', { opdId: 'opd-baru' });

      expect(kepalaRepoMock.findOpdAktifById).toHaveBeenCalledWith('opd-baru');
      expect(penggunaRepoMock.countAktifByOpdIdAndPeran).toHaveBeenCalledWith(
        'opd-baru',
        PeranPengguna.KEPALA_OPD,
        'kepala-1',
      );
      expect(kepalaRepoMock.persistUpdate).toHaveBeenCalledWith('kepala-1', {
        pindah: { opdAsalId: 'opd-lama', opdTujuanId: 'opd-baru' },
      });
      expect(actual.opdId).toBe('opd-baru');
      expect(actual.namaOpd).toBe('Dinas Baru');
    });

    it('seharusnya tidak memvalidasi OPD tujuan ketika opdId sama dengan existing (Edge Case)', async () => {
      kepalaRepoMock.findKepalaById
        .mockResolvedValueOnce(baseKepala({ opdId: 'opd-1' }))
        .mockResolvedValueOnce(baseKepala({ opdId: 'opd-1' }));

      await service.update('kepala-1', { opdId: 'opd-1' });

      expect(kepalaRepoMock.findOpdAktifById).not.toHaveBeenCalled();
      expect(penggunaRepoMock.countAktifByOpdIdAndPeran).not.toHaveBeenCalled();
      expect(kepalaRepoMock.persistUpdate).toHaveBeenCalledWith('kepala-1', {});
    });

    it('seharusnya membersihkan semua field profil pada update parsial (Worst Case)', async () => {
      kepalaRepoMock.findKepalaById.mockResolvedValueOnce(baseKepala());
      kepalaRepoMock.findKepalaById.mockResolvedValueOnce(baseKepala());

      await service.update('kepala-1', {
        nama: '  Nama Baru  ',
        jabatan: '  Jabatan Baru  ',
        pangkat: '  IV/b  ',
        nohp: '  081299999999  ',
      });

      expect(kepalaRepoMock.persistUpdate).toHaveBeenCalledWith(
        'kepala-1',
        expect.objectContaining({
          profil: {
            nama: 'Nama Baru',
            jabatan: 'Jabatan Baru',
            pangkat: 'IV/b',
            nohp: '6281299999999',
          },
        }),
      );
    });

    it('seharusnya menetapkan deletedAt pada pembaruan status ke NONAKTIF (Edge Case)', async () => {
      kepalaRepoMock.findKepalaById.mockResolvedValueOnce(baseKepala());
      kepalaRepoMock.findKepalaById.mockResolvedValueOnce(baseKepala()); // for read-after-write

      await service.update('kepala-1', { status: 'NONAKTIF' });

      expect(kepalaRepoMock.persistUpdate).toHaveBeenCalledWith(
        'kepala-1',
        expect.objectContaining({
          profil: expect.objectContaining({
            deletedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('seharusnya menetapkan deletedAt menjadi null dan syncRiwayatOpdId jika status menjadi AKTIF dan belum ada yang aktif (Edge Case)', async () => {
      kepalaRepoMock.findKepalaById.mockResolvedValueOnce(
        baseKepala({ deletedAt: new Date(), opdId: 'opd-1' }),
      );
      kepalaRepoMock.findKepalaById.mockResolvedValueOnce(baseKepala()); // for read-after-write
      penggunaRepoMock.countAktifByOpdIdAndPeran.mockResolvedValueOnce(0); // No other active

      await service.update('kepala-1', { status: 'AKTIF' });

      expect(kepalaRepoMock.persistUpdate).toHaveBeenCalledWith(
        'kepala-1',
        expect.objectContaining({
          syncRiwayatOpdId: 'opd-1',
          profil: expect.objectContaining({
            deletedAt: null,
          }),
        }),
      );
    });

    it('seharusnya tidak mengecek slot OPD ketika status AKTIF dikirim untuk akun yang sudah aktif (Edge Case)', async () => {
      kepalaRepoMock.findKepalaById.mockResolvedValueOnce(baseKepala({ deletedAt: null }));
      kepalaRepoMock.findKepalaById.mockResolvedValueOnce(baseKepala({ deletedAt: null }));

      await service.update('kepala-1', { status: 'AKTIF' });

      expect(penggunaRepoMock.countAktifByOpdIdAndPeran).not.toHaveBeenCalled();
      expect(kepalaRepoMock.persistUpdate).toHaveBeenCalledWith(
        'kepala-1',
        expect.objectContaining({
          profil: { deletedAt: null },
        }),
      );
    });

    it('seharusnya memakai OPD tujuan untuk cek slot saat reaktivasi dengan opdId sama seperti existing (Edge Case)', async () => {
      kepalaRepoMock.findKepalaById
        .mockResolvedValueOnce(baseKepala({ deletedAt: new Date(), opdId: 'opd-1' }))
        .mockResolvedValueOnce(baseKepala({ deletedAt: null, opdId: 'opd-1' }));
      penggunaRepoMock.countAktifByOpdIdAndPeran.mockResolvedValueOnce(0);

      await service.update('kepala-1', { opdId: 'opd-1', status: 'AKTIF' });

      expect(penggunaRepoMock.countAktifByOpdIdAndPeran).toHaveBeenCalledWith(
        'opd-1',
        PeranPengguna.KEPALA_OPD,
        'kepala-1',
      );
      expect(kepalaRepoMock.persistUpdate).toHaveBeenCalledWith(
        'kepala-1',
        expect.objectContaining({
          syncRiwayatOpdId: 'opd-1',
          profil: { deletedAt: null },
        }),
      );
    });

    it('seharusnya melempar ConflictException jika terjadi Prisma P2002 pada persistUpdate (False Case)', async () => {
      kepalaRepoMock.findKepalaById.mockResolvedValueOnce(baseKepala());
      const prismaError = new Prisma.PrismaClientKnownRequestError('err', {
        code: 'P2002',
        clientVersion: '1',
      });
      kepalaRepoMock.persistUpdate.mockRejectedValueOnce(prismaError);

      await expect(service.update('kepala-1', { nama: 'X' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('seharusnya melempar NotFoundException jika data tidak ditemukan sesaat setelah persistUpdate (False Case)', async () => {
      kepalaRepoMock.findKepalaById.mockResolvedValueOnce(baseKepala());
      kepalaRepoMock.findKepalaById.mockResolvedValueOnce(null); // read-after-write null

      await expect(service.update('kepala-1', { nama: 'X' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remove (Tambahan Kasus)', () => {
    it('seharusnya melempar NotFoundException jika pengguna tidak ditemukan (False Case)', async () => {
      kepalaRepoMock.findKepalaById.mockResolvedValueOnce(null);
      await expect(service.remove('kepala-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('seharusnya memanggil softDeleteKepalaOpd jika _count.detailSopDibuat adalah 0 (Success/Edge Case)', async () => {
      kepalaRepoMock.findKepalaById.mockResolvedValueOnce(
        baseKepala({ _count: { detailSopDibuat: 0 } }),
      );
      await service.remove('kepala-1');
      expect(kepalaRepoMock.softDeleteKepalaOpd).toHaveBeenCalledWith('kepala-1');
    });
  });

  describe('listRiwayatOpd (Tambahan Kasus)', () => {
    it('seharusnya melempar NotFoundException jika kepala tidak ditemukan (False Case)', async () => {
      kepalaRepoMock.findKepalaById.mockResolvedValueOnce(null);
      await expect(service.listRiwayatOpd('kepala-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('seharusnya mengembalikan array kosong jika tidak ada riwayat (Edge Case)', async () => {
      kepalaRepoMock.findKepalaById.mockResolvedValueOnce(baseKepala());
      kepalaRepoMock.findRiwayatRowsForPengguna.mockResolvedValueOnce([]);

      const result = await service.listRiwayatOpd('kepala-1');
      expect(result).toEqual([]);
    });

    it('seharusnya melakukan map riwayat dengan benar (Normal Case)', async () => {
      kepalaRepoMock.findKepalaById.mockResolvedValueOnce(baseKepala());
      const riwayatDate = new Date();
      kepalaRepoMock.findRiwayatRowsForPengguna.mockResolvedValueOnce([
        {
          opdId: 'opd-1',
          opd: { nama: 'Dinas A' },
          createdAt: riwayatDate,
          updatedAt: riwayatDate,
          isAktif: true,
        },
      ]);

      const result = await service.listRiwayatOpd('kepala-1');
      expect(result).toEqual([
        {
          opdId: 'opd-1',
          namaOpd: 'Dinas A',
          dicatatPada: riwayatDate,
          diperbaruiPada: riwayatDate,
          isAktif: true,
        },
      ]);
    });
  });
});
