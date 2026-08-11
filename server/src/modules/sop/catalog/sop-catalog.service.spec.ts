import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserOpdAccessService } from '../../core/opd/user-opd-access.service';
import { EvaluasiNilaiService } from '../../evaluation/nilai/evaluasi-nilai.service';
import { Test, TestingModule } from '@nestjs/testing';
import {
  JenisLangkahProsedur,
  PeranPengguna,
  Prisma,
  SatuanWaktu,
  StatusSOP,
} from '../../../generated/prisma';
import type { JwtAccessPayload } from '../../../common';
import type { CreateSopDto } from './dto/create-sop.dto';
import type { ListSopQueryDto } from './dto/list-sop-query.dto';
import type { UpdateDetailSopStatusDto } from './dto/update-detail-sop-status.dto';
import type { UpdateSopHeaderDto } from './dto/update-sop-header.dto';
import { encodeLogEditSopClientId } from '../collaboration/log-edit-session.helper';
import {
  SopCatalogRepository,
  type SopDaftarDbRow,
  type SopWorkbenchDbPayload,
} from './sop-catalog.repository';
import { SopCatalogService } from './sop-catalog.service';

describe('Pengujian SopCatalogService', () => {
  let service: SopCatalogService;
  const repoMock: jest.Mocked<
    Pick<
      SopCatalogRepository,
      | 'findOpdIdByPenggunaId'
      | 'findDaftarByOpdId'
      | 'findDaftarAll'
      | 'findOpdNama'
      | 'createSopWithInitialDetail'
      | 'findWorkbenchPayloadByDetailOrSopId'
      | 'findDetailIdByDetailOrSopId'
      | 'findLatestDetailStatusContext'
      | 'updateDetailSopStatus'
      | 'transitionDetailSopRevisiToSedangDievaluasi'
      | 'updateSopHeaderTransaction'
      | 'cloneDetailSopFromSource'
      | 'findRiwayatVersiBySopId'
      | 'deleteVersiDraft'
      | 'deleteSopDraftAwal'
    >
  > = {
    findOpdIdByPenggunaId: jest.fn(),
    findDaftarByOpdId: jest.fn(),
    findDaftarAll: jest.fn(),
    findOpdNama: jest.fn(),
    createSopWithInitialDetail: jest.fn(),
    findWorkbenchPayloadByDetailOrSopId: jest.fn(),
    findDetailIdByDetailOrSopId: jest.fn(),
    findLatestDetailStatusContext: jest.fn(),
    updateDetailSopStatus: jest.fn(),
    transitionDetailSopRevisiToSedangDievaluasi: jest.fn(),
    updateSopHeaderTransaction: jest.fn(),
    cloneDetailSopFromSource: jest.fn(),
    findRiwayatVersiBySopId: jest.fn(),
    deleteVersiDraft: jest.fn(),
    deleteSopDraftAwal: jest.fn(),
  };
  const evaluasiNilaiServiceMock = {
    assertBolehKirimUlangSetelahRevisi: jest.fn().mockResolvedValue(undefined),
  };
  const userOpdAccessMock = {
    isEvaluatorRole: jest.fn(
      (role: PeranPengguna) =>
        role === PeranPengguna.EVALUATOR || role === PeranPengguna.PJ_EVALUATOR,
    ),
    getRequiredUserOpdId: jest.fn().mockResolvedValue('opd-1'),
    assertWorkbenchAccess: jest.fn().mockResolvedValue(undefined),
  };
  const user: JwtAccessPayload = {
    sub: 'pengguna-1',
    email: 'a@b.c',
    peran: PeranPengguna.PENYUSUN,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    evaluasiNilaiServiceMock.assertBolehKirimUlangSetelahRevisi.mockResolvedValue(undefined);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SopCatalogService,
        { provide: SopCatalogRepository, useValue: repoMock as unknown as SopCatalogRepository },
        { provide: UserOpdAccessService, useValue: userOpdAccessMock },
        { provide: EvaluasiNilaiService, useValue: evaluasiNilaiServiceMock },
      ],
    }).compile();
    service = module.get(SopCatalogService);
    userOpdAccessMock.getRequiredUserOpdId.mockResolvedValue('opd-1');
    userOpdAccessMock.assertWorkbenchAccess.mockResolvedValue(undefined);
  });

  it('seharusnya melempar ForbiddenException ketika pengguna tidak memiliki OPD', async () => {
    userOpdAccessMock.getRequiredUserOpdId.mockRejectedValueOnce(
      new ForbiddenException('Pengguna tidak terikat OPD'),
    );
    await expect(service.listForCurrentUser(user)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repoMock.findDaftarByOpdId).not.toHaveBeenCalled();
  });

  it('seharusnya memetakan terbaru detail dan terakhir diedit', async () => {
    const t = new Date('2026-01-15T10:00:00.000Z');
    const row: SopDaftarDbRow = {
      sopId: 'sop-1',
      opdId: 'opd-1',
      judul: 'Judul A',
      detail: {
        detailSopId: 'det-1',
        nomorSOP: '001/2026',
        status: 'DRAFT',
        versi: 1,
        updatedAt: t,
        pembuatNama: 'Budi',
        editorNama: 'Ani',
        peraturanId: 'per-1',
      },
      versiBerlaku: null,
      allStatuses: [StatusSOP.DRAFT],
    };
    repoMock.findDaftarByOpdId.mockResolvedValue([row]);
    const actual = await service.listForCurrentUser(user);
    expect(repoMock.findDaftarByOpdId).toHaveBeenCalledWith('opd-1', {});
    expect(actual).toHaveLength(1);
    expect(actual[0]).toMatchObject({
      id: 'sop-1',
      opdId: 'opd-1',
      detailSopId: 'det-1',
      judul: 'Judul A',
      nomorSop: '001/2026',
      pembuat: 'Budi',
      terakhirDiedit: { nama: 'Ani', waktu: t.toISOString() },
      status: 'DRAFT',
      peraturanId: 'per-1',
      terakhirDiperbarui: t.toISOString(),
    });
  });

  it('seharusnya memetakan baris tanpa detail', async () => {
    const row: SopDaftarDbRow = {
      sopId: 'sop-2',
      opdId: 'opd-1',
      judul: 'Tanpa detail',
      detail: undefined,
      versiBerlaku: null,
      allStatuses: [],
    };
    repoMock.findDaftarByOpdId.mockResolvedValue([row]);
    const actual = await service.listForCurrentUser(user);
    expect(repoMock.findDaftarByOpdId).toHaveBeenCalledWith('opd-1', {});
    expect(actual[0]).toMatchObject({
      id: 'sop-2',
      opdId: 'opd-1',
      detailSopId: null,
      judul: 'Tanpa detail',
      nomorSop: null,
      pembuat: null,
      terakhirDiedit: { nama: null, waktu: null },
      status: 'DRAFT',
      peraturanId: null,
      terakhirDiperbarui: null,
    });
  });

  it('seharusnya mengatur canCabutSop ketika SOP berlaku tanpa revisi berjalan', async () => {
    const t = new Date('2026-01-15T10:00:00.000Z');
    const row: SopDaftarDbRow = {
      sopId: 'sop-berlaku',
      opdId: 'opd-1',
      judul: 'SOP Berlaku',
      detail: {
        detailSopId: 'det-berlaku',
        nomorSOP: '001/2026',
        status: StatusSOP.BERLAKU,
        versi: 1,
        updatedAt: t,
        pembuatNama: 'Budi',
        editorNama: 'Budi',
        peraturanId: 'per-1',
      },
      versiBerlaku: {
        detailSopId: 'det-berlaku',
        nomorSOP: '001/2026',
        status: StatusSOP.BERLAKU,
        versi: 1,
        updatedAt: t,
        pembuatNama: 'Budi',
        editorNama: 'Budi',
        peraturanId: 'per-1',
      },
      allStatuses: [StatusSOP.BERLAKU],
    };
    repoMock.findDaftarByOpdId.mockResolvedValue([row]);
    const actual = await service.listForCurrentUser(user);
    expect(actual[0]?.canCabutSop).toBe(true);
    expect(actual[0]?.canBuatVersiBaru).toBe(true);
  });

  it('seharusnya mengosongkan canCabutSop ketika revisi sedang berjalan', async () => {
    const t = new Date('2026-01-15T10:00:00.000Z');
    const row: SopDaftarDbRow = {
      sopId: 'sop-revisi',
      opdId: 'opd-1',
      judul: 'SOP Revisi',
      detail: {
        detailSopId: 'det-draft',
        nomorSOP: '002/2026',
        status: StatusSOP.DRAFT,
        versi: 2,
        updatedAt: t,
        pembuatNama: 'Budi',
        editorNama: 'Budi',
        peraturanId: 'per-1',
      },
      versiBerlaku: {
        detailSopId: 'det-berlaku',
        nomorSOP: '001/2026',
        status: StatusSOP.BERLAKU,
        versi: 1,
        updatedAt: t,
        pembuatNama: 'Budi',
        editorNama: 'Budi',
        peraturanId: 'per-1',
      },
      allStatuses: [StatusSOP.DRAFT, StatusSOP.BERLAKU],
    };
    repoMock.findDaftarByOpdId.mockResolvedValue([row]);
    const actual = await service.listForCurrentUser(user);
    expect(actual[0]?.canCabutSop).toBe(false);
    expect(actual[0]?.canBuatVersiBaru).toBe(false);
  });

  it('seharusnya menggunakan findDaftarSemua untuk evaluator', async () => {
    const evaluatorUser: JwtAccessPayload = {
      sub: 'ev-1',
      email: 'ev@b.c',
      peran: PeranPengguna.EVALUATOR,
    };
    repoMock.findDaftarAll.mockResolvedValue([]);
    await service.listForCurrentUser(evaluatorUser);
    expect(repoMock.findDaftarAll).toHaveBeenCalledWith({});
    expect(userOpdAccessMock.getRequiredUserOpdId).not.toHaveBeenCalled();
  });

  it('seharusnya meneruskan filter ke repository ketika pengguna adalah penyusun', async () => {
    const query = {
      status: 'DRAFT',
      tanggalDari: '2026-01-01',
      tanggalSampai: '2026-01-31',
    } as ListSopQueryDto;
    repoMock.findDaftarByOpdId.mockResolvedValue([]);
    await service.listForCurrentUser(user, query);
    expect(repoMock.findDaftarByOpdId).toHaveBeenCalledWith('opd-1', {
      status: 'DRAFT',
      tanggalDari: '2026-01-01',
      tanggalSampai: '2026-01-31',
    });
  });

  it('seharusnya menggunakan findDaftarSemua dengan filter ketika pengguna adalah evaluator', async () => {
    const evaluatorUser: JwtAccessPayload = {
      sub: 'ev-2',
      email: 'ev2@b.c',
      peran: PeranPengguna.EVALUATOR,
    };
    const query = {
      status: 'MENUNGGU_PENGAJUAN_EVALUASI',
      tanggalDari: '2026-02-01',
    } as ListSopQueryDto;
    repoMock.findDaftarAll.mockResolvedValue([]);
    await service.listForCurrentUser(evaluatorUser, query);
    expect(repoMock.findDaftarAll).toHaveBeenCalledWith({
      status: 'MENUNGGU_PENGAJUAN_EVALUASI',
      tanggalDari: '2026-02-01',
      tanggalSampai: undefined,
    });
  });

  it('seharusnya melempar BadRequestException ketika tanggal awal setelah tanggal akhir', async () => {
    const query = { tanggalDari: '2026-02-10', tanggalSampai: '2026-02-01' } as ListSopQueryDto;
    await expect(service.listForCurrentUser(user, query)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repoMock.findDaftarByOpdId).not.toHaveBeenCalled();
  });

  it('seharusnya memperlakukan status semua sebagai tanpa filter status', async () => {
    const query = { status: 'all', tanggalSampai: '2026-06-30' } as ListSopQueryDto;
    repoMock.findDaftarByOpdId.mockResolvedValue([]);
    await service.listForCurrentUser(user, query);
    expect(repoMock.findDaftarByOpdId).toHaveBeenCalledWith('opd-1', {
      status: undefined,
      tanggalDari: undefined,
      tanggalSampai: '2026-06-30',
    });
  });

  it('seharusnya membuat SOP dengan nama lembaga kosong ketika DTO tidak mengirim field tersebut', async () => {
    const t = new Date('2026-02-01T12:00:00.000Z');
    const dbRow: SopDaftarDbRow = {
      sopId: 'sop-new',
      opdId: 'opd-1',
      judul: 'Judul Baru',
      detail: {
        detailSopId: 'det-new',
        nomorSOP: 'N-1',
        status: 'DRAFT',
        versi: 1,
        updatedAt: t,
        pembuatNama: 'Budi',
        editorNama: null,
        peraturanId: null,
      },
      versiBerlaku: null,
      allStatuses: [StatusSOP.DRAFT],
    };
    repoMock.createSopWithInitialDetail.mockResolvedValue(dbRow);
    const dto: CreateSopDto = { judul: 'Judul Baru', nomorSop: 'N-1' };
    const actual = await service.createForPenyusun(user, dto);
    expect(repoMock.findOpdNama).not.toHaveBeenCalled();
    expect(repoMock.createSopWithInitialDetail).toHaveBeenCalledWith({
      judul: 'Judul Baru',
      nomorSOP: 'N-1',
      opdId: 'opd-1',
      penggunaId: 'pengguna-1',
      namaLembaga: '',
    });
    expect(actual).toMatchObject({
      id: 'sop-new',
      detailSopId: 'det-new',
      judul: 'Judul Baru',
      nomorSop: 'N-1',
      pembuat: 'Budi',
      status: 'DRAFT',
    });
  });

  it('seharusnya menyimpan nama lembaga kosong ketika DTO tidak mengirim field meskipun nama OPD tidak dikenal', async () => {
    const t = new Date('2026-02-01T12:00:00.000Z');
    const dbRow: SopDaftarDbRow = {
      sopId: 'sop-new',
      opdId: 'opd-1',
      judul: 'Hanya Judul',
      detail: {
        detailSopId: 'det-new',
        nomorSOP: 'N-2',
        status: 'DRAFT',
        versi: 1,
        updatedAt: t,
        pembuatNama: 'Budi',
        editorNama: null,
        peraturanId: null,
      },
      versiBerlaku: null,
      allStatuses: [StatusSOP.DRAFT],
    };
    repoMock.createSopWithInitialDetail.mockResolvedValue(dbRow);
    const dto: CreateSopDto = { judul: 'Hanya Judul', nomorSop: 'N-2' };
    await service.createForPenyusun(user, dto);
    expect(repoMock.findOpdNama).not.toHaveBeenCalled();
    expect(repoMock.createSopWithInitialDetail).toHaveBeenCalledWith(
      expect.objectContaining({ namaLembaga: '' }),
    );
  });

  it('seharusnya menyimpan nama lembaga yang sudah di-trim ketika DTO mengirim nilai', async () => {
    const t = new Date('2026-02-01T12:00:00.000Z');
    const dbRow: SopDaftarDbRow = {
      sopId: 'sop-new',
      opdId: 'opd-1',
      judul: 'J',
      detail: {
        detailSopId: 'det-new',
        nomorSOP: 'N-3',
        status: 'DRAFT',
        versi: 1,
        updatedAt: t,
        pembuatNama: 'Budi',
        editorNama: null,
        peraturanId: null,
      },
      versiBerlaku: null,
      allStatuses: [StatusSOP.DRAFT],
    };
    repoMock.createSopWithInitialDetail.mockResolvedValue(dbRow);
    const dto: CreateSopDto = {
      judul: 'J',
      nomorSop: 'N-3',
      namaLembaga: '  PEMERINTAH\nKABUPATEN X  ',
    };
    await service.createForPenyusun(user, dto);
    expect(repoMock.createSopWithInitialDetail).toHaveBeenCalledWith(
      expect.objectContaining({ namaLembaga: 'PEMERINTAH\nKABUPATEN X' }),
    );
  });

  it('seharusnya melempar ForbiddenException ketika membuat SOP tanpa OPD', async () => {
    userOpdAccessMock.getRequiredUserOpdId.mockRejectedValueOnce(
      new ForbiddenException('Pengguna tidak terikat OPD'),
    );
    const dto: CreateSopDto = { judul: 'X', nomorSop: 'Y' };
    await expect(service.createForPenyusun(user, dto)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repoMock.createSopWithInitialDetail).not.toHaveBeenCalled();
  });

  it('seharusnya memetakan P2002 menjadi ConflictException', async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: 'test',
    });
    repoMock.createSopWithInitialDetail.mockRejectedValue(p2002);
    const dto: CreateSopDto = { judul: 'Judul', nomorSop: 'dup' };
    await expect(service.createForPenyusun(user, dto)).rejects.toBeInstanceOf(ConflictException);
  });

  it('seharusnya melempar NotFoundException ketika workbench detail tidak ditemukan', async () => {
    repoMock.findWorkbenchPayloadByDetailOrSopId.mockResolvedValue(null);
    await expect(
      service.getPenyusunWorkbench(user, '00000000-0000-4000-8000-000000000001'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('seharusnya melempar ForbiddenException ketika OPD workbench tidak cocok', async () => {
    const t = new Date('2026-03-01T08:00:00.000Z');
    const payload = {
      detailSopId: 'det-wb',
      sopId: 'sop-wb',
      status: 'DRAFT',
      versi: 1,
      nomorSOP: 'WB/1',
      tanggalPembuatan: t,
      tanggalRevisi: null,
      tanggalEfektif: null,
      namaLembaga: 'Lembaga',
      dibuatOlehId: 'p1',
      terakhirDieditOlehId: null,
      createdAt: t,
      updatedAt: t,
      sop: {
        sopId: 'sop-wb',
        opdId: 'opd-lain',
        judul: 'Judul WB',
        createdAt: t,
        updatedAt: t,
        opd: {
          opdId: 'opd-lain',
          nama: 'OPD Lain',
          pengguna: [],
        },
      },
      dibuatOleh: { penggunaId: 'p1', nama: 'Budi' },
      terakhirDieditOleh: null,
      lampiranPeringatan: [],
      lampiranKualifikasiPelaksanaan: [],
      lampiranPeralatanPerlengkapan: [],
      lampiranPencatatanPendataan: [],
      dasarHukum: [],
      relasiSopKeluar: [],
      relasiSopMasuk: [],
      swimlanes: [],
      nilaiEvaluasi: [],
      langkahSOP: [],
      logEditSop: [],
    } as unknown as SopWorkbenchDbPayload;
    repoMock.findWorkbenchPayloadByDetailOrSopId.mockResolvedValue(payload);
    userOpdAccessMock.assertWorkbenchAccess.mockRejectedValueOnce(
      new ForbiddenException('Akses ditolak untuk DetailSOP ini'),
    );
    await expect(service.getPenyusunWorkbench(user, 'det-wb')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('seharusnya mengembalikan workbench ketika OPD penyusun cocok', async () => {
    const t = new Date('2026-03-02T09:00:00.000Z');
    const payload = {
      detailSopId: 'det-wb-2',
      sopId: 'sop-wb-2',
      status: 'DRAFT',
      versi: 1,
      nomorSOP: 'WB/2',
      tanggalPembuatan: t,
      tanggalRevisi: null,
      tanggalEfektif: null,
      namaLembaga: 'Lembaga 2',
      dibuatOlehId: 'p1',
      terakhirDieditOlehId: null,
      createdAt: t,
      updatedAt: t,
      sop: {
        sopId: 'sop-wb-2',
        opdId: 'opd-1',
        judul: 'Judul OK',
        createdAt: t,
        updatedAt: t,
        opd: {
          opdId: 'opd-1',
          nama: 'OPD Satu',
          pengguna: [{ nama: 'Dr. Kepala', nip: '198001012010011001' }],
        },
      },
      dibuatOleh: { penggunaId: 'p1', nama: 'Budi' },
      terakhirDieditOleh: null,
      lampiranPeringatan: [],
      lampiranKualifikasiPelaksanaan: [],
      lampiranPeralatanPerlengkapan: [],
      lampiranPencatatanPendataan: [],
      dasarHukum: [],
      relasiSopKeluar: [],
      relasiSopMasuk: [],
      swimlanes: [],
      nilaiEvaluasi: [],
      langkahSOP: [],
      logEditSop: [
        {
          detailSopId: 'det-wb-2',
          penggunaId: 'p1',
          createdAt: t,
          bagian: 'HEADER',
          keterangan: 'Header SOP: Peringatan',
          sesiChangeCount: 1,
          closedAt: null,
          updatedAt: t,
          domainFields: [{ domainField: 'peringatan' }],
          pengguna: {
            penggunaId: 'p1',
            nama: 'Budi',
            email: 'budi@x',
            peran: PeranPengguna.PENYUSUN,
          },
        },
      ],
    } as unknown as SopWorkbenchDbPayload;
    repoMock.findWorkbenchPayloadByDetailOrSopId.mockResolvedValue(payload);
    const actual = await service.getPenyusunWorkbench(user, 'det-wb-2', 50);
    expect(repoMock.findWorkbenchPayloadByDetailOrSopId).toHaveBeenCalledWith('det-wb-2', 50);
    expect(actual.detail.id).toBe('det-wb-2');
    expect(actual.detail.sop?.judul).toBe('Judul OK');
    expect(actual.detail.kepalaOpd).toEqual({ nama: 'Dr. Kepala', nip: '198001012010011001' });
    expect(actual.langkah).toHaveLength(0);
    expect(actual.logEdit).toHaveLength(1);
    expect(actual.logEdit[0]?.id).toBe(encodeLogEditSopClientId('det-wb-2', 'p1', t));
    expect(actual.logEdit[0]?.aktorRole).toBe(PeranPengguna.PENYUSUN);
  });

  describe('Pengujian memperbarui penyusun header', () => {
    const t = new Date('2026-04-01T08:00:00.000Z');
    const baseWorkbenchPayload = (
      override?: Partial<Record<string, unknown>>,
    ): SopWorkbenchDbPayload =>
      ({
        detailSopId: 'det-up',
        sopId: 'sop-up',
        status: 'DRAFT',
        versi: 1,
        nomorSOP: 'WB/UP',
        tanggalPembuatan: t,
        tanggalRevisi: null,
        tanggalEfektif: null,
        namaLembaga: 'Lembaga',
        dibuatOlehId: 'p1',
        terakhirDieditOlehId: null,
        createdAt: t,
        updatedAt: t,
        sop: {
          sopId: 'sop-up',
          opdId: 'opd-1',
          judul: 'Judul Lama',
          createdAt: t,
          updatedAt: t,
          opd: {
            opdId: 'opd-1',
            nama: 'OPD Satu',
            pengguna: [],
          },
        },
        dibuatOleh: { penggunaId: 'p1', nama: 'Budi' },
        terakhirDieditOleh: null,
        lampiranPeringatan: [],
        lampiranKualifikasiPelaksanaan: [],
        lampiranPeralatanPerlengkapan: [],
        lampiranPencatatanPendataan: [],
        dasarHukum: [],
        relasiSopKeluar: [],
        relasiSopMasuk: [],
        swimlanes: [],
        nilaiEvaluasi: [],
        langkahSOP: [],
        logEditSop: [],
        ...override,
      }) as unknown as SopWorkbenchDbPayload;

    beforeEach(() => {
      repoMock.findDetailIdByDetailOrSopId.mockResolvedValue({
        detailSopId: 'det-up',
        sopId: 'sop-up',
      });
      repoMock.findWorkbenchPayloadByDetailOrSopId.mockResolvedValue(baseWorkbenchPayload());
      repoMock.updateSopHeaderTransaction.mockResolvedValue({ ok: true, data: undefined });
    });

    it('seharusnya melempar NotFoundException ketika detail atau SOP id tidak dapat ditemukan', async () => {
      repoMock.findDetailIdByDetailOrSopId.mockResolvedValueOnce(null);
      const dto: UpdateSopHeaderDto = { judul: 'X' };
      await expect(service.updatePenyusunHeader(user, 'unknown', dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repoMock.updateSopHeaderTransaction).not.toHaveBeenCalled();
    });

    it('seharusnya melempar ConflictException ketika detail sudah berlaku', async () => {
      repoMock.findWorkbenchPayloadByDetailOrSopId.mockResolvedValueOnce(
        baseWorkbenchPayload({ status: StatusSOP.BERLAKU }),
      );
      const dto: UpdateSopHeaderDto = { judul: 'Baru' };
      await expect(service.updatePenyusunHeader(user, 'det-up', dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repoMock.updateSopHeaderTransaction).not.toHaveBeenCalled();
    });

    it('seharusnya melempar ForbiddenException ketika OPD tidak cocok', async () => {
      const payload = baseWorkbenchPayload({
        sop: {
          sopId: 'sop-up',
          opdId: 'opd-lain',
          judul: 'X',
          createdAt: t,
          updatedAt: t,
          opd: {
            opdId: 'opd-lain',
            nama: 'OPD Lain',
            pengguna: [],
          },
        },
      });
      repoMock.findWorkbenchPayloadByDetailOrSopId.mockResolvedValueOnce(payload);
      userOpdAccessMock.assertWorkbenchAccess.mockRejectedValueOnce(
        new ForbiddenException('Akses ditolak untuk DetailSOP ini'),
      );
      const dto: UpdateSopHeaderDto = { judul: 'Baru' };
      await expect(service.updatePenyusunHeader(user, 'det-up', dto)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(repoMock.updateSopHeaderTransaction).not.toHaveBeenCalled();
    });

    it('seharusnya memperbarui judul pada header SOP ketika judul dikirim', async () => {
      const dto: UpdateSopHeaderDto = { judul: 'Judul Baru' };
      await service.updatePenyusunHeader(user, 'det-up', dto);
      expect(repoMock.updateSopHeaderTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          detailSopId: 'det-up',
          sopId: 'sop-up',
          userId: 'pengguna-1',
          input: expect.objectContaining({ judul: 'Judul Baru' }),
          changedFields: ['judul'],
        }),
      );
    });

    it('seharusnya mengembalikan workbench dengan log edit setelah patch header', async () => {
      const logTime = new Date('2026-04-01T09:00:00.000Z');
      repoMock.findWorkbenchPayloadByDetailOrSopId
        .mockResolvedValueOnce(baseWorkbenchPayload())
        .mockResolvedValueOnce(
          baseWorkbenchPayload({
            logEditSop: [
              {
                detailSopId: 'det-up',
                penggunaId: 'p1',
                createdAt: logTime,
                bagian: 'HEADER',
                keterangan: 'Header SOP: Judul SOP',
                sesiChangeCount: 1,
                closedAt: null,
                updatedAt: logTime,
                domainFields: [{ domainField: 'judul' }],
                pengguna: {
                  penggunaId: 'p1',
                  nama: 'Budi',
                  email: 'budi@x',
                  peran: PeranPengguna.PENYUSUN,
                },
              },
            ],
          }),
        );
      const dto: UpdateSopHeaderDto = { judul: 'Judul Baru' };
      const actual = await service.updatePenyusunHeader(user, 'det-up', dto);
      expect(actual.logEdit.length).toBeGreaterThan(0);
      expect(actual.logEdit[0]?.meta?.fields).toContain('judul');
    });

    it('seharusnya memperbarui nomor dan nama lembaga pada detail ketika dikirim', async () => {
      const dto: UpdateSopHeaderDto = {
        nomorSOP: '042/2026',
        namaLembaga: 'PEMERINTAH\nKOTA Y',
      };
      await service.updatePenyusunHeader(user, 'det-up', dto);
      expect(repoMock.updateSopHeaderTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            nomorSOP: '042/2026',
            namaLembaga: 'PEMERINTAH\nKOTA Y',
          }),
        }),
      );
    });

    it('seharusnya mengganti dasar hukum ketika daftar ID dikirim', async () => {
      const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
      const dto: UpdateSopHeaderDto = { dasarHukumPeraturanIds: ids };
      await service.updatePenyusunHeader(user, 'det-up', dto);
      expect(repoMock.updateSopHeaderTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({ dasarHukumPeraturanIds: ids }),
        }),
      );
    });

    it('seharusnya mengganti SOP terkait ketika daftar ID dikirim', async () => {
      const ids = ['33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444'];
      const dto: UpdateSopHeaderDto = { sopTerkaitDetailIds: ids };
      await service.updatePenyusunHeader(user, 'det-up', dto);
      expect(repoMock.updateSopHeaderTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({ sopTerkaitDetailIds: ids }),
        }),
      );
    });

    it('seharusnya mengganti lampiran per jenis ketika array dikirim', async () => {
      const dto: UpdateSopHeaderDto = {
        lampiran: {
          peringatan: ['Hati-hati saat verifikasi'],
          kualifikasiPelaksanaan: ['S1 Hukum', 'Sertifikat A'],
          peralatanPerlengkapan: ['Komputer', 'Printer'],
          pencatatanPendataan: ['Buku register'],
        },
      };
      await service.updatePenyusunHeader(user, 'det-up', dto);
      expect(repoMock.updateSopHeaderTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            lampiran: {
              peringatan: ['Hati-hati saat verifikasi'],
              kualifikasiPelaksanaan: ['S1 Hukum', 'Sertifikat A'],
              peralatanPerlengkapan: ['Komputer', 'Printer'],
              pencatatanPendataan: ['Buku register'],
            },
          }),
          changedFields: expect.arrayContaining([
            'peringatan',
            'kualifikasiPelaksanaan',
            'peralatanPerlengkapan',
            'pencatatanPendataan',
          ]),
        }),
      );
    });

    it('seharusnya melempar ConflictException ketika nomor SOP duplikat', async () => {
      const p2002 = new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      });
      repoMock.updateSopHeaderTransaction.mockRejectedValueOnce(p2002);
      const dto: UpdateSopHeaderDto = { nomorSOP: 'dup' };
      await expect(service.updatePenyusunHeader(user, 'det-up', dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('seharusnya melempar BadRequestException ketika invariant DB SOP terkait gagal', async () => {
      const driverError = {
        name: 'DriverAdapterError',
        cause: {
          message:
            'Relasi SOP terkait sudah ada arah terbalik; hapus pasangan yang ada terlebih dahulu',
          state: '45000',
          code: 1644,
        },
      };
      repoMock.updateSopHeaderTransaction.mockRejectedValueOnce(driverError);
      const dto: UpdateSopHeaderDto = { sopTerkaitDetailIds: ['det-other'] };
      await expect(service.updatePenyusunHeader(user, 'det-up', dto)).rejects.toMatchObject({
        response: {
          message:
            'Relasi SOP terkait sudah ada arah terbalik; hapus pasangan yang ada terlebih dahulu',
        },
      });
    });

    it('seharusnya melewati repository ketika DTO tidak memiliki field', async () => {
      const dto: UpdateSopHeaderDto = {};
      await service.updatePenyusunHeader(user, 'det-up', dto);
      expect(repoMock.updateSopHeaderTransaction).not.toHaveBeenCalled();
      expect(repoMock.findWorkbenchPayloadByDetailOrSopId).toHaveBeenCalled();
    });

    it('seharusnya mengembalikan workbench dengan lampiran terkelompok setelah pembaruan', async () => {
      const refreshedPayload = baseWorkbenchPayload({
        lampiranPeringatan: [
          {
            lampiranPeringatanId: 'l1',
            detailSopId: 'det-up',
            teks: 'Awas!',
            createdAt: t,
            updatedAt: t,
          },
        ],
        lampiranKualifikasiPelaksanaan: [
          {
            lampiranKualifikasiPelaksanaanId: 'l2',
            detailSopId: 'det-up',
            teks: 'S1 Hukum',
            createdAt: t,
            updatedAt: t,
          },
          {
            lampiranKualifikasiPelaksanaanId: 'l3',
            detailSopId: 'det-up',
            teks: 'Sertifikat A',
            createdAt: new Date(t.getTime() + 1000),
            updatedAt: new Date(t.getTime() + 1000),
          },
        ],
      });
      repoMock.findWorkbenchPayloadByDetailOrSopId
        .mockResolvedValueOnce(baseWorkbenchPayload())
        .mockResolvedValueOnce(refreshedPayload);
      const dto: UpdateSopHeaderDto = { lampiran: { peringatan: ['Awas!'] } };
      const actual = await service.updatePenyusunHeader(user, 'det-up', dto);
      expect(actual.detail.lampiran?.peringatan.map((i) => i.teks)).toEqual(['Awas!']);
      expect(actual.detail.lampiran?.kualifikasiPelaksanaan.map((i) => i.teks)).toEqual([
        'S1 Hukum',
        'Sertifikat A',
      ]);
      expect(actual.detail.lampiran?.peralatanPerlengkapan.map((i) => i.teks)).toEqual([]);
      expect(actual.detail.lampiran?.pencatatanPendataan.map((i) => i.teks)).toEqual([]);
    });
  });

  describe('Pengujian transisi status detail SOP', () => {
    const t = new Date('2026-05-01T08:00:00.000Z');
    function stubWorkbenchPayload(status: string): SopWorkbenchDbPayload {
      return {
        detailSopId: 'det-st',
        sopId: 'sop-st',
        status,
        versi: 1,
        nomorSOP: 'ST/1',
        tanggalPembuatan: t,
        tanggalRevisi: null,
        tanggalEfektif: null,
        namaLembaga: 'Lembaga',
        dibuatOlehId: 'p1',
        terakhirDieditOlehId: null,
        createdAt: t,
        updatedAt: t,
        sop: {
          sopId: 'sop-st',
          opdId: 'opd-1',
          judul: 'Judul ST',
          createdAt: t,
          updatedAt: t,
          opd: {
            opdId: 'opd-1',
            nama: 'OPD Satu',
            pengguna: [],
          },
        },
        dibuatOleh: { penggunaId: 'p1', nama: 'Budi' },
        terakhirDieditOleh: null,
        lampiranPeringatan: [],
        lampiranKualifikasiPelaksanaan: [],
        lampiranPeralatanPerlengkapan: [],
        lampiranPencatatanPendataan: [],
        dasarHukum: [],
        relasiSopKeluar: [],
        relasiSopMasuk: [],
        swimlanes: [],
        nilaiEvaluasi: [],
        langkahSOP: [],
        logEditSop: [],
      } as unknown as SopWorkbenchDbPayload;
    }

    function stubWorkbenchSiapLengkap(status: string): SopWorkbenchDbPayload {
      const pelaksanaId = 'pel-1';
      const langkahId = 'langkah-1';
      const base = stubWorkbenchPayload(status);
      return {
        ...base,
        lampiranPeringatan: [
          {
            detailSopId: 'det-st',
            lampiranPeringatanId: 'lt-per',
            teks: 'Perhatikan prosedur',
            createdAt: t,
            updatedAt: t,
          },
        ],
        lampiranKualifikasiPelaksanaan: [
          {
            detailSopId: 'det-st',
            lampiranKualifikasiPelaksanaanId: 'lt-kua',
            teks: 'Kualifikasi A',
            createdAt: t,
            updatedAt: t,
          },
        ],
        lampiranPeralatanPerlengkapan: [
          {
            detailSopId: 'det-st',
            lampiranPeralatanPerlengkapanId: 'lt-alat',
            teks: 'Alat B',
            createdAt: t,
            updatedAt: t,
          },
        ],
        lampiranPencatatanPendataan: [
          {
            detailSopId: 'det-st',
            lampiranPencatatanPendataanId: 'lt-cat',
            teks: 'Catatan C',
            createdAt: t,
            updatedAt: t,
          },
        ],
        dasarHukum: [
          {
            detailSopId: 'det-st',
            peraturanId: 'per-1',
            createdAt: t,
            updatedAt: t,
            peraturan: {
              peraturanId: 'per-1',
              nama: 'PP',
              nomor: '1',
              tahun: 2024,
              tentang: 'Peraturan contoh',
              createdAt: t,
              updatedAt: t,
            },
          },
        ],
        relasiSopKeluar: [
          {
            detailSopId: 'det-st',
            detailSopTerkaitId: 'det-lain',
            createdAt: t,
            updatedAt: t,
            sopTerkait: {
              detailSopId: 'det-lain',
              sopId: 'sop-lain',
              nomorSOP: '99/2026',
              sop: { sopId: 'sop-lain', judul: 'SOP lain' },
            },
          },
        ],
        swimlanes: [
          {
            detailSopId: 'det-st',
            pelaksanaId,
            urutan: 0,
            createdAt: t,
            updatedAt: t,
            pelaksana: {
              pelaksanaId,
              opdId: 'opd-1',
              nama: 'Pelaksana',
              createdAt: t,
              updatedAt: t,
            },
          },
        ],
        langkahSOP: [
          {
            langkahSopId: langkahId,
            detailSopId: 'det-st',
            urutan: 1,
            kegiatan: 'Isi formulir',
            jenis: JenisLangkahProsedur.KEGIATAN,
            kelengkapan: 'Form',
            keluaran: 'Draft',
            waktu: 1,
            satuanWaktu: SatuanWaktu.h,
            keterangan: 'Keterangan langkah',
            pelaksanaId,
            langkahSelanjutnyaYaId: null,
            langkahSelanjutnyaTidakId: null,
            createdAt: t,
            updatedAt: t,
            pelaksana: {
              pelaksanaId,
              opdId: 'opd-1',
              nama: 'Pelaksana',
              createdAt: t,
              updatedAt: t,
            },
          },
        ],
      } as unknown as SopWorkbenchDbPayload;
    }

    beforeEach(() => {
      repoMock.updateDetailSopStatus.mockResolvedValue(undefined);
    });

    it('seharusnya melempar NotFoundException ketika detail tidak ditemukan', async () => {
      repoMock.findLatestDetailStatusContext.mockResolvedValueOnce(null);
      const dto: UpdateDetailSopStatusDto = { status: StatusSOP.MENUNGGU_PENGAJUAN_EVALUASI };
      await expect(
        service.transitionDetailSopStatus(user, 'unknown-id', dto),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repoMock.updateDetailSopStatus).not.toHaveBeenCalled();
    });

    it('seharusnya melempar ConflictException ketika target sama dengan status saat ini', async () => {
      repoMock.findLatestDetailStatusContext.mockResolvedValue({
        detailSopId: 'det-st',
        sopId: 'sop-st',
        status: StatusSOP.DRAFT,
        sopOpdId: 'opd-1',
      });
      const dto: UpdateDetailSopStatusDto = { status: StatusSOP.DRAFT };
      await expect(service.transitionDetailSopStatus(user, 'det-st', dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repoMock.updateDetailSopStatus).not.toHaveBeenCalled();
    });

    it('seharusnya melempar ConflictException ketika endpoint status umum mengatur status berlaku', async () => {
      const kepalaUser: JwtAccessPayload = { ...user, peran: PeranPengguna.KEPALA_OPD };
      repoMock.findLatestDetailStatusContext.mockResolvedValue({
        detailSopId: 'det-st',
        sopId: 'sop-st',
        status: StatusSOP.DIVERIFIKASI_PJ_EVALUATOR_ORGANISASI,
        sopOpdId: 'opd-1',
      });
      const dto: UpdateDetailSopStatusDto = { status: StatusSOP.BERLAKU };
      await expect(
        service.transitionDetailSopStatus(kepalaUser, 'det-st', dto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repoMock.updateDetailSopStatus).not.toHaveBeenCalled();
    });

    it('seharusnya mengizinkan draft menjadi menunggu pengajuan evaluasi untuk penyusun ketika workbench lengkap', async () => {
      repoMock.findLatestDetailStatusContext.mockResolvedValue({
        detailSopId: 'det-st',
        sopId: 'sop-st',
        status: StatusSOP.DRAFT,
        sopOpdId: 'opd-1',
      });
      const draftRow = stubWorkbenchSiapLengkap('DRAFT');
      const refreshed = stubWorkbenchSiapLengkap('MENUNGGU_PENGAJUAN_EVALUASI');
      repoMock.findWorkbenchPayloadByDetailOrSopId
        .mockResolvedValueOnce(draftRow)
        .mockResolvedValueOnce(refreshed);
      const dto: UpdateDetailSopStatusDto = { status: StatusSOP.MENUNGGU_PENGAJUAN_EVALUASI };
      const actual = await service.transitionDetailSopStatus(user, 'det-st', dto);
      expect(repoMock.updateDetailSopStatus).toHaveBeenCalledWith({
        detailSopId: 'det-st',
        status: StatusSOP.MENUNGGU_PENGAJUAN_EVALUASI,
        userId: 'pengguna-1',
      });
      expect(actual.detail.status).toBe('MENUNGGU_PENGAJUAN_EVALUASI');
    });

    it('seharusnya melempar BadRequestException ketika workbench tidak lengkap untuk menunggu pengajuan evaluasi', async () => {
      repoMock.findLatestDetailStatusContext.mockResolvedValue({
        detailSopId: 'det-st',
        sopId: 'sop-st',
        status: StatusSOP.DRAFT,
        sopOpdId: 'opd-1',
      });
      repoMock.findWorkbenchPayloadByDetailOrSopId.mockResolvedValueOnce(
        stubWorkbenchPayload('DRAFT'),
      );
      const dto: UpdateDetailSopStatusDto = { status: StatusSOP.MENUNGGU_PENGAJUAN_EVALUASI };
      await expect(service.transitionDetailSopStatus(user, 'det-st', dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repoMock.updateDetailSopStatus).not.toHaveBeenCalled();
    });

    it('seharusnya menolak akses penyusun saat mengajukan evaluasi dari status siap', async () => {
      repoMock.findLatestDetailStatusContext.mockResolvedValue({
        detailSopId: 'det-st',
        sopId: 'sop-st',
        status: StatusSOP.MENUNGGU_PENGAJUAN_EVALUASI,
        sopOpdId: 'opd-1',
      });
      const dto: UpdateDetailSopStatusDto = { status: StatusSOP.DIAJUKAN_EVALUASI };
      await expect(service.transitionDetailSopStatus(user, 'det-st', dto)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(repoMock.updateDetailSopStatus).not.toHaveBeenCalled();
    });

    it('seharusnya mengizinkan PJ penyusun mengajukan evaluasi dari status siap', async () => {
      const pjUser: JwtAccessPayload = { ...user, peran: PeranPengguna.PJ_PENYUSUN };
      repoMock.findLatestDetailStatusContext.mockResolvedValue({
        detailSopId: 'det-st',
        sopId: 'sop-st',
        status: StatusSOP.MENUNGGU_PENGAJUAN_EVALUASI,
        sopOpdId: 'opd-1',
      });
      const refreshed = stubWorkbenchPayload('DIAJUKAN_EVALUASI');
      repoMock.findWorkbenchPayloadByDetailOrSopId.mockResolvedValueOnce(refreshed);
      const dto: UpdateDetailSopStatusDto = { status: StatusSOP.DIAJUKAN_EVALUASI };
      const actual = await service.transitionDetailSopStatus(pjUser, 'det-st', dto);
      expect(repoMock.updateDetailSopStatus).toHaveBeenCalledWith({
        detailSopId: 'det-st',
        status: StatusSOP.DIAJUKAN_EVALUASI,
        userId: 'pengguna-1',
      });
      expect(actual.detail.status).toBe('DIAJUKAN_EVALUASI');
    });
  });

  describe('Pengujian kirim ulang ke evaluator setelah revisi', () => {
    const t = new Date('2026-05-01T08:00:00.000Z');

    function minimalRevisiWorkbench(): SopWorkbenchDbPayload {
      const pelaksanaId = 'pel-1';
      const langkahId = 'langkah-1';
      return {
        detailSopId: 'det-rev',
        sopId: 'sop-rev',
        status: 'REVISI_DARI_EVALUATOR',
        versi: 1,
        nomorSOP: 'REV/1',
        tanggalPembuatan: t,
        tanggalRevisi: null,
        tanggalEfektif: null,
        namaLembaga: 'Lembaga',
        dibuatOlehId: 'p1',
        terakhirDieditOlehId: null,
        createdAt: t,
        updatedAt: t,
        sop: {
          sopId: 'sop-rev',
          opdId: 'opd-1',
          judul: 'Judul Rev',
          createdAt: t,
          updatedAt: t,
          opd: {
            opdId: 'opd-1',
            nama: 'OPD Satu',
            pengguna: [],
          },
        },
        dibuatOleh: { penggunaId: 'p1', nama: 'Budi' },
        terakhirDieditOleh: null,
        lampiranPeringatan: [
          {
            detailSopId: 'det-rev',
            lampiranPeringatanId: 'lt-per',
            teks: 'Perhatian',
            createdAt: t,
            updatedAt: t,
          },
        ],
        lampiranKualifikasiPelaksanaan: [
          {
            detailSopId: 'det-rev',
            lampiranKualifikasiPelaksanaanId: 'lt-kua',
            teks: 'Kualifikasi',
            createdAt: t,
            updatedAt: t,
          },
        ],
        lampiranPeralatanPerlengkapan: [
          {
            detailSopId: 'det-rev',
            lampiranPeralatanPerlengkapanId: 'lt-alat',
            teks: 'Alat',
            createdAt: t,
            updatedAt: t,
          },
        ],
        lampiranPencatatanPendataan: [
          {
            detailSopId: 'det-rev',
            lampiranPencatatanPendataanId: 'lt-cat',
            teks: 'Catat',
            createdAt: t,
            updatedAt: t,
          },
        ],
        dasarHukum: [
          {
            detailSopId: 'det-rev',
            peraturanId: 'per-1',
            createdAt: t,
            updatedAt: t,
            peraturan: {
              peraturanId: 'per-1',
              nama: 'PP',
              nomor: '1',
              tahun: 2024,
              tentang: 'Peraturan contoh',
              createdAt: t,
              updatedAt: t,
            },
          },
        ],
        relasiSopKeluar: [
          {
            detailSopId: 'det-rev',
            detailSopTerkaitId: 'det-lain',
            createdAt: t,
            updatedAt: t,
            sopTerkait: {
              detailSopId: 'det-lain',
              sopId: 'sop-lain',
              nomorSOP: '99/2026',
              sop: { sopId: 'sop-lain', judul: 'SOP lain' },
            },
          },
        ],
        relasiSopMasuk: [],
        swimlanes: [
          {
            detailSopId: 'det-rev',
            pelaksanaId,
            urutan: 0,
            createdAt: t,
            updatedAt: t,
            pelaksana: {
              pelaksanaId,
              opdId: 'opd-1',
              nama: 'Pelaksana',
              createdAt: t,
              updatedAt: t,
            },
          },
        ],
        nilaiEvaluasi: [],
        langkahSOP: [
          {
            langkahSopId: langkahId,
            detailSopId: 'det-rev',
            urutan: 1,
            kegiatan: 'Isi',
            jenis: JenisLangkahProsedur.KEGIATAN,
            kelengkapan: 'Form',
            keluaran: 'Out',
            waktu: 1,
            satuanWaktu: SatuanWaktu.h,
            keterangan: 'Ket',
            pelaksanaId,
            langkahSelanjutnyaYaId: null,
            langkahSelanjutnyaTidakId: null,
            createdAt: t,
            updatedAt: t,
            pelaksana: {
              pelaksanaId,
              opdId: 'opd-1',
              nama: 'Pelaksana',
              createdAt: t,
              updatedAt: t,
            },
          },
        ],
        logEditSop: [],
      } as unknown as SopWorkbenchDbPayload;
    }

    beforeEach(() => {
      repoMock.transitionDetailSopRevisiToSedangDievaluasi.mockResolvedValue(undefined);
    });

    it('seharusnya menolak akses evaluator', async () => {
      const evUser: JwtAccessPayload = { ...user, peran: PeranPengguna.EVALUATOR };
      await expect(
        service.kirimUlangKeEvaluatorSetelahRevisi(evUser, 'det-rev'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repoMock.findLatestDetailStatusContext).not.toHaveBeenCalled();
    });

    it('seharusnya melempar ConflictException ketika status bukan revisi', async () => {
      const pjUser: JwtAccessPayload = { ...user, peran: PeranPengguna.PJ_PENYUSUN };
      repoMock.findLatestDetailStatusContext.mockResolvedValue({
        detailSopId: 'det-rev',
        sopId: 'sop-rev',
        status: StatusSOP.DRAFT,
        sopOpdId: 'opd-1',
      });
      await expect(
        service.kirimUlangKeEvaluatorSetelahRevisi(pjUser, 'det-rev'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repoMock.transitionDetailSopRevisiToSedangDievaluasi).not.toHaveBeenCalled();
    });

    it('seharusnya menolak akses penyusun', async () => {
      await expect(
        service.kirimUlangKeEvaluatorSetelahRevisi(user, 'det-rev'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repoMock.findLatestDetailStatusContext).not.toHaveBeenCalled();
      expect(repoMock.transitionDetailSopRevisiToSedangDievaluasi).not.toHaveBeenCalled();
    });

    it('seharusnya mengizinkan PJ penyusun', async () => {
      const pjUser: JwtAccessPayload = { ...user, peran: PeranPengguna.PJ_PENYUSUN };
      repoMock.findLatestDetailStatusContext.mockResolvedValue({
        detailSopId: 'det-rev',
        sopId: 'sop-rev',
        status: StatusSOP.REVISI_DARI_EVALUATOR,
        sopOpdId: 'opd-1',
      });
      const lengkap = minimalRevisiWorkbench();
      const refreshed = {
        ...lengkap,
        status: 'SEDANG_DIEVALUASI',
      } as unknown as SopWorkbenchDbPayload;
      repoMock.findWorkbenchPayloadByDetailOrSopId
        .mockResolvedValueOnce(lengkap)
        .mockResolvedValueOnce(refreshed);
      const actual = await service.kirimUlangKeEvaluatorSetelahRevisi(pjUser, 'det-rev');
      expect(repoMock.transitionDetailSopRevisiToSedangDievaluasi).toHaveBeenCalledWith({
        detailSopId: 'det-rev',
        userId: 'pengguna-1',
      });
      expect(actual.detail.status).toBe('SEDANG_DIEVALUASI');
    });

    it('seharusnya tetap mengirim ulang meski umpan balik belum ditandai selesai terpisah', async () => {
      const pjUser: JwtAccessPayload = { ...user, peran: PeranPengguna.PJ_PENYUSUN };
      repoMock.findLatestDetailStatusContext.mockResolvedValue({
        detailSopId: 'det-rev',
        sopId: 'sop-rev',
        status: StatusSOP.REVISI_DARI_EVALUATOR,
        sopOpdId: 'opd-1',
      });
      const lengkap = minimalRevisiWorkbench();
      const refreshed = {
        ...lengkap,
        status: 'SEDANG_DIEVALUASI',
      } as unknown as SopWorkbenchDbPayload;
      repoMock.findWorkbenchPayloadByDetailOrSopId
        .mockResolvedValueOnce(lengkap)
        .mockResolvedValueOnce(refreshed);
      await service.kirimUlangKeEvaluatorSetelahRevisi(pjUser, 'det-rev');
      expect(evaluasiNilaiServiceMock.assertBolehKirimUlangSetelahRevisi).not.toHaveBeenCalled();
      expect(repoMock.transitionDetailSopRevisiToSedangDievaluasi).toHaveBeenCalledWith({
        detailSopId: 'det-rev',
        userId: 'pengguna-1',
      });
    });
  });

  describe('Pengujian buat versi baru dari sumber aktif atau riwayat', () => {
    const t = new Date('2026-05-20T08:00:00.000Z');
    const workbenchV2 = {
      detailSopId: 'det-v2',
      sopId: 'sop-v1',
      status: 'DRAFT',
      versi: 2,
      nomorSOP: 'SOP-V2',
      tanggalPembuatan: t,
      tanggalRevisi: t,
      tanggalEfektif: null,
      namaLembaga: 'Lembaga',
      dibuatOlehId: 'pengguna-1',
      terakhirDieditOlehId: null,
      createdAt: t,
      updatedAt: t,
      revisiDariDetailSopId: 'det-v1',
      revisiDari: { detailSopId: 'det-v1', versi: 1 },
      sop: {
        sopId: 'sop-v1',
        opdId: 'opd-1',
        judul: 'SOP Versi',
        createdAt: t,
        updatedAt: t,
        opd: { opdId: 'opd-1', nama: 'OPD Satu', pengguna: [] },
      },
      dibuatOleh: { penggunaId: 'pengguna-1', nama: 'Budi' },
      terakhirDieditOleh: null,
      lampiranPeringatan: [],
      lampiranKualifikasiPelaksanaan: [],
      lampiranPeralatanPerlengkapan: [],
      lampiranPencatatanPendataan: [],
      dasarHukum: [],
      relasiSopKeluar: [],
      relasiSopMasuk: [],
      swimlanes: [],
      nilaiEvaluasi: [],
      langkahSOP: [],
      logEditSop: [],
    } as unknown as SopWorkbenchDbPayload;

    it('seharusnya mengkloning versi berlaku yang dipilih dan mengembalikan workbench', async () => {
      repoMock.findDetailIdByDetailOrSopId.mockResolvedValue({
        detailSopId: 'det-v1',
        sopId: 'sop-v1',
      });
      repoMock.findLatestDetailStatusContext.mockResolvedValue({
        detailSopId: 'det-v1',
        sopId: 'sop-v1',
        status: StatusSOP.BERLAKU,
        sopOpdId: 'opd-1',
      });
      repoMock.cloneDetailSopFromSource.mockResolvedValue({
        ok: true,
        data: { detailSopId: 'det-v2', versi: 2 },
      });
      repoMock.findWorkbenchPayloadByDetailOrSopId.mockResolvedValue(workbenchV2);
      const actual = await service.buatVersiBaruDariSumber(user, 'det-v1');
      expect(repoMock.cloneDetailSopFromSource).toHaveBeenCalledWith({
        sourceDetailSopId: 'det-v1',
        penggunaId: 'pengguna-1',
      });
      expect(actual.detail.id).toBe('det-v2');
    });

    it('seharusnya memakai versi riwayat yang dipilih tanpa dialihkan ke versi berlaku', async () => {
      repoMock.findDetailIdByDetailOrSopId.mockResolvedValue({
        detailSopId: 'det-v1',
        sopId: 'sop-v1',
      });
      repoMock.findLatestDetailStatusContext.mockResolvedValue({
        detailSopId: 'det-v1',
        sopId: 'sop-v1',
        status: StatusSOP.DIGANTIKAN,
        sopOpdId: 'opd-1',
      });
      repoMock.cloneDetailSopFromSource.mockResolvedValue({
        ok: true,
        data: { detailSopId: 'det-v3', versi: 3 },
      });
      repoMock.findWorkbenchPayloadByDetailOrSopId.mockResolvedValue({
        ...workbenchV2,
        detailSopId: 'det-v3',
        versi: 3,
        revisiDariDetailSopId: 'det-v1',
      });

      const actual = await service.buatVersiBaruDariSumber(user, 'det-v1');

      expect(repoMock.cloneDetailSopFromSource).toHaveBeenCalledWith({
        sourceDetailSopId: 'det-v1',
        penggunaId: 'pengguna-1',
      });
      expect(repoMock.findRiwayatVersiBySopId).not.toHaveBeenCalled();
      expect(actual.detail.id).toBe('det-v3');
    });

    it('seharusnya melempar ForbiddenException ketika pengguna bukan penyusun', async () => {
      const evaluator: JwtAccessPayload = { ...user, peran: PeranPengguna.EVALUATOR };
      await expect(service.buatVersiBaruDariSumber(evaluator, 'det-v1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('riwayat menandai semua versi terminal layak menjadi sumber jika tidak ada revisi aktif', async () => {
      repoMock.findDetailIdByDetailOrSopId.mockResolvedValue({
        detailSopId: 'det-v2',
        sopId: 'sop-v1',
      });
      repoMock.findLatestDetailStatusContext.mockResolvedValue({
        detailSopId: 'det-v2',
        sopId: 'sop-v1',
        status: StatusSOP.BERLAKU,
        sopOpdId: 'opd-1',
      });
      repoMock.findRiwayatVersiBySopId.mockResolvedValue([
        {
          detailSopId: 'det-v0',
          versi: 0,
          nomorSOP: 'SOP-V0',
          status: StatusSOP.DITOLAK_EVALUATOR,
          revisiDariDetailSopId: null,
          revisiDariVersi: null,
          updatedAt: t,
          canHapusDraft: false,
        },
        {
          detailSopId: 'det-v1',
          versi: 1,
          nomorSOP: 'SOP-V1',
          status: StatusSOP.DIGANTIKAN,
          revisiDariDetailSopId: null,
          revisiDariVersi: null,
          updatedAt: t,
          canHapusDraft: false,
        },
        {
          detailSopId: 'det-v2',
          versi: 2,
          nomorSOP: 'SOP-V2',
          status: StatusSOP.BERLAKU,
          revisiDariDetailSopId: 'det-v1',
          revisiDariVersi: 1,
          updatedAt: t,
          canHapusDraft: false,
        },
      ]);

      const rows = await service.getRiwayatVersi(user, 'sop-v1');

      expect(rows.map((row) => row.canBuatVersiBaru)).toEqual([true, true, true]);
    });

    it('riwayat menonaktifkan semua sumber ketika masih ada revisi aktif', async () => {
      repoMock.findDetailIdByDetailOrSopId.mockResolvedValue({
        detailSopId: 'det-v2',
        sopId: 'sop-v1',
      });
      repoMock.findLatestDetailStatusContext.mockResolvedValue({
        detailSopId: 'det-v2',
        sopId: 'sop-v1',
        status: StatusSOP.DRAFT,
        sopOpdId: 'opd-1',
      });
      repoMock.findRiwayatVersiBySopId.mockResolvedValue([
        {
          detailSopId: 'det-v1',
          versi: 1,
          nomorSOP: 'SOP-V1',
          status: StatusSOP.BERLAKU,
          revisiDariDetailSopId: null,
          revisiDariVersi: null,
          updatedAt: t,
          canHapusDraft: false,
        },
        {
          detailSopId: 'det-v2',
          versi: 2,
          nomorSOP: 'SOP-V2',
          status: StatusSOP.DRAFT,
          revisiDariDetailSopId: 'det-v1',
          revisiDariVersi: 1,
          updatedAt: t,
          canHapusDraft: true,
        },
      ]);

      const rows = await service.getRiwayatVersi(user, 'sop-v1');

      expect(rows.map((row) => row.canBuatVersiBaru)).toEqual([false, false]);
    });
  });

  describe('Pengujian cabut SOP berlaku', () => {
    const kepalaUser: JwtAccessPayload = {
      sub: 'kepala-1',
      email: 'kepala@b.c',
      peran: PeranPengguna.KEPALA_OPD,
    };
    const t = new Date('2026-05-01T08:00:00.000Z');

    function stubBerlakuWorkbench(status: string): SopWorkbenchDbPayload {
      return {
        detailSopId: 'det-berlaku',
        sopId: 'sop-cabut',
        status,
        versi: 1,
        nomorSOP: 'CAB/1',
        tanggalPembuatan: t,
        tanggalRevisi: null,
        tanggalEfektif: t,
        namaLembaga: 'Lembaga',
        dibuatOlehId: 'p1',
        terakhirDieditOlehId: null,
        createdAt: t,
        updatedAt: t,
        sop: {
          sopId: 'sop-cabut',
          opdId: 'opd-1',
          judul: 'SOP Cabut',
          createdAt: t,
          updatedAt: t,
          opd: { opdId: 'opd-1', nama: 'OPD Satu', pengguna: [] },
        },
        dibuatOleh: { penggunaId: 'p1', nama: 'Budi' },
        terakhirDieditOleh: null,
        lampiranPeringatan: [],
        lampiranKualifikasiPelaksanaan: [],
        lampiranPeralatanPerlengkapan: [],
        lampiranPencatatanPendataan: [],
        dasarHukum: [],
        relasiSopKeluar: [],
        relasiSopMasuk: [],
        swimlanes: [],
        nilaiEvaluasi: [],
        langkahSOP: [],
        logEditSop: [],
      } as unknown as SopWorkbenchDbPayload;
    }

    beforeEach(() => {
      userOpdAccessMock.getRequiredUserOpdId.mockResolvedValue('opd-1');
      userOpdAccessMock.assertWorkbenchAccess.mockResolvedValue(undefined);
      repoMock.findDetailIdByDetailOrSopId.mockResolvedValue({
        detailSopId: 'det-berlaku',
        sopId: 'sop-cabut',
      });
      repoMock.findLatestDetailStatusContext.mockResolvedValue({
        detailSopId: 'det-berlaku',
        sopId: 'sop-cabut',
        status: StatusSOP.BERLAKU,
        sopOpdId: 'opd-1',
      });
    });

    it('seharusnya cabut berlaku versi dan mengembalikan workbench', async () => {
      repoMock.findRiwayatVersiBySopId.mockResolvedValue([
        {
          detailSopId: 'det-berlaku',
          versi: 1,
          nomorSOP: 'CAB/1',
          status: StatusSOP.BERLAKU,
          revisiDariDetailSopId: null,
          revisiDariVersi: null,
          updatedAt: t,
          canHapusDraft: false,
        },
      ]);
      repoMock.findWorkbenchPayloadByDetailOrSopId.mockResolvedValue(
        stubBerlakuWorkbench('DICABUT'),
      );
      const actual = await service.cabutSopBerlaku(kepalaUser, 'sop-cabut');
      expect(repoMock.updateDetailSopStatus).toHaveBeenCalledWith({
        detailSopId: 'det-berlaku',
        status: StatusSOP.DICABUT,
        userId: 'kepala-1',
      });
      expect(actual.detail.status).toBe('DICABUT');
    });

    it('seharusnya mencabut versi berlaku ketika parameter adalah header SOP dan versi terbaru adalah draft', async () => {
      repoMock.findLatestDetailStatusContext.mockResolvedValue({
        detailSopId: 'det-draft',
        sopId: 'sop-cabut',
        status: StatusSOP.DRAFT,
        sopOpdId: 'opd-1',
      });
      repoMock.findRiwayatVersiBySopId.mockResolvedValue([
        {
          detailSopId: 'det-berlaku',
          versi: 1,
          nomorSOP: 'CAB/1',
          status: StatusSOP.BERLAKU,
          revisiDariDetailSopId: null,
          revisiDariVersi: null,
          updatedAt: t,
          canHapusDraft: false,
        },
      ]);
      repoMock.findWorkbenchPayloadByDetailOrSopId.mockResolvedValue(
        stubBerlakuWorkbench('DICABUT'),
      );
      await service.cabutSopBerlaku(kepalaUser, 'sop-cabut');
      expect(repoMock.updateDetailSopStatus).toHaveBeenCalledWith({
        detailSopId: 'det-berlaku',
        status: StatusSOP.DICABUT,
        userId: 'kepala-1',
      });
    });

    it('seharusnya menolak cabut untuk non kepala OPD', async () => {
      await expect(service.cabutSopBerlaku(user, 'sop-cabut')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(repoMock.updateDetailSopStatus).not.toHaveBeenCalled();
    });

    it('seharusnya menolak cabut ketika tidak ada berlaku versi', async () => {
      repoMock.findRiwayatVersiBySopId.mockResolvedValue([
        {
          detailSopId: 'det-draft',
          versi: 1,
          nomorSOP: 'CAB/1',
          status: StatusSOP.DRAFT,
          revisiDariDetailSopId: null,
          revisiDariVersi: null,
          updatedAt: t,
          canHapusDraft: false,
        },
      ]);
      await expect(service.cabutSopBerlaku(kepalaUser, 'sop-cabut')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repoMock.updateDetailSopStatus).not.toHaveBeenCalled();
    });

    it('seharusnya menolak pencabutan ketika revisi sedang berjalan', async () => {
      repoMock.findRiwayatVersiBySopId.mockResolvedValue([
        {
          detailSopId: 'det-berlaku',
          versi: 1,
          nomorSOP: 'CAB/1',
          status: StatusSOP.BERLAKU,
          revisiDariDetailSopId: null,
          revisiDariVersi: null,
          updatedAt: t,
          canHapusDraft: false,
        },
        {
          detailSopId: 'det-draft',
          versi: 2,
          nomorSOP: 'CAB/2',
          status: StatusSOP.DRAFT,
          revisiDariDetailSopId: 'det-berlaku',
          revisiDariVersi: 1,
          updatedAt: t,
          canHapusDraft: true,
        },
      ]);
      await expect(service.cabutSopBerlaku(kepalaUser, 'sop-cabut')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repoMock.updateDetailSopStatus).not.toHaveBeenCalled();
    });

    it('seharusnya mendelegasikan dicabut dari transition detail SOP status', async () => {
      repoMock.findRiwayatVersiBySopId.mockResolvedValue([
        {
          detailSopId: 'det-berlaku',
          versi: 1,
          nomorSOP: 'CAB/1',
          status: StatusSOP.BERLAKU,
          revisiDariDetailSopId: null,
          revisiDariVersi: null,
          updatedAt: t,
          canHapusDraft: false,
        },
      ]);
      repoMock.findWorkbenchPayloadByDetailOrSopId.mockResolvedValue(
        stubBerlakuWorkbench('DICABUT'),
      );
      const dto: UpdateDetailSopStatusDto = { status: StatusSOP.DICABUT };
      const actual = await service.transitionDetailSopStatus(kepalaUser, 'sop-cabut', dto);
      expect(repoMock.updateDetailSopStatus).toHaveBeenCalledWith({
        detailSopId: 'det-berlaku',
        status: StatusSOP.DICABUT,
        userId: 'kepala-1',
      });
      expect(actual.detail.status).toBe('DICABUT');
    });
  });

  describe('Pengujian hapus versi draft', () => {
    it('seharusnya memanggil repository menghapus ketika penyusun', async () => {
      repoMock.findLatestDetailStatusContext.mockResolvedValue({
        detailSopId: 'det-draft',
        sopId: 'sop-1',
        status: StatusSOP.DRAFT,
        sopOpdId: 'opd-1',
      });
      repoMock.deleteVersiDraft.mockResolvedValue({ ok: true, data: undefined });
      await service.hapusVersiDraft(user, 'det-draft');
      expect(repoMock.deleteVersiDraft).toHaveBeenCalledWith('det-draft');
    });
  });

  describe('Pengujian hapus SOP draft awal', () => {
    it('seharusnya memanggil repository untuk menghapus header SOP ketika penyusun', async () => {
      repoMock.findLatestDetailStatusContext.mockResolvedValue({
        detailSopId: 'det-draft-awal',
        sopId: 'sop-draft-awal',
        status: StatusSOP.DRAFT,
        sopOpdId: 'opd-1',
      });
      repoMock.deleteSopDraftAwal.mockResolvedValue({ ok: true, data: undefined });
      await service.hapusSopDraftAwal(user, 'det-draft-awal');
      expect(repoMock.deleteSopDraftAwal).toHaveBeenCalledWith('det-draft-awal');
    });

    it('seharusnya meneruskan konflik ketika repository menolak draft yang bukan draft awal', async () => {
      repoMock.findLatestDetailStatusContext.mockResolvedValue({
        detailSopId: 'det-proses',
        sopId: 'sop-proses',
        status: StatusSOP.SEDANG_DISUSUN,
        sopOpdId: 'opd-1',
      });
      repoMock.deleteSopDraftAwal.mockResolvedValue({
        ok: false,
        reason: 'CONFLICT',
        message: 'SOP hanya dapat dihapus ketika masih berupa draft awal',
      });
      await expect(service.hapusSopDraftAwal(user, 'det-proses')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });
});
