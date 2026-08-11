import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { JwtAccessPayload } from '../../../common';
import {
  JenisLangkahProsedur,
  PeranPengguna,
  Prisma,
  SatuanWaktu,
  StatusSOP,
} from '../../../generated/prisma';
import { UserOpdAccessService } from '../../core/opd/user-opd-access.service';
import { SopCatalogService } from '../catalog/sop-catalog.service';
import type { PenyusunWorkbenchDataDto } from '../catalog/dto/penyusun-workbench-data.dto';
import { SopProsedurRepository } from './sop-prosedur.repository';
import { SopProsedurService } from './sop-prosedur.service';

describe('Pengujian SopProsedurService', () => {
  let service: SopProsedurService;

  const repoMock: jest.Mocked<
    Pick<
      SopProsedurRepository,
      | 'findDetailIdByDetailOrSopId'
      | 'findOpdIdByPenggunaId'
      | 'findPelaksanaIdsByOpd'
      | 'findExistingSwimlanePelaksanaIds'
      | 'findDetailStatus'
      | 'updateProsedurTransaction'
    >
  > = {
    findDetailIdByDetailOrSopId: jest.fn(),
    findOpdIdByPenggunaId: jest.fn(),
    findPelaksanaIdsByOpd: jest.fn(),
    findExistingSwimlanePelaksanaIds: jest.fn(),
    findDetailStatus: jest.fn(),
    updateProsedurTransaction: jest.fn(),
  };

  const catalogMock = {
    getPenyusunWorkbench: jest.fn(),
  };
  const userOpdAccessMock = {
    assertSameOpd: jest.fn().mockResolvedValue(undefined),
  };

  const makeUser = (peran: PeranPengguna, sub = 'user-1'): JwtAccessPayload =>
    ({ sub, email: 'a@b.c', peran }) as JwtAccessPayload;

  const fakeWorkbench = {
    detail: { id: 'det-1' },
  } as unknown as PenyusunWorkbenchDataDto;

  beforeEach(async () => {
    jest.resetAllMocks();
    repoMock.findDetailStatus.mockResolvedValue(StatusSOP.SEDANG_DISUSUN);
    catalogMock.getPenyusunWorkbench.mockResolvedValue(fakeWorkbench);
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        SopProsedurService,
        { provide: SopProsedurRepository, useValue: repoMock as unknown as SopProsedurRepository },
        { provide: SopCatalogService, useValue: catalogMock as unknown as SopCatalogService },
        { provide: UserOpdAccessService, useValue: userOpdAccessMock },
      ],
    }).compile();
    service = moduleRef.get(SopProsedurService);
  });

  describe('Pengujian update prosedur', () => {
    it('seharusnya melempar NotFoundException ketika id tidak dapat ditemukan', async () => {
      repoMock.findDetailIdByDetailOrSopId.mockResolvedValueOnce(null);
      await expect(
        service.updateProsedur(makeUser(PeranPengguna.PENYUSUN), 'unknown', {}),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('seharusnya melempar ForbiddenException ketika peran bukan penyusun', async () => {
      repoMock.findDetailIdByDetailOrSopId.mockResolvedValueOnce({
        detailSopId: 'det-1',
        sopOpdId: 'opd-1',
      });
      await expect(
        service.updateProsedur(makeUser(PeranPengguna.EVALUATOR), 'det-1', {}),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('seharusnya melempar ForbiddenException ketika OPD penyusun tidak cocok', async () => {
      repoMock.findDetailIdByDetailOrSopId.mockResolvedValueOnce({
        detailSopId: 'det-1',
        sopOpdId: 'opd-1',
      });
      userOpdAccessMock.assertSameOpd.mockRejectedValueOnce(
        new ForbiddenException('Akses ditolak untuk DetailSOP ini'),
      );
      await expect(
        service.updateProsedur(makeUser(PeranPengguna.PENYUSUN), 'det-1', {}),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('seharusnya mengembalikan workbench tanpa memanggil repository ketika DTO kosong', async () => {
      repoMock.findDetailIdByDetailOrSopId.mockResolvedValueOnce({
        detailSopId: 'det-1',
        sopOpdId: 'opd-1',
      });
      repoMock.findOpdIdByPenggunaId.mockResolvedValueOnce('opd-1');
      const out = await service.updateProsedur(makeUser(PeranPengguna.PENYUSUN), 'det-1', {});
      expect(repoMock.updateProsedurTransaction).not.toHaveBeenCalled();
      expect(out).toBe(fakeWorkbench);
    });

    it('seharusnya melempar ConflictException ketika detail sudah berlaku', async () => {
      repoMock.findDetailIdByDetailOrSopId.mockResolvedValueOnce({
        detailSopId: 'det-1',
        sopOpdId: 'opd-1',
      });
      repoMock.findOpdIdByPenggunaId.mockResolvedValueOnce('opd-1');
      repoMock.findDetailStatus.mockResolvedValueOnce(StatusSOP.BERLAKU);
      await expect(
        service.updateProsedur(makeUser(PeranPengguna.PENYUSUN), 'det-1', {
          pelaksana: [{ pelaksanaId: 'p-1' }],
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repoMock.updateProsedurTransaction).not.toHaveBeenCalled();
    });

    it('seharusnya melempar BadRequestException ketika pelaksana duplikat in DTO', async () => {
      repoMock.findDetailIdByDetailOrSopId.mockResolvedValueOnce({
        detailSopId: 'det-1',
        sopOpdId: 'opd-1',
      });
      repoMock.findOpdIdByPenggunaId.mockResolvedValueOnce('opd-1');
      await expect(
        service.updateProsedur(makeUser(PeranPengguna.PENYUSUN), 'det-1', {
          pelaksana: [{ pelaksanaId: 'p-1' }, { pelaksanaId: 'p-1' }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('seharusnya melempar BadRequestException ketika pelaksana tidak in OPD', async () => {
      repoMock.findDetailIdByDetailOrSopId.mockResolvedValueOnce({
        detailSopId: 'det-1',
        sopOpdId: 'opd-1',
      });
      repoMock.findOpdIdByPenggunaId.mockResolvedValueOnce('opd-1');
      repoMock.findPelaksanaIdsByOpd.mockResolvedValueOnce(new Set<string>());
      await expect(
        service.updateProsedur(makeUser(PeranPengguna.PENYUSUN), 'det-1', {
          pelaksana: [{ pelaksanaId: 'p-1' }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('seharusnya melempar BadRequestException ketika temp Id duplikat', async () => {
      repoMock.findDetailIdByDetailOrSopId.mockResolvedValueOnce({
        detailSopId: 'det-1',
        sopOpdId: 'opd-1',
      });
      repoMock.findOpdIdByPenggunaId.mockResolvedValueOnce('opd-1');
      repoMock.findExistingSwimlanePelaksanaIds.mockResolvedValueOnce(['p-1']);
      const baseLangkah = {
        jenis: JenisLangkahProsedur.KEGIATAN,
        kegiatan: 'a',
        pelaksanaId: 'p-1',
      };
      await expect(
        service.updateProsedur(makeUser(PeranPengguna.PENYUSUN), 'det-1', {
          langkah: [
            { tempId: 't-1', ...baseLangkah },
            { tempId: 't-1', ...baseLangkah },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('seharusnya melempar BadRequestException ketika cabang referensi tidak dikenal temp Id', async () => {
      repoMock.findDetailIdByDetailOrSopId.mockResolvedValueOnce({
        detailSopId: 'det-1',
        sopOpdId: 'opd-1',
      });
      repoMock.findOpdIdByPenggunaId.mockResolvedValueOnce('opd-1');
      repoMock.findExistingSwimlanePelaksanaIds.mockResolvedValueOnce(['p-1']);
      await expect(
        service.updateProsedur(makeUser(PeranPengguna.PENYUSUN), 'det-1', {
          langkah: [
            {
              tempId: 't-1',
              jenis: JenisLangkahProsedur.KEPUTUSAN,
              kegiatan: 'cabang',
              pelaksanaId: 'p-1',
              langkahSelanjutnyaYaTempId: 'NOPE',
            },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('seharusnya melempar BadRequestException ketika langkah pelaksana tidak in swimlane payload', async () => {
      repoMock.findDetailIdByDetailOrSopId.mockResolvedValueOnce({
        detailSopId: 'det-1',
        sopOpdId: 'opd-1',
      });
      repoMock.findOpdIdByPenggunaId.mockResolvedValueOnce('opd-1');
      repoMock.findPelaksanaIdsByOpd.mockResolvedValueOnce(new Set(['p-1']));
      await expect(
        service.updateProsedur(makeUser(PeranPengguna.PENYUSUN), 'det-1', {
          pelaksana: [{ pelaksanaId: 'p-1' }],
          langkah: [
            {
              tempId: 't-1',
              jenis: JenisLangkahProsedur.KEGIATAN,
              kegiatan: 'pakai p-2',
              pelaksanaId: 'p-2',
            },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('seharusnya memanggil repository hanya dengan field pelaksana yang berubah', async () => {
      repoMock.findDetailIdByDetailOrSopId.mockResolvedValueOnce({
        detailSopId: 'det-1',
        sopOpdId: 'opd-1',
      });
      repoMock.findOpdIdByPenggunaId.mockResolvedValueOnce('opd-1');
      repoMock.findPelaksanaIdsByOpd.mockResolvedValueOnce(new Set(['p-1']));
      const user = makeUser(PeranPengguna.PENYUSUN);
      await service.updateProsedur(user, 'det-1', {
        pelaksana: [{ pelaksanaId: 'p-1' }],
      });
      expect(repoMock.updateProsedurTransaction).toHaveBeenCalledTimes(1);
      const args = repoMock.updateProsedurTransaction.mock.calls[0][0];
      expect(args.detailSopId).toBe('det-1');
      expect(args.userId).toBe(user.sub);
      expect(args.changedFields).toEqual(['pelaksana']);
      expect(args.input.pelaksana).toEqual([{ pelaksanaId: 'p-1' }]);
      expect(args.input.langkah).toBeUndefined();
    });

    it('seharusnya memanggil repository hanya dengan field langkah yang berubah dan memvalidasi terhadap swimlane yang sudah ada', async () => {
      repoMock.findDetailIdByDetailOrSopId.mockResolvedValueOnce({
        detailSopId: 'det-1',
        sopOpdId: 'opd-1',
      });
      repoMock.findOpdIdByPenggunaId.mockResolvedValueOnce('opd-1');
      repoMock.findExistingSwimlanePelaksanaIds.mockResolvedValueOnce(['p-9']);
      await service.updateProsedur(makeUser(PeranPengguna.PENYUSUN), 'det-1', {
        langkah: [
          {
            tempId: 't-1',
            jenis: JenisLangkahProsedur.KEGIATAN,
            kegiatan: 'a',
            pelaksanaId: 'p-9',
          },
        ],
      });
      const args = repoMock.updateProsedurTransaction.mock.calls[0][0];
      expect(args.changedFields).toEqual(['langkah']);
      expect(args.input.langkah).toHaveLength(1);
      expect(args.input.langkah?.[0].pelaksanaId).toBe('p-9');
    });

    it('seharusnya memanggil repository dengan kedua field yang berubah dan menghubungkan ulang cabang', async () => {
      repoMock.findDetailIdByDetailOrSopId.mockResolvedValueOnce({
        detailSopId: 'det-1',
        sopOpdId: 'opd-1',
      });
      repoMock.findOpdIdByPenggunaId.mockResolvedValueOnce('opd-1');
      repoMock.findPelaksanaIdsByOpd.mockResolvedValueOnce(new Set(['p-1']));
      await service.updateProsedur(makeUser(PeranPengguna.PENYUSUN), 'det-1', {
        pelaksana: [{ pelaksanaId: 'p-1' }],
        langkah: [
          {
            tempId: 't-1',
            jenis: JenisLangkahProsedur.KEPUTUSAN,
            kegiatan: 'cek',
            pelaksanaId: 'p-1',
            langkahSelanjutnyaYaTempId: 't-2',
          },
          {
            tempId: 't-2',
            jenis: JenisLangkahProsedur.KEGIATAN,
            kegiatan: 'lanjut',
            pelaksanaId: 'p-1',
            satuanWaktu: SatuanWaktu.h,
            waktu: 1,
          },
        ],
      });
      const args = repoMock.updateProsedurTransaction.mock.calls[0][0];
      expect(args.changedFields).toEqual(['pelaksana', 'langkah']);
      expect(args.input.langkah?.[0].langkahSelanjutnyaYaTempId).toBe('t-2');
      expect(args.input.langkah?.[1].langkahSelanjutnyaYaTempId).toBeNull();
    });

    it('seharusnya melempar NotFoundException ketika detail status tidak ditemukan di tengah proses (Edge Case)', async () => {
      repoMock.findDetailIdByDetailOrSopId.mockResolvedValueOnce({
        detailSopId: 'det-1',
        sopOpdId: 'opd-1',
      });
      repoMock.findOpdIdByPenggunaId.mockResolvedValueOnce('opd-1');
      repoMock.findDetailStatus.mockResolvedValueOnce(null);
      await expect(
        service.updateProsedur(makeUser(PeranPengguna.PENYUSUN), 'det-1', {}),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('seharusnya melempar BadRequestException ketika LangkahSOP tidak diset pelaksanaId dan pelaksana cadangan kosong (Edge Case)', async () => {
      repoMock.findDetailIdByDetailOrSopId.mockResolvedValueOnce({
        detailSopId: 'det-1',
        sopOpdId: 'opd-1',
      });
      repoMock.findOpdIdByPenggunaId.mockResolvedValueOnce('opd-1');
      repoMock.findExistingSwimlanePelaksanaIds.mockResolvedValueOnce([]); // no existing pelaksana

      await expect(
        service.updateProsedur(makeUser(PeranPengguna.PENYUSUN), 'det-1', {
          langkah: [
            {
              tempId: 't-1',
              jenis: JenisLangkahProsedur.KEGIATAN,
              kegiatan: 'tanpa pelaksana',
              // pelaksanaId: undefined, // omitted intentionally
            },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('seharusnya mengamankan jenis cabang dengan membuang (set null) langkah selanjutnya Ya/Tidak jika jenis BUKAN KEPUTUSAN', async () => {
      repoMock.findDetailIdByDetailOrSopId.mockResolvedValueOnce({
        detailSopId: 'det-1',
        sopOpdId: 'opd-1',
      });
      repoMock.findOpdIdByPenggunaId.mockResolvedValueOnce('opd-1');
      repoMock.findExistingSwimlanePelaksanaIds.mockResolvedValueOnce(['p-1']);
      await service.updateProsedur(makeUser(PeranPengguna.PENYUSUN), 'det-1', {
        langkah: [
          {
            tempId: 't-1',
            jenis: JenisLangkahProsedur.KEGIATAN, // Bukan keputusan
            kegiatan: 'tes cabang ngawur',
            pelaksanaId: 'p-1',
            langkahSelanjutnyaYaTempId: 't-1', // Maliciously set branch
            langkahSelanjutnyaTidakTempId: 't-1', // Maliciously set branch
          },
        ],
      });
      const args = repoMock.updateProsedurTransaction.mock.calls[0][0];
      expect(args.input.langkah?.[0].langkahSelanjutnyaYaTempId).toBeNull();
      expect(args.input.langkah?.[0].langkahSelanjutnyaTidakTempId).toBeNull();
    });

    it('seharusnya memetakan error Prisma P2002 menjadi ConflictException (Worst Case Konflik Unik)', async () => {
      repoMock.findDetailIdByDetailOrSopId.mockResolvedValueOnce({
        detailSopId: 'det-1',
        sopOpdId: 'opd-1',
      });
      repoMock.findOpdIdByPenggunaId.mockResolvedValueOnce('opd-1');
      repoMock.findPelaksanaIdsByOpd.mockResolvedValueOnce(new Set(['p-1']));

      const p2002 = new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      });
      repoMock.updateProsedurTransaction.mockRejectedValueOnce(p2002);

      await expect(
        service.updateProsedur(makeUser(PeranPengguna.PENYUSUN), 'det-1', {
          pelaksana: [{ pelaksanaId: 'p-1' }],
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('seharusnya memetakan error referensi P2003/P2025 menjadi BadRequestException (Worst Case Referensi Hilang)', async () => {
      repoMock.findDetailIdByDetailOrSopId.mockResolvedValueOnce({
        detailSopId: 'det-1',
        sopOpdId: 'opd-1',
      });
      repoMock.findOpdIdByPenggunaId.mockResolvedValueOnce('opd-1');
      repoMock.findPelaksanaIdsByOpd.mockResolvedValueOnce(new Set(['p-1']));

      const p2025 = new Prisma.PrismaClientKnownRequestError('not found', {
        code: 'P2025',
        clientVersion: 'test',
      });
      repoMock.updateProsedurTransaction.mockRejectedValueOnce(p2025);

      await expect(
        service.updateProsedur(makeUser(PeranPengguna.PENYUSUN), 'det-1', {
          pelaksana: [{ pelaksanaId: 'p-1' }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('seharusnya merespons dengan BadRequestException khusus jika database mengembalikan error trigger Langkah tujuan cabang', async () => {
      repoMock.findDetailIdByDetailOrSopId.mockResolvedValueOnce({
        detailSopId: 'det-1',
        sopOpdId: 'opd-1',
      });
      repoMock.findOpdIdByPenggunaId.mockResolvedValueOnce('opd-1');
      repoMock.findPelaksanaIdsByOpd.mockResolvedValueOnce(new Set(['p-1']));

      repoMock.updateProsedurTransaction.mockRejectedValueOnce(
        new Error('Langkah tujuan cabang terdeteksi melintas batas SOP'),
      );

      await expect(
        service.updateProsedur(makeUser(PeranPengguna.PENYUSUN), 'det-1', {
          pelaksana: [{ pelaksanaId: 'p-1' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
