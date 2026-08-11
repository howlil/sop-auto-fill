import type { PrismaService } from '../../../common/prisma/prisma.service';
import { PeranPengguna } from '../../../generated/prisma';
import {
  markRiwayatOpdTidakAktif,
  syncActiveRiwayatOpd,
} from '../pengguna/helpers/riwayat-opd.sync';
import { KepalaOpdRepository } from './kepala-opd.repository';

jest.mock('../pengguna/helpers/riwayat-opd.sync', () => ({
  markRiwayatOpdTidakAktif: jest.fn(),
  syncActiveRiwayatOpd: jest.fn(),
}));

describe('Pengujian KepalaOpdRepository', () => {
  const txMock = {
    pengguna: {
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const prismaMock = {
    oPD: {
      findFirst: jest.fn(),
    },
    pengguna: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    riwayatOpdPengguna: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  let repo: KepalaOpdRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => unknown) =>
      callback(txMock),
    );
    repo = new KepalaOpdRepository(prismaMock as unknown as PrismaService);
  });

  it('seharusnya mencari OPD aktif berdasarkan id', async () => {
    await repo.findOpdAktifById('opd-1');

    expect(prismaMock.oPD.findFirst).toHaveBeenCalledWith({
      where: { opdId: 'opd-1', deletedAt: null },
    });
  });

  it('seharusnya mencari kepala OPD berdasarkan id dan peran KEPALA_OPD', async () => {
    await repo.findKepalaById('kepala-1');

    expect(prismaMock.pengguna.findFirst).toHaveBeenCalledWith({
      where: { penggunaId: 'kepala-1', peran: PeranPengguna.KEPALA_OPD },
      include: {
        opd: true,
        _count: { select: { detailSopDibuat: true } },
      },
    });
  });

  it('seharusnya mencari semua kepala tanpa filter ketika search kosong', async () => {
    await repo.findManyKepala('   ');

    expect(prismaMock.pengguna.findMany).toHaveBeenCalledWith({
      where: { peran: PeranPengguna.KEPALA_OPD },
      include: {
        opd: true,
        _count: { select: { detailSopDibuat: true } },
      },
      orderBy: [{ deletedAt: 'asc' }, { nama: 'asc' }],
    });
  });

  it('seharusnya mencari semua kepala dengan filter nama, nip, atau email ketika search berisi nilai', async () => {
    await repo.findManyKepala('kepala');

    expect(prismaMock.pengguna.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          peran: PeranPengguna.KEPALA_OPD,
          OR: [
            { nama: { contains: 'kepala' } },
            { nip: { contains: 'kepala' } },
            { email: { contains: 'kepala' } },
          ],
        },
      }),
    );
  });

  it('seharusnya membuat kepala OPD dalam transaksi dan sync riwayat aktif', async () => {
    txMock.pengguna.create.mockResolvedValueOnce({ penggunaId: 'kepala-1' });

    const actual = await repo.createWithRiwayatOpd({
      email: 'kepala@example.test',
      nama: 'Kepala',
      nip: '1',
      pangkat: 'IV/a',
      jabatan: 'Kepala',
      nohp: '081234567890',
      kataSandi: 'hashed',
      opdId: 'opd-1',
    });

    expect(txMock.pengguna.create).toHaveBeenCalledWith({
      data: {
        email: 'kepala@example.test',
        nama: 'Kepala',
        nip: '1',
        pangkat: 'IV/a',
        jabatan: 'Kepala',
        nohp: '081234567890',
        kataSandi: 'hashed',
        peran: PeranPengguna.KEPALA_OPD,
        opdId: 'opd-1',
      },
    });
    expect(syncActiveRiwayatOpd).toHaveBeenCalledWith(txMock, 'kepala-1', 'opd-1');
    expect(actual).toEqual({ penggunaId: 'kepala-1' });
  });

  it('seharusnya persist pindah OPD dengan menonaktifkan riwayat lama dan sync tujuan', async () => {
    await repo.persistUpdate('kepala-1', {
      pindah: { opdAsalId: 'opd-lama', opdTujuanId: 'opd-baru' },
    });

    expect(markRiwayatOpdTidakAktif).toHaveBeenCalledWith(txMock, 'kepala-1', 'opd-lama');
    expect(txMock.pengguna.update).toHaveBeenCalledWith({
      where: { penggunaId: 'kepala-1' },
      data: { opdId: 'opd-baru' },
    });
    expect(syncActiveRiwayatOpd).toHaveBeenCalledWith(txMock, 'kepala-1', 'opd-baru');
  });

  it('seharusnya persist profil hanya ketika profil berisi field', async () => {
    await repo.persistUpdate('kepala-1', { profil: { nama: 'Kepala Baru' } });

    expect(txMock.pengguna.update).toHaveBeenCalledWith({
      where: { penggunaId: 'kepala-1' },
      data: { nama: 'Kepala Baru' },
    });
  });

  it('seharusnya tidak update profil ketika profil kosong', async () => {
    await repo.persistUpdate('kepala-1', { profil: {} });

    expect(txMock.pengguna.update).not.toHaveBeenCalled();
    expect(syncActiveRiwayatOpd).not.toHaveBeenCalled();
  });

  it('seharusnya sync riwayat saat syncRiwayatOpdId dikirim', async () => {
    await repo.persistUpdate('kepala-1', { syncRiwayatOpdId: 'opd-1' });

    expect(syncActiveRiwayatOpd).toHaveBeenCalledWith(txMock, 'kepala-1', 'opd-1');
  });

  it('seharusnya soft delete kepala OPD dengan deletedAt baru', async () => {
    await repo.softDeleteKepalaOpd('kepala-1');

    expect(prismaMock.pengguna.update).toHaveBeenCalledWith({
      where: { penggunaId: 'kepala-1' },
      data: { deletedAt: expect.any(Date) },
    });
  });
});
