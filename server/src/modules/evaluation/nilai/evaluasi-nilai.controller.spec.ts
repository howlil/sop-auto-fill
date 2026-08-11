import type { Request } from 'express';
import { PeranPengguna, HasilEvaluasi, StatusTindakLanjut } from '../../../generated/prisma';
import type { JwtAccessPayload } from '../../core/auth/helpers/auth.shared';
import { EvaluasiNilaiController } from './evaluasi-nilai.controller';
import { EvaluasiNilaiService } from './evaluasi-nilai.service';

describe('Pengujian EvaluasiNilaiController', () => {
  let controller: EvaluasiNilaiController;
  let service: jest.Mocked<
    Pick<EvaluasiNilaiService, 'isiNilai' | 'tandaiTindakLanjutSelesai' | 'selesai' | 'tolak'>
  >;

  const user: JwtAccessPayload = {
    sub: 'user-1',
    email: 'user@example.test',
    peran: PeranPengguna.EVALUATOR,
    sesiTokenVersion: 1,
  };
  const req = { user } as Request & { user: JwtAccessPayload };
  const nilaiResponse = {
    id: 'p1:d1',
    pengajuanEvaluasiId: 'p1',
    sopDetailId: 'd1',
    hasil: HasilEvaluasi.PERLU_PERBAIKAN,
    catatan: 'Perbaiki',
    statusTindakLanjut: StatusTindakLanjut.TERBUKA,
    statusTindakLanjutLabel: 'Terbuka',
    ditindaklanjutiPada: null,
    version: 1,
    dinilaiOlehId: 'evaluator-1',
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
  };

  beforeEach(() => {
    service = {
      isiNilai: jest.fn(),
      tandaiTindakLanjutSelesai: jest.fn(),
      selesai: jest.fn(),
      tolak: jest.fn(),
    };
    controller = new EvaluasiNilaiController(service as unknown as EvaluasiNilaiService);
  });

  it('seharusnya meneruskan user, id, dan dto ke service isiNilai lalu membungkus response', async () => {
    service.isiNilai.mockResolvedValueOnce(nilaiResponse);
    const dto = { hasil: HasilEvaluasi.PERLU_PERBAIKAN, catatan: 'Perbaiki', version: 0 };

    const actual = await controller.isiNilai(req, 'p1', 'd1', dto);

    expect(service.isiNilai).toHaveBeenCalledWith(user, 'p1', 'd1', dto);
    expect(actual).toEqual({
      message: 'Nilai evaluasi berhasil disimpan',
      success: true,
      data: nilaiResponse,
    });
  });

  it('seharusnya meneruskan user dan id ke service tandaiTindakLanjutSelesai', async () => {
    service.tandaiTindakLanjutSelesai.mockResolvedValueOnce({
      ...nilaiResponse,
      statusTindakLanjut: StatusTindakLanjut.SELESAI,
    });

    const actual = await controller.tandaiTindakLanjutSelesai(req, 'p1', 'd1');

    expect(service.tandaiTindakLanjutSelesai).toHaveBeenCalledWith(user, 'p1', 'd1');
    expect(actual).toEqual({
      message: 'Umpan balik evaluasi ditandai selesai',
      success: true,
      data: expect.objectContaining({ statusTindakLanjut: StatusTindakLanjut.SELESAI }),
    });
  });

  it('seharusnya meneruskan user, id, dan dto ke service selesai', async () => {
    const selesaiResponse = {
      id: 'p1',
      opdId: 'opd-1',
      status: 'SELESAI_DIEVALUASI',
      nilaiOPD: 5,
      tanggalEvaluasi: '2026-05-01T10:00:00.000Z',
      tanggalDiselesaikan: '2026-05-02T10:00:00.000Z',
      diselesaikanOlehId: 'evaluator-1',
      version: 2,
      createdAt: '2026-05-01T10:00:00.000Z',
      updatedAt: '2026-05-02T10:00:00.000Z',
    };
    service.selesai.mockResolvedValueOnce(selesaiResponse);

    const actual = await controller.selesai(req, 'p1', { nomorBA: 'BA-001', nilaiOPD: 5 });

    expect(service.selesai).toHaveBeenCalledWith(user, 'p1', { nomorBA: 'BA-001', nilaiOPD: 5 });
    expect(actual).toEqual({
      message: 'Pengajuan evaluasi berhasil diselesaikan',
      success: true,
      data: selesaiResponse,
    });
  });

  it('seharusnya meneruskan alasan dan versi ke service penolakan', async () => {
    const response = {
      id: 'p1',
      opdId: 'opd-1',
      status: 'DITOLAK',
      alasanPenolakan: 'Dokumen belum lengkap',
      ditolakOlehId: user.sub,
      tanggalDitolak: '2026-08-02T08:00:00.000Z',
      version: 1,
      createdAt: '2026-08-01T08:00:00.000Z',
      updatedAt: '2026-08-02T08:00:00.000Z',
    };
    service.tolak.mockResolvedValueOnce(response);

    const actual = await controller.tolak(req, 'p1', {
      alasan: 'Dokumen belum lengkap',
      version: 0,
    });

    expect(service.tolak).toHaveBeenCalledWith(user, 'p1', {
      alasan: 'Dokumen belum lengkap',
      version: 0,
    });
    expect(actual).toEqual({
      message: 'Pengajuan evaluasi berhasil ditolak',
      success: true,
      data: response,
    });
  });
});
