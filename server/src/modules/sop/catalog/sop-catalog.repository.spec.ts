import {
  BagianSOP,
  HasilEvaluasi,
  StatusPengajuanEvaluasi,
  StatusSOP,
  StatusTindakLanjut,
} from '../../../generated/prisma';
import type { PrismaService } from '../../../common/prisma/prisma.service';
import { SopCatalogRepository } from './sop-catalog.repository';

interface CallLog {
  table: string;
  op: string;
  args: unknown;
}

function makeStatusTx(): {
  tx: Record<string, unknown>;
  calls: CallLog[];
  setActiveNilai: (nilai: unknown) => void;
} {
  const calls: CallLog[] = [];
  let activeNilai: unknown = null;
  const record = (table: string, op: string) =>
    jest.fn(async (args: unknown) => {
      calls.push({ table, op, args });
      if (table === 'logEditSOP' && op === 'findFirst') {
        return null;
      }
      if (table === 'nilaiEvaluasi' && op === 'findFirst') {
        return activeNilai;
      }
      if (table === 'pengajuanEvaluasi' && op === 'updateMany') {
        return { count: 1 };
      }
      return { count: 0 };
    });
  const tx = {
    detailSOP: { update: record('detailSOP', 'update') },
    nilaiEvaluasi: {
      findFirst: record('nilaiEvaluasi', 'findFirst'),
      update: record('nilaiEvaluasi', 'update'),
    },
    logNilaiEvaluasi: {
      create: record('logNilaiEvaluasi', 'create'),
    },
    pengajuanEvaluasi: {
      updateMany: record('pengajuanEvaluasi', 'updateMany'),
    },
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
  return {
    tx,
    calls,
    setActiveNilai: (nilai: unknown) => {
      activeNilai = nilai;
    },
  };
}

describe('Pengujian logging status pada SopCatalogRepository', () => {
  function makeRepo(): {
    repo: SopCatalogRepository;
    calls: CallLog[];
    setActiveNilai: (nilai: unknown) => void;
  } {
    const { tx, calls, setActiveNilai } = makeStatusTx();
    const prismaMock = {
      $transaction: jest.fn(async (cb: (inner: unknown) => Promise<void>) => cb(tx)),
    } as unknown as PrismaService;
    return { repo: new SopCatalogRepository(prismaMock), calls, setActiveNilai };
  }

  it('seharusnya menulis log status terpisah ketika memperbarui status detail SOP', async () => {
    const { repo, calls } = makeRepo();
    await repo.updateDetailSopStatus({
      detailSopId: 'det-1',
      status: StatusSOP.MENUNGGU_PENGAJUAN_EVALUASI,
      userId: 'u-1',
    });
    expect(calls.some((c) => c.table === 'detailSOP' && c.op === 'update')).toBe(true);
    const logCreate = calls.find((c) => c.table === 'logEditSOP' && c.op === 'create');
    expect(logCreate).toBeDefined();
    const data = (logCreate!.args as { data: { bagian: BagianSOP; discrete?: boolean } }).data;
    expect(data.bagian).toBe(BagianSOP.STATUS);
    expect(
      (logCreate!.args as { data: { domainFields: { create: Array<{ domainField: string }> } } })
        .data.domainFields.create,
    ).toEqual(expect.arrayContaining([{ domainField: 'status' }]));
  });

  it('seharusnya menulis dua log status terpisah ketika revisi menjadi sedang dievaluasi', async () => {
    const { repo, calls } = makeRepo();
    await repo.transitionDetailSopRevisiToSedangDievaluasi({
      detailSopId: 'det-revisi',
      userId: 'u-penyusun',
    });
    const detailUpdates = calls.filter((c) => c.table === 'detailSOP' && c.op === 'update');
    expect(detailUpdates).toHaveLength(2);
    const logCreates = calls.filter((c) => c.table === 'logEditSOP' && c.op === 'create');
    expect(logCreates).toHaveLength(2);
    for (const entry of logCreates) {
      const data = (entry.args as { data: { bagian: BagianSOP } }).data;
      expect(data.bagian).toBe(BagianSOP.STATUS);
    }
  });

  it('seharusnya otomatis menandai tindak lanjut selesai saat kirim ulang revisi', async () => {
    const { repo, calls, setActiveNilai } = makeRepo();
    setActiveNilai({
      pengajuanEvaluasiId: 'pengajuan-1',
      detailSopId: 'det-revisi',
      hasil: HasilEvaluasi.PERLU_PERBAIKAN,
      catatan: 'Perbaiki keluaran',
      statusTindakLanjut: StatusTindakLanjut.TERBUKA,
      pengajuanEvaluasi: { status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI },
    });

    await repo.transitionDetailSopRevisiToSedangDievaluasi({
      detailSopId: 'det-revisi',
      userId: 'u-penyusun',
    });

    const nilaiUpdate = calls.find((c) => c.table === 'nilaiEvaluasi' && c.op === 'update');
    expect(nilaiUpdate).toBeDefined();
    expect(
      (nilaiUpdate!.args as { data: { statusTindakLanjut: StatusTindakLanjut } }).data
        .statusTindakLanjut,
    ).toBe(StatusTindakLanjut.SELESAI);

    const logNilaiCreate = calls.find((c) => c.table === 'logNilaiEvaluasi' && c.op === 'create');
    expect(logNilaiCreate).toBeDefined();
    expect(
      (
        logNilaiCreate!.args as {
          data: { statusTindakLanjutSesudah: StatusTindakLanjut; ditindaklanjutiOlehId: string };
        }
      ).data,
    ).toMatchObject({
      statusTindakLanjutSesudah: StatusTindakLanjut.SELESAI,
      ditindaklanjutiOlehId: 'u-penyusun',
    });
  });
});
