import type { Prisma } from '../../../generated/prisma';
import { BagianSOP } from '../../../generated/prisma';

export const DEFAULT_LOG_SESSION_IDLE_MS = 10 * 60 * 1000;

export interface LogEditSessionMeta {
  fields: string[];
  count: number;
}

export interface AppendLogParams {
  tx: Prisma.TransactionClient;
  detailSopId: string;
  penggunaId: string;
  bagian: BagianSOP;
  fields: string[];
  discrete?: boolean;
  idleWindowMs?: number;
  now?: Date;
}

const FIELD_LABEL_ID: Record<string, string> = {
  judul: 'Judul SOP',
  nomorSOP: 'Nomor SOP',
  namaLembaga: 'Nama Lembaga',
  peringatan: 'Peringatan',
  dasarHukumPeraturanIds: 'Dasar Hukum',
  sopTerkaitDetailIds: 'Keterkaitan SOP',
  kualifikasiPelaksanaan: 'Kualifikasi Pelaksanaan',
  peralatanPerlengkapan: 'Peralatan/Perlengkapan',
  pencatatanPendataan: 'Pencatatan dan Pendataan',
  pelaksana: 'Aktor Pelaksana',
  langkah: 'Daftar Langkah',
  status: 'Status SOP',
  create: 'Membuat',
  delete: 'Menghapus',
  revisiDariDetailSopId: 'Sumber versi',
};

const BAGIAN_LABEL_ID: Record<BagianSOP, string> = {
  HEADER: 'Header SOP',
  LANGKAH: 'Langkah Prosedur',
  STATUS: 'Status SOP',
};

export function encodeLogEditSopClientId(
  detailSopId: string,
  penggunaId: string,
  createdAt: Date,
): string {
  return `${detailSopId}\u001f${penggunaId}\u001f${createdAt.toISOString()}`;
}

export function translateField(field: string): string {
  return FIELD_LABEL_ID[field] ?? field;
}

export function buildLogSummary(bagian: BagianSOP, meta: LogEditSessionMeta): string {
  const labels = meta.fields.map(translateField);
  const fieldsText = labels.length > 0 ? `: ${labels.join(', ')}` : '';
  const countText = meta.count > 1 ? ` (${meta.count} perubahan)` : '';
  return `${BAGIAN_LABEL_ID[bagian]}${fieldsText}${countText}`;
}

function unionFields(prev: string[], next: string[]): string[] {
  return Array.from(
    new Set([...prev, ...next].filter((value) => value.trim().length > 0)),
  );
}

async function replaceDomainFields(
  tx: Prisma.TransactionClient,
  detailSopId: string,
  penggunaId: string,
  logCreatedAt: Date,
  domainFields: string[],
): Promise<void> {
  await tx.logEditSopDomainField.deleteMany({
    where: { detailSopId, penggunaId, logCreatedAt },
  });
  const unique = Array.from(new Set(domainFields.filter((field) => field.trim().length > 0)));
  if (unique.length > 0) {
    await tx.logEditSopDomainField.createMany({
      data: unique.map((domainField) => ({
        detailSopId,
        penggunaId,
        logCreatedAt,
        domainField,
      })),
    });
  }
}

export async function appendOrCreateLogSession(p: AppendLogParams): Promise<void> {
  const now = p.now ?? new Date();
  const window = p.idleWindowMs ?? DEFAULT_LOG_SESSION_IDLE_MS;
  const fields = p.fields.filter((field) => field.trim().length > 0);

  if (p.discrete === true) {
    const meta: LogEditSessionMeta = { fields, count: 1 };
    await p.tx.logEditSOP.create({
      data: {
        detailSopId: p.detailSopId,
        penggunaId: p.penggunaId,
        createdAt: now,
        bagian: p.bagian,
        keterangan: buildLogSummary(p.bagian, meta),
        sesiChangeCount: 1,
        closedAt: now,
        domainFields: {
          create: Array.from(new Set(fields)).map((domainField) => ({ domainField })),
        },
      },
    });
    return;
  }

  const cutoff = new Date(now.getTime() - window);
  const open = await p.tx.logEditSOP.findFirst({
    where: {
      detailSopId: p.detailSopId,
      penggunaId: p.penggunaId,
      bagian: p.bagian,
      closedAt: null,
      updatedAt: { gt: cutoff },
    },
    orderBy: { updatedAt: 'desc' },
    include: { domainFields: true },
  });

  if (open !== null) {
    const merged: LogEditSessionMeta = {
      fields: unionFields(open.domainFields.map((row) => row.domainField), fields),
      count: open.sesiChangeCount + 1,
    };
    await p.tx.logEditSOP.update({
      where: {
        detailSopId_penggunaId_createdAt: {
          detailSopId: open.detailSopId,
          penggunaId: open.penggunaId,
          createdAt: open.createdAt,
        },
      },
      data: {
        sesiChangeCount: merged.count,
        keterangan: buildLogSummary(p.bagian, merged),
      },
    });
    await replaceDomainFields(
      p.tx,
      open.detailSopId,
      open.penggunaId,
      open.createdAt,
      merged.fields,
    );
    return;
  }

  await p.tx.logEditSOP.updateMany({
    where: {
      detailSopId: p.detailSopId,
      penggunaId: p.penggunaId,
      bagian: p.bagian,
      closedAt: null,
    },
    data: { closedAt: now },
  });

  const fresh: LogEditSessionMeta = { fields, count: 1 };
  await p.tx.logEditSOP.create({
    data: {
      detailSopId: p.detailSopId,
      penggunaId: p.penggunaId,
      createdAt: now,
      bagian: p.bagian,
      keterangan: buildLogSummary(p.bagian, fresh),
      sesiChangeCount: 1,
      closedAt: null,
      domainFields: {
        create: Array.from(new Set(fields)).map((domainField) => ({ domainField })),
      },
    },
  });
}
