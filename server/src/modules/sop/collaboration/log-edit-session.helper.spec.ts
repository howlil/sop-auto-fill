import { BagianSOP } from '../../../generated/prisma';
import {
  appendOrCreateLogSession,
  buildLogSummary,
  DEFAULT_LOG_SESSION_IDLE_MS,
  translateField,
  encodeLogEditSopClientId,
  type LogEditSessionMeta,
} from './log-edit-session.helper';

interface FakeDomainRow {
  detailSopId: string;
  penggunaId: string;
  logCreatedAt: Date;
  domainField: string;
}

interface FakeLogRow {
  detailSopId: string;
  penggunaId: string;
  createdAt: Date;
  bagian: BagianSOP;
  keterangan: string | null;
  sesiChangeCount: number;
  closedAt: Date | null;
  updatedAt: Date;
  domainFields: FakeDomainRow[];
}

interface CapturedTx {
  rows: FakeLogRow[];
  domainRows: FakeDomainRow[];
  findFirst: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  updateMany: jest.Mock;
  domainDeleteMany: jest.Mock;
  domainCreateMany: jest.Mock;
  setClock: (now: Date) => void;
}

function makeTx(): {
  tx: {
    logEditSOP: CapturedTx;
    logEditSopDomainField: Pick<CapturedTx, 'domainDeleteMany' | 'domainCreateMany'>;
  };
  capture: CapturedTx;
} {
  const rows: FakeLogRow[] = [];
  const domainRows: FakeDomainRow[] = [];
  let clock: Date = new Date();
  const capture: CapturedTx = {
    rows,
    domainRows,
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    domainDeleteMany: jest.fn(),
    domainCreateMany: jest.fn(),
    setClock: (next) => {
      clock = next;
    },
  };

  capture.findFirst.mockImplementation(
    async (args: { where: Record<string, unknown>; include?: unknown }) => {
      const w = args.where;
      const cutoff = (w.updatedAt as { gt: Date } | undefined)?.gt;
      const candidates = rows.filter(
        (r) =>
          r.detailSopId === w.detailSopId &&
          r.penggunaId === w.penggunaId &&
          r.bagian === w.bagian &&
          r.closedAt === null &&
          (cutoff === undefined || r.updatedAt > cutoff),
      );
      candidates.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      const hit = candidates[0] ?? null;
      if (hit === null) {
        return null;
      }
      if (
        args.include !== undefined &&
        typeof args.include === 'object' &&
        'domainFields' in (args.include as object)
      ) {
        return {
          ...hit,
          domainFields: hit.domainFields.map((df) => ({ domainField: df.domainField })),
        };
      }
      return hit;
    },
  );

  capture.create.mockImplementation(async (args: { data: Record<string, unknown> }) => {
    const d = args.data;
    const createdAt = d.createdAt as Date;
    const detailSopId = d.detailSopId as string;
    const penggunaId = d.penggunaId as string;
    const nested = d.domainFields as { create: { domainField: string }[] } | undefined;
    const creates = nested?.create ?? [];
    const domainFields: FakeDomainRow[] = creates.map((c) => ({
      detailSopId,
      penggunaId,
      logCreatedAt: createdAt,
      domainField: c.domainField,
    }));
    domainRows.push(...domainFields);
    const row: FakeLogRow = {
      detailSopId,
      penggunaId,
      createdAt,
      bagian: d.bagian as BagianSOP,
      keterangan: (d.keterangan as string | null | undefined) ?? null,
      sesiChangeCount: (d.sesiChangeCount as number | undefined) ?? 1,
      closedAt: (d.closedAt as Date | null | undefined) ?? null,
      updatedAt: clock,
      domainFields,
    };
    rows.push(row);
    return row;
  });

  capture.update.mockImplementation(
    async (args: {
      where: {
        detailSopId_penggunaId_createdAt: {
          detailSopId: string;
          penggunaId: string;
          createdAt: Date;
        };
      };
      data: Record<string, unknown>;
    }) => {
      const k = args.where.detailSopId_penggunaId_createdAt;
      const idx = rows.findIndex(
        (r) =>
          r.detailSopId === k.detailSopId &&
          r.penggunaId === k.penggunaId &&
          r.createdAt.getTime() === k.createdAt.getTime(),
      );
      if (idx === -1) {
        throw new Error('row not found');
      }
      const target = rows[idx];
      const updated: FakeLogRow = {
        ...target,
        sesiChangeCount:
          'sesiChangeCount' in args.data
            ? (args.data.sesiChangeCount as number)
            : target.sesiChangeCount,
        keterangan:
          'keterangan' in args.data ? (args.data.keterangan as string | null) : target.keterangan,
        closedAt: 'closedAt' in args.data ? (args.data.closedAt as Date | null) : target.closedAt,
        updatedAt: clock,
        domainFields: target.domainFields,
      };
      rows[idx] = updated;
      return updated;
    },
  );

  capture.updateMany.mockImplementation(
    async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const w = args.where;
      let count = 0;
      for (let i = 0; i < rows.length; i += 1) {
        const r = rows[i];
        if (
          r.detailSopId === w.detailSopId &&
          r.penggunaId === w.penggunaId &&
          r.bagian === w.bagian &&
          (w.closedAt === null ? r.closedAt === null : true)
        ) {
          rows[i] = {
            ...r,
            closedAt: (args.data.closedAt as Date | null) ?? r.closedAt,
            updatedAt: clock,
          };
          count += 1;
        }
      }
      return { count };
    },
  );

  capture.domainDeleteMany.mockImplementation(async (args: { where: Record<string, unknown> }) => {
    const w = args.where;
    let n = 0;
    for (let i = domainRows.length - 1; i >= 0; i -= 1) {
      const d = domainRows[i];
      if (
        d.detailSopId === w.detailSopId &&
        d.penggunaId === w.penggunaId &&
        d.logCreatedAt.getTime() === (w.logCreatedAt as Date).getTime()
      ) {
        domainRows.splice(i, 1);
        n += 1;
      }
    }
    for (const r of rows) {
      if (
        r.detailSopId === w.detailSopId &&
        r.penggunaId === w.penggunaId &&
        r.createdAt.getTime() === (w.logCreatedAt as Date).getTime()
      ) {
        r.domainFields = [];
      }
    }
    return { count: n };
  });

  capture.domainCreateMany.mockImplementation(async (args: { data: FakeDomainRow[] }) => {
    for (const d of args.data) {
      domainRows.push(d);
      const parent = rows.find(
        (r) =>
          r.detailSopId === d.detailSopId &&
          r.penggunaId === d.penggunaId &&
          r.createdAt.getTime() === d.logCreatedAt.getTime(),
      );
      if (parent !== undefined) {
        parent.domainFields.push(d);
      }
    }
    return { count: args.data.length };
  });

  return {
    tx: {
      logEditSOP: capture,
      logEditSopDomainField: {
        domainDeleteMany: capture.domainDeleteMany,
        domainCreateMany: capture.domainCreateMany,
      },
    },
    capture,
  };
}

/** Mock tx: hanya delegate log + domain field (sisanya tidak dipakai helper). */
function asAppendTx(
  raw: ReturnType<typeof makeTx>['tx'],
): Parameters<typeof appendOrCreateLogSession>[0]['tx'] {
  return {
    logEditSOP: raw.logEditSOP,
    logEditSopDomainField: {
      deleteMany: raw.logEditSopDomainField.domainDeleteMany,
      createMany: raw.logEditSopDomainField.domainCreateMany,
    },
  } as unknown as Parameters<typeof appendOrCreateLogSession>[0]['tx'];
}

async function appendAt(capture: CapturedTx, now: Date, fn: () => Promise<void>): Promise<void> {
  capture.setClock(now);
  await fn();
}

describe('Pengujian helper sesi log edit', () => {
  describe('Pengujian translateField', () => {
    it('seharusnya mengembalikan label Indonesia untuk field yang dikenal', () => {
      expect(translateField('judul')).toBe('Judul SOP');
      expect(translateField('peringatan')).toBe('Peringatan');
    });
    it('seharusnya meneruskan field yang tidak dikenal apa adanya', () => {
      expect(translateField('xyz')).toBe('xyz');
    });
  });

  describe('Pengujian buildLogSummary', () => {
    it('seharusnya memformat ringkasan ketika jumlah lebih dari satu', () => {
      const meta: LogEditSessionMeta = { fields: ['peringatan', 'judul'], count: 5 };
      expect(buildLogSummary(BagianSOP.HEADER, meta)).toBe(
        'Header SOP: Peringatan, Judul SOP (5 perubahan)',
      );
    });
    it('seharusnya memformat tunggal tanpa jumlah sufiks', () => {
      const meta: LogEditSessionMeta = { fields: ['nomorSOP'], count: 1 };
      expect(buildLogSummary(BagianSOP.HEADER, meta)).toBe('Header SOP: Nomor SOP');
    });
    it('seharusnya menangani field kosong hanya dengan label bagian', () => {
      const meta: LogEditSessionMeta = { fields: [], count: 1 };
      expect(buildLogSummary(BagianSOP.STATUS, meta)).toBe('Status SOP');
    });
  });

  describe('Pengujian appendOrCreateLogSession', () => {
    const detailSopId = 'detail-1';
    const penggunaId = 'user-1';

    it('seharusnya membuat sesi baru ketika tidak ada sesi terbuka', async () => {
      const { tx, capture } = makeTx();
      const now = new Date('2026-05-04T10:00:00Z');
      await appendAt(capture, now, () =>
        appendOrCreateLogSession({
          tx: asAppendTx(tx),
          detailSopId,
          penggunaId,
          bagian: BagianSOP.HEADER,
          fields: ['peringatan'],
          now,
        }),
      );
      expect(capture.findFirst).toHaveBeenCalledTimes(1);
      expect(capture.create).toHaveBeenCalledTimes(1);
      expect(capture.rows[0]).toMatchObject({
        bagian: BagianSOP.HEADER,
        closedAt: null,
        keterangan: 'Header SOP: Peringatan',
      });
    });

    it('seharusnya menggabungkan ke sesi terbuka dalam jendela waktu idle', async () => {
      const { tx, capture } = makeTx();
      const t1 = new Date('2026-05-04T10:00:00Z');
      const t2 = new Date(t1.getTime() + 5 * 60 * 1000);
      await appendAt(capture, t1, () =>
        appendOrCreateLogSession({
          tx: asAppendTx(tx),
          detailSopId,
          penggunaId,
          bagian: BagianSOP.HEADER,
          fields: ['peringatan'],
          now: t1,
        }),
      );
      await appendAt(capture, t2, () =>
        appendOrCreateLogSession({
          tx: asAppendTx(tx),
          detailSopId,
          penggunaId,
          bagian: BagianSOP.HEADER,
          fields: ['nomorSOP'],
          now: t2,
        }),
      );
      expect(capture.create).toHaveBeenCalledTimes(1);
      expect(capture.update).toHaveBeenCalledTimes(1);
      expect(capture.domainDeleteMany).toHaveBeenCalled();
      expect(capture.domainCreateMany).toHaveBeenCalled();
      expect(capture.rows.length).toBe(1);
      expect(capture.rows[0].sesiChangeCount).toBe(2);
      const keys = capture.rows[0].domainFields.map((x) => x.domainField).sort();
      expect(keys).toEqual(['nomorSOP', 'peringatan'].sort());
      expect(capture.rows[0].keterangan).toContain('Header SOP');
      expect(capture.rows[0].keterangan).toContain('(2 perubahan)');
    });

    it('seharusnya membuat sesi kedua setelah jendela waktu idle berakhir', async () => {
      const { tx, capture } = makeTx();
      const t1 = new Date('2026-05-04T10:00:00Z');
      const t2 = new Date(t1.getTime() + DEFAULT_LOG_SESSION_IDLE_MS + 60 * 1000);
      await appendAt(capture, t1, () =>
        appendOrCreateLogSession({
          tx: asAppendTx(tx),
          detailSopId,
          penggunaId,
          bagian: BagianSOP.HEADER,
          fields: ['peringatan'],
          now: t1,
        }),
      );
      await appendAt(capture, t2, () =>
        appendOrCreateLogSession({
          tx: asAppendTx(tx),
          detailSopId,
          penggunaId,
          bagian: BagianSOP.HEADER,
          fields: ['judul'],
          now: t2,
        }),
      );
      expect(capture.create).toHaveBeenCalledTimes(2);
      expect(capture.rows[0].closedAt).not.toBeNull();
      expect(capture.rows[1].closedAt).toBeNull();
    });

    it('seharusnya melewati sesi menggabungkan ketika terpisah true', async () => {
      const { tx, capture } = makeTx();
      const t1 = new Date('2026-05-04T10:00:00Z');
      const t2 = new Date(t1.getTime() + 60 * 1000);
      await appendAt(capture, t1, () =>
        appendOrCreateLogSession({
          tx: asAppendTx(tx),
          detailSopId,
          penggunaId,
          bagian: BagianSOP.UMPAN_BALIK,
          fields: ['create'],
          discrete: true,
          now: t1,
        }),
      );
      await appendAt(capture, t2, () =>
        appendOrCreateLogSession({
          tx: asAppendTx(tx),
          detailSopId,
          penggunaId,
          bagian: BagianSOP.UMPAN_BALIK,
          fields: ['create'],
          discrete: true,
          now: t2,
        }),
      );
      expect(capture.create).toHaveBeenCalledTimes(2);
      expect(capture.findFirst).not.toHaveBeenCalled();
      expect(capture.rows[0].closedAt).toEqual(t1);
      expect(capture.rows[1].closedAt).toEqual(t2);
    });

    it('seharusnya menggabungkan sesi langkah ketika masih dalam window idle yang sama', async () => {
      const { tx, capture } = makeTx();
      const t1 = new Date('2026-05-04T10:00:00Z');
      const t2 = new Date(t1.getTime() + 60 * 1000);
      await appendAt(capture, t1, () =>
        appendOrCreateLogSession({
          tx: asAppendTx(tx),
          detailSopId,
          penggunaId,
          bagian: BagianSOP.LANGKAH,
          fields: ['kegiatan'],
          now: t1,
        }),
      );
      await appendAt(capture, t2, () =>
        appendOrCreateLogSession({
          tx: asAppendTx(tx),
          detailSopId,
          penggunaId,
          bagian: BagianSOP.LANGKAH,
          fields: ['kegiatan'],
          now: t2,
        }),
      );
      expect(capture.create).toHaveBeenCalledTimes(1);
      expect(capture.rows.length).toBe(1);
      expect(capture.rows[0].sesiChangeCount).toBe(2);
    });
  });

  // --- COMPREHENSIVE TESTS (FALSE, WORST, EDGE CASES) ---

  describe('Pengujian encodeLogEditSopClientId', () => {
    it('seharusnya mengenkode id klien dengan pemisah unit (Success Case)', () => {
      const now = new Date('2026-06-01T10:00:00Z');
      const encoded = encodeLogEditSopClientId('det-1', 'usr-2', now);
      expect(encoded).toBe(`det-1\u001fusr-2\u001f2026-06-01T10:00:00.000Z`);
    });
  });

  describe('Pengujian Edge & Worst Cases untuk appendOrCreateLogSession', () => {
    const detailSopId = 'detail-1';
    const penggunaId = 'user-1';

    it('seharusnya menangani input fields yang kotor (string kosong, undefined, whitespace, null) dengan aman (Worst Case)', async () => {
      const { tx, capture } = makeTx();
      const now = new Date('2026-05-04T10:00:00Z');

      // Simulasi dirty data: null/undefined di-bypass TS lewat tipe any
      const dirtyFields = [
        'peringatan',
        '',
        '   ',
        null,
        undefined,
        'peringatan',
        'judul',
        '',
      ] as any as string[];

      await appendAt(capture, now, () =>
        appendOrCreateLogSession({
          tx: asAppendTx(tx),
          detailSopId,
          penggunaId,
          bagian: BagianSOP.HEADER,
          fields: dirtyFields,
          now,
        }),
      );

      expect(capture.create).toHaveBeenCalledTimes(1);
      const created = capture.rows[0];
      // Hanya peringatan dan judul yang lolos
      expect(created.keterangan).toContain('Peringatan');
      expect(created.keterangan).toContain('Judul SOP');
      const domains = created.domainFields.map((d) => d.domainField).sort();
      expect(domains).toEqual(['judul', 'peringatan'].sort());
    });

    it('seharusnya melewati createMany domain fields jika fields disanitasi menjadi kosong sepenuhnya (Edge Case)', async () => {
      const { tx, capture } = makeTx();
      const t1 = new Date('2026-05-04T10:00:00Z');
      const t2 = new Date('2026-05-04T10:05:00Z');

      await appendAt(capture, t1, () =>
        appendOrCreateLogSession({
          tx: asAppendTx(tx),
          detailSopId,
          penggunaId,
          bagian: BagianSOP.STATUS,
          fields: ['status'],
          now: t1,
        }),
      );

      // Simulasi array fields kosong saat update
      await appendAt(capture, t2, () =>
        appendOrCreateLogSession({
          tx: asAppendTx(tx),
          detailSopId,
          penggunaId,
          bagian: BagianSOP.STATUS,
          fields: ['', '   '] as any as string[],
          now: t2,
        }),
      );

      expect(capture.update).toHaveBeenCalledTimes(1);
      // domainCreateMany seharusnya tidak menghasilkan elemen baru atau tidak dipanggil dengan array panjang (dalam simulasi ini 1 unik dari old)
      // Fungsi helper replaceDomainFields tetap dipanggil untuk menyimpan union (['status'] + []) -> ['status']
      expect(capture.rows[0].domainFields.map((x) => x.domainField)).toEqual(['status']);
    });

    it('seharusnya menghormati override idleWindowMs dan memisahkan sesi walaupun dalam jendela default (Edge Case)', async () => {
      const { tx, capture } = makeTx();
      const t1 = new Date('2026-05-04T10:00:00Z');
      // Beda 5 detik
      const t2 = new Date(t1.getTime() + 5000);

      await appendAt(capture, t1, () =>
        appendOrCreateLogSession({
          tx: asAppendTx(tx),
          detailSopId,
          penggunaId,
          bagian: BagianSOP.LANGKAH,
          fields: ['kegiatan'],
          now: t1,
          idleWindowMs: 1000, // Jendela idle 1 detik
        }),
      );

      await appendAt(capture, t2, () =>
        appendOrCreateLogSession({
          tx: asAppendTx(tx),
          detailSopId,
          penggunaId,
          bagian: BagianSOP.LANGKAH,
          fields: ['aktor'],
          now: t2,
          idleWindowMs: 1000, // Jendela idle 1 detik
        }),
      );

      // Seharusnya membuat 2 sesi terpisah karena selisih 5 detik > 1 detik window
      expect(capture.create).toHaveBeenCalledTimes(2);
      expect(capture.update).not.toHaveBeenCalled();
      expect(capture.rows[0].closedAt).toEqual(t2); // Ditutup oleh t2
      expect(capture.rows[1].closedAt).toBeNull(); // Masih open
    });

    it('seharusnya bisa menutup banyak sesi stale secara massal (stale session closure race condition) (Edge Case)', async () => {
      const { tx, capture } = makeTx();
      const t1 = new Date('2026-05-04T10:00:00Z');
      const t2 = new Date(t1.getTime() + DEFAULT_LOG_SESSION_IDLE_MS + 1000);

      // Inject secara manual 3 sesi open basi (biasanya akibat race condition)
      capture.rows.push({
        detailSopId,
        penggunaId,
        bagian: BagianSOP.EVALUASI,
        createdAt: new Date(t1.getTime() - 1000),
        closedAt: null,
        sesiChangeCount: 1,
        keterangan: '',
        updatedAt: t1,
        domainFields: [],
      });
      capture.rows.push({
        detailSopId,
        penggunaId,
        bagian: BagianSOP.EVALUASI,
        createdAt: new Date(t1.getTime() - 2000),
        closedAt: null,
        sesiChangeCount: 1,
        keterangan: '',
        updatedAt: t1,
        domainFields: [],
      });
      capture.rows.push({
        detailSopId,
        penggunaId,
        bagian: BagianSOP.EVALUASI,
        createdAt: new Date(t1.getTime() - 3000),
        closedAt: null,
        sesiChangeCount: 1,
        keterangan: '',
        updatedAt: t1,
        domainFields: [],
      });

      await appendAt(capture, t2, () =>
        appendOrCreateLogSession({
          tx: asAppendTx(tx),
          detailSopId,
          penggunaId,
          bagian: BagianSOP.EVALUASI,
          fields: ['catatan'],
          now: t2,
        }),
      );

      // create dipanggil 1 kali untuk sesi baru
      expect(capture.create).toHaveBeenCalledTimes(1);

      // 3 Sesi stale tersebut kini harus memiliki closedAt = t2
      expect(capture.rows[0].closedAt).toEqual(t2);
      expect(capture.rows[1].closedAt).toEqual(t2);
      expect(capture.rows[2].closedAt).toEqual(t2);
      // Sesi ke-4 (sesi baru) open
      expect(capture.rows[3].closedAt).toBeNull();
    });
  });
});
