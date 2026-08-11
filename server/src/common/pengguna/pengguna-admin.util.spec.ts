import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import {
  assertAtLeastOneUpdateField,
  assertEmailNipUniqueOnUpdate,
  rethrowPrismaUniqueViolation,
  resolveDeletedAtFromStatus,
} from './pengguna-admin.util';

describe('Pengujian util pengguna admin', () => {
  describe('Pengujian rethrowPrismaUniqueViolation', () => {
    it('seharusnya melempar ConflictException ketika error Prisma P2002 terjadi', () => {
      const err = new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: 'test',
      });
      expect(() => rethrowPrismaUniqueViolation(err)).toThrow(ConflictException);
    });

    it('seharusnya tidak melempar error untuk jenis error lain', () => {
      expect(() => rethrowPrismaUniqueViolation(new Error('other'))).not.toThrow();
    });
  });

  describe('Pengujian resolveDeletedAtFromStatus', () => {
    it('seharusnya mengisi tanggal ketika status nonaktif', () => {
      const actual = resolveDeletedAtFromStatus('NONAKTIF', null);
      expect(actual).toBeInstanceOf(Date);
    });

    it('seharusnya mengosongkan nilai ketika status aktif', () => {
      expect(resolveDeletedAtFromStatus('AKTIF', new Date())).toBeNull();
    });

    it('seharusnya mempertahankan nilai saat ini ketika status tidak dikirim', () => {
      const current = new Date('2020-01-01');
      expect(resolveDeletedAtFromStatus(undefined, current)).toBe(current);
    });
  });

  describe('Pengujian assertAtLeastOneUpdateField', () => {
    it('seharusnya melempar error ketika semua field update kosong', () => {
      expect(() => assertAtLeastOneUpdateField([undefined, undefined])).toThrow(
        BadRequestException,
      );
    });

    it('seharusnya tidak melempar error ketika ada nilai yang bukan undefined (termasuk null atau falsy) (Edge Case)', () => {
      expect(() => assertAtLeastOneUpdateField([undefined, null])).not.toThrow();
      expect(() => assertAtLeastOneUpdateField([false, undefined])).not.toThrow();
      expect(() => assertAtLeastOneUpdateField([0])).not.toThrow();
      expect(() => assertAtLeastOneUpdateField([''])).not.toThrow();
    });
  });

  describe('Pengujian assertEmailNipUniqueOnUpdate', () => {
    const repo = {
      existsEmailOtherThan: jest.fn(),
      existsNipOtherThan: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
      repo.existsEmailOtherThan.mockResolvedValue(false);
      repo.existsNipOtherThan.mockResolvedValue(false);
    });

    it('seharusnya melempar error ketika email sudah digunakan', async () => {
      repo.existsEmailOtherThan.mockResolvedValueOnce(true);
      await expect(
        assertEmailNipUniqueOnUpdate(
          repo,
          'u1',
          { email: 'a@x.id', nip: '1' },
          'b@x.id',
          undefined,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('seharusnya melempar error ketika NIP sudah digunakan', async () => {
      repo.existsNipOtherThan.mockResolvedValueOnce(true);
      await expect(
        assertEmailNipUniqueOnUpdate(repo, 'u1', { email: 'a@x.id', nip: '1' }, undefined, '2'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('seharusnya melewati pengecekan ketika nilai tidak berubah', async () => {
      await assertEmailNipUniqueOnUpdate(repo, 'u1', { email: 'a@x.id', nip: '1' }, 'a@x.id', '1');
      expect(repo.existsEmailOtherThan).not.toHaveBeenCalled();
      expect(repo.existsNipOtherThan).not.toHaveBeenCalled();
    });
    it('seharusnya hanya memvalidasi NIP jika hanya nipNext yang berubah dan tidak undef (Edge Case)', async () => {
      await assertEmailNipUniqueOnUpdate(repo, 'u1', { email: 'a@x.id', nip: '1' }, undefined, '2');
      expect(repo.existsEmailOtherThan).not.toHaveBeenCalled();
      expect(repo.existsNipOtherThan).toHaveBeenCalledWith('2', 'u1');
    });

    it('seharusnya hanya memvalidasi Email jika hanya emailNext yang berubah dan tidak undef (Edge Case)', async () => {
      await assertEmailNipUniqueOnUpdate(
        repo,
        'u1',
        { email: 'a@x.id', nip: '1' },
        'b@x.id',
        undefined,
      );
      expect(repo.existsEmailOtherThan).toHaveBeenCalledWith('b@x.id', 'u1');
      expect(repo.existsNipOtherThan).not.toHaveBeenCalled();
    });
  });
});
