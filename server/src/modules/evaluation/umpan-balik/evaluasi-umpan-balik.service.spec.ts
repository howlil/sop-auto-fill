import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  HasilEvaluasi,
  PeranPengguna,
  StatusPengajuanEvaluasi,
  StatusTindakLanjut,
} from '../../../generated/prisma';
import type { JwtAccessPayload } from '../../../common';
import { EvaluasiNilaiService } from '../nilai/evaluasi-nilai.service';
import { PengajuanEvaluasiRepository } from '../pengajuan/pengajuan-evaluasi.repository';
import { EvaluasiUmpanBalikService } from './evaluasi-umpan-balik.service';

describe('Pengujian EvaluasiUmpanBalikService', () => {
  let service: EvaluasiUmpanBalikService;

  const nilaiServiceMock = {
    findOpdIdByDetailSopId: jest.fn(),
    findUmpanBalikForDetail: jest.fn(),
  };

  const pengajuanRepoMock = {
    findOpdIdPengguna: jest.fn(),
  };

  const penyusunUser: JwtAccessPayload = {
    sub: 'penyusun-1',
    email: 'p@x.id',
    peran: PeranPengguna.PENYUSUN,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EvaluasiUmpanBalikService(
      nilaiServiceMock as unknown as EvaluasiNilaiService,
      pengajuanRepoMock as unknown as PengajuanEvaluasiRepository,
    );
    pengajuanRepoMock.findOpdIdPengguna.mockResolvedValue('opd-1');
    nilaiServiceMock.findOpdIdByDetailSopId.mockResolvedValue('opd-1');
  });

  describe('Validasi Hak Akses (RBAC & OPD)', () => {
    it('seharusnya menolak akses (Forbidden) jika peran pengguna bukan PENYUSUN, PJ_PENYUSUN, atau KEPALA_OPD', async () => {
      const deniedRoles = [PeranPengguna.EVALUATOR, PeranPengguna.PJ_EVALUATOR];

      for (const peran of deniedRoles) {
        const user: JwtAccessPayload = { sub: 'u-1', email: 'e@x.id', peran };
        await expect(service.getUmpanBalikForDetail(user, 'detail-1')).rejects.toThrow(
          ForbiddenException,
        );
      }
      expect(pengajuanRepoMock.findOpdIdPengguna).not.toHaveBeenCalled();
    });

    it('seharusnya mengizinkan pengecekan jika peran valid (PENYUSUN, PJ_PENYUSUN, KEPALA_OPD)', async () => {
      const allowedRoles = [
        PeranPengguna.PENYUSUN,
        PeranPengguna.PJ_PENYUSUN,
        PeranPengguna.KEPALA_OPD,
      ];

      nilaiServiceMock.findUmpanBalikForDetail.mockResolvedValue(null);

      for (const peran of allowedRoles) {
        const user: JwtAccessPayload = { sub: 'u-1', email: 'e@x.id', peran };
        const result = await service.getUmpanBalikForDetail(user, 'detail-1');
        expect(result).toBeNull();
      }
    });

    it('seharusnya melempar ForbiddenException jika OPD pengguna tidak terdaftar di database', async () => {
      pengajuanRepoMock.findOpdIdPengguna.mockResolvedValue(null);
      await expect(service.getUmpanBalikForDetail(penyusunUser, 'detail-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('seharusnya melempar NotFoundException jika Detail SOP tidak ada di database', async () => {
      nilaiServiceMock.findOpdIdByDetailSopId.mockResolvedValue(null);
      await expect(service.getUmpanBalikForDetail(penyusunUser, 'detail-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('seharusnya melempar ForbiddenException jika Detail SOP berada di instansi (OPD) yang berbeda dengan milik pengguna', async () => {
      nilaiServiceMock.findOpdIdByDetailSopId.mockResolvedValue('opd-lain');
      await expect(service.getUmpanBalikForDetail(penyusunUser, 'detail-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('Pengambilan dan Pemetaan Data Umpan Balik', () => {
    it('seharusnya mengembalikan null jika data umpan balik evaluasi tidak ditemukan untuk SOP tersebut', async () => {
      nilaiServiceMock.findUmpanBalikForDetail.mockResolvedValue(null);
      const actual = await service.getUmpanBalikForDetail(penyusunUser, 'detail-1');
      expect(actual).toBeNull();
    });

    it('seharusnya memetakan nilai default hasil = PERLU_PERBAIKAN jika di DB bernilai null (Edge Case)', async () => {
      nilaiServiceMock.findUmpanBalikForDetail.mockResolvedValue({
        pengajuanEvaluasiId: 'pj-1',
        detailSopId: 'detail-1',
        hasil: null, // edge case
        catatan: 'Catatan dummy',
        statusTindakLanjut: null,
        ditindaklanjutiPada: null,
        version: 1,
        dinilaiOleh: null,
        ditindaklanjutiOleh: null,
        pengajuanEvaluasi: { status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI },
      });

      const actual = await service.getUmpanBalikForDetail(penyusunUser, 'detail-1');

      expect(actual?.hasil).toBe(HasilEvaluasi.PERLU_PERBAIKAN);
      expect(actual?.hasilLabel).toBeTruthy();
    });

    it('seharusnya memetakan secara utuh jika ada status tindak lanjut, tanggal, dan user yang menilai/menindaklanjuti (Normal Case)', async () => {
      const mockDate = new Date('2026-05-28T02:00:00.000Z');
      nilaiServiceMock.findUmpanBalikForDetail.mockResolvedValue({
        pengajuanEvaluasiId: 'pj-1',
        detailSopId: 'detail-1',
        hasil: HasilEvaluasi.SESUAI,
        catatan: 'Sudah baik',
        statusTindakLanjut: StatusTindakLanjut.SELESAI,
        ditindaklanjutiPada: mockDate,
        version: 2,
        dinilaiOleh: { penggunaId: 'ev-1', nama: 'Si Evaluator' },
        ditindaklanjutiOleh: { penggunaId: 'penyusun-1', nama: 'Si Penyusun' },
        pengajuanEvaluasi: { status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI },
      });

      const actual = await service.getUmpanBalikForDetail(penyusunUser, 'detail-1');

      expect(actual?.hasil).toBe(HasilEvaluasi.SESUAI);
      expect(actual?.catatan).toBe('Sudah baik');
      expect(actual?.statusTindakLanjut).toBe(StatusTindakLanjut.SELESAI);
      expect(actual?.statusTindakLanjutLabel).toBeTruthy();
      expect(actual?.ditindaklanjutiPada).toBe(mockDate.toISOString());
      expect(actual?.version).toBe(2);
      expect(actual?.dinilaiOleh).toEqual({ id: 'ev-1', nama: 'Si Evaluator' });
      expect(actual?.ditindaklanjutiOleh).toEqual({ id: 'penyusun-1', nama: 'Si Penyusun' });
    });

    it('seharusnya menampilkan penolakan final tanpa tindak lanjut versi lama', async () => {
      nilaiServiceMock.findUmpanBalikForDetail.mockResolvedValue({
        pengajuanEvaluasiId: 'pj-ditolak',
        detailSopId: 'detail-1',
        hasil: HasilEvaluasi.DITOLAK,
        catatan: 'Substansi tidak sesuai ruang lingkup.',
        statusTindakLanjut: null,
        ditindaklanjutiPada: null,
        version: 3,
        dinilaiOleh: { penggunaId: 'ev-1', nama: 'Si Evaluator' },
        ditindaklanjutiOleh: null,
        pengajuanEvaluasi: { status: StatusPengajuanEvaluasi.DITOLAK },
      });

      const actual = await service.getUmpanBalikForDetail(penyusunUser, 'detail-1');

      expect(actual).toEqual(
        expect.objectContaining({
          pengajuanStatus: StatusPengajuanEvaluasi.DITOLAK,
          hasil: HasilEvaluasi.DITOLAK,
          hasilLabel: 'Ditolak',
          statusTindakLanjut: null,
        }),
      );
    });

    it('seharusnya meneruskan error jika service di bawahnya gagal (Worst Case)', async () => {
      nilaiServiceMock.findUmpanBalikForDetail.mockRejectedValue(new Error('Koneksi terputus'));
      await expect(service.getUmpanBalikForDetail(penyusunUser, 'detail-1')).rejects.toThrow(
        'Koneksi terputus',
      );
    });
  });
});
