import { BagianSOP } from '../../../generated/prisma';
import {
  appendOrCreateLogSession,
  buildLogSummary,
  encodeLogEditSopClientId,
  translateField,
} from './log-edit-session.helper';

function makeTx() {
  const logEditSOP = {
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  };
  const logEditSopDomainField = {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
  };
  return { tx: { logEditSOP, logEditSopDomainField } as any, logEditSOP };
}

describe('log edit session helper', () => {
  it('menghasilkan label hanya untuk bagian authoring yang masih didukung', () => {
    expect(buildLogSummary(BagianSOP.HEADER, { fields: ['judul'], count: 1 })).toBe(
      'Header SOP: Judul SOP',
    );
    expect(buildLogSummary(BagianSOP.LANGKAH, { fields: ['langkah'], count: 2 })).toBe(
      'Langkah Prosedur: Daftar Langkah (2 perubahan)',
    );
    expect(buildLogSummary(BagianSOP.STATUS, { fields: ['status'], count: 1 })).toBe(
      'Status SOP: Status SOP',
    );
    expect(translateField('custom')).toBe('custom');
  });

  it('membuat id log stabil dari detail, user, dan waktu', () => {
    expect(
      encodeLogEditSopClientId('detail-1', 'user-1', new Date('2026-08-01T00:00:00.000Z')),
    ).toBe('detail-1\u001fuser-1\u001f2026-08-01T00:00:00.000Z');
  });

  it('membuat log discrete sebagai sesi yang langsung ditutup', async () => {
    const { tx, logEditSOP } = makeTx();
    const now = new Date('2026-08-01T10:00:00.000Z');

    await appendOrCreateLogSession({
      tx,
      detailSopId: 'detail-1',
      penggunaId: 'user-1',
      bagian: BagianSOP.STATUS,
      fields: ['status'],
      discrete: true,
      now,
    });

    expect(logEditSOP.findFirst).not.toHaveBeenCalled();
    expect(logEditSOP.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        detailSopId: 'detail-1',
        penggunaId: 'user-1',
        bagian: BagianSOP.STATUS,
        sesiChangeCount: 1,
        closedAt: now,
      }),
    });
  });

  it('menutup sesi stale sebelum membuat sesi authoring baru', async () => {
    const { tx, logEditSOP } = makeTx();
    const now = new Date('2026-08-01T10:00:00.000Z');

    await appendOrCreateLogSession({
      tx,
      detailSopId: 'detail-1',
      penggunaId: 'user-1',
      bagian: BagianSOP.HEADER,
      fields: ['judul'],
      now,
    });

    expect(logEditSOP.findFirst).toHaveBeenCalled();
    expect(logEditSOP.updateMany).toHaveBeenCalledWith({
      where: {
        detailSopId: 'detail-1',
        penggunaId: 'user-1',
        bagian: BagianSOP.HEADER,
        closedAt: null,
      },
      data: { closedAt: now },
    });
    expect(logEditSOP.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ closedAt: null, bagian: BagianSOP.HEADER }),
    });
  });
});
