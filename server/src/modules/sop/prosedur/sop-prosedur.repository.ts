import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma';
import { BagianSOP, JenisLangkahProsedur, SatuanWaktu } from '../../../generated/prisma';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { appendOrCreateLogSession } from '../collaboration/log-edit-session.helper';

export interface RepoLangkahPatchItem {
  tempId: string;
  jenis: JenisLangkahProsedur;
  kegiatan: string;
  kelengkapan?: string;
  keluaran?: string;
  waktu?: number;
  satuanWaktu?: SatuanWaktu;
  keterangan?: string;
  pelaksanaId?: string | null;
  langkahSelanjutnyaYaTempId?: string | null;
  langkahSelanjutnyaTidakTempId?: string | null;
}

export interface RepoPelaksanaPatchItem {
  pelaksanaId: string;
}

export interface UpdateSopProsedurRepoInput {
  pelaksana?: RepoPelaksanaPatchItem[];
  langkah?: RepoLangkahPatchItem[];
  /**
   * Pelaksana cadangan untuk langkah yang tidak menyetel `pelaksanaId`. Service
   * sudah memastikan minimal satu sumber tersedia (DTO baru atau jalur pelaksana yang ada).
   */
  defaultPelaksanaId?: string | null;
}

@Injectable()
export class SopProsedurRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve `id` ke pasangan (detailSopId, sopOpdId). Jika `id` adalah sopId header,
   * dipakai DetailSOP versi terbaru.
   */
  async findDetailIdByDetailOrSopId(
    detailOrSopId: string,
  ): Promise<{ detailSopId: string; sopOpdId: string } | null> {
    const direct = await this.prisma.detailSOP.findUnique({
      where: { detailSopId: detailOrSopId },
      select: { detailSopId: true, sop: { select: { opdId: true } } },
    });
    if (direct !== null) {
      return { detailSopId: direct.detailSopId, sopOpdId: direct.sop.opdId };
    }
    const header = await this.prisma.sOP.findUnique({
      where: { sopId: detailOrSopId },
      select: {
        opdId: true,
        detailSops: {
          orderBy: { versi: 'desc' },
          take: 1,
          select: { detailSopId: true },
        },
      },
    });
    const latest = header?.detailSops[0]?.detailSopId;
    if (header === null || latest === undefined) {
      return null;
    }
    return { detailSopId: latest, sopOpdId: header.opdId };
  }

  async findDetailStatus(
    detailSopId: string,
  ): Promise<import('../../../generated/prisma').StatusSOP | null> {
    const row = await this.prisma.detailSOP.findUnique({
      where: { detailSopId },
      select: { status: true },
    });
    return row?.status ?? null;
  }

  async findOpdIdByPenggunaId(penggunaId: string): Promise<string | null> {
    const row = await this.prisma.pengguna.findFirst({
      where: { penggunaId, deletedAt: null },
      select: { opdId: true },
    });
    return row?.opdId ?? null;
  }

  /**
   * Daftar `pelaksanaId` yang valid untuk OPD pemilik SOP. Dipakai service untuk
   * validasi referensial DTO sebelum eksekusi transaksi.
   */
  async findPelaksanaIdsByOpd(opdId: string, ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set<string>();
    const rows = await this.prisma.pelaksana.findMany({
      where: { opdId, pelaksanaId: { in: Array.from(new Set(ids)) } },
      select: { pelaksanaId: true },
    });
    return new Set(rows.map((r) => r.pelaksanaId));
  }

  /**
   * `pelaksanaId` jalur pelaksana yang ada pada DetailSOP. Dipakai bila `dto.pelaksana`
   * tidak dikirim namun `dto.langkah[].pelaksanaId` perlu divalidasi terhadap
   * jalur pelaksana yang berlaku saat ini.
   */
  async findExistingSwimlanePelaksanaIds(detailSopId: string): Promise<string[]> {
    const rows = await this.prisma.detailSOPPelaksana.findMany({
      where: { detailSopId },
      select: { pelaksanaId: true },
      orderBy: { urutan: 'asc' },
    });
    return rows.map((r) => r.pelaksanaId);
  }

  /**
   * Ganti semua jalur pelaksana + langkah dalam satu transaksi. Operasi disusun agar
   * aman terhadap FK self-relasi cabang pada `LangkahSOP`.
   */
  async updateProsedurTransaction(params: {
    detailSopId: string;
    userId: string;
    input: UpdateSopProsedurRepoInput;
    changedFields: string[];
  }): Promise<void> {
    const { detailSopId, userId, input, changedFields } = params;
    await this.prisma.$transaction(async (tx) => {
      // A. Ganti pelaksana (jalur pelaksana) bila dikirim
      if (input.pelaksana !== undefined) {
        await tx.detailSOPPelaksana.deleteMany({ where: { detailSopId } });
        const items = input.pelaksana;
        if (items.length > 0) {
          /* `createMany` aman karena PK komposit (detailSopId, pelaksanaId);
             duplikat di muatan data disaring di level service. */
          await tx.detailSOPPelaksana.createMany({
            data: items.map((p, i) => ({
              detailSopId,
              pelaksanaId: p.pelaksanaId,
              urutan: i + 1,
            })),
          });
        }
      }

      // B. Replace langkah bila dikirim
      if (input.langkah !== undefined) {
        await this.replaceLangkahInTx(tx, detailSopId, input);
      }

      // C. Tandai DetailSOP sebagai baru diedit oleh user
      await tx.detailSOP.update({
        where: { detailSopId },
        data: { terakhirDieditOlehId: userId },
      });

      // D. Append log sesi (merge 10 menit)
      await appendOrCreateLogSession({
        tx,
        detailSopId,
        penggunaId: userId,
        bagian: BagianSOP.LANGKAH,
        fields: changedFields,
      });
    });
  }

  /**
   * Strategi replace-all langkah:
   *   1. Cari id langkah existing → putus self-FK cabang, lalu hapus langkah.
   *   2. Set `langkahSelanjutnyaYaId/TidakId = null` untuk hindari FK restrict
   *      saat delete (self-relasi default Prisma `Restrict`).
   *   3. `deleteMany` langkah existing.
   *   4. Buat ulang langkah dari muatan data (urutan = posisi index, langkah1..N).
   *   5. Update relasi cabang dengan resolusi `tempId -> uuid` baru.
   */
  private async replaceLangkahInTx(
    tx: Prisma.TransactionClient,
    detailSopId: string,
    input: UpdateSopProsedurRepoInput,
  ): Promise<void> {
    const langkah = input.langkah ?? [];

    const existingIds = (
      await tx.langkahSOP.findMany({
        where: { detailSopId },
        select: { langkahSopId: true },
      })
    ).map((r) => r.langkahSopId);

    if (existingIds.length > 0) {
      // 1. Putuskan self-FK cabang agar deleteMany tidak ditolak Restrict
      await tx.langkahSOP.updateMany({
        where: { detailSopId },
        data: { langkahSelanjutnyaYaId: null, langkahSelanjutnyaTidakId: null },
      });

      // 2. Hapus langkah lama
      await tx.langkahSOP.deleteMany({ where: { detailSopId } });
    }

    if (langkah.length === 0) return;

    // 3. Buat langkah baru tanpa relasi cabang dulu
    const tempToId = new Map<string, string>();
    for (const [i, item] of langkah.entries()) {
      const id = randomUUID();
      tempToId.set(item.tempId, id);
      const pelaksanaId = item.pelaksanaId ?? input.defaultPelaksanaId ?? null;
      if (pelaksanaId === null) {
        /* Service sudah memvalidasi; pengaman runtime saja. */
        throw new Error(
          'pelaksanaId tidak dapat diresolusi untuk langkah; pastikan jalur pelaksana atau pelaksanaId di-set',
        );
      }
      await tx.langkahSOP.create({
        data: {
          langkahSopId: id,
          detailSopId,
          urutan: i + 1,
          jenis: item.jenis,
          kegiatan: item.kegiatan,
          kelengkapan: item.kelengkapan ?? '',
          keluaran: item.keluaran ?? '',
          waktu: item.waktu ?? 0,
          satuanWaktu: item.satuanWaktu ?? SatuanWaktu.m,
          keterangan: item.keterangan ?? '',
          pelaksanaId,
        },
      });
    }

    // 4. Pasang relasi cabang Ya/Tidak
    for (const item of langkah) {
      const sourceId = tempToId.get(item.tempId);
      if (sourceId === undefined) continue;
      const ya = item.langkahSelanjutnyaYaTempId
        ? (tempToId.get(item.langkahSelanjutnyaYaTempId) ?? null)
        : null;
      const tidak = item.langkahSelanjutnyaTidakTempId
        ? (tempToId.get(item.langkahSelanjutnyaTidakTempId) ?? null)
        : null;
      if (ya === null && tidak === null) continue;
      await tx.langkahSOP.update({
        where: { langkahSopId: sourceId },
        data: {
          langkahSelanjutnyaYaId: ya,
          langkahSelanjutnyaTidakId: tidak,
        },
      });
    }
  }
}
