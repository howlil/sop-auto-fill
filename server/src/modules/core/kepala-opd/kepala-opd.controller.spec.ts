import { KepalaOpdController } from './kepala-opd.controller';
import { KepalaOpdService } from './kepala-opd.service';

describe('Pengujian KepalaOpdController', () => {
  let controller: KepalaOpdController;
  let service: jest.Mocked<
    Pick<KepalaOpdService, 'findAll' | 'create' | 'update' | 'remove' | 'listRiwayatOpd'>
  >;

  const publicRow = {
    id: 'kepala-1',
    nama: 'Kepala',
    nip: '198001012009011001',
    email: 'kepala@example.test',
    nohp: '081234567890',
    jabatan: 'Kepala OPD',
    pangkat: 'IV/a',
    opdId: 'opd-1',
    namaOpd: 'Dinas A',
    isActive: true,
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    dapatDihapus: true,
  };

  beforeEach(() => {
    service = {
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      listRiwayatOpd: jest.fn(),
    };
    controller = new KepalaOpdController(service as unknown as KepalaOpdService);
  });

  it('seharusnya membungkus response daftar kepala OPD', async () => {
    service.findAll.mockResolvedValueOnce([publicRow]);

    const actual = await controller.findAll('kepala');

    expect(service.findAll).toHaveBeenCalledWith('kepala');
    expect(actual).toEqual({
      message: 'Daftar Kepala OPD berhasil diambil',
      success: true,
      data: [publicRow],
    });
  });

  it('seharusnya membungkus response create kepala OPD', async () => {
    service.create.mockResolvedValueOnce(publicRow);
    const dto = {
      opdId: 'opd-1',
      nama: 'Kepala',
      nip: '198001012009011001',
      email: 'kepala@example.test',
      jabatan: 'Kepala OPD',
      pangkat: 'IV/a',
      nohp: '081234567890',
    };

    const actual = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(actual).toEqual({
      message: 'Kepala OPD berhasil ditambahkan',
      success: true,
      data: publicRow,
    });
  });

  it('seharusnya membungkus response update kepala OPD', async () => {
    service.update.mockResolvedValueOnce(publicRow);

    const actual = await controller.update('kepala-1', { nama: 'Kepala Baru' });

    expect(service.update).toHaveBeenCalledWith('kepala-1', { nama: 'Kepala Baru' });
    expect(actual).toEqual({
      message: 'Kepala OPD berhasil diperbarui',
      success: true,
      data: publicRow,
    });
  });

  it('seharusnya membungkus response remove kepala OPD', async () => {
    service.remove.mockResolvedValueOnce(undefined);

    const actual = await controller.remove('kepala-1');

    expect(service.remove).toHaveBeenCalledWith('kepala-1');
    expect(actual).toEqual({
      message: 'Kepala OPD berhasil dinonaktifkan',
      success: true,
      data: null,
    });
  });

  it('seharusnya membungkus response riwayat OPD', async () => {
    const row = {
      opdId: 'opd-1',
      namaOpd: 'Dinas A',
      dicatatPada: new Date('2026-05-01T00:00:00.000Z'),
      diperbaruiPada: new Date('2026-05-02T00:00:00.000Z'),
      isAktif: true,
    };
    service.listRiwayatOpd.mockResolvedValueOnce([row]);

    const actual = await controller.riwayatOpd('kepala-1');

    expect(service.listRiwayatOpd).toHaveBeenCalledWith('kepala-1');
    expect(actual).toEqual({
      message: 'Riwayat penugasan OPD berhasil diambil',
      success: true,
      data: [row],
    });
  });
});
