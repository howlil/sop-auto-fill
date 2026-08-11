import type { Prisma } from '../../../generated/prisma';
import { BagianSOP } from '../../../generated/prisma';

/**
 * Window default antara dua edit yang masih dianggap satu sesi (idle gap < 10 menit).
 * Mengikuti gaya Google Docs: edit beruntun digabung; jika idle melewati window,
 * sesi ditutup dan edit berikutnya membuat sesi baru.
 */
export const DEFAULT_LOG_SESSION_IDLE_MS = 10 * 60 * 1000;

/** Bentuk meta sesi (memori / respons API), bukan kolom JSON. */
export interface LogEditSessionMeta {
  /** Daftar field domain yang berubah selama sesi (union string set). */
  fields: string[];
  /** Berapa kali append terjadi pada sesi ini. */
  count: number;
}

export interface AppendLogParams {
  /** Prisma transaction client. Helper dimaksudkan dijalankan dalam transaksi. */
  tx: Prisma.TransactionClient;
  detailSopId: string;
  penggunaId: string;
  bagian: BagianSOP;
  /** Daftar field domain yang baru saja berubah pada satu request. */
  fields: string[];
  /** Force selalu buat entry baru (untuk event diskrit, mis. UMPAN_BALIK/STATUS). */
  discrete?: boolean;
  /** Override idle window. Default {@link DEFAULT_LOG_SESSION_IDLE_MS}. */
  idleWindowMs?: number;
  /** Sumber waktu — diparameterkan untuk memudahkan unit test. */
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
};

const BAGIAN_LABEL_ID: Record<BagianSOP, string> = {
  HEADER: 'Header SOP',
  LANGKAH: 'Langkah Prosedur',
  STATUS: 'Status SOP',
  UMPAN_BALIK: 'Umpan balik evaluasi',
  EVALUASI: 'Evaluasi',
};

/** Id stabil untuk klien (bukan UUID): tripel PK dipisah unit separator. */
export function encodeLogEditSopClientId(
  detailSopId: string,
  penggunaId: string,
  createdAt: Date,
): string {
  return `${detailSopId}\u001f${penggunaId}\u001f${createdAt.toISOString()}`;
}

/** Konversi nama field domain ke label Bahasa Indonesia. Field tak dikenal dipakai apa adanya. */
export function translateField(field: string): string {
  return FIELD_LABEL_ID[field] ?? field;
}

/** Bangun ringkasan keterangan untuk ditampilkan di tab Aktivitas. */
export function buildLogSummary(bagian: BagianSOP, meta: LogEditSessionMeta): string {
  const labels = meta.fields.map(translateField);
  const fieldsText = labels.length > 0 ? `: ${labels.join(', ')}` : '';
  const countText = meta.count > 1 ? ` (${meta.count} perubahan)` : '';
  return `${BAGIAN_LABEL_ID[bagian]}${fieldsText}${countText}`;
}

function unionFields(prev: string[], next: string[]): string[] {
  const set = new Set<string>();
  for (const v of prev) {
    if (typeof v === 'string' && v.trim().length > 0) {
      set.add(v);
    }
  }
  for (const v of next) {
    if (typeof v === 'string' && v.trim().length > 0) {
      set.add(v);
    }
  }
  return Array.from(set);
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
  const unique = Array.from(
    new Set(domainFields.filter((f) => typeof f === 'string' && f.trim().length > 0)),
  );
  if (unique.length === 0) {
    return;
  }
  await tx.logEditSopDomainField.createMany({
    data: unique.map((domainField) => ({
      detailSopId,
      penggunaId,
      logCreatedAt,
      domainField,
    })),
  });
}

/**
 * Append-or-create entry log untuk satu (detailSop, pengguna, bagian, targetEntityId).
 *
 * - `discrete=true` selalu buat entry baru `closedAt = now`.
 * - Bila ada sesi terbuka same triple dan `updatedAt > now - idleWindowMs` -> merge.
 * - Bila tidak: tutup sesi terbuka basi (`closedAt = now`) lalu buat sesi baru (`closedAt = null`).
 */
export async function appendOrCreateLogSession(p: AppendLogParams): Promise<void> {
  const now = p.now ?? new Date();
  const window = p.idleWindowMs ?? DEFAULT_LOG_SESSION_IDLE_MS;
  const fields = p.fields.filter((f) => typeof f === 'string' && f.trim().length > 0);

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
    const prevFields = open.domainFields.map((r) => r.domainField);
    const merged: LogEditSessionMeta = {
      fields: unionFields(prevFields, fields),
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

  /* Tutup sesi terbuka basi same triple agar tidak ada dua sesi terbuka paralel. */
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
