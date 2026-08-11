import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SopCatalogService } from '../catalog/sop-catalog.service';
import { SopPdfStorageService } from '../pdf/sop-pdf-storage.service';
import type { PublicArsipQueryDto } from './dto/public-arsip-query.dto';
import { SopPublicRepository } from './sop-public.repository';
import { SopPublicService } from './sop-public.service';

describe('Pengujian SopPublicService', () => {
  let service: SopPublicService;
  const repoMock = {
    countOpdWithBerlakuSop: jest.fn(),
    findOpdWithBerlakuSop: jest.fn(),
    findOpdAktifById: jest.fn(),
    countBerlakuSopByOpd: jest.fn(),
    findBerlakuSopByOpd: jest.fn(),
    countBerlakuSopGlobal: jest.fn(),
    findBerlakuSopGlobal: jest.fn(),
  };
  const catalogMock = {
    getPublicDokumenBerlaku: jest.fn(),
  };
  const storageMock = {
    readPublishedPdf: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SopPublicService,
        { provide: SopPublicRepository, useValue: repoMock },
        { provide: SopCatalogService, useValue: catalogMock },
        { provide: SopPdfStorageService, useValue: storageMock },
      ],
    }).compile();
    service = module.get(SopPublicService);
  });

  it('seharusnya mengembalikan daftar OPD terpaginasi', async () => {
    repoMock.countOpdWithBerlakuSop.mockResolvedValue(2);
    repoMock.findOpdWithBerlakuSop.mockResolvedValue([
      { opdId: 'opd-1', nama: 'OPD Satu', jumlahSopBerlaku: 3 },
      { opdId: 'opd-2', nama: 'OPD Dua', jumlahSopBerlaku: 1 },
    ]);
    const query = { page: 1, limit: 10, search: 'satu' } as PublicArsipQueryDto;
    const actual = await service.listOpd(query);
    expect(repoMock.countOpdWithBerlakuSop).toHaveBeenCalledWith('satu');
    expect(repoMock.findOpdWithBerlakuSop).toHaveBeenCalledWith({
      search: 'satu',
      skip: 0,
      take: 10,
    });
    expect(actual.items).toHaveLength(2);
    expect(actual.pagination.totalItems).toBe(2);
  });

  it('seharusnya melempar NotFoundException ketika OPD tidak ditemukan untuk SOP daftar', async () => {
    repoMock.findOpdAktifById.mockResolvedValue(null);
    await expect(
      service.listSopByOpd('opd-x', { page: 1, limit: 10 } as PublicArsipQueryDto),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('seharusnya mengembalikan daftar SOP terpaginasi untuk OPD', async () => {
    repoMock.findOpdAktifById.mockResolvedValue({ opdId: 'opd-1', nama: 'OPD Satu' });
    repoMock.countBerlakuSopByOpd.mockResolvedValue(1);
    repoMock.findBerlakuSopByOpd.mockResolvedValue([
      {
        detailSopId: 'det-1',
        sopId: 'sop-1',
        opdId: 'opd-1',
        judul: 'Judul SOP',
        nomorSOP: '01/2026',
        versi: 1,
        tanggalEfektif: new Date('2026-05-01T00:00:00.000Z'),
        opdNama: 'OPD Satu',
      },
    ]);
    const actual = await service.listSopByOpd('opd-1', {
      page: 1,
      limit: 10,
      search: 'judul',
    } as PublicArsipQueryDto);
    expect(repoMock.findBerlakuSopByOpd).toHaveBeenCalledWith({
      opdId: 'opd-1',
      search: 'judul',
      skip: 0,
      take: 10,
    });
    expect(actual.opd).toEqual({ opdId: 'opd-1', nama: 'OPD Satu' });
    expect(actual.items[0]?.detailSopId).toBe('det-1');
    expect(actual.items[0]?.opdId).toBe('opd-1');
    expect(actual.items[0]?.tanggalEfektif).toBe('2026-05-01T00:00:00.000Z');
    expect(actual.items[0]?.pdfUrl).toBe('/sop/public/pdf/det-1');
  });

  it('seharusnya mengembalikan hasil pencarian SOP global secara terpaginasi', async () => {
    repoMock.countBerlakuSopGlobal.mockResolvedValue(1);
    repoMock.findBerlakuSopGlobal.mockResolvedValue([
      {
        detailSopId: 'det-2',
        sopId: 'sop-2',
        opdId: 'opd-2',
        judul: 'SOP Dua',
        nomorSOP: '02/2026',
        versi: 1,
        tanggalEfektif: null,
        opdNama: 'OPD Dua',
      },
    ]);
    const actual = await service.listSopGlobal({
      page: 1,
      limit: 15,
      search: 'sop',
    } as PublicArsipQueryDto);
    expect(repoMock.countBerlakuSopGlobal).toHaveBeenCalledWith('sop');
    expect(actual.items[0]?.opdNama).toBe('OPD Dua');
    expect(actual.pagination.totalItems).toBe(1);
  });

  it('seharusnya mendelegasikan getDokumen ke service katalog', async () => {
    const dokumen = {
      opd: { id: 'opd-1', nama: 'OPD' },
      detail: { id: 'det-1' },
      langkah: [],
    };
    catalogMock.getPublicDokumenBerlaku.mockResolvedValue(dokumen);
    const actual = await service.getDokumen('det-1');
    expect(catalogMock.getPublicDokumenBerlaku).toHaveBeenCalledWith('det-1');
    expect(actual).toBe(dokumen);
  });

  describe('Edge/False/Worst Cases - listOpd', () => {
    it('seharusnya membiarkan exception dari database (worst case) mengalir ke atas', async () => {
      repoMock.countOpdWithBerlakuSop.mockRejectedValue(new Error('Database Timeout'));
      await expect(service.listOpd({ page: 1, limit: 10 } as PublicArsipQueryDto)).rejects.toThrow(
        'Database Timeout',
      );
    });

    it('seharusnya menangani query paginasi dengan fallback aman jika dikirim undefined atau negatif', async () => {
      repoMock.countOpdWithBerlakuSop.mockResolvedValue(0);
      repoMock.findOpdWithBerlakuSop.mockResolvedValue([]);
      const query = { page: -5, limit: -10 } as any as PublicArsipQueryDto;

      const actual = await service.listOpd(query);

      expect(repoMock.findOpdWithBerlakuSop).toHaveBeenCalledWith({
        search: undefined,
        skip: 0,
        take: 1,
      });
      expect(actual.items).toEqual([]);
      expect(actual.pagination.page).toBe(1);
      expect(actual.pagination.limit).toBe(1);
    });

    it('seharusnya menangani kembalian kosong dengan benar (page 9999)', async () => {
      repoMock.countOpdWithBerlakuSop.mockResolvedValue(5);
      repoMock.findOpdWithBerlakuSop.mockResolvedValue([]);

      const actual = await service.listOpd({ page: 9999, limit: 10 } as PublicArsipQueryDto);

      expect(actual.items).toEqual([]);
      expect(actual.pagination.totalItems).toBe(5);
      expect(actual.pagination.totalPages).toBe(1);
    });
  });

  describe('Edge/False/Worst Cases - listSopByOpd', () => {
    it('seharusnya mengembalikan daftar SOP kosong tetapi tetap memetakan data OPD jika OPD valid tapi belum ada SOP', async () => {
      repoMock.findOpdAktifById.mockResolvedValue({ opdId: 'opd-1', nama: 'OPD Satu' });
      repoMock.countBerlakuSopByOpd.mockResolvedValue(0);
      repoMock.findBerlakuSopByOpd.mockResolvedValue([]);

      const actual = await service.listSopByOpd('opd-1', {
        page: 1,
        limit: 10,
      } as PublicArsipQueryDto);

      expect(actual.opd).toEqual({ opdId: 'opd-1', nama: 'OPD Satu' });
      expect(actual.items).toEqual([]);
      expect(actual.pagination.totalItems).toBe(0);
    });

    it('seharusnya menangani query search kosong tanpa menyebabkan error', async () => {
      repoMock.findOpdAktifById.mockResolvedValue({ opdId: 'opd-1', nama: 'OPD Satu' });
      repoMock.countBerlakuSopByOpd.mockResolvedValue(1);
      repoMock.findBerlakuSopByOpd.mockResolvedValue([
        {
          detailSopId: 'det-1',
          sopId: 'sop-1',
          opdId: 'opd-1',
          judul: 'Judul SOP',
          nomorSOP: '01/2026',
          versi: 1,
          tanggalEfektif: null,
          opdNama: 'OPD Satu',
        },
      ]);

      const actual = await service.listSopByOpd('opd-1', {
        page: 1,
        limit: 10,
        search: '',
      } as PublicArsipQueryDto);

      expect(repoMock.findBerlakuSopByOpd).toHaveBeenCalledWith({
        opdId: 'opd-1',
        search: '',
        skip: 0,
        take: 10,
      });
      expect(actual.items[0]?.tanggalEfektif).toBeNull();
    });
  });

  describe('Edge/False/Worst Cases - listSopGlobal', () => {
    it('seharusnya membiarkan pengecualian jika count database gagal (worst case)', async () => {
      repoMock.countBerlakuSopGlobal.mockRejectedValue(new Error('Koneksi Putus'));
      await expect(
        service.listSopGlobal({ page: 1, limit: 10 } as PublicArsipQueryDto),
      ).rejects.toThrow('Koneksi Putus');
    });
  });

  describe('Edge/False/Worst Cases - getDokumen', () => {
    it('seharusnya membiarkan NotFoundException dari katalog mengalir secara langsung (worst case)', async () => {
      catalogMock.getPublicDokumenBerlaku.mockRejectedValue(
        new NotFoundException('Dokumen tidak ditemukan di katalog'),
      );
      await expect(service.getDokumen('det-invalid')).rejects.toThrow(NotFoundException);
    });
  });
});
