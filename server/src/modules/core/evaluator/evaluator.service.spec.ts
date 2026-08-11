import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ServiceUnavailableException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  BCRYPT_SALT_ROUNDS,
  DEFAULT_PENGGUNA_PASSWORD,
} from '../../../common/auth/password.constants';
import { Prisma, PeranPengguna, type Pengguna } from '../../../generated/prisma';
import { PenggunaRepository } from '../pengguna/pengguna.repository';
import { EvaluatorService } from './evaluator.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-default-password'),
}));

describe('Pengujian EvaluatorService', () => {
  let service: EvaluatorService;
  let repository: jest.Mocked<
    Pick<
      PenggunaRepository,
      | 'findPjEvaluatorOrganisasiOpdId'
      | 'findPjEvaluatorOrganisasiOpd'
      | 'findEvaluatorsByOpd'
      | 'findEvaluatorByIdInOpd'
      | 'findEvaluatorAktifById'
      | 'createPengguna'
      | 'updateEvaluator'
      | 'softDeleteEvaluator'
      | 'existsEmailOtherThan'
      | 'existsNipOtherThan'
    >
  >;

  const baseRow: Pengguna = {
    penggunaId: 'u-1',
    email: 'a@b.c',
    opdId: 'opd-biro',
    nama: 'Test',
    kataSandi: 'x',
    peran: PeranPengguna.EVALUATOR,
    nip: '1',
    jabatan: 'J',
    pangkat: 'P',
    nohp: '6281234567890',
    sesiTokenVersion: 0,
    refreshTokenHash: null,
    refreshTokenExpiresAt: null,
    passwordChangedAt: null,
    ttePinHash: null,
    tteP12Base64: null,
    tteP12PassphraseEncrypted: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    repository = {
      findPjEvaluatorOrganisasiOpdId: jest.fn().mockResolvedValue('opd-biro'),
      findPjEvaluatorOrganisasiOpd: jest
        .fn()
        .mockResolvedValue({ opdId: 'opd-biro', nama: 'Biro' }),
      findEvaluatorsByOpd: jest.fn().mockResolvedValue([baseRow]),
      findEvaluatorByIdInOpd: jest.fn().mockResolvedValue(baseRow),
      findEvaluatorAktifById: jest.fn().mockResolvedValue(baseRow),
      createPengguna: jest.fn().mockImplementation(async (data) => ({
        ...baseRow,
        email: String(data.email),
        nama: String(data.nama),
        penggunaId: 'new-id',
      })),
      updateEvaluator: jest.fn().mockResolvedValue(baseRow),
      softDeleteEvaluator: jest.fn().mockResolvedValue(undefined),
      existsEmailOtherThan: jest.fn().mockResolvedValue(false),
      existsNipOtherThan: jest.fn().mockResolvedValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [EvaluatorService, { provide: PenggunaRepository, useValue: repository }],
    }).compile();

    service = module.get(EvaluatorService);
  });

  it('seharusnya melakukan hash password default saat membuat evaluator', async () => {
    (bcrypt.hash as jest.Mock).mockClear();
    await service.createAnggota({
      email: 'e@test.com',
      nama: 'N',
      nip: 'nip1',
      jabatan: 'Jab',
      pangkat: 'P',
      nohp: '081234567890',
    });
    expect(bcrypt.hash).toHaveBeenCalledWith(DEFAULT_PENGGUNA_PASSWORD, BCRYPT_SALT_ROUNDS);
    expect(repository.createPengguna).toHaveBeenCalled();
  });

  it('seharusnya mengembalikan grup dari listGrup', async () => {
    const grup = await service.listGrup();
    expect(grup).toHaveLength(1);
    expect(grup[0].opdId).toBe('opd-biro');
    expect(grup[0].namaOpd).toBe('Biro');
    expect(grup[0].evaluator).toHaveLength(1);
    expect(repository.findEvaluatorsByOpd).toHaveBeenCalledWith('opd-biro', undefined);
  });

  it('seharusnya meneruskan pencarian ke findEvaluatorsByOpd', async () => {
    await service.listGrup('  teguh  ');
    expect(repository.findEvaluatorsByOpd).toHaveBeenCalledWith('opd-biro', '  teguh  ');
  });

  it('seharusnya melempar ServiceUnavailableException pada listGrup ketika PJ tidak ada', async () => {
    repository.findPjEvaluatorOrganisasiOpd.mockResolvedValueOnce(null);
    await expect(service.listGrup()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('seharusnya melempar ServiceUnavailableException ketika biro tidak dikonfigurasi pada membuat', async () => {
    repository.findPjEvaluatorOrganisasiOpdId.mockResolvedValueOnce(null);
    await expect(
      service.createAnggota({
        email: 'e@test.com',
        nama: 'N',
        nip: 'nip1',
        jabatan: 'Jab',
        pangkat: 'P',
        nohp: '081234567890',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(repository.createPengguna).not.toHaveBeenCalled();
  });

  it('seharusnya menetapkan evaluator menjadi biro OPD pada membuat', async () => {
    await service.createAnggota({
      email: 'e@test.com',
      nama: 'N',
      nip: 'nip1',
      jabatan: 'Jab',
      pangkat: 'P',
      nohp: '081234567890',
    });
    expect(repository.createPengguna).toHaveBeenCalledWith(
      expect.objectContaining({
        opd: { connect: { opdId: 'opd-biro' } },
        peran: PeranPengguna.EVALUATOR,
      }),
    );
  });

  it('seharusnya melempar NotFoundException ketika memperbarui evaluator di luar biro', async () => {
    repository.findEvaluatorByIdInOpd.mockResolvedValueOnce(null);
    await expect(service.updateAnggota('u-unknown', { nama: 'X' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  // --- Tambahan Test Case createAnggota ---
  it('seharusnya membersihkan spasi dan mengecilkan huruf email pada createAnggota (Worst Case)', async () => {
    await service.createAnggota({
      email: '  E@Test.Com  ',
      nama: '  Nama  ',
      nip: ' nip1 ',
      jabatan: ' Jab ',
      pangkat: ' P ',
      nohp: ' 081234567890 ',
    });
    expect(repository.createPengguna).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'e@test.com',
        nama: 'Nama',
        nip: 'nip1',
        jabatan: 'Jab',
        pangkat: 'P',
        nohp: '6281234567890',
      }),
    );
  });

  it('seharusnya melempar ConflictException jika email/nip sudah ada pada createAnggota (False Case)', async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError('error', {
      code: 'P2002',
      clientVersion: '1.0',
    });
    repository.createPengguna.mockRejectedValueOnce(prismaError);
    await expect(
      service.createAnggota({
        email: 'e@test.com',
        nama: 'N',
        nip: 'nip1',
        jabatan: 'Jab',
        pangkat: 'P',
        nohp: '081234567890',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  // --- Tambahan Test Case updateAnggota ---
  it('seharusnya melempar ServiceUnavailableException jika biro tidak ada pada updateAnggota (False Case)', async () => {
    repository.findPjEvaluatorOrganisasiOpdId.mockResolvedValueOnce(null);
    await expect(service.updateAnggota('u-1', { nama: 'X' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('seharusnya melempar BadRequestException jika tidak ada field yang dikirim pada updateAnggota (Edge/False Case)', async () => {
    await expect(service.updateAnggota('u-1', {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('seharusnya membersihkan spasi dan mengubah huruf email pada updateAnggota (Worst Case)', async () => {
    repository.existsEmailOtherThan = jest.fn().mockResolvedValue(false);
    repository.existsNipOtherThan = jest.fn().mockResolvedValue(false);

    await service.updateAnggota('u-1', {
      email: '  BARU@test.com ',
      nama: '  Nama Baru ',
      nip: ' nip2 ',
      jabatan: ' Jab2 ',
      pangkat: ' P2 ',
      nohp: ' 082234567890 ',
    });

    expect(repository.updateEvaluator).toHaveBeenCalledWith(
      'u-1',
      expect.objectContaining({
        email: 'baru@test.com',
        nama: 'Nama Baru',
        nip: 'nip2',
        jabatan: 'Jab2',
        pangkat: 'P2',
        nohp: '6282234567890',
      }),
    );
  });

  it('seharusnya mengubah deletedAt menjadi saat ini jika status NONAKTIF, dan null jika AKTIF (Edge Case)', async () => {
    await service.updateAnggota('u-1', { status: 'NONAKTIF' });
    expect(repository.updateEvaluator).toHaveBeenCalledWith(
      'u-1',
      expect.objectContaining({
        deletedAt: expect.any(Date),
      }),
    );

    await service.updateAnggota('u-1', { status: 'AKTIF' });
    expect(repository.updateEvaluator).toHaveBeenCalledWith(
      'u-1',
      expect.objectContaining({
        deletedAt: null,
      }),
    );
  });

  it('seharusnya melempar ConflictException jika terjadi Prisma P2002 pada updateEvaluator (False Case)', async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError('error', {
      code: 'P2002',
      clientVersion: '1.0',
    });
    repository.updateEvaluator.mockRejectedValueOnce(prismaError);
    await expect(service.updateAnggota('u-1', { nama: 'X' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  // --- Tambahan Test Case softDeleteAnggota ---
  it('seharusnya melempar ServiceUnavailableException jika biro tidak ada pada softDeleteAnggota (False Case)', async () => {
    repository.findPjEvaluatorOrganisasiOpdId.mockResolvedValueOnce(null);
    await expect(service.softDeleteAnggota('u-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('seharusnya melempar NotFoundException jika evaluator aktif tidak ditemukan pada softDeleteAnggota (False Case)', async () => {
    repository.findEvaluatorAktifById.mockResolvedValueOnce(null);
    await expect(service.softDeleteAnggota('u-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('seharusnya memanggil softDeleteEvaluator jika berhasil (Edge/Success Case)', async () => {
    await service.softDeleteAnggota('u-1');
    expect(repository.softDeleteEvaluator).toHaveBeenCalledWith('u-1');
  });

  // --- Tambahan Test Case Advanced (Edge & False Cases) ---

  it('seharusnya tidak mengecek ke database jika email dan NIP yang dikirim sama dengan data lama (Edge Case)', async () => {
    await service.updateAnggota('u-1', {
      email: 'a@b.c',
      nip: '1',
    });
    expect(repository.existsEmailOtherThan).not.toHaveBeenCalled();
    expect(repository.existsNipOtherThan).not.toHaveBeenCalled();
    expect(repository.updateEvaluator).toHaveBeenCalledWith(
      'u-1',
      expect.objectContaining({ email: 'a@b.c', nip: '1' }),
    );
  });

  it('seharusnya meneruskan error jika terjadi kegagalan sistem selain Prisma P2002 (False Case)', async () => {
    const genericError = new Error('Database Down');
    repository.createPengguna.mockRejectedValueOnce(genericError);

    await expect(
      service.createAnggota({
        email: 'x@test.com',
        nama: 'X',
        nip: 'x',
        jabatan: 'X',
        pangkat: 'X',
        nohp: '6281234567890',
      }),
    ).rejects.toThrow('Database Down');
  });

  it('seharusnya mengembalikan array kosong untuk evaluator jika listGrup dipanggil saat belum ada evaluator (Edge Case)', async () => {
    repository.findEvaluatorsByOpd.mockResolvedValueOnce([]);
    const grup = await service.listGrup();
    expect(grup[0].evaluator).toEqual([]);
  });

  it('seharusnya hanya memperbarui satu field pada pembaruan parsial (Edge Case)', async () => {
    await service.updateAnggota('u-1', { nohp: '081234567890' });
    expect(repository.updateEvaluator).toHaveBeenCalledWith('u-1', {
      nohp: '6281234567890',
    });
  });

  it('seharusnya mengonversi response DTO dengan benar saat deletedAt terisi (Edge Case)', async () => {
    const deleteDate = new Date();
    repository.createPengguna.mockResolvedValueOnce({
      ...baseRow,
      deletedAt: deleteDate,
    });

    const res = await service.createAnggota({
      email: 'e@test.com',
      nama: 'N',
      nip: 'n',
      jabatan: 'J',
      pangkat: 'P',
      nohp: '6281234567890',
    });

    expect(res.status).toBe('NONAKTIF');
    expect(res.berakhirPada).toEqual(deleteDate);
  });
});
