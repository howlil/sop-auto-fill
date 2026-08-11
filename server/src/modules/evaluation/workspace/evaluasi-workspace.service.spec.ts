import { NotFoundException } from '@nestjs/common';
import {
  JenisPengajuanEvaluasi,
  StatusPengajuanEvaluasi,
  StatusSOP,
  PeranPengguna,
} from '../../../generated/prisma';
import type { JwtAccessPayload } from '../../../common/types/jwt-access-payload.type';
import { SopCatalogService } from '../../sop/catalog/sop-catalog.service';
import type { EvaluasiWorkspaceRepository } from './evaluasi-workspace.repository';
import { EvaluasiWorkspaceService } from './evaluasi-workspace.service';
import type { PengajuanEvaluasiService } from '../pengajuan/pengajuan-evaluasi.service';

describe('Pengujian EvaluasiWorkspaceService', () => {
  const userEvaluator: JwtAccessPayload = {
    sub: 'pengguna-test',
    email: 'e@test.id',
    peran: PeranPengguna.EVALUATOR,
  };

  const detailId = '11111111-1111-1111-1111-111111111111';
  const sopId = '22222222-2222-2222-2222-222222222222';
  const detailMeta = {
    versi: 1,
    detailUpdatedAt: new Date('2026-05-01T08:00:00.000Z'),
  };

  function pipelineRow(
    overrides: Partial<{
      detailSopId: string;
      sopId: string;
      judul: string;
      nomorSOP: string;
      statusDetail: StatusSOP;
    }> = {},
  ) {
    return {
      detailSopId: detailId,
      sopId,
      judul: 'SOP A',
      nomorSOP: '001',
      statusDetail: StatusSOP.DIAJUKAN_EVALUASI,
      ...detailMeta,
      ...overrides,
    };
  }

  function nilaiEvaluasiRow(
    overrides: Partial<{
      detailSopId: string;
      hasil: string | null;
      catatan: string | null;
      version: number;
      statusTindakLanjut: string | null;
      ditindaklanjutiPada: Date | null;
    }> = {},
  ) {
    return {
      detailSopId: detailId,
      hasil: null,
      catatan: null,
      version: 0,
      statusTindakLanjut: null,
      ditindaklanjutiPada: null,
      ...detailMeta,
      ...overrides,
    };
  }

  function createRepoMock(
    partial: Partial<jest.Mocked<EvaluasiWorkspaceRepository>>,
  ): jest.Mocked<EvaluasiWorkspaceRepository> {
    return {
      findOpdRingkas: jest.fn(),
      findDaftarDetailPipeline: jest.fn(),
      findPengajuanAktif: jest.fn(),
      findRiwayatOpdSelesai: jest.fn(),
      findLogNilaiUntukDetailWorkspace: jest.fn(),
      detailMilikiOpd: jest.fn(),
      evaluatorTerakhirUntukDetailSop: jest.fn(),
      findPengajuanBundleForWorkspace: jest.fn(),
      ...partial,
    } as jest.Mocked<EvaluasiWorkspaceRepository>;
  }

  function createPastikanMock(): {
    pastikanPengajuanRequestOpdUntukEvaluator: jest.Mock;
    assertUserCanAccessPengajuan: jest.Mock;
  } {
    return {
      pastikanPengajuanRequestOpdUntukEvaluator: jest.fn().mockResolvedValue(undefined),
      assertUserCanAccessPengajuan: jest.fn().mockResolvedValue(undefined),
    };
  }

  const mockWorkbench = {
    detail: { id: detailId } as never,
    langkah: [],
    logEdit: [],
  };

  it('seharusnya melempar NotFoundException ketika OPD tidak ditemukan', async () => {
    const repo = createRepoMock({
      findOpdRingkas: jest.fn().mockResolvedValue(null),
    });
    const sopCatalog = { getPenyusunWorkbench: jest.fn() } as unknown as SopCatalogService;
    const pastikan = createPastikanMock();
    const service = new EvaluasiWorkspaceService(
      repo,
      sopCatalog,
      pastikan as unknown as PengajuanEvaluasiService,
    );
    await expect(
      service.getWorkspaceOpd(userEvaluator, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', {}),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('seharusnya memanggil bootstrap lalu memuat ulang pengajuan ketika pengguna evaluator dan data awal null', async () => {
    const repo = createRepoMock({
      findOpdRingkas: jest.fn().mockResolvedValue({ opdId: 'opd-1', nama: 'OPD Test' }),
      findDaftarDetailPipeline: jest.fn().mockResolvedValue([pipelineRow()]),
      findPengajuanAktif: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          pengajuanEvaluasiId: 'p-new',
          status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
          jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_OPD,
          nilaiEvaluasi: [nilaiEvaluasiRow()],
        }),
      findRiwayatOpdSelesai: jest.fn().mockResolvedValue([]),
      findLogNilaiUntukDetailWorkspace: jest.fn().mockResolvedValue([]),
      evaluatorTerakhirUntukDetailSop: jest.fn().mockResolvedValue(new Map()),
    });
    const sopCatalog = { getPenyusunWorkbench: jest.fn() } as unknown as SopCatalogService;
    const pastikan = createPastikanMock();
    const service = new EvaluasiWorkspaceService(
      repo,
      sopCatalog,
      pastikan as unknown as PengajuanEvaluasiService,
    );
    const actual = await service.getWorkspaceOpd(userEvaluator, 'opd-1', {});
    expect(pastikan.pastikanPengajuanRequestOpdUntukEvaluator).toHaveBeenCalledWith(
      userEvaluator,
      'opd-1',
      expect.arrayContaining([expect.objectContaining({ detailSopId: detailId })]),
    );
    expect(repo.findPengajuanAktif).toHaveBeenCalledTimes(2);
    expect(actual.pengajuanAktif?.id).toBe('p-new');
    expect(actual.pengajuanAktif?.jenis).toBe('EVALUASI_REQUEST_OPD');
    expect(actual.daftarSop).toHaveLength(1);
    expect(actual.daftarSop[0]?.tampilanAlur).toBe('sedang_dievaluasi');
    expect(sopCatalog.getPenyusunWorkbench).not.toHaveBeenCalled();
  });

  it('seharusnya tidak memanggil bootstrap ketika PJ evaluator', async () => {
    const userPj: JwtAccessPayload = {
      sub: 'pj-1',
      email: 'pj@test.id',
      peran: PeranPengguna.PJ_EVALUATOR,
    };
    const repo = createRepoMock({
      findOpdRingkas: jest.fn().mockResolvedValue({ opdId: 'opd-1', nama: 'OPD Test' }),
      findDaftarDetailPipeline: jest.fn().mockResolvedValue([pipelineRow()]),
      findPengajuanAktif: jest.fn().mockResolvedValue(null),
      findRiwayatOpdSelesai: jest.fn().mockResolvedValue([]),
      findLogNilaiUntukDetailWorkspace: jest.fn().mockResolvedValue([]),
      evaluatorTerakhirUntukDetailSop: jest.fn().mockResolvedValue(new Map()),
    });
    const sopCatalog = { getPenyusunWorkbench: jest.fn() } as unknown as SopCatalogService;
    const pastikan = createPastikanMock();
    const service = new EvaluasiWorkspaceService(
      repo,
      sopCatalog,
      pastikan as unknown as PengajuanEvaluasiService,
    );
    const actual = await service.getWorkspaceOpd(userPj, 'opd-1', {});
    expect(pastikan.pastikanPengajuanRequestOpdUntukEvaluator).not.toHaveBeenCalled();
    expect(repo.findPengajuanAktif).toHaveBeenCalledTimes(1);
    expect(actual.pengajuanAktif).toBeNull();
  });

  it('seharusnya memetakan tampilan alur ketika nilai draft dan selesai', async () => {
    const detailOther = '33333333-3333-3333-3333-333333333333';
    const repo = createRepoMock({
      findOpdRingkas: jest.fn().mockResolvedValue({ opdId: 'opd-1', nama: 'OPD Test' }),
      findDaftarDetailPipeline: jest.fn().mockResolvedValue([
        pipelineRow({ statusDetail: StatusSOP.SEDANG_DIEVALUASI }),
        pipelineRow({
          detailSopId: detailOther,
          sopId: '44444444-4444-4444-4444-444444444444',
          judul: 'SOP B',
          nomorSOP: '002',
          statusDetail: StatusSOP.SEDANG_DIEVALUASI,
        }),
      ]),
      findPengajuanAktif: jest.fn().mockResolvedValue({
        pengajuanEvaluasiId: 'peng-1',
        status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
        jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_EVALUATOR,
        nilaiEvaluasi: [
          nilaiEvaluasiRow(),
          nilaiEvaluasiRow({
            detailSopId: detailOther,
            hasil: 'SESUAI',
            catatan: 'ok',
            version: 1,
          }),
        ],
      }),
      findRiwayatOpdSelesai: jest.fn().mockResolvedValue([]),
      findLogNilaiUntukDetailWorkspace: jest.fn().mockResolvedValue([]),
      evaluatorTerakhirUntukDetailSop: jest.fn().mockResolvedValue(new Map()),
    });
    const sopCatalog = { getPenyusunWorkbench: jest.fn() } as unknown as SopCatalogService;
    const pastikan = createPastikanMock();
    const service = new EvaluasiWorkspaceService(
      repo,
      sopCatalog,
      pastikan as unknown as PengajuanEvaluasiService,
    );
    const actual = await service.getWorkspaceOpd(userEvaluator, 'opd-1', {});
    expect(pastikan.pastikanPengajuanRequestOpdUntukEvaluator).not.toHaveBeenCalled();
    expect(actual.daftarSop).toHaveLength(2);
    expect(actual.daftarSop.find((r) => r.detailSopId === detailId)?.tampilanAlur).toBe(
      'sedang_dievaluasi',
    );
    expect(actual.daftarSop.find((r) => r.detailSopId === detailOther)?.tampilanAlur).toBe(
      'selesai_pengajuan_ini',
    );
    expect(actual.pengajuanAktif?.nilaiPerDetail).toHaveLength(2);
  });

  it('seharusnya hanya mengisi preview ketika preview diperluas dan detail diperbolehkan', async () => {
    const repo = createRepoMock({
      findOpdRingkas: jest.fn().mockResolvedValue({ opdId: 'opd-1', nama: 'OPD Test' }),
      findDaftarDetailPipeline: jest.fn().mockResolvedValue([pipelineRow()]),
      findPengajuanAktif: jest.fn().mockResolvedValue(null),
      findRiwayatOpdSelesai: jest.fn().mockResolvedValue([]),
      findLogNilaiUntukDetailWorkspace: jest.fn().mockResolvedValue([]),
      detailMilikiOpd: jest.fn().mockResolvedValue(true),
      evaluatorTerakhirUntukDetailSop: jest.fn().mockResolvedValue(new Map()),
    });
    const getWorkbench = jest.fn().mockResolvedValue(mockWorkbench);
    const sopCatalog = { getPenyusunWorkbench: getWorkbench } as unknown as SopCatalogService;
    const pastikan = createPastikanMock();
    const service = new EvaluasiWorkspaceService(
      repo,
      sopCatalog,
      pastikan as unknown as PengajuanEvaluasiService,
    );
    const withoutExpand = await service.getWorkspaceOpd(userEvaluator, 'opd-1', {
      detailSopId: detailId,
    });
    expect(withoutExpand.preview).toBeNull();
    expect(getWorkbench).not.toHaveBeenCalled();
    const withExpand = await service.getWorkspaceOpd(userEvaluator, 'opd-1', {
      detailSopId: detailId,
      expand: 'preview',
    });
    expect(withExpand.preview?.detailSopId).toBe(detailId);
    expect(getWorkbench).toHaveBeenCalledTimes(1);
    expect(getWorkbench).toHaveBeenCalledWith(userEvaluator, detailId, 50);
  });

  it('seharusnya melewati preview ketika detail tidak berada dalam alur evaluasi', async () => {
    const repo = createRepoMock({
      findOpdRingkas: jest.fn().mockResolvedValue({ opdId: 'opd-1', nama: 'OPD Test' }),
      findDaftarDetailPipeline: jest.fn().mockResolvedValue([]),
      findPengajuanAktif: jest.fn().mockResolvedValue(null),
      findRiwayatOpdSelesai: jest.fn().mockResolvedValue([]),
      findLogNilaiUntukDetailWorkspace: jest.fn().mockResolvedValue([]),
      detailMilikiOpd: jest.fn().mockResolvedValue(true),
      evaluatorTerakhirUntukDetailSop: jest.fn().mockResolvedValue(new Map()),
    });
    const getWorkbench = jest.fn().mockResolvedValue(mockWorkbench);
    const sopCatalog = { getPenyusunWorkbench: getWorkbench } as unknown as SopCatalogService;
    const pastikan = createPastikanMock();
    const service = new EvaluasiWorkspaceService(
      repo,
      sopCatalog,
      pastikan as unknown as PengajuanEvaluasiService,
    );
    const actual = await service.getWorkspaceOpd(userEvaluator, 'opd-1', {
      detailSopId: detailId,
      expand: 'preview',
    });
    expect(actual.preview).toBeNull();
    expect(getWorkbench).not.toHaveBeenCalled();
    expect(pastikan.pastikanPengajuanRequestOpdUntukEvaluator).not.toHaveBeenCalled();
  });

  it('seharusnya melempar NotFoundException ketika bundle pengajuan tidak ditemukan', async () => {
    const repo = createRepoMock({
      findPengajuanBundleForWorkspace: jest.fn().mockResolvedValue(null),
    });
    const sopCatalog = { getPenyusunWorkbench: jest.fn() } as unknown as SopCatalogService;
    const pastikan = createPastikanMock();
    const service = new EvaluasiWorkspaceService(
      repo,
      sopCatalog,
      pastikan as unknown as PengajuanEvaluasiService,
    );
    await expect(
      service.getWorkspacePengajuan(userEvaluator, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', {}),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(pastikan.assertUserCanAccessPengajuan).not.toHaveBeenCalled();
  });

  it('seharusnya memetakan workspace pengajuan hanya dari bundle nilai', async () => {
    const repo = createRepoMock({
      findPengajuanBundleForWorkspace: jest.fn().mockResolvedValue({
        pengajuanEvaluasiId: 'peng-1',
        opdId: 'opd-1',
        status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
        jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_EVALUATOR,
        nilaiEvaluasi: [nilaiEvaluasiRow()],
        daftarRows: [pipelineRow({ statusDetail: StatusSOP.SEDANG_DIEVALUASI })],
      }),
      findOpdRingkas: jest.fn().mockResolvedValue({ opdId: 'opd-1', nama: 'OPD Test' }),
      findRiwayatOpdSelesai: jest.fn().mockResolvedValue([]),
      findLogNilaiUntukDetailWorkspace: jest.fn().mockResolvedValue([]),
      evaluatorTerakhirUntukDetailSop: jest.fn().mockResolvedValue(new Map()),
    });
    const sopCatalog = { getPenyusunWorkbench: jest.fn() } as unknown as SopCatalogService;
    const pastikan = createPastikanMock();
    const service = new EvaluasiWorkspaceService(
      repo,
      sopCatalog,
      pastikan as unknown as PengajuanEvaluasiService,
    );
    const actual = await service.getWorkspacePengajuan(userEvaluator, 'peng-1', {});
    expect(pastikan.assertUserCanAccessPengajuan).toHaveBeenCalledWith(userEvaluator, 'opd-1');
    expect(actual.daftarSop).toHaveLength(1);
    expect(actual.daftarSop[0]?.detailSopId).toBe(detailId);
    expect(actual.pengajuanAktif?.id).toBe('peng-1');
    expect(actual.pengajuanAktif?.jenis).toBe('EVALUASI_REQUEST_EVALUATOR');
    expect(actual.pengajuanAktif?.nilaiPerDetail).toHaveLength(1);
    expect(actual.opd.id).toBe('opd-1');
  });

  it('seharusnya mengembalikan log nilai SOP terpilih untuk pengajuan aktif ketika detail SOP tersedia', async () => {
    const createdAt = new Date('2026-05-19T10:00:00.000Z');
    const findLogNilai = jest.fn().mockResolvedValue([
      {
        pengajuanEvaluasiId: 'peng-1',
        detailSopId: detailId,
        penggunaId: 'eval-1',
        evaluatorNama: 'Budi Evaluator',
        hasilSebelum: null,
        hasilSesudah: 'SESUAI',
        catatanSebelum: null,
        catatanSesudah: 'Sesuai standar',
        createdAt,
      },
    ]);
    const repo = createRepoMock({
      findOpdRingkas: jest.fn().mockResolvedValue({ opdId: 'opd-1', nama: 'OPD Test' }),
      findDaftarDetailPipeline: jest
        .fn()
        .mockResolvedValue([pipelineRow({ statusDetail: StatusSOP.SEDANG_DIEVALUASI })]),
      findPengajuanAktif: jest.fn().mockResolvedValue({
        pengajuanEvaluasiId: 'peng-1',
        status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
        jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_EVALUATOR,
        nilaiEvaluasi: [nilaiEvaluasiRow({ hasil: 'SESUAI', version: 1 })],
      }),
      findRiwayatOpdSelesai: jest.fn().mockResolvedValue([]),
      findLogNilaiUntukDetailWorkspace: findLogNilai,
      evaluatorTerakhirUntukDetailSop: jest.fn().mockResolvedValue(new Map()),
    });
    const sopCatalog = { getPenyusunWorkbench: jest.fn() } as unknown as SopCatalogService;
    const pastikan = createPastikanMock();
    const service = new EvaluasiWorkspaceService(
      repo,
      sopCatalog,
      pastikan as unknown as PengajuanEvaluasiService,
    );
    const actual = await service.getWorkspaceOpd(userEvaluator, 'opd-1', {
      detailSopId: detailId,
    });
    expect(findLogNilai).toHaveBeenCalledWith('peng-1', detailId, 30);
    expect(actual.logNilaiSopTerpilih).toHaveLength(1);
    expect(actual.logNilaiSopTerpilih[0]?.evaluatorNama).toBe('Budi Evaluator');
    expect(actual.logNilaiSopTerpilih[0]?.hasilSesudah).toBe('SESUAI');
  });

  it('seharusnya mempertahankan status pengajuan tetap terlihat pada tahap jobdesk akhir', async () => {
    const repo = createRepoMock({
      findPengajuanBundleForWorkspace: jest.fn().mockResolvedValue({
        pengajuanEvaluasiId: 'peng-2',
        opdId: 'opd-1',
        status: StatusPengajuanEvaluasi.DITANDATANGANI_PJ_PENYUSUN,
        jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_EVALUATOR,
        nilaiEvaluasi: [nilaiEvaluasiRow({ hasil: 'SESUAI', version: 2 })],
        daftarRows: [
          pipelineRow({
            statusDetail: StatusSOP.DIVERIFIKASI_PJ_EVALUATOR_ORGANISASI,
          }),
        ],
      }),
      findOpdRingkas: jest.fn().mockResolvedValue({ opdId: 'opd-1', nama: 'OPD Test' }),
      findRiwayatOpdSelesai: jest.fn().mockResolvedValue([]),
      findLogNilaiUntukDetailWorkspace: jest.fn().mockResolvedValue([]),
      evaluatorTerakhirUntukDetailSop: jest.fn().mockResolvedValue(new Map()),
    });
    const sopCatalog = { getPenyusunWorkbench: jest.fn() } as unknown as SopCatalogService;
    const pastikan = createPastikanMock();
    const service = new EvaluasiWorkspaceService(
      repo,
      sopCatalog,
      pastikan as unknown as PengajuanEvaluasiService,
    );
    const actual = await service.getWorkspacePengajuan(userEvaluator, 'peng-2', {});
    expect(actual.pengajuanAktif?.status).toBe('DITANDATANGANI_PJ_PENYUSUN');
  });

  describe('getWorkspaceOpdSaya', () => {
    it('seharusnya memanggil resolveOpdIdTerikat dan mendelegasikan ke getWorkspaceOpd', async () => {
      const repo = createRepoMock({
        findOpdRingkas: jest.fn().mockResolvedValue({ opdId: 'opd-saya', nama: 'OPD Saya' }),
        findDaftarDetailPipeline: jest.fn().mockResolvedValue([]),
        findPengajuanAktif: jest.fn().mockResolvedValue(null),
        findRiwayatOpdSelesai: jest.fn().mockResolvedValue([]),
        evaluatorTerakhirUntukDetailSop: jest.fn().mockResolvedValue(new Map()),
      });
      const sopCatalog = { getPenyusunWorkbench: jest.fn() } as unknown as SopCatalogService;
      const pastikan = createPastikanMock();
      const mockResolve = jest.fn().mockResolvedValue('opd-saya');
      const service = new EvaluasiWorkspaceService(repo, sopCatalog, {
        ...pastikan,
        resolveOpdIdTerikat: mockResolve,
      } as unknown as PengajuanEvaluasiService);

      const res = await service.getWorkspaceOpdSaya(userEvaluator, {});
      expect(mockResolve).toHaveBeenCalledWith(userEvaluator);
      expect(pastikan.assertUserCanAccessPengajuan).toHaveBeenCalledWith(userEvaluator, 'opd-saya');
      expect(res.opd.id).toBe('opd-saya');
    });
  });

  describe('Edge/False/Worst Cases - getWorkspaceOpd', () => {
    it('seharusnya melempar error jika pengguna tidak memiliki akses pengajuan OPD', async () => {
      const repo = createRepoMock({
        findOpdRingkas: jest.fn().mockResolvedValue({ opdId: 'opd-1', nama: 'OPD Test' }),
      });
      const sopCatalog = { getPenyusunWorkbench: jest.fn() } as unknown as SopCatalogService;
      const pastikan = createPastikanMock();
      pastikan.assertUserCanAccessPengajuan.mockRejectedValue(new Error('Akses ditolak'));

      const service = new EvaluasiWorkspaceService(
        repo,
        sopCatalog,
        pastikan as unknown as PengajuanEvaluasiService,
      );

      await expect(service.getWorkspaceOpd(userEvaluator, 'opd-1', {})).rejects.toThrow(
        'Akses ditolak',
      );
    });

    it('seharusnya tidak memanggil pastikanPengajuanRequestOpdUntukEvaluator jika pengguna evaluator tetapi daftar detail kosong', async () => {
      const repo = createRepoMock({
        findOpdRingkas: jest.fn().mockResolvedValue({ opdId: 'opd-1', nama: 'OPD Test' }),
        findDaftarDetailPipeline: jest.fn().mockResolvedValue([]),
        findPengajuanAktif: jest.fn().mockResolvedValue(null),
        findRiwayatOpdSelesai: jest.fn().mockResolvedValue([]),
        evaluatorTerakhirUntukDetailSop: jest.fn().mockResolvedValue(new Map()),
      });
      const sopCatalog = { getPenyusunWorkbench: jest.fn() } as unknown as SopCatalogService;
      const pastikan = createPastikanMock();

      const service = new EvaluasiWorkspaceService(
        repo,
        sopCatalog,
        pastikan as unknown as PengajuanEvaluasiService,
      );

      const res = await service.getWorkspaceOpd(userEvaluator, 'opd-1', {});
      expect(pastikan.pastikanPengajuanRequestOpdUntukEvaluator).not.toHaveBeenCalled();
      expect(res.pengajuanAktif).toBeNull();
    });

    it('seharusnya mengabaikan log dan preview jika detailSopId tidak ada di dalam daftar detail pipeline (foreign id)', async () => {
      const foreignId = '99999999-9999-9999-9999-999999999999';
      const repo = createRepoMock({
        findOpdRingkas: jest.fn().mockResolvedValue({ opdId: 'opd-1', nama: 'OPD Test' }),
        findDaftarDetailPipeline: jest.fn().mockResolvedValue([pipelineRow()]),
        findPengajuanAktif: jest.fn().mockResolvedValue({
          pengajuanEvaluasiId: 'peng-1',
          status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
          jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_OPD,
          nilaiEvaluasi: [nilaiEvaluasiRow()],
        }),
        findRiwayatOpdSelesai: jest.fn().mockResolvedValue([]),
        findLogNilaiUntukDetailWorkspace: jest.fn(),
        detailMilikiOpd: jest.fn(),
        evaluatorTerakhirUntukDetailSop: jest.fn().mockResolvedValue(new Map()),
      });
      const sopCatalog = { getPenyusunWorkbench: jest.fn() } as unknown as SopCatalogService;
      const pastikan = createPastikanMock();

      const service = new EvaluasiWorkspaceService(
        repo,
        sopCatalog,
        pastikan as unknown as PengajuanEvaluasiService,
      );

      const res = await service.getWorkspaceOpd(userEvaluator, 'opd-1', {
        detailSopId: foreignId,
        expand: 'preview',
      });

      expect(repo.findLogNilaiUntukDetailWorkspace).not.toHaveBeenCalled();
      expect(res.logNilaiSopTerpilih).toEqual([]);
      expect(res.preview).toBeNull();
    });

    it('seharusnya menangani query expand kosong atau whitespace dengan aman tanpa error', async () => {
      const repo = createRepoMock({
        findOpdRingkas: jest.fn().mockResolvedValue({ opdId: 'opd-1', nama: 'OPD Test' }),
        findDaftarDetailPipeline: jest.fn().mockResolvedValue([]),
        findPengajuanAktif: jest.fn().mockResolvedValue(null),
        findRiwayatOpdSelesai: jest.fn().mockResolvedValue([]),
        evaluatorTerakhirUntukDetailSop: jest.fn().mockResolvedValue(new Map()),
      });
      const sopCatalog = { getPenyusunWorkbench: jest.fn() } as unknown as SopCatalogService;
      const pastikan = createPastikanMock();

      const service = new EvaluasiWorkspaceService(
        repo,
        sopCatalog,
        pastikan as unknown as PengajuanEvaluasiService,
      );

      const res = await service.getWorkspaceOpd(userEvaluator, 'opd-1', { expand: ', ,  ' });
      expect(res).toBeDefined();
    });

    it('seharusnya mengembalikan preview null jika detailMilikiOpd mengembalikan false meskipun ada di pipeline', async () => {
      const repo = createRepoMock({
        findOpdRingkas: jest.fn().mockResolvedValue({ opdId: 'opd-1', nama: 'OPD Test' }),
        findDaftarDetailPipeline: jest.fn().mockResolvedValue([pipelineRow()]),
        findPengajuanAktif: jest.fn().mockResolvedValue(null),
        findRiwayatOpdSelesai: jest.fn().mockResolvedValue([]),
        detailMilikiOpd: jest.fn().mockResolvedValue(false),
        evaluatorTerakhirUntukDetailSop: jest.fn().mockResolvedValue(new Map()),
        findLogNilaiUntukDetailWorkspace: jest.fn().mockResolvedValue([]),
      });
      const sopCatalog = { getPenyusunWorkbench: jest.fn() } as unknown as SopCatalogService;
      const pastikan = createPastikanMock();

      const service = new EvaluasiWorkspaceService(
        repo,
        sopCatalog,
        pastikan as unknown as PengajuanEvaluasiService,
      );

      const res = await service.getWorkspaceOpd(userEvaluator, 'opd-1', {
        detailSopId: detailId,
        expand: 'preview',
      });

      expect(repo.detailMilikiOpd).toHaveBeenCalledWith(detailId, 'opd-1');
      expect(res.preview).toBeNull();
      expect(sopCatalog.getPenyusunWorkbench).not.toHaveBeenCalled();
    });

    it('seharusnya mengembalikan preview null jika query.expand="preview" tetapi query.detailSopId undefined', async () => {
      const repo = createRepoMock({
        findOpdRingkas: jest.fn().mockResolvedValue({ opdId: 'opd-1', nama: 'OPD Test' }),
        findDaftarDetailPipeline: jest.fn().mockResolvedValue([pipelineRow()]),
        findPengajuanAktif: jest.fn().mockResolvedValue(null),
        findRiwayatOpdSelesai: jest.fn().mockResolvedValue([]),
        evaluatorTerakhirUntukDetailSop: jest.fn().mockResolvedValue(new Map()),
      });
      const sopCatalog = { getPenyusunWorkbench: jest.fn() } as unknown as SopCatalogService;
      const pastikan = createPastikanMock();

      const service = new EvaluasiWorkspaceService(
        repo,
        sopCatalog,
        pastikan as unknown as PengajuanEvaluasiService,
      );

      const res = await service.getWorkspaceOpd(userEvaluator, 'opd-1', {
        expand: 'preview',
      });

      expect(res.preview).toBeNull();
    });

    it('seharusnya menangani map evaluasi kosong atau evaluator terakhir null tanpa melempar error', async () => {
      const repo = createRepoMock({
        findOpdRingkas: jest.fn().mockResolvedValue({ opdId: 'opd-1', nama: 'OPD Test' }),
        findDaftarDetailPipeline: jest.fn().mockResolvedValue([pipelineRow()]),
        findPengajuanAktif: jest.fn().mockResolvedValue({
          pengajuanEvaluasiId: 'peng-1',
          status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
          jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_OPD,
          nilaiEvaluasi: [], // Kosong
        }),
        findRiwayatOpdSelesai: jest.fn().mockResolvedValue([]),
        evaluatorTerakhirUntukDetailSop: jest.fn().mockResolvedValue(new Map()), // Kosong
      });
      const sopCatalog = { getPenyusunWorkbench: jest.fn() } as unknown as SopCatalogService;
      const pastikan = createPastikanMock();

      const service = new EvaluasiWorkspaceService(
        repo,
        sopCatalog,
        pastikan as unknown as PengajuanEvaluasiService,
      );

      const res = await service.getWorkspaceOpd(userEvaluator, 'opd-1', {});
      expect(res.daftarSop[0]?.evaluatorTerakhir).toBeNull();
      expect(res.daftarSop[0]?.tampilanAlur).toBe('perlu_evaluasi'); // Karena tidak ada di map nilaiEvaluasi
    });
  });

  describe('Edge/False/Worst Cases - getWorkspacePengajuan', () => {
    it('seharusnya melempar NotFoundException jika bundle ditemukan tetapi data OPD ringkas tidak ditemukan', async () => {
      const repo = createRepoMock({
        findPengajuanBundleForWorkspace: jest.fn().mockResolvedValue({
          pengajuanEvaluasiId: 'peng-1',
          opdId: 'opd-1',
          status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
          jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_EVALUATOR,
          nilaiEvaluasi: [],
          daftarRows: [],
        }),
        findOpdRingkas: jest.fn().mockResolvedValue(null),
      });
      const sopCatalog = { getPenyusunWorkbench: jest.fn() } as unknown as SopCatalogService;
      const pastikan = createPastikanMock();

      const service = new EvaluasiWorkspaceService(
        repo,
        sopCatalog,
        pastikan as unknown as PengajuanEvaluasiService,
      );

      await expect(service.getWorkspacePengajuan(userEvaluator, 'peng-1', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('seharusnya melempar error dari assertUserCanAccessPengajuan jika pengguna tidak berwenang', async () => {
      const repo = createRepoMock({
        findPengajuanBundleForWorkspace: jest.fn().mockResolvedValue({
          pengajuanEvaluasiId: 'peng-1',
          opdId: 'opd-1',
          status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
          jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_EVALUATOR,
          nilaiEvaluasi: [],
          daftarRows: [],
        }),
      });
      const sopCatalog = { getPenyusunWorkbench: jest.fn() } as unknown as SopCatalogService;
      const pastikan = createPastikanMock();
      pastikan.assertUserCanAccessPengajuan.mockRejectedValue(new Error('Unauthorized'));

      const service = new EvaluasiWorkspaceService(
        repo,
        sopCatalog,
        pastikan as unknown as PengajuanEvaluasiService,
      );

      await expect(service.getWorkspacePengajuan(userEvaluator, 'peng-1', {})).rejects.toThrow(
        'Unauthorized',
      );
    });

    it('seharusnya mengabaikan log nilai dan preview jika detailSopId di query tidak ada di dalam bundle', async () => {
      const foreignId = '99999999-9999-9999-9999-999999999999';
      const repo = createRepoMock({
        findPengajuanBundleForWorkspace: jest.fn().mockResolvedValue({
          pengajuanEvaluasiId: 'peng-1',
          opdId: 'opd-1',
          status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
          jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_EVALUATOR,
          nilaiEvaluasi: [nilaiEvaluasiRow()],
          daftarRows: [pipelineRow()],
        }),
        findOpdRingkas: jest.fn().mockResolvedValue({ opdId: 'opd-1', nama: 'OPD' }),
        findRiwayatOpdSelesai: jest.fn().mockResolvedValue([]),
        findLogNilaiUntukDetailWorkspace: jest.fn(),
        detailMilikiOpd: jest.fn(),
        evaluatorTerakhirUntukDetailSop: jest.fn().mockResolvedValue(new Map()),
      });
      const sopCatalog = { getPenyusunWorkbench: jest.fn() } as unknown as SopCatalogService;
      const pastikan = createPastikanMock();

      const service = new EvaluasiWorkspaceService(
        repo,
        sopCatalog,
        pastikan as unknown as PengajuanEvaluasiService,
      );

      const res = await service.getWorkspacePengajuan(userEvaluator, 'peng-1', {
        detailSopId: foreignId,
        expand: 'preview',
      });

      expect(repo.findLogNilaiUntukDetailWorkspace).not.toHaveBeenCalled();
      expect(res.logNilaiSopTerpilih).toEqual([]);
      expect(res.preview).toBeNull();
    });

    it('seharusnya mengembalikan preview null jika expand preview diminta tetapi detailMilikiOpd false', async () => {
      const repo = createRepoMock({
        findPengajuanBundleForWorkspace: jest.fn().mockResolvedValue({
          pengajuanEvaluasiId: 'peng-1',
          opdId: 'opd-1',
          status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
          jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_EVALUATOR,
          nilaiEvaluasi: [nilaiEvaluasiRow()],
          daftarRows: [pipelineRow()],
        }),
        findOpdRingkas: jest.fn().mockResolvedValue({ opdId: 'opd-1', nama: 'OPD' }),
        findRiwayatOpdSelesai: jest.fn().mockResolvedValue([]),
        findLogNilaiUntukDetailWorkspace: jest.fn().mockResolvedValue([]),
        detailMilikiOpd: jest.fn().mockResolvedValue(false),
        evaluatorTerakhirUntukDetailSop: jest.fn().mockResolvedValue(new Map()),
      });
      const sopCatalog = { getPenyusunWorkbench: jest.fn() } as unknown as SopCatalogService;
      const pastikan = createPastikanMock();

      const service = new EvaluasiWorkspaceService(
        repo,
        sopCatalog,
        pastikan as unknown as PengajuanEvaluasiService,
      );

      const res = await service.getWorkspacePengajuan(userEvaluator, 'peng-1', {
        detailSopId: detailId,
        expand: 'preview',
      });

      expect(repo.detailMilikiOpd).toHaveBeenCalledWith(detailId, 'opd-1');
      expect(res.preview).toBeNull();
      expect(sopCatalog.getPenyusunWorkbench).not.toHaveBeenCalled();
    });
  });
});
