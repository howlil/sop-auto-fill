import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtAccessPayload } from '../../../common';
import { StatusSOP } from '../../../generated/prisma';
import type { SopAiSnapshot } from '../ai-common/sop-ai-snapshot.types';
import type { SopQualityFinding } from '../ai-review/sop-ai-review.types';
import { SopAiRevisionService } from './sop-ai-revision.service';

const user: JwtAccessPayload = {
  sub: 'owner-1',
  email: 'owner@example.test',
  name: 'Owner Test',
};

const snapshot: SopAiSnapshot = {
  detailSopId: 'detail-db-1',
  versi: 3,
  judul: 'SOP Pelayanan',
  nomorSop: '001/SOP',
  namaLembaga: 'Unit Pelayanan',
  peringatan: ['Pastikan data benar'],
  kualifikasiPelaksanaan: ['Memahami layanan'],
  peralatanPerlengkapan: ['Komputer'],
  pencatatanPendataan: ['Register'],
  actors: [{ pelaksanaId: 'actor-db-1', name: 'Petugas', order: 1 }],
  steps: [
    {
      langkahSopId: 'step-db-1',
      urutan: 1,
      kegiatan: 'Menerima permohonan',
      jenis: 'AWAL_AKHIR',
      kelengkapan: 'Formulir',
      keluaran: 'Permohonan diterima',
      waktu: 5,
      satuanWaktu: 'm',
      keterangan: 'Catat',
      actorName: 'Petugas',
      targetYaUrutan: null,
      targetTidakUrutan: null,
    },
    {
      langkahSopId: 'step-db-2',
      urutan: 2,
      kegiatan: 'Memverifikasi permohonan',
      jenis: 'KEGIATAN',
      kelengkapan: 'Permohonan diterima',
      keluaran: 'Hasil verifikasi',
      waktu: 10,
      satuanWaktu: 'm',
      keterangan: 'Periksa kelengkapan',
      actorName: 'Petugas',
      targetYaUrutan: null,
      targetTidakUrutan: null,
    },
  ],
};

const eligibleFinding: SopQualityFinding = {
  severity: 'WARNING',
  category: 'INPUT_OUTPUT',
  location: { kind: 'STEP', stepOrder: 2 },
  title: 'Keluaran terlalu umum',
  explanation: 'Keluaran belum menjelaskan hasil verifikasi secara spesifik.',
  recommendation: 'Perjelas keluaran yang dihasilkan langkah ini.',
};

const manualFinding: SopQualityFinding = {
  ...eligibleFinding,
  category: 'DECISION_ROUTING',
};

function makeService(mode: 'disabled' | 'fake' | 'openai' = 'fake') {
  const repository = { findContext: jest.fn() };
  const provider = { suggest: jest.fn() };
  const config = {
    get: jest.fn((key: string) => (key === 'AI_REVISION_PROVIDER' ? mode : undefined)),
  } as unknown as ConfigService;
  const service = new SopAiRevisionService(repository as any, provider as any, config);
  return { service, repository, provider };
}

describe('SopAiRevisionService', () => {
  it('exposes provider-independent availability', () => {
    expect(makeService('disabled').service.availability()).toEqual({ enabled: false });
    expect(makeService('fake').service.availability()).toEqual({ enabled: true });
  });

  it('rejects disabled mode before repository access', async () => {
    const { service, repository, provider } = makeService('disabled');
    await expect(service.suggest(user, 'detail-db-1', eligibleFinding)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(repository.findContext).not.toHaveBeenCalled();
    expect(provider.suggest).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing SOP without provider invocation', async () => {
    const { service, repository, provider } = makeService();
    repository.findContext.mockResolvedValue(null);
    await expect(service.suggest(user, 'missing', eligibleFinding)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(provider.suggest).not.toHaveBeenCalled();
  });

  it('checks ownership before provider invocation', async () => {
    const { service, repository, provider } = makeService();
    repository.findContext.mockResolvedValue({
      ownerId: 'other-user',
      status: StatusSOP.DRAFT,
      snapshot,
    });
    await expect(service.suggest(user, 'detail-db-1', eligibleFinding)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(provider.suggest).not.toHaveBeenCalled();
  });

  it.each([StatusSOP.COMPLETED, StatusSOP.ARCHIVED])(
    'rejects %s before provider invocation',
    async (status) => {
      const { service, repository, provider } = makeService();
      repository.findContext.mockResolvedValue({ ownerId: user.sub, status, snapshot });
      await expect(service.suggest(user, 'detail-db-1', eligibleFinding)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(provider.suggest).not.toHaveBeenCalled();
    },
  );

  it('rejects manual-only findings before provider invocation', async () => {
    const { service, repository, provider } = makeService();
    repository.findContext.mockResolvedValue({
      ownerId: user.sub,
      status: StatusSOP.DRAFT,
      snapshot,
    });
    await expect(service.suggest(user, 'detail-db-1', manualFinding)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(provider.suggest).not.toHaveBeenCalled();
  });

  it('sends only provider-safe content and derived targets', async () => {
    const { service, repository, provider } = makeService();
    repository.findContext.mockResolvedValue({
      ownerId: user.sub,
      status: StatusSOP.DRAFT,
      snapshot,
    });
    provider.suggest.mockResolvedValue({
      target: { kind: 'STEP', stepOrder: 2, field: 'KELUARAN' },
      after: 'Berita acara hasil verifikasi',
      rationale: 'Keluaran dibuat lebih spesifik.',
    });

    await expect(service.suggest(user, 'detail-db-1', eligibleFinding)).resolves.toEqual({
      sourceDetailSopId: 'detail-db-1',
      sourceVersion: 3,
      suggestion: {
        target: { kind: 'STEP', stepOrder: 2, field: 'KELUARAN' },
        before: 'Hasil verifikasi',
        after: 'Berita acara hasil verifikasi',
        rationale: 'Keluaran dibuat lebih spesifik.',
      },
    });

    expect(provider.suggest).toHaveBeenCalledTimes(1);
    const providerInput = provider.suggest.mock.calls[0][0];
    expect(providerInput.allowedTargets).toEqual([
      { kind: 'STEP', stepOrder: 2, field: 'KELENGKAPAN' },
      { kind: 'STEP', stepOrder: 2, field: 'KELUARAN' },
    ]);
    expect(providerInput.finding).toEqual(eligibleFinding);
    const serialized = JSON.stringify(providerInput);
    expect(serialized).not.toContain('detail-db-1');
    expect(serialized).not.toContain('actor-db-1');
    expect(serialized).not.toContain('step-db-1');
    expect(serialized).not.toContain('step-db-2');
    expect(serialized).not.toContain('001/SOP');
    expect(serialized).not.toContain('Unit Pelayanan');
    expect(serialized).not.toContain(user.sub);
    expect(serialized).not.toContain(user.email);
  });

  it('maps invalid provider output to a safe 422', async () => {
    const { service, repository, provider } = makeService();
    repository.findContext.mockResolvedValue({
      ownerId: user.sub,
      status: StatusSOP.DRAFT,
      snapshot,
    });
    provider.suggest.mockResolvedValue({
      target: { kind: 'STEP', stepOrder: 2, field: 'KETERANGAN' },
      after: 'Perubahan yang tidak diizinkan oleh finding ini',
      rationale: 'Target tidak termasuk allowlist.',
    });

    const promise = service.suggest(user, 'detail-db-1', eligibleFinding);
    await expect(promise).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(promise).rejects.not.toThrow(/KETERANGAN|allowlist|step-db/);
  });
});
