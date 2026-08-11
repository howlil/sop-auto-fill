import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { JwtAccessPayload } from '../../../common';
import {
  JenisPengajuanEvaluasi,
  PeranPengguna,
  StatusPengajuanEvaluasi,
  StatusSOP,
} from '../../../generated/prisma';
import { STATUS_PENGAJUAN_AKTIF_LINTAS_JOBDESK } from './pengajuan-evaluasi-status.constants';
import type { PengajuanEvaluasiDetailRow } from './pengajuan-evaluasi.repository';
import type { PengajuanEvaluasiRepository } from './pengajuan-evaluasi.repository';
import { UserOpdAccessService } from '../../core/opd/user-opd-access.service';
import { PengajuanEvaluasiService } from '../pengajuan/pengajuan-evaluasi.service';

function buildService(
  repo: PengajuanEvaluasiRepository,
  userOpdAccessOverrides?: Partial<{
    getRequiredUserOpdId: jest.Mock;
    assertSameOpd: jest.Mock;
  }>,
): PengajuanEvaluasiService {
  const userOpdAccess = {
    getRequiredUserOpdId: jest.fn().mockResolvedValue('opd-a'),
    assertSameOpd: jest.fn().mockResolvedValue(undefined),
    ...userOpdAccessOverrides,
  } as unknown as UserOpdAccessService;
  return new PengajuanEvaluasiService(repo, userOpdAccess);
}

describe('Pengujian PengajuanEvaluasiService', () => {
  const userPjPenyusun = {
    sub: 'u1',
    email: 'pj@test',
    peran: PeranPengguna.PJ_PENYUSUN,
  };

  it('seharusnya mengembalikan ringkasan terpaginasi dengan total item', async () => {
    const ringkasRow = {
      pengajuanEvaluasiId: 'p1',
      opdId: 'opd-a',
      opdNama: 'OPD A',
      jenis: 'EVALUASI_REQUEST_EVALUATOR',
      status: 'SELESAI_DIEVALUASI',
      createdAt: '2026-01-01T00:00:00.000Z',
      jumlahSop: 2,
      jumlahSudahDinilai: 2,
    };
    const repo = {
      findOpdIdPengguna: jest.fn(),
      buildWhereRingkasFromQuery: jest.fn().mockReturnValue({}),
      countWhere: jest.fn().mockResolvedValue(25),
      findRingkasPage: jest.fn().mockResolvedValue([ringkasRow]),
    } as unknown as PengajuanEvaluasiRepository;
    const service = buildService(repo);
    const actual = await service.findAllRingkas(
      { sub: 'pj', email: 'pj@test', peran: PeranPengguna.PJ_EVALUATOR },
      { page: 2, limit: 10 },
    );
    expect(repo.countWhere).toHaveBeenCalled();
    expect(repo.findRingkasPage).toHaveBeenCalledWith({}, 10, 10);
    expect(actual.items).toHaveLength(1);
    expect(actual.pagination).toEqual({
      page: 2,
      limit: 10,
      totalItems: 25,
      totalPages: 3,
    });
  });

  it('seharusnya menerapkan filter OPD untuk penyusun pada pencarian semua data', async () => {
    const getRequiredUserOpdId = jest.fn().mockResolvedValue('opd-a');
    const repo = {
      buildWhereFromQuery: jest.fn().mockReturnValue({ AND: [{ opdId: 'opd-a' }] }),
      findManyFiltered: jest.fn().mockResolvedValue([]),
    } as unknown as PengajuanEvaluasiRepository;
    const service = buildService(repo, { getRequiredUserOpdId });
    const penyusunUser: JwtAccessPayload = {
      sub: 'pen-1',
      email: 'pen@test',
      peran: PeranPengguna.PENYUSUN,
    };
    const actual = await service.findAll(penyusunUser, {});
    expect(getRequiredUserOpdId).toHaveBeenCalledWith('pen-1', 'OPD pengguna tidak ditemukan');
    expect(repo.buildWhereFromQuery).toHaveBeenCalledWith(expect.any(Object), 'opd-a');
    expect(actual).toEqual([]);
  });

  it('seharusnya menghilangkan field OPD pada findAll untuk PJ Penyusun', async () => {
    const now = new Date();
    const row = {
      pengajuanEvaluasiId: 'p1',
      opdId: 'opd-a',
      jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_EVALUATOR,
      status: StatusPengajuanEvaluasi.DITANDATANGANI_PJ_EVALUATOR,
      nilaiOPD: 4,
      createdAt: now,
      updatedAt: now,
      opd: { opdId: 'opd-a', nama: 'OPD A' },
      nilaiEvaluasi: [],
      logNilaiEvaluasi: [],
      dokumenTte: [],
    } as unknown as PengajuanEvaluasiDetailRow;
    const getRequiredUserOpdId = jest.fn().mockResolvedValue('opd-a');
    const repo = {
      buildWhereFromQuery: jest.fn().mockReturnValue({ AND: [{ opdId: 'opd-a' }] }),
      findManyFiltered: jest.fn().mockResolvedValue([row]),
    } as unknown as PengajuanEvaluasiRepository;
    const service = buildService(repo, { getRequiredUserOpdId });
    const actual = await service.findAll(userPjPenyusun, {});
    expect(actual).toHaveLength(1);
    expect(actual[0]).not.toHaveProperty('opdId');
    expect(actual[0]).not.toHaveProperty('opdNama');
    expect(actual[0]).not.toHaveProperty('opd');
    expect(actual[0]).not.toHaveProperty('nilaiOPD');
  });

  it('seharusnya tetap menyertakan field OPD pada findAll untuk PJ Evaluator', async () => {
    const now = new Date();
    const row = {
      pengajuanEvaluasiId: 'p1',
      opdId: 'opd-a',
      jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_EVALUATOR,
      status: StatusPengajuanEvaluasi.DITANDATANGANI_PJ_EVALUATOR,
      nilaiOPD: 4,
      createdAt: now,
      updatedAt: now,
      opd: { opdId: 'opd-a', nama: 'OPD A' },
      nilaiEvaluasi: [],
      logNilaiEvaluasi: [],
      dokumenTte: [],
    } as unknown as PengajuanEvaluasiDetailRow;
    const repo = {
      buildWhereFromQuery: jest.fn().mockReturnValue({}),
      findManyFiltered: jest.fn().mockResolvedValue([row]),
    } as unknown as PengajuanEvaluasiRepository;
    const service = buildService(repo);
    const actual = await service.findAll(
      { sub: 'pj-ev', email: 'pj-ev@test', peran: PeranPengguna.PJ_EVALUATOR },
      {},
    );
    expect(actual[0]).toMatchObject({
      opdId: 'opd-a',
      opdNama: 'OPD A',
      nilaiOPD: 4,
      opd: { id: 'opd-a', nama: 'OPD A' },
    });
  });

  it('seharusnya menerapkan filter OPD untuk PJ penyusun pada pencarian semua data', async () => {
    const getRequiredUserOpdId = jest.fn().mockResolvedValue('opd-a');
    const repo = {
      buildWhereFromQuery: jest.fn().mockReturnValue({ AND: [{ opdId: 'opd-a' }] }),
      findManyFiltered: jest.fn().mockResolvedValue([]),
    } as unknown as PengajuanEvaluasiRepository;
    const service = buildService(repo, { getRequiredUserOpdId });
    const actual = await service.findAll(userPjPenyusun, {});
    expect(getRequiredUserOpdId).toHaveBeenCalledWith('u1', 'OPD pengguna tidak ditemukan');
    expect(repo.buildWhereFromQuery).toHaveBeenCalledWith(expect.any(Object), 'opd-a');
    expect(repo.findManyFiltered).toHaveBeenCalledWith({ AND: [{ opdId: 'opd-a' }] });
    expect(actual).toEqual([]);
  });

  it('seharusnya menolak akses membuat ketika bukan PJ penyusun', async () => {
    const runTransaction = jest.fn();
    const repo = { runTransaction } as unknown as PengajuanEvaluasiRepository;
    const service = buildService(repo);
    await expect(
      service.create(
        { sub: 'x', email: 'e', peran: PeranPengguna.EVALUATOR },
        {
          jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_EVALUATOR,
          sopDetailIds: ['00000000-0000-4000-8000-000000000002'],
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('seharusnya menolak akses membuat ketika PJ penyusun tidak punya OPD', async () => {
    const getRequiredUserOpdId = jest
      .fn()
      .mockRejectedValue(new ForbiddenException('OPD pengguna tidak ditemukan'));
    const runTransaction = jest.fn();
    const repo = { runTransaction } as unknown as PengajuanEvaluasiRepository;
    const service = buildService(repo, { getRequiredUserOpdId });
    await expect(
      service.create(userPjPenyusun, {
        jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_EVALUATOR,
        sopDetailIds: ['00000000-0000-4000-8000-000000000002'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(getRequiredUserOpdId).toHaveBeenCalledWith('u1', 'OPD pengguna tidak ditemukan');
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it.each([
    JenisPengajuanEvaluasi.EVALUASI_REQUEST_EVALUATOR,
    JenisPengajuanEvaluasi.EVALUASI_REQUEST_OPD,
  ])('seharusnya menyimpan jenis %s saat membuat pengajuan', async (jenis) => {
    const opdId = '00000000-0000-4000-8000-000000000001';
    const detailSopId = '00000000-0000-4000-8000-000000000002';
    const pengajuanId = '00000000-0000-4000-8000-000000000099';
    const tx = {
      pengajuanEvaluasi: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ pengajuanEvaluasiId: pengajuanId }),
      },
      detailSOP: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ detailSopId, status: StatusSOP.MENUNGGU_PENGAJUAN_EVALUASI }]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const runTransaction = jest.fn(async (cb: (t: typeof tx) => Promise<string>) => cb(tx));
    const now = new Date('2026-06-01T12:00:00.000Z');
    const mockRow = {
      pengajuanEvaluasiId: pengajuanId,
      opdId,
      jenis,
      status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
      nomorBA: null,
      tanggalPermintaan: now,
      tanggalEvaluasi: now,
      nilaiOPD: null,
      diverifikasiOlehUserId: null,
      diselesaikanOlehId: null,
      ditandatanganiOlehPjPenyusunUserId: null,
      tanggalTTDBaPjPenyusun: null,
      tanggalDiselesaikan: null,
      version: 0,
      createdAt: now,
      updatedAt: now,
      opd: { opdId, nama: 'OPD Uji' },
      nilaiEvaluasi: [
        {
          pengajuanEvaluasiId: pengajuanId,
          detailSopId,
          hasil: null,
          catatan: null,
          version: 0,
          dinilaiOlehId: null,
          dinilaiOleh: null,
          detailSop: {
            detailSopId,
            nomorSOP: 'SOP-001',
            status: StatusSOP.SEDANG_DIEVALUASI,
            sop: { sopId: '00000000-0000-4000-8000-000000000077', judul: 'Judul SOP' },
          },
          createdAt: now,
          updatedAt: now,
        },
      ],
      logNilaiEvaluasi: [],
      dokumenTte: [],
      diselesaikanOleh: null,
      diverifikasiOlehUser: null,
      ditandatanganiOlehPjPenyusunUser: null,
    } as unknown as PengajuanEvaluasiDetailRow;
    const findByIdFull = jest.fn().mockResolvedValue(mockRow);
    const getRequiredUserOpdId = jest.fn().mockResolvedValue(opdId);
    const repo = { runTransaction, findByIdFull } as unknown as PengajuanEvaluasiRepository;
    const service = buildService(repo, { getRequiredUserOpdId });
    const userPj = { sub: 'pj-1', email: 'pj@test', peran: PeranPengguna.PJ_PENYUSUN };
    const actual = await service.create(userPj, {
      jenis,
      sopDetailIds: [detailSopId],
    });
    expect(tx.pengajuanEvaluasi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          opdId,
          jenis,
          status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
        }),
      }),
    );
    expect(findByIdFull).toHaveBeenCalledWith(pengajuanId);
    expect(actual).toMatchObject({ id: pengajuanId, jenis: String(jenis) });
    expect(actual).not.toHaveProperty('opdId');
    expect(actual).not.toHaveProperty('opdNama');
    expect(actual).not.toHaveProperty('opd');
    expect(actual).not.toHaveProperty('nilaiOPD');
  });

  it('seharusnya menolak pembuatan ketika status detail belum menunggu pengajuan evaluasi', async () => {
    const opdId = '00000000-0000-4000-8000-000000000001';
    const detailSopId = '00000000-0000-4000-8000-000000000002';
    const tx = {
      pengajuanEvaluasi: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      detailSOP: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ detailSopId, status: StatusSOP.SEDANG_DIEVALUASI }]),
        updateMany: jest.fn(),
      },
    };
    const runTransaction = jest.fn(async (cb: (t: typeof tx) => Promise<string>) => cb(tx));
    const repo = { runTransaction } as unknown as PengajuanEvaluasiRepository;
    const getRequiredUserOpdId = jest.fn().mockResolvedValue(opdId);
    const service = buildService(repo, { getRequiredUserOpdId });

    await expect(
      service.create(userPjPenyusun, {
        jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_EVALUATOR,
        sopDetailIds: [detailSopId],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.pengajuanEvaluasi.create).not.toHaveBeenCalled();
    expect(tx.detailSOP.updateMany).not.toHaveBeenCalled();
  });

  it('seharusnya menolak pembuatan ketika detail SOP milik OPD berbeda', async () => {
    const opdId = '00000000-0000-4000-8000-000000000001';
    const detailSopId = '00000000-0000-4000-8000-000000000002';
    const tx = {
      pengajuanEvaluasi: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      detailSOP: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn(),
      },
    };
    const runTransaction = jest.fn(async (cb: (t: typeof tx) => Promise<string>) => cb(tx));
    const repo = { runTransaction } as unknown as PengajuanEvaluasiRepository;
    const getRequiredUserOpdId = jest.fn().mockResolvedValue(opdId);
    const service = buildService(repo, { getRequiredUserOpdId });

    await expect(
      service.create(userPjPenyusun, {
        jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_EVALUATOR,
        sopDetailIds: [detailSopId],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.detailSOP.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          detailSopId: { in: [detailSopId] },
          sop: { opdId },
        }),
      }),
    );
  });

  it('seharusnya melempar ConflictException ketika OPD masih memiliki pengajuan evaluasi aktif', async () => {
    const opdId = '00000000-0000-4000-8000-000000000001';
    const detailSopId = '00000000-0000-4000-8000-000000000002';
    const tx = {
      pengajuanEvaluasi: {
        findFirst: jest.fn().mockResolvedValue({ pengajuanEvaluasiId: 'p1' }),
        create: jest.fn(),
      },
      detailSOP: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    const runTransaction = jest.fn(async (cb: (t: typeof tx) => Promise<string>) => cb(tx));
    const repo = { runTransaction } as unknown as PengajuanEvaluasiRepository;
    const getRequiredUserOpdId = jest.fn().mockResolvedValue(opdId);
    const service = buildService(repo, { getRequiredUserOpdId });

    await expect(
      service.create(userPjPenyusun, {
        jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_EVALUATOR,
        sopDetailIds: [detailSopId],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.pengajuanEvaluasi.create).not.toHaveBeenCalled();
    expect(tx.detailSOP.findMany).not.toHaveBeenCalled();
  });

  it('seharusnya melempar ConflictException ketika status berubah sebelum dipromosikan', async () => {
    const opdId = '00000000-0000-4000-8000-000000000001';
    const detailSopId = '00000000-0000-4000-8000-000000000002';
    const tx = {
      pengajuanEvaluasi: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ pengajuanEvaluasiId: 'p1' }),
      },
      detailSOP: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ detailSopId, status: StatusSOP.MENUNGGU_PENGAJUAN_EVALUASI }]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const runTransaction = jest.fn(async (cb: (t: typeof tx) => Promise<string>) => cb(tx));
    const repo = { runTransaction } as unknown as PengajuanEvaluasiRepository;
    const getRequiredUserOpdId = jest.fn().mockResolvedValue(opdId);
    const service = buildService(repo, { getRequiredUserOpdId });

    await expect(
      service.create(userPjPenyusun, {
        jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_EVALUATOR,
        sopDetailIds: [detailSopId],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('seharusnya tidak melakukan perubahan pada evaluasi EVALUASI_REQUEST_OPD ketika pengguna bukan evaluator', async () => {
    const runTransaction = jest.fn();
    const repo = { runTransaction } as unknown as PengajuanEvaluasiRepository;
    const service = buildService(repo);
    await service.pastikanPengajuanRequestOpdUntukEvaluator(
      { sub: 'x', email: 'e', peran: PeranPengguna.PJ_EVALUATOR },
      '00000000-0000-4000-8000-000000000001',
      [
        {
          detailSopId: '00000000-0000-4000-8000-000000000002',
          statusDetail: StatusSOP.MENUNGGU_PENGAJUAN_EVALUASI,
        },
      ],
    );
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('seharusnya tidak melakukan perubahan pada evaluasi EVALUASI_REQUEST_OPD ketika alur pengajuan tidak memenuhi syarat', async () => {
    const runTransaction = jest.fn();
    const repo = { runTransaction } as unknown as PengajuanEvaluasiRepository;
    const service = buildService(repo);
    await service.pastikanPengajuanRequestOpdUntukEvaluator(
      { sub: 'x', email: 'e', peran: PeranPengguna.EVALUATOR },
      '00000000-0000-4000-8000-000000000001',
      [
        {
          detailSopId: '00000000-0000-4000-8000-000000000002',
          statusDetail: StatusSOP.MENUNGGU_TTD_PJ_EVALUATOR,
        },
      ],
    );
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('seharusnya tidak melakukan perubahan pada evaluasi EVALUASI_REQUEST_OPD ketika status sudah diajukan evaluasi', async () => {
    const runTransaction = jest.fn();
    const repo = { runTransaction } as unknown as PengajuanEvaluasiRepository;
    const service = buildService(repo);
    await service.pastikanPengajuanRequestOpdUntukEvaluator(
      { sub: 'x', email: 'e', peran: PeranPengguna.EVALUATOR },
      '00000000-0000-4000-8000-000000000001',
      [
        {
          detailSopId: '00000000-0000-4000-8000-000000000002',
          statusDetail: StatusSOP.DIAJUKAN_EVALUASI,
        },
      ],
    );
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('seharusnya keluar dari transaksi lebih awal ketika pengajuan penghambat masih ada', async () => {
    const detailSopId = '00000000-0000-4000-8000-000000000002';
    const tx = {
      pengajuanEvaluasi: {
        findFirst: jest.fn().mockResolvedValue({ pengajuanEvaluasiId: 'existing' }),
        create: jest.fn(),
      },
      detailSOP: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    const runTransaction = jest.fn(async (cb: (t: typeof tx) => Promise<void>) => {
      await cb(tx);
    });
    const repo = { runTransaction } as unknown as PengajuanEvaluasiRepository;
    const service = buildService(repo);
    await service.pastikanPengajuanRequestOpdUntukEvaluator(
      { sub: 'x', email: 'e', peran: PeranPengguna.EVALUATOR },
      '00000000-0000-4000-8000-000000000001',
      [{ detailSopId, statusDetail: StatusSOP.MENUNGGU_PENGAJUAN_EVALUASI }],
    );
    expect(tx.pengajuanEvaluasi.create).not.toHaveBeenCalled();
    expect(tx.detailSOP.updateMany).not.toHaveBeenCalled();
  });

  it('seharusnya memeriksa pengajuan penghambat pada semua status jobdesk aktif', async () => {
    const tx = {
      pengajuanEvaluasi: {
        findFirst: jest.fn().mockResolvedValue({ pengajuanEvaluasiId: 'existing' }),
      },
      detailSOP: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    const runTransaction = jest.fn(async (cb: (t: typeof tx) => Promise<void>) => {
      await cb(tx);
    });
    const repo = { runTransaction } as unknown as PengajuanEvaluasiRepository;
    const service = buildService(repo);
    await service.pastikanPengajuanRequestOpdUntukEvaluator(
      { sub: 'x', email: 'e', peran: PeranPengguna.EVALUATOR },
      '00000000-0000-4000-8000-000000000001',
      [
        {
          detailSopId: '00000000-0000-4000-8000-000000000002',
          statusDetail: StatusSOP.MENUNGGU_PENGAJUAN_EVALUASI,
        },
      ],
    );
    expect(tx.pengajuanEvaluasi.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: [...STATUS_PENGAJUAN_AKTIF_LINTAS_JOBDESK] },
        }),
      }),
    );
  });

  it('seharusnya membuat evaluasi EVALUASI_REQUEST_OPD dalam transaksi ketika tidak ada penghambat', async () => {
    const detailSopId = '00000000-0000-4000-8000-000000000002';
    const tx = {
      pengajuanEvaluasi: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ pengajuanEvaluasiId: 'p1' }),
      },
      detailSOP: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ detailSopId, status: StatusSOP.MENUNGGU_PENGAJUAN_EVALUASI }]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const runTransaction = jest.fn(async (cb: (t: typeof tx) => Promise<void>) => {
      await cb(tx);
    });
    const repo = { runTransaction } as unknown as PengajuanEvaluasiRepository;
    const service = buildService(repo);
    await service.pastikanPengajuanRequestOpdUntukEvaluator(
      { sub: 'x', email: 'e', peran: PeranPengguna.EVALUATOR },
      '00000000-0000-4000-8000-000000000001',
      [{ detailSopId, statusDetail: StatusSOP.MENUNGGU_PENGAJUAN_EVALUASI }],
    );
    expect(tx.pengajuanEvaluasi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_OPD,
          status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
          tanggalEvaluasi: expect.any(Date),
          nilaiEvaluasi: {
            create: [{ detailSopId }],
          },
        }),
      }),
    );
    expect(tx.detailSOP.updateMany).toHaveBeenCalled();
  });

  // --- COMPREHENSIVE TESTS (FALSE, WORST, EDGE CASES) ---

  describe('findOne (Tambahan Kasus)', () => {
    it('seharusnya melempar NotFoundException jika pengajuanEvaluasiId tidak ditemukan (False Case)', async () => {
      const repo = {
        findByIdFull: jest.fn().mockResolvedValue(null),
      } as unknown as PengajuanEvaluasiRepository;
      const service = buildService(repo);
      await expect(
        service.findOne({ sub: 'u', email: 'e', peran: PeranPengguna.PJ_PENYUSUN }, 'invalid'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('seharusnya melempar ForbiddenException jika mencoba mengakses pengajuan dari OPD lain (False Case)', async () => {
      const row = { opdId: 'opd-lain' } as PengajuanEvaluasiDetailRow;
      const repo = {
        findByIdFull: jest.fn().mockResolvedValue(row),
      } as unknown as PengajuanEvaluasiRepository;
      const assertSameOpd = jest
        .fn()
        .mockRejectedValue(
          new ForbiddenException('Anda tidak dapat mengakses pengajuan evaluasi OPD lain'),
        );
      const service = buildService(repo, { assertSameOpd });
      await expect(
        service.findOne({ sub: 'u', email: 'e', peran: PeranPengguna.PENYUSUN }, 'p1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('seharusnya mengembalikan data ringkas jika ditemukan dan terotorisasi (Success Case)', async () => {
      const now = new Date();
      const row = {
        pengajuanEvaluasiId: 'p1',
        opdId: 'opd-a',
        jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_EVALUATOR,
        status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
        createdAt: now,
        updatedAt: now,
        opd: { opdId: 'opd-a', nama: 'OPD A' },
        nilaiEvaluasi: [],
        logNilaiEvaluasi: [],
        dokumenTte: [],
      } as unknown as PengajuanEvaluasiDetailRow;
      const repo = {
        findByIdFull: jest.fn().mockResolvedValue(row),
      } as unknown as PengajuanEvaluasiRepository;
      const assertSameOpd = jest.fn().mockResolvedValue(undefined);
      const service = buildService(repo, { assertSameOpd });
      const result = await service.findOne(
        { sub: 'u', email: 'e', peran: PeranPengguna.PENYUSUN },
        'p1',
      );
      expect(result.id).toBe('p1');
    });
  });

  describe('create (Tambahan Kasus)', () => {
    it('seharusnya melempar BadRequestException jika sopDetailIds mengandung duplikasi (Worst/Edge Case)', async () => {
      const repo = {} as unknown as PengajuanEvaluasiRepository;
      const getRequiredUserOpdId = jest.fn().mockResolvedValue('opd-a');
      const service = buildService(repo, { getRequiredUserOpdId });
      await expect(
        service.create(userPjPenyusun, {
          jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_EVALUATOR,
          sopDetailIds: ['id1', 'id1'],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('seharusnya melempar ConflictException jika data langsung hilang sesaat sesudah transaksi dibuat (False Case)', async () => {
      const tx = {
        pengajuanEvaluasi: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ pengajuanEvaluasiId: 'p1' }),
        },
        detailSOP: {
          findMany: jest
            .fn()
            .mockResolvedValue([
              { detailSopId: 'id1', status: StatusSOP.MENUNGGU_PENGAJUAN_EVALUASI },
            ]),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };
      const runTransaction = jest.fn(async (cb: (t: typeof tx) => Promise<string>) => cb(tx));
      const repo = {
        runTransaction,
        findByIdFull: jest.fn().mockResolvedValue(null),
      } as unknown as PengajuanEvaluasiRepository;
      const getRequiredUserOpdId = jest.fn().mockResolvedValue('opd-a');
      const service = buildService(repo, { getRequiredUserOpdId });
      await expect(
        service.create(userPjPenyusun, {
          jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_EVALUATOR,
          sopDetailIds: ['id1'],
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('pastikanPengajuanRequestOpdUntukEvaluator (Tambahan Kasus)', () => {
    it('seharusnya no-op tanpa transaksi jika pipeline valid namun detail tidak ada yang siap evaluasi (Edge Case)', async () => {
      const runTransaction = jest.fn();
      const repo = { runTransaction } as unknown as PengajuanEvaluasiRepository;
      const service = buildService(repo);
      await service.pastikanPengajuanRequestOpdUntukEvaluator(
        { sub: 'eval', email: 'e', peran: PeranPengguna.EVALUATOR },
        'opd-a',
        [{ detailSopId: 'id1', statusDetail: StatusSOP.DRAFT }],
      );
      expect(runTransaction).not.toHaveBeenCalled();
    });

    it('seharusnya melempar ConflictException jika baris diupdate tidak cocok (promoted.count !== sopDetailIds.length) di transaksi (False Case)', async () => {
      const tx = {
        pengajuanEvaluasi: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ pengajuanEvaluasiId: 'p1' }),
        },
        detailSOP: {
          findMany: jest
            .fn()
            .mockResolvedValue([
              { detailSopId: 'id1', status: StatusSOP.MENUNGGU_PENGAJUAN_EVALUASI },
            ]),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }), // mismatch
        },
      };
      const runTransaction = jest.fn(async (cb: (t: typeof tx) => Promise<void>) => cb(tx));
      const repo = { runTransaction } as unknown as PengajuanEvaluasiRepository;
      const service = buildService(repo);
      await expect(
        service.pastikanPengajuanRequestOpdUntukEvaluator(
          { sub: 'eval', email: 'e', peran: PeranPengguna.EVALUATOR },
          'opd-a',
          [{ detailSopId: 'id1', statusDetail: StatusSOP.MENUNGGU_PENGAJUAN_EVALUASI }],
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('Otorisasi Akses: resolveOpdIdTerikat & assertUserCanAccessPengajuan (Tambahan Kasus)', () => {
    it('resolveOpdIdTerikat seharusnya melempar ForbiddenException jika user adalah EVALUATOR (karena global) (False Case)', async () => {
      const repo = {} as unknown as PengajuanEvaluasiRepository;
      const service = buildService(repo);
      await expect(
        service.resolveOpdIdTerikat({ sub: 'eval', email: 'e', peran: PeranPengguna.EVALUATOR }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('resolveOpdIdTerikat seharusnya mengembalikan opdId untuk PJ_PENYUSUN (Success Case)', async () => {
      const repo = {} as unknown as PengajuanEvaluasiRepository;
      const getRequiredUserOpdId = jest.fn().mockResolvedValue('opd-a');
      const service = buildService(repo, { getRequiredUserOpdId });
      const opdId = await service.resolveOpdIdTerikat(userPjPenyusun);
      expect(opdId).toBe('opd-a');
    });

    it('assertUserCanAccessPengajuan seharusnya me-resolve jika user adalah EVALUATOR tanpa cek OPD (Edge Case)', async () => {
      const repo = {} as unknown as PengajuanEvaluasiRepository;
      const assertSameOpd = jest.fn();
      const service = buildService(repo, { assertSameOpd });
      await expect(
        service.assertUserCanAccessPengajuan(
          { sub: 'eval', email: 'e', peran: PeranPengguna.EVALUATOR },
          'opd-a',
        ),
      ).resolves.toBeUndefined();
      expect(assertSameOpd).not.toHaveBeenCalled();
    });

    it('assertUserCanAccessPengajuan seharusnya melempar ForbiddenException untuk role yang tidak dikenal (False Case)', async () => {
      const repo = {} as unknown as PengajuanEvaluasiRepository;
      const service = buildService(repo);
      await expect(
        service.assertUserCanAccessPengajuan(
          { sub: 'admin', email: 'a', peran: 'ADMIN' as PeranPengguna },
          'opd-a',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
