import { BadRequestException } from '@nestjs/common';
import type { EvaluasiGrafikRepository } from './evaluasi-grafik.repository';
import { EvaluasiGrafikService } from './evaluasi-grafik.service';

describe('Pengujian EvaluasiGrafikService', () => {
  let findDaftarOpdAktifMock: jest.Mock;
  let findAgregasiPerTahunOpdMock: jest.Mock;
  let repoMock: jest.Mocked<EvaluasiGrafikRepository>;
  let service: EvaluasiGrafikService;

  beforeEach(() => {
    findDaftarOpdAktifMock = jest.fn();
    findAgregasiPerTahunOpdMock = jest.fn();
    repoMock = {
      findDaftarOpdAktif: findDaftarOpdAktifMock,
      findAgregasiPerTahunOpd: findAgregasiPerTahunOpdMock,
    } as unknown as jest.Mocked<EvaluasiGrafikRepository>;
    service = new EvaluasiGrafikService(repoMock);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('resolveRentangTahun (Validasi & Default Rentang)', () => {
    it('seharusnya melempar BadRequestException ketika tahunDari lebih besar dari tahunSampai', async () => {
      await expect(
        service.getGrafikTahunan({ tahunDari: 2026, tahunSampai: 2020 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(findDaftarOpdAktifMock).not.toHaveBeenCalled();
    });

    it('seharusnya menetapkan tahunDari = tahunSampai = tahun jika hanya query "tahun" diberikan', async () => {
      findDaftarOpdAktifMock.mockResolvedValue([]);
      findAgregasiPerTahunOpdMock.mockResolvedValue([]);

      await service.getGrafikTahunan({ tahun: 2024 });

      expect(findAgregasiPerTahunOpdMock).toHaveBeenCalledWith(2024, 2024);
    });

    it('seharusnya memakai tahun berjalan untuk default tahunDari (sampai - 4) jika hanya tahunSampai diberikan', async () => {
      findDaftarOpdAktifMock.mockResolvedValue([]);
      findAgregasiPerTahunOpdMock.mockResolvedValue([]);

      await service.getGrafikTahunan({ tahunSampai: 2025 });

      expect(findAgregasiPerTahunOpdMock).toHaveBeenCalledWith(2021, 2025);
    });

    it('seharusnya memakai tahun berjalan untuk default tahunSampai jika hanya tahunDari diberikan', async () => {
      findDaftarOpdAktifMock.mockResolvedValue([]);
      findAgregasiPerTahunOpdMock.mockResolvedValue([]);

      const currentYear = new Date().getFullYear();
      await service.getGrafikTahunan({ tahunDari: 2020 });

      expect(findAgregasiPerTahunOpdMock).toHaveBeenCalledWith(2020, currentYear);
    });

    it('seharusnya memakai default 5 tahun terakhir (termasuk tahun ini) jika tidak ada query tahun sama sekali', async () => {
      findDaftarOpdAktifMock.mockResolvedValue([]);
      findAgregasiPerTahunOpdMock.mockResolvedValue([]);

      const currentYear = new Date().getFullYear();
      await service.getGrafikTahunan({});

      expect(findAgregasiPerTahunOpdMock).toHaveBeenCalledWith(currentYear - 4, currentYear);
    });
  });

  describe('buildResponse (Agregasi Data)', () => {
    it('seharusnya menghitung agregasi dengan benar untuk multi-tahun (normal case)', async () => {
      findDaftarOpdAktifMock.mockResolvedValue([
        { opdId: 'a', nama: 'OPD A' },
        { opdId: 'b', nama: 'OPD B' },
      ]);
      findAgregasiPerTahunOpdMock.mockResolvedValue([
        { tahun: 2024, opdId: 'a', opdNama: 'OPD A', jumlahEvaluasi: 2, rataRataSkor: 4.111 },
        { tahun: 2024, opdId: 'b', opdNama: 'OPD B', jumlahEvaluasi: 1, rataRataSkor: 2 },
        { tahun: 2025, opdId: 'a', opdNama: 'OPD A', jumlahEvaluasi: 0, rataRataSkor: null }, // edge: empty in 2025
      ]);

      const actual = await service.getGrafikTahunan({ tahunDari: 2024, tahunSampai: 2025 });

      expect(actual.totalOpdAktif).toBe(2);
      expect(actual.ringkasanPerTahun).toHaveLength(2); // 2024, 2025

      const y2024 = actual.ringkasanPerTahun.find((r) => r.tahun === 2024);
      expect(y2024?.totalPenilaian).toBe(3);
      expect(y2024?.jumlahOpdDenganPenilaian).toBe(2);
      expect(y2024?.rataRataSkorOpd).toBe(3.06); // (4.11 + 2) / 2 = 6.11 / 2 = 3.055 => rounded to 3.06

      const y2025 = actual.ringkasanPerTahun.find((r) => r.tahun === 2025);
      expect(y2025?.totalPenilaian).toBe(0);
      expect(y2025?.jumlahOpdDenganPenilaian).toBe(0);
      expect(y2025?.rataRataSkorOpd).toBeNull();
    });

    it('seharusnya menangani jumlahEvaluasi bertipe bigint dari database', async () => {
      findDaftarOpdAktifMock.mockResolvedValue([{ opdId: 'a', nama: 'OPD A' }]);
      findAgregasiPerTahunOpdMock.mockResolvedValue([
        { tahun: 2025, opdId: 'a', opdNama: 'OPD A', jumlahEvaluasi: BigInt(5), rataRataSkor: 3 },
      ]);

      const actual = await service.getGrafikTahunan({ tahun: 2025 });
      expect(actual.ringkasanPerTahun[0]?.totalPenilaian).toBe(5);
      expect(actual.ringkasanPerTahun[0]?.perOpd[0]?.jumlahEvaluasi).toBe(5);
    });

    it('seharusnya mengabaikan nilai OPD di luar skala 1 sampai 5 (dan NaN/Infinity) serta menganggapnya null', async () => {
      findDaftarOpdAktifMock.mockResolvedValue([
        { opdId: 'a', nama: 'OPD A' },
        { opdId: 'b', nama: 'OPD B' },
        { opdId: 'c', nama: 'OPD C' },
        { opdId: 'd', nama: 'OPD D' },
        { opdId: 'e', nama: 'OPD E' },
      ]);
      findAgregasiPerTahunOpdMock.mockResolvedValue([
        { tahun: 2025, opdId: 'a', opdNama: 'OPD A', jumlahEvaluasi: 1, rataRataSkor: 0 },
        { tahun: 2025, opdId: 'b', opdNama: 'OPD B', jumlahEvaluasi: 1, rataRataSkor: 6 },
        { tahun: 2025, opdId: 'c', opdNama: 'OPD C', jumlahEvaluasi: 1, rataRataSkor: NaN },
        { tahun: 2025, opdId: 'd', opdNama: 'OPD D', jumlahEvaluasi: 1, rataRataSkor: Infinity },
        { tahun: 2025, opdId: 'e', opdNama: 'OPD E', jumlahEvaluasi: 1, rataRataSkor: '3.5' }, // String numeric valid
      ]);

      const actual = await service.getGrafikTahunan({ tahun: 2025 });
      const perOpd = actual.ringkasanPerTahun[0].perOpd;

      expect(perOpd.find((p) => p.opdId === 'a')?.rataRataSkor).toBeNull();
      expect(perOpd.find((p) => p.opdId === 'b')?.rataRataSkor).toBeNull();
      expect(perOpd.find((p) => p.opdId === 'c')?.rataRataSkor).toBeNull();
      expect(perOpd.find((p) => p.opdId === 'd')?.rataRataSkor).toBeNull();

      expect(perOpd.find((p) => p.opdId === 'e')?.rataRataSkor).toBe(3.5);

      expect(actual.ringkasanPerTahun[0]?.rataRataSkorOpd).toBe(3.5);
    });

    it('seharusnya mengembalikan ringkasan kosong jika daftar OPD kosong (edge case)', async () => {
      findDaftarOpdAktifMock.mockResolvedValue([]);
      findAgregasiPerTahunOpdMock.mockResolvedValue([
        { tahun: 2025, opdId: 'ghost', opdNama: 'GHOST', jumlahEvaluasi: 1, rataRataSkor: 4 },
      ]);

      const actual = await service.getGrafikTahunan({ tahun: 2025 });
      expect(actual.totalOpdAktif).toBe(0);
      expect(actual.ringkasanPerTahun).toHaveLength(1);
      expect(actual.ringkasanPerTahun[0]?.totalPenilaian).toBe(0);
      expect(actual.ringkasanPerTahun[0]?.perOpd).toHaveLength(0);
    });

    it('seharusnya meneruskan error dari database secara langsung tanpa menelannya (worst case)', async () => {
      findDaftarOpdAktifMock.mockRejectedValue(new Error('DB Timeout'));
      findAgregasiPerTahunOpdMock.mockResolvedValue([]);

      await expect(service.getGrafikTahunan({ tahun: 2025 })).rejects.toThrow('DB Timeout');
    });
  });
});
