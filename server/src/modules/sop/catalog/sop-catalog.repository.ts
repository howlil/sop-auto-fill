import { Injectable } from '@nestjs/common';
import { TERMINAL_DETAIL_STATUSES } from '../../../common/status/sop-editable.util';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  BagianSOP,
  HasilEvaluasi,
  JenisDokumenTte,
  PeranPengguna,
  Prisma,
  StatusPengajuanEvaluasi,
  StatusSOP,
  StatusTindakLanjut,
} from '../../../generated/prisma';
import { appendOrCreateLogSession } from '../collaboration/log-edit-session.helper';
import {
  sopCatalogRepoFail,
  sopCatalogRepoOk,
  type SopCatalogRepoResult,
} from './sop-catalog.repo-result';

export interface UpdateSopHeaderRepoInput {
  judul?: string;
  nomorSOP?: string;
  namaLembaga?: string;
  dasarHukumPeraturanIds?: string[];
  sopTerkaitDetailIds?: string[];
  lampiran?: {
    peringatan?: string[];
    kualifikasiPelaksanaan?: string[];
    peralatanPerlengkapan?: string[];
    pencatatanPendataan?: string[];
  };
}

/** Muatan data mentah area kerja penyusun (DetailSOP + langkah + log) untuk dipetakan di service. */
export type SopWorkbenchDbPayload = Prisma.DetailSOPGetPayload<{
  include: {
    sop: {
      include: {
        opd: {
          select: {
            opdId: true;
            nama: true;
            pengguna: {
              where: { peran: 'KEPALA_OPD'; deletedAt: null };
              take: 1;
              select: { nama: true; nip: true };
            };
          };
        };
      };
    };
    dibuatOleh: { select: { penggunaId: true; nama: true } };
    terakhirDieditOleh: { select: { penggunaId: true; nama: true } };
    revisiDari: { select: { detailSopId: true; versi: true } };
    lampiranPeringatan: true;
    lampiranKualifikasiPelaksanaan: true;
    lampiranPeralatanPerlengkapan: true;
    lampiranPencatatanPendataan: true;
    dasarHukum: { include: { peraturan: true } };
    relasiSopKeluar: {
      include: {
        sopTerkait: { include: { sop: { select: { judul: true; sopId: true } } } };
      };
    };
    relasiSopMasuk: {
      include: {
        sop: { include: { sop: { select: { judul: true; sopId: true } } } };
      };
    };
    dokumenTte: {
      where: { jenisDokumen: 'SOP_BERLAKU' };
      select: {
        dokumenTteId: true;
        riwayatTandaTangan: {
          select: {
            peran: true;
            userId: true;
            dokumenTteId: true;
            ditandatanganiPada: true;
            user: { select: { nama: true; nip: true; jabatan: true } };
          };
        };
      };
    };
    swimlanes: { include: { pelaksana: true } };
    nilaiEvaluasi: {
      select: { pengajuanEvaluasiId: true; detailSopId: true; hasil: true; catatan: true };
    };
    langkahSOP: { orderBy: { urutan: 'asc' }; include: { pelaksana: true } };
    logEditSop: {
      orderBy: { createdAt: 'desc' };
      take: number;
      include: {
        domainFields: true;
        pengguna: { select: { penggunaId: true; nama: true; email: true; peran: true } };
      };
    };
    konfigurasiDiagram: {
      include: {
        overridePanah: {
          include: {
            titikTekuk: {
              orderBy: { urutan: 'asc' };
            };
          };
        };
        overrideLabel: true;
      };
    };
  };
}>;

export type SopDaftarDetailSlice = {
  detailSopId: string;
  nomorSOP: string;
  status: string;
  versi: number;
  updatedAt: Date;
  pembuatNama: string | null;
  editorNama: string | null;
  peraturanId: string | null;
};

export type SopDaftarDbRow = {
  sopId: string;
  opdId: string;
  judul: string;
  /** Versi terbaru (urutan versi desc). */
  detail: SopDaftarDetailSlice | undefined;
  /** Versi yang sedang BERLAKU, bila ada. */
  versiBerlaku: SopDaftarDetailSlice | null;
  /** Semua status DetailSOP pada header (untuk deteksi revisi yang sedang berjalan). */
  allStatuses: StatusSOP[];
};

export type SopRiwayatVersiDbRow = {
  detailSopId: string;
  versi: number;
  nomorSOP: string;
  status: StatusSOP;
  revisiDariDetailSopId: string | null;
  revisiDariVersi: number | null;
  updatedAt: Date;
  canHapusDraft: boolean;
};

/** Filter daftar SOP (DetailSOP terbaru): status dan/atau rentang tanggal `updatedAt` (YYYY-MM-DD, UTC). */
export interface SopDaftarListFilters {
  readonly status?: string;
  readonly tanggalDari?: string;
  readonly tanggalSampai?: string;
}

@Injectable()
export class SopCatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  private static isoDateUtc(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private applyDaftarFilters(
    rows: SopDaftarDbRow[],
    filters: SopDaftarListFilters,
  ): SopDaftarDbRow[] {
    const hasStatus = filters.status !== undefined && filters.status.length > 0;
    const hasDari = filters.tanggalDari !== undefined && filters.tanggalDari.length > 0;
    const hasSampai = filters.tanggalSampai !== undefined && filters.tanggalSampai.length > 0;
    if (!hasStatus && !hasDari && !hasSampai) {
      return rows;
    }
    return rows.filter((r) => {
      const d = r.detail;
      if (d === undefined) {
        return false;
      }
      if (hasStatus && d.status !== filters.status) {
        return false;
      }
      const day = SopCatalogRepository.isoDateUtc(d.updatedAt);
      if (hasDari && day < filters.tanggalDari) {
        return false;
      }
      if (hasSampai && day > filters.tanggalSampai) {
        return false;
      }
      return true;
    });
  }

  async findOpdIdByPenggunaId(penggunaId: string): Promise<string | null> {
    const row = await this.prisma.pengguna.findFirst({
      where: { penggunaId, deletedAt: null },
      select: { opdId: true },
    });
    return row?.opdId ?? null;
  }

  async findOpdNama(opdId: string): Promise<string | null> {
    const row = await this.prisma.oPD.findFirst({
      where: { opdId, deletedAt: null },
      select: { nama: true },
    });
    return row?.nama ?? null;
  }

  async findPenggunaNama(penggunaId: string): Promise<string | null> {
    const row = await this.prisma.pengguna.findFirst({
      where: { penggunaId, deletedAt: null },
      select: { nama: true },
    });
    return row?.nama ?? null;
  }

  /**
   * Transaksi: header SOP + DetailSOP versi 1 (status DRAFT, dibuatOlehId = pembuat).
   */
  async createSopWithInitialDetail(params: {
    judul: string;
    nomorSOP: string;
    opdId: string;
    penggunaId: string;
    namaLembaga: string;
  }): Promise<SopDaftarDbRow> {
    const created = await this.prisma.$transaction(async (tx) => {
      const sop = await tx.sOP.create({
        data: {
          judul: params.judul,
          opdId: params.opdId,
        },
      });
      const detail = await tx.detailSOP.create({
        data: {
          sopId: sop.sopId,
          nomorSOP: params.nomorSOP,
          versi: 1,
          status: StatusSOP.DRAFT,
          dibuatOlehId: params.penggunaId,
          namaLembaga: params.namaLembaga,
        },
        include: {
          dibuatOleh: { select: { nama: true } },
          terakhirDieditOleh: { select: { nama: true } },
        },
      });
      return { sop, detail };
    });
    const d = created.detail;
    const slice: SopDaftarDetailSlice = {
      detailSopId: d.detailSopId,
      nomorSOP: d.nomorSOP,
      status: d.status,
      versi: d.versi,
      updatedAt: d.updatedAt,
      pembuatNama: d.dibuatOleh?.nama ?? null,
      editorNama: d.terakhirDieditOleh?.nama ?? null,
      peraturanId: null,
    };
    return {
      sopId: created.sop.sopId,
      opdId: created.sop.opdId,
      judul: created.sop.judul,
      detail: slice,
      versiBerlaku: null,
      allStatuses: [d.status],
    };
  }

  private mapDetailSlice(d: {
    detailSopId: string;
    nomorSOP: string;
    status: StatusSOP;
    versi: number;
    updatedAt: Date;
    dibuatOleh: { nama: string } | null;
    terakhirDieditOleh: { nama: string } | null;
    dasarHukum: { peraturanId: string }[];
  }): SopDaftarDetailSlice {
    return {
      detailSopId: d.detailSopId,
      nomorSOP: d.nomorSOP,
      status: d.status,
      versi: d.versi,
      updatedAt: d.updatedAt,
      pembuatNama: d.dibuatOleh?.nama ?? null,
      editorNama: d.terakhirDieditOleh?.nama ?? null,
      peraturanId: d.dasarHukum[0]?.peraturanId ?? null,
    };
  }

  private mapSopDaftarRow(r: {
    sopId: string;
    opdId: string;
    judul: string;
    detailSops: {
      detailSopId: string;
      nomorSOP: string;
      status: StatusSOP;
      versi: number;
      updatedAt: Date;
      dibuatOleh: { nama: string } | null;
      terakhirDieditOleh: { nama: string } | null;
      dasarHukum: { peraturanId: string }[];
    }[];
  }): SopDaftarDbRow {
    const sorted = [...r.detailSops].sort((a, b) => b.versi - a.versi);
    const latest = sorted[0];
    const berlaku = sorted.find((d) => d.status === StatusSOP.BERLAKU);
    return {
      sopId: r.sopId,
      opdId: r.opdId,
      judul: r.judul,
      detail: latest === undefined ? undefined : this.mapDetailSlice(latest),
      versiBerlaku: berlaku === undefined ? null : this.mapDetailSlice(berlaku),
      allStatuses: sorted.map((d) => d.status),
    };
  }

  private static deriveNomorSopVersiBaru(nomorLama: string, versiBaru: number): string {
    const match = nomorLama.match(/^(.+)-V\d+$/i);
    const base = match !== null ? match[1] : nomorLama;
    return `${base}-V${versiBaru}`;
  }

  async findDaftarByOpdId(
    opdId: string,
    filters: SopDaftarListFilters = {},
  ): Promise<SopDaftarDbRow[]> {
    const rows = await this.prisma.sOP.findMany({
      where: { opdId },
      orderBy: { updatedAt: 'desc' },
      select: {
        sopId: true,
        opdId: true,
        judul: true,
        detailSops: {
          orderBy: { versi: 'desc' },
          select: {
            detailSopId: true,
            nomorSOP: true,
            status: true,
            versi: true,
            updatedAt: true,
            dibuatOleh: { select: { nama: true } },
            terakhirDieditOleh: { select: { nama: true } },
            dasarHukum: {
              orderBy: { createdAt: 'asc' },
              take: 1,
              select: { peraturanId: true },
            },
          },
        },
      },
    });
    const mappedByOpd = rows.map((r) => this.mapSopDaftarRow(r));
    return this.applyDaftarFilters(mappedByOpd, filters);
  }

  /** Daftar semua SOP (untuk peran evaluasi yang membutuhkan agregasi lintas OPD). */
  /**
   * Satu query DetailSOP lengkap untuk halaman area kerja penyusun (tanpa duplikasi fetch).
   */
  async findWorkbenchPayload(
    detailSopId: string,
    logsLimit: number,
  ): Promise<SopWorkbenchDbPayload | null> {
    const row = await this.prisma.detailSOP.findUnique({
      where: { detailSopId },
      include: {
        sop: {
          include: {
            opd: {
              select: {
                opdId: true,
                nama: true,
                pengguna: {
                  where: { peran: PeranPengguna.KEPALA_OPD, deletedAt: null },
                  take: 1,
                  select: { nama: true, nip: true },
                },
              },
            },
          },
        },
        dibuatOleh: { select: { penggunaId: true, nama: true } },
        terakhirDieditOleh: { select: { penggunaId: true, nama: true } },
        revisiDari: { select: { detailSopId: true, versi: true } },
        lampiranPeringatan: true,
        lampiranKualifikasiPelaksanaan: true,
        lampiranPeralatanPerlengkapan: true,
        lampiranPencatatanPendataan: true,
        dasarHukum: { include: { peraturan: true } },
        relasiSopKeluar: {
          include: {
            sopTerkait: { include: { sop: { select: { judul: true, sopId: true } } } },
          },
        },
        relasiSopMasuk: {
          include: {
            sop: { include: { sop: { select: { judul: true, sopId: true } } } },
          },
        },
        dokumenTte: {
          where: { jenisDokumen: 'SOP_BERLAKU' },
          select: {
            dokumenTteId: true,
            riwayatTandaTangan: {
              select: {
                peran: true,
                userId: true,
                dokumenTteId: true,
                ditandatanganiPada: true,
                user: { select: { nama: true, nip: true, jabatan: true } },
              },
            },
          },
        },
        swimlanes: { include: { pelaksana: true } },
        nilaiEvaluasi: {
          select: { pengajuanEvaluasiId: true, detailSopId: true, hasil: true, catatan: true },
        },
        langkahSOP: { orderBy: { urutan: 'asc' }, include: { pelaksana: true } },
        logEditSop: {
          orderBy: { createdAt: 'desc' },
          take: logsLimit,
          include: {
            domainFields: true,
            pengguna: { select: { penggunaId: true, nama: true, email: true, peran: true } },
          },
        },
        konfigurasiDiagram: {
          include: {
            overridePanah: {
              include: {
                titikTekuk: {
                  orderBy: { urutan: 'asc' },
                },
              },
            },
            overrideLabel: true,
          },
        },
      },
    });
    return row;
  }

  /**
   * Workbench: `id` boleh berupa `detailSopId` atau `sopId` (header).
   * UI daftar memakai `sop.id` pada rute edit; cadangan ke DetailSOP versi terbaru per header.
   */
  async findWorkbenchPayloadByDetailOrSopId(
    detailOrSopId: string,
    logsLimit: number,
  ): Promise<SopWorkbenchDbPayload | null> {
    const direct = await this.findWorkbenchPayload(detailOrSopId, logsLimit);
    if (direct !== null) {
      return direct;
    }
    const header = await this.prisma.sOP.findUnique({
      where: { sopId: detailOrSopId },
      select: {
        detailSops: {
          orderBy: { versi: 'desc' },
          take: 1,
          select: { detailSopId: true },
        },
      },
    });
    const latestDetailId = header?.detailSops[0]?.detailSopId;
    if (latestDetailId === undefined) {
      return null;
    }
    return this.findWorkbenchPayload(latestDetailId, logsLimit);
  }

  /**
   * Resolve `id` (boleh detailSopId atau sopId header) menjadi pasangan (detailSopId, sopId).
   * Bila berupa sopId header, dipakai DetailSOP versi terbaru.
   */
  async findDetailIdByDetailOrSopId(
    detailOrSopId: string,
  ): Promise<{ detailSopId: string; sopId: string } | null> {
    const direct = await this.prisma.detailSOP.findUnique({
      where: { detailSopId: detailOrSopId },
      select: { detailSopId: true, sopId: true },
    });
    if (direct !== null) {
      return direct;
    }
    const header = await this.prisma.sOP.findUnique({
      where: { sopId: detailOrSopId },
      select: {
        sopId: true,
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
    return { detailSopId: latest, sopId: header.sopId };
  }

  /**
   * Status + OPD untuk DetailSOP terbaru; `detailOrSopId` boleh ID DetailSOP atau ID header SOP.
   */
  async findLatestDetailStatusContext(detailOrSopId: string): Promise<{
    detailSopId: string;
    sopId: string;
    status: StatusSOP;
    sopOpdId: string;
  } | null> {
    const resolved = await this.findDetailIdByDetailOrSopId(detailOrSopId);
    if (resolved === null) {
      return null;
    }
    const row = await this.prisma.detailSOP.findUnique({
      where: { detailSopId: resolved.detailSopId },
      select: {
        detailSopId: true,
        sopId: true,
        status: true,
        sop: { select: { opdId: true } },
      },
    });
    if (row === null) {
      return null;
    }
    return {
      detailSopId: row.detailSopId,
      sopId: row.sopId,
      status: row.status,
      sopOpdId: row.sop.opdId,
    };
  }

  async updateDetailSopStatus(params: {
    detailSopId: string;
    status: StatusSOP;
    userId: string;
  }): Promise<void> {
    const { detailSopId, status, userId } = params;
    await this.prisma.$transaction(async (tx) => {
      await tx.detailSOP.update({
        where: { detailSopId },
        data: {
          status,
          terakhirDieditOlehId: userId,
        },
      });
      await appendOrCreateLogSession({
        tx,
        detailSopId,
        penggunaId: userId,
        bagian: BagianSOP.STATUS,
        fields: ['status'],
        discrete: true,
      });
      if (status === StatusSOP.DICABUT) {
        await tx.$executeRaw`
          UPDATE DokumenTte
          SET pdfStatus = ${'REVOKED'},
              pdfRevokedAt = ${new Date()}
          WHERE detailSopId = ${detailSopId}
            AND jenisDokumen = ${JenisDokumenTte.SOP_BERLAKU}
        `;
      }
    });
  }

  /**
   * Transaksi: tutup tindak lanjut evaluasi lalu set REVISI_DARI_EVALUATOR -> SEDANG_DIEVALUASI.
   */
  async transitionDetailSopRevisiToSedangDievaluasi(params: {
    detailSopId: string;
    userId: string;
  }): Promise<void> {
    const { detailSopId, userId } = params;
    await this.prisma.$transaction(async (tx) => {
      const nilai = await tx.nilaiEvaluasi.findFirst({
        where: {
          detailSopId,
          hasil: HasilEvaluasi.PERLU_PERBAIKAN,
          pengajuanEvaluasi: {
            status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
          },
        },
        orderBy: { updatedAt: 'desc' },
      });
      if (nilai !== null && nilai.statusTindakLanjut !== StatusTindakLanjut.SELESAI) {
        const sekarang = new Date();
        await tx.logNilaiEvaluasi.create({
          data: {
            pengajuanEvaluasiId: nilai.pengajuanEvaluasiId,
            detailSopId,
            penggunaId: userId,
            createdAt: sekarang,
            hasilSebelum: nilai.hasil,
            hasilSesudah: nilai.hasil,
            catatanSebelum: nilai.catatan ?? null,
            catatanSesudah: nilai.catatan ?? null,
            statusTindakLanjutSebelum: nilai.statusTindakLanjut ?? null,
            statusTindakLanjutSesudah: StatusTindakLanjut.SELESAI,
            ditindaklanjutiOlehId: userId,
            ditindaklanjutiPada: sekarang,
          },
        });
        await tx.nilaiEvaluasi.update({
          where: {
            pengajuanEvaluasiId_detailSopId: {
              pengajuanEvaluasiId: nilai.pengajuanEvaluasiId,
              detailSopId,
            },
          },
          data: {
            statusTindakLanjut: StatusTindakLanjut.SELESAI,
            ditindaklanjutiOlehId: userId,
            ditindaklanjutiPada: sekarang,
            version: { increment: 1 },
          },
        });
      }
      await tx.detailSOP.update({
        where: { detailSopId },
        data: {
          status: StatusSOP.MENUNGGU_PENGAJUAN_EVALUASI,
          terakhirDieditOlehId: userId,
        },
      });
      await appendOrCreateLogSession({
        tx,
        detailSopId,
        penggunaId: userId,
        bagian: BagianSOP.STATUS,
        fields: ['status'],
        discrete: true,
      });
      await tx.detailSOP.update({
        where: { detailSopId },
        data: {
          status: StatusSOP.SEDANG_DIEVALUASI,
          terakhirDieditOlehId: userId,
        },
      });
      await appendOrCreateLogSession({
        tx,
        detailSopId,
        penggunaId: userId,
        bagian: BagianSOP.STATUS,
        fields: ['status'],
        discrete: true,
      });
    });
  }

  /**
   * Partial update header SOP dalam satu transaksi (judul header, kolom DetailSOP,
   * relasi DasarHukum, SopTerkait, dan kelompok LampiranTeks per jenis).
   * Replace-all untuk array; field skalar hanya ditulis bila dikirim.
   */
  async updateSopHeaderTransaction(params: {
    detailSopId: string;
    sopId: string;
    userId: string;
    input: UpdateSopHeaderRepoInput;
    /** Daftar nama field domain yang diminta klien — dipakai untuk session log. */
    changedFields: string[];
  }): Promise<SopCatalogRepoResult<void>> {
    const { detailSopId, sopId, userId, input, changedFields } = params;
    await this.prisma.$transaction(async (tx) => {
      if (input.judul !== undefined) {
        await tx.sOP.update({
          where: { sopId },
          data: { judul: input.judul.trim() },
        });
      }

      const detailData: Prisma.DetailSOPUncheckedUpdateInput = {
        terakhirDieditOlehId: userId,
      };
      if (input.nomorSOP !== undefined) {
        detailData.nomorSOP = input.nomorSOP.trim();
      }
      if (input.namaLembaga !== undefined) {
        detailData.namaLembaga = input.namaLembaga;
      }
      await tx.detailSOP.update({
        where: { detailSopId },
        data: detailData,
      });

      if (input.dasarHukumPeraturanIds !== undefined) {
        await tx.dasarHukum.deleteMany({ where: { detailSopId } });
        const uniqueIds = Array.from(new Set(input.dasarHukumPeraturanIds));
        if (uniqueIds.length > 0) {
          await tx.dasarHukum.createMany({
            data: uniqueIds.map((peraturanId) => ({ detailSopId, peraturanId })),
            skipDuplicates: true,
          });
        }
      }

      if (input.sopTerkaitDetailIds !== undefined) {
        await tx.sopTerkait.deleteMany({ where: { detailSopId } });
        const uniqueIds = Array.from(
          new Set(input.sopTerkaitDetailIds.filter((id) => id !== detailSopId)),
        );
        if (uniqueIds.length > 0) {
          await tx.sopTerkait.createMany({
            data: uniqueIds.map((detailSopTerkaitId) => ({
              detailSopId,
              detailSopTerkaitId,
            })),
            skipDuplicates: true,
          });
        }
      }

      if (input.lampiran?.peringatan !== undefined) {
        await tx.lampiranPeringatan.deleteMany({ where: { detailSopId } });
        const cleaned = input.lampiran.peringatan
          .map((it) => it.trim())
          .filter((it) => it.length > 0);
        if (cleaned.length > 0) {
          await tx.lampiranPeringatan.createMany({
            data: cleaned.map((teks) => ({ detailSopId, teks })),
          });
        }
      }

      if (input.lampiran?.kualifikasiPelaksanaan !== undefined) {
        await tx.lampiranKualifikasiPelaksanaan.deleteMany({ where: { detailSopId } });
        const cleaned = input.lampiran.kualifikasiPelaksanaan
          .map((it) => it.trim())
          .filter((it) => it.length > 0);
        if (cleaned.length > 0) {
          await tx.lampiranKualifikasiPelaksanaan.createMany({
            data: cleaned.map((teks) => ({ detailSopId, teks })),
          });
        }
      }

      if (input.lampiran?.peralatanPerlengkapan !== undefined) {
        await tx.lampiranPeralatanPerlengkapan.deleteMany({ where: { detailSopId } });
        const cleaned = input.lampiran.peralatanPerlengkapan
          .map((it) => it.trim())
          .filter((it) => it.length > 0);
        if (cleaned.length > 0) {
          await tx.lampiranPeralatanPerlengkapan.createMany({
            data: cleaned.map((teks) => ({ detailSopId, teks })),
          });
        }
      }

      if (input.lampiran?.pencatatanPendataan !== undefined) {
        await tx.lampiranPencatatanPendataan.deleteMany({ where: { detailSopId } });
        const cleaned = input.lampiran.pencatatanPendataan
          .map((it) => it.trim())
          .filter((it) => it.length > 0);
        if (cleaned.length > 0) {
          await tx.lampiranPencatatanPendataan.createMany({
            data: cleaned.map((teks) => ({ detailSopId, teks })),
          });
        }
      }

      await appendOrCreateLogSession({
        tx,
        detailSopId,
        penggunaId: userId,
        bagian: BagianSOP.HEADER,
        fields: changedFields,
      });
    });
    return sopCatalogRepoOk(undefined);
  }

  async findDaftarAll(filters: SopDaftarListFilters = {}): Promise<SopDaftarDbRow[]> {
    const rows = await this.prisma.sOP.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        sopId: true,
        opdId: true,
        judul: true,
        detailSops: {
          orderBy: { versi: 'desc' },
          select: {
            detailSopId: true,
            nomorSOP: true,
            status: true,
            versi: true,
            updatedAt: true,
            dibuatOleh: { select: { nama: true } },
            terakhirDieditOleh: { select: { nama: true } },
            dasarHukum: {
              orderBy: { createdAt: 'asc' },
              take: 1,
              select: { peraturanId: true },
            },
          },
        },
      },
    });
    const mapped = rows.map((r) => this.mapSopDaftarRow(r));
    return this.applyDaftarFilters(mapped, filters);
  }

  async findRiwayatVersiBySopId(sopId: string): Promise<SopRiwayatVersiDbRow[]> {
    const rows = await this.prisma.detailSOP.findMany({
      where: { sopId },
      orderBy: { versi: 'asc' },
      select: {
        detailSopId: true,
        versi: true,
        nomorSOP: true,
        status: true,
        revisiDariDetailSopId: true,
        updatedAt: true,
        revisiDari: { select: { versi: true } },
        _count: { select: { nilaiEvaluasi: true } },
      },
    });
    return rows.map((r) => ({
      detailSopId: r.detailSopId,
      versi: r.versi,
      nomorSOP: r.nomorSOP,
      status: r.status,
      revisiDariDetailSopId: r.revisiDariDetailSopId,
      revisiDariVersi: r.revisiDari?.versi ?? null,
      updatedAt: r.updatedAt,
      canHapusDraft:
        r.status === StatusSOP.DRAFT &&
        r.revisiDariDetailSopId !== null &&
        r._count.nilaiEvaluasi === 0,
    }));
  }

  /** Clone snapshot versi terminal yang dipilih menjadi versi baru berstatus DRAFT. */
  async cloneDetailSopFromSource(params: {
    sourceDetailSopId: string;
    penggunaId: string;
  }): Promise<SopCatalogRepoResult<{ detailSopId: string; versi: number }>> {
    const source = await this.prisma.detailSOP.findUnique({
      where: { detailSopId: params.sourceDetailSopId },
      include: {
        lampiranPeringatan: true,
        lampiranKualifikasiPelaksanaan: true,
        lampiranPeralatanPerlengkapan: true,
        lampiranPencatatanPendataan: true,
        dasarHukum: true,
        swimlanes: true,
        relasiSopKeluar: true,
        relasiSopMasuk: true,
        langkahSOP: { orderBy: { urutan: 'asc' } },
      },
    });
    if (source === null) {
      return sopCatalogRepoFail('NOT_FOUND', 'DetailSOP sumber tidak ditemukan');
    }
    if (!TERMINAL_DETAIL_STATUSES.has(source.status)) {
      return sopCatalogRepoFail(
        'CONFLICT',
        'Hanya versi terminal (DITOLAK_EVALUATOR, BERLAKU, DIGANTIKAN, atau DICABUT) yang dapat dijadikan sumber versi baru',
      );
    }
    const siblings = await this.prisma.detailSOP.findMany({
      where: { sopId: source.sopId },
      select: { status: true, versi: true },
    });
    const hasInFlight = siblings.some((s) => !TERMINAL_DETAIL_STATUSES.has(s.status));
    if (hasInFlight) {
      return sopCatalogRepoFail(
        'CONFLICT',
        'Masih ada versi revisi yang belum selesai. Selesaikan atau batalkan revisi tersebut terlebih dahulu.',
      );
    }
    const maxVersi = siblings.reduce((max, s) => Math.max(max, s.versi), 0);
    const versiBaru = maxVersi + 1;
    const nomorSOP = SopCatalogRepository.deriveNomorSopVersiBaru(source.nomorSOP, versiBaru);
    const now = new Date();
    const cloned = await this.prisma.$transaction(async (tx) => {
      const created = await tx.detailSOP.create({
        data: {
          sopId: source.sopId,
          versi: versiBaru,
          status: StatusSOP.DRAFT,
          nomorSOP,
          namaLembaga: source.namaLembaga,
          tanggalPembuatan: now,
          tanggalRevisi: now,
          tanggalEfektif: null,
          dibuatOlehId: params.penggunaId,
          terakhirDieditOlehId: params.penggunaId,
          revisiDariDetailSopId: source.detailSopId,
        },
      });
      const newDetailId = created.detailSopId;
      if (source.lampiranPeringatan.length > 0) {
        await tx.lampiranPeringatan.createMany({
          data: source.lampiranPeringatan.map((l) => ({
            detailSopId: newDetailId,
            teks: l.teks,
          })),
        });
      }
      if (source.lampiranKualifikasiPelaksanaan.length > 0) {
        await tx.lampiranKualifikasiPelaksanaan.createMany({
          data: source.lampiranKualifikasiPelaksanaan.map((l) => ({
            detailSopId: newDetailId,
            teks: l.teks,
          })),
        });
      }
      if (source.lampiranPeralatanPerlengkapan.length > 0) {
        await tx.lampiranPeralatanPerlengkapan.createMany({
          data: source.lampiranPeralatanPerlengkapan.map((l) => ({
            detailSopId: newDetailId,
            teks: l.teks,
          })),
        });
      }
      if (source.lampiranPencatatanPendataan.length > 0) {
        await tx.lampiranPencatatanPendataan.createMany({
          data: source.lampiranPencatatanPendataan.map((l) => ({
            detailSopId: newDetailId,
            teks: l.teks,
          })),
        });
      }
      if (source.dasarHukum.length > 0) {
        await tx.dasarHukum.createMany({
          data: source.dasarHukum.map((d) => ({
            detailSopId: newDetailId,
            peraturanId: d.peraturanId,
          })),
        });
      }
      if (source.swimlanes.length > 0) {
        await tx.detailSOPPelaksana.createMany({
          data: source.swimlanes.map((s) => ({
            detailSopId: newDetailId,
            pelaksanaId: s.pelaksanaId,
            urutan: s.urutan,
          })),
        });
      }
      for (const rel of source.relasiSopKeluar) {
        await tx.sopTerkait.create({
          data: {
            detailSopId: newDetailId,
            detailSopTerkaitId: rel.detailSopTerkaitId,
          },
        });
      }
      for (const rel of source.relasiSopMasuk) {
        await tx.sopTerkait.create({
          data: {
            detailSopId: rel.detailSopId,
            detailSopTerkaitId: newDetailId,
          },
        });
      }
      const langkahIdMap = new Map<string, string>();
      for (const step of source.langkahSOP) {
        const createdStep = await tx.langkahSOP.create({
          data: {
            detailSopId: newDetailId,
            urutan: step.urutan,
            kegiatan: step.kegiatan,
            jenis: step.jenis,
            kelengkapan: step.kelengkapan,
            keluaran: step.keluaran,
            waktu: step.waktu,
            satuanWaktu: step.satuanWaktu,
            keterangan: step.keterangan,
            pelaksanaId: step.pelaksanaId,
          },
        });
        langkahIdMap.set(step.langkahSopId, createdStep.langkahSopId);
      }
      for (const step of source.langkahSOP) {
        const newId = langkahIdMap.get(step.langkahSopId);
        if (newId === undefined) {
          continue;
        }
        const yaId =
          step.langkahSelanjutnyaYaId === null
            ? null
            : (langkahIdMap.get(step.langkahSelanjutnyaYaId) ?? null);
        const tidakId =
          step.langkahSelanjutnyaTidakId === null
            ? null
            : (langkahIdMap.get(step.langkahSelanjutnyaTidakId) ?? null);
        if (step.langkahSelanjutnyaYaId !== null || step.langkahSelanjutnyaTidakId !== null) {
          await tx.langkahSOP.update({
            where: { langkahSopId: newId },
            data: {
              langkahSelanjutnyaYaId: yaId,
              langkahSelanjutnyaTidakId: tidakId,
            },
          });
        }
      }
      const sourceDiagramConfigs = await tx.konfigurasiDiagramSOP.findMany({
        where: { detailSopId: params.sourceDetailSopId },
        include: {
          overridePanah: {
            include: {
              titikTekuk: {
                orderBy: { urutan: 'asc' },
              },
            },
          },
          overrideLabel: true,
        },
      });
      if (sourceDiagramConfigs.length > 0) {
        for (const cfg of sourceDiagramConfigs) {
          await tx.konfigurasiDiagramSOP.create({
            data: {
              detailSopId: newDetailId,
              jenis: cfg.jenis,
              layoutSeed: cfg.layoutSeed,
            },
          });
          for (const edge of cfg.overridePanah) {
            const newFrom = langkahIdMap.get(edge.dariLangkahSopId);
            const newTo = langkahIdMap.get(edge.keLangkahSopId);
            if (newFrom === undefined || newTo === undefined) {
              continue;
            }
            await tx.overridePanahDiagramSOP.create({
              data: {
                detailSopId: newDetailId,
                jenis: cfg.jenis,
                dariLangkahSopId: newFrom,
                keLangkahSopId: newTo,
                cabang: edge.cabang,
                sSide: edge.sSide,
                eSide: edge.eSide,
                startX: edge.startX,
                startY: edge.startY,
                endX: edge.endX,
                endY: edge.endY,
              },
            });
            if (edge.titikTekuk.length > 0) {
              await tx.titikTekukPanahDiagramSOP.createMany({
                data: edge.titikTekuk.map((point) => ({
                  detailSopId: newDetailId,
                  jenis: cfg.jenis,
                  dariLangkahSopId: newFrom,
                  keLangkahSopId: newTo,
                  cabang: edge.cabang,
                  urutan: point.urutan,
                  x: point.x,
                  y: point.y,
                })),
              });
            }
          }
          if (cfg.overrideLabel.length > 0) {
            await tx.overrideLabelDiagramSOP.createMany({
              data: cfg.overrideLabel.map((label) => ({
                detailSopId: newDetailId,
                jenis: cfg.jenis,
                kunciLabel: label.kunciLabel,
                posisiX: label.posisiX,
                posisiY: label.posisiY,
              })),
            });
          }
        }
      }
      await tx.logEditSOP.create({
        data: {
          detailSopId: newDetailId,
          penggunaId: params.penggunaId,
          createdAt: now,
          bagian: BagianSOP.STATUS,
          keterangan: `Versi ${versiBaru} dibuat berdasarkan versi ${source.versi}`,
          sesiChangeCount: 1,
          closedAt: now,
          domainFields: {
            create: [{ domainField: 'create' }, { domainField: 'revisiDariDetailSopId' }],
          },
        },
      });
      return { detailSopId: newDetailId, versi: versiBaru };
    });
    return sopCatalogRepoOk(cloned);
  }

  async deleteVersiDraft(detailSopId: string): Promise<SopCatalogRepoResult<void>> {
    const row = await this.prisma.detailSOP.findUnique({
      where: { detailSopId },
      select: {
        status: true,
        revisiDariDetailSopId: true,
        _count: { select: { nilaiEvaluasi: true } },
      },
    });
    if (row === null) {
      return sopCatalogRepoFail('NOT_FOUND', 'DetailSOP tidak ditemukan');
    }
    if (row.status !== StatusSOP.DRAFT) {
      return sopCatalogRepoFail('CONFLICT', 'Hanya versi berstatus DRAFT yang dapat dihapus');
    }
    if (row.revisiDariDetailSopId === null) {
      return sopCatalogRepoFail(
        'CONFLICT',
        'Hanya versi revisi yang dibuat dari versi sebelumnya yang dapat dihapus lewat endpoint ini',
      );
    }
    if (row._count.nilaiEvaluasi > 0) {
      return sopCatalogRepoFail(
        'CONFLICT',
        'Versi tidak dapat dihapus karena sudah terikat data evaluasi',
      );
    }
    await this.prisma.detailSOP.delete({ where: { detailSopId } });
    return sopCatalogRepoOk(undefined);
  }

  async deleteSopDraftAwal(detailSopId: string): Promise<SopCatalogRepoResult<void>> {
    const row = await this.prisma.detailSOP.findUnique({
      where: { detailSopId },
      select: {
        sopId: true,
        status: true,
        versi: true,
        revisiDariDetailSopId: true,
        sop: { select: { _count: { select: { detailSops: true } } } },
      },
    });
    if (row === null) {
      return sopCatalogRepoFail('NOT_FOUND', 'DetailSOP tidak ditemukan');
    }
    if (
      row.status !== StatusSOP.DRAFT ||
      row.versi !== 1 ||
      row.revisiDariDetailSopId !== null ||
      row.sop._count.detailSops !== 1
    ) {
      return sopCatalogRepoFail(
        'CONFLICT',
        'SOP hanya dapat dihapus ketika masih berupa draft awal dan belum memiliki versi lain',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.detailSOP.delete({ where: { detailSopId } });
      await tx.sOP.delete({ where: { sopId: row.sopId } });
    });
    return sopCatalogRepoOk(undefined);
  }
}
