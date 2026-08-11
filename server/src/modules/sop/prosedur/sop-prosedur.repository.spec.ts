import { BagianSOP, JenisLangkahProsedur, SatuanWaktu } from '../../../generated/prisma';
import type { PrismaService } from '../../../common/prisma/prisma.service';
import { buildLogSummary } from '../collaboration/log-edit-session.helper';
import { SopProsedurRepository } from './sop-prosedur.repository';

interface CallLog {
  table: string;
  op: string;
  args: unknown;
}

function makeTx(existingLangkahIds: string[]): {
  tx: any;
  calls: CallLog[];
} {
  const calls: CallLog[] = [];
  const record = (table: string, op: string) =>
    jest.fn(async (args: unknown) => {
      calls.push({ table, op, args });
      if (table === 'langkahSOP' && op === 'findMany') {
        return existingLangkahIds.map((id) => ({ langkahSopId: id }));
      }
      if (table === 'langkahSOP' && op === 'create') {
        const data = (args as { data: { langkahSopId: string } }).data;
        return { langkahSopId: data.langkahSopId };
      }
      if (table === 'logEditSOP' && op === 'findFirst') {
        return null;
      }
      return { count: 0 };
    });

  const tx = {
    detailSOPPelaksana: {
      deleteMany: record('detailSOPPelaksana', 'deleteMany'),
      createMany: record('detailSOPPelaksana', 'createMany'),
    },
    langkahSOP: {
      findMany: record('langkahSOP', 'findMany'),
      updateMany: record('langkahSOP', 'updateMany'),
      deleteMany: record('langkahSOP', 'deleteMany'),
      create: record('langkahSOP', 'create'),
      update: record('langkahSOP', 'update'),
    },
    detailSOP: { update: record('detailSOP', 'update') },
    logEditSOP: {
      findFirst: record('logEditSOP', 'findFirst'),
      create: record('logEditSOP', 'create'),
      update: record('logEditSOP', 'update'),
      updateMany: record('logEditSOP', 'updateMany'),
    },
    logEditSopDomainField: {
      deleteMany: record('logEditSopDomainField', 'deleteMany'),
      createMany: record('logEditSopDomainField', 'createMany'),
    },
  };
  return { tx, calls };
}

describe('Pengujian SopProsedurRepository.updateProsedurTransaction', () => {
  function makeRepo(existingLangkahIds: string[]): {
    repo: SopProsedurRepository;
    calls: CallLog[];
  } {
    const { tx, calls } = makeTx(existingLangkahIds);
    const prismaMock = {
      $transaction: jest.fn(async (cb: (tx: unknown) => Promise<void>) => cb(tx)),
    } as unknown as PrismaService;
    const repo = new SopProsedurRepository(prismaMock);
    return { repo, calls };
  }

  it('seharusnya hanya mengganti pelaksana ketika hanya pelaksana yang dikirim', async () => {
    const { repo, calls } = makeRepo([]);
    await repo.updateProsedurTransaction({
      detailSopId: 'det-1',
      userId: 'u-1',
      input: { pelaksana: [{ pelaksanaId: 'p-1' }, { pelaksanaId: 'p-2' }] },
      changedFields: ['pelaksana'],
    });
    const swimlaneOps = calls.filter((c) => c.table === 'detailSOPPelaksana');
    expect(swimlaneOps.map((c) => c.op)).toEqual(['deleteMany', 'createMany']);
    expect(calls.some((c) => c.table === 'langkahSOP' && c.op === 'deleteMany')).toBe(false);
    expect(calls.some((c) => c.table === 'detailSOP' && c.op === 'update')).toBe(true);
    expect(calls.some((c) => c.table === 'logEditSOP')).toBe(true);
  });

  it('seharusnya memutus self FK, menghapus, menambahkan, lalu menghubungkan ulang', async () => {
    const { repo, calls } = makeRepo(['L-1', 'L-2']);
    await repo.updateProsedurTransaction({
      detailSopId: 'det-1',
      userId: 'u-1',
      input: {
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
        defaultPelaksanaId: 'p-1',
      },
      changedFields: ['langkah'],
    });

    const opsOrder = calls
      .filter((c) => ['langkahSOP', 'detailSOP', 'logEditSOP'].includes(c.table))
      .map((c) => `${c.table}.${c.op}`);

    const idxFindMany = opsOrder.indexOf('langkahSOP.findMany');
    const idxUpdateMany = opsOrder.indexOf('langkahSOP.updateMany');
    const idxLangkahDelete = opsOrder.indexOf('langkahSOP.deleteMany');
    const idxFirstCreate = opsOrder.indexOf('langkahSOP.create');
    const idxBranchUpdate = opsOrder.indexOf('langkahSOP.update');
    const idxDetailUpdate = opsOrder.indexOf('detailSOP.update');
    const idxLogCreate = opsOrder.lastIndexOf('logEditSOP.create');

    expect(idxFindMany).toBeGreaterThanOrEqual(0);
    expect(idxUpdateMany).toBeGreaterThan(idxFindMany);
    expect(idxLangkahDelete).toBeGreaterThan(idxUpdateMany);
    expect(idxFirstCreate).toBeGreaterThan(idxLangkahDelete);
    expect(idxBranchUpdate).toBeGreaterThan(idxFirstCreate);
    expect(idxDetailUpdate).toBeGreaterThan(idxBranchUpdate);
    expect(idxLogCreate).toBeGreaterThan(idxDetailUpdate);

    /* Branch update hanya untuk langkah yang punya cabang. */
    const branchUpdates = calls.filter((c) => c.table === 'langkahSOP' && c.op === 'update');
    expect(branchUpdates).toHaveLength(1);
  });

  it('seharusnya menambahkan langkah baru tanpa cleanup diagram ketika belum ada langkah', async () => {
    const { repo, calls } = makeRepo([]);
    await repo.updateProsedurTransaction({
      detailSopId: 'det-1',
      userId: 'u-1',
      input: {
        langkah: [
          {
            tempId: 't-1',
            jenis: JenisLangkahProsedur.KEGIATAN,
            kegiatan: 'baru',
            pelaksanaId: 'p-1',
          },
        ],
        defaultPelaksanaId: 'p-1',
      },
      changedFields: ['langkah'],
    });
    expect(calls.some((c) => c.table === 'langkahSOP' && c.op === 'create')).toBe(true);
  });

  it('seharusnya memanggil log helper dengan bagian LANGKAH dan field yang berubah', async () => {
    const { repo, calls } = makeRepo([]);
    await repo.updateProsedurTransaction({
      detailSopId: 'det-1',
      userId: 'u-1',
      input: { pelaksana: [] },
      changedFields: ['pelaksana'],
    });
    const logCreate = calls.find((c) => c.table === 'logEditSOP' && c.op === 'create');
    expect(logCreate).toBeDefined();
    type LogCreateData = {
      bagian: BagianSOP;
      sesiChangeCount: number;
      keterangan: string;
      closedAt: Date | null;
      domainFields: { create: Array<{ domainField: string }> };
    };
    const data = (logCreate!.args as { data: LogCreateData }).data;
    expect(data.bagian).toBe(BagianSOP.LANGKAH);
    expect(data.sesiChangeCount).toBe(1);
    expect(data.closedAt).toBeNull();
    expect(data.keterangan).toBe(
      buildLogSummary(BagianSOP.LANGKAH, { fields: ['pelaksana'], count: 1 }),
    );
    expect(data.domainFields.create).toEqual([{ domainField: 'pelaksana' }]);
    expect(calls.some((c) => c.table === 'logEditSOP' && c.op === 'findFirst')).toBe(true);
  });
});
