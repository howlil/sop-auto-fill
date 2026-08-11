import { Injectable } from '@nestjs/common';
import {
  JenisDokumenTte,
  PeranPengguna,
  Prisma,
  StatusPengajuanEvaluasi,
  StatusSOP,
} from '../../../../generated/prisma';
import { toWibDateOnly } from '../../../../common/date/wib-date.util';
import { PrismaService } from '../../../../common/prisma/prisma.service';

export type TtePenggunaRingkas = {
  readonly penggunaId: string;
  readonly email: string;
  readonly nama: string;
  readonly nip: string;
  readonly jabatan: string;
  readonly pangkat: string;
  readonly peran: PeranPengguna;
  readonly opdId: string;
  readonly opdNama: string;
};

export type TteKredensialRow = {
  readonly hashPin: string;
  readonly p12Base64: string | null;
  readonly p12PassphraseEncrypted: string | null;
  readonly updatedAt: Date;
};

export type PdfSignatureMetadataInput = {
  readonly signatureValue: string;
  readonly signatureAlgorithm: string;
  readonly signatureFormat: string;
  readonly certSerialNumber: string;
  readonly certIssuer: string;
  readonly certSubject: string;
  readonly certFingerprint: string;
  readonly certValidFrom: Date;
  readonly certValidTo: Date;
};

export type PdfSignatureBindingRow = {
  readonly userId: string;
  readonly dokumenTteId: string;
  readonly peran: PeranPengguna;
  readonly ditandatanganiPada: Date;
  readonly signatureValue: string | null;
  readonly certSerialNumber: string | null;
  readonly certFingerprint: string | null;
  readonly dokumenTte: {
    readonly dokumenTteId: string;
    readonly nomorDokumen: string;
    readonly judulDokumen: string;
    readonly jenisDokumen: JenisDokumenTte;
    readonly hashDokumen: string;
  };
};

export type PreparedSopPengesahanItem = {
  readonly detailSopId: string;
  readonly sopId: string;
  readonly opdId: string;
  readonly judulSop: string;
  readonly nomorSOP: string;
  readonly versi: number;
  readonly dokumenTteId: string;
  readonly nomorDokumen: string;
  readonly judulDokumen: string;
};

export type PreparedSopPengesahanResult =
  | { readonly ok: true; readonly items: PreparedSopPengesahanItem[] }
  | {
      readonly ok?: false;
      readonly error:
        | 'NOT_FOUND'
        | 'FORBIDDEN_OPD'
        | 'BAD_PENGAJUAN_STATUS'
        | 'EMPTY_SOP'
        | 'BAD_SOP_STATUS'
        | 'ALREADY_SIGNED'
        | 'INVALID_DOC_PARENT'
        | 'SOP_STATUS_DRIFT';
      readonly status?: StatusPengajuanEvaluasi | StatusSOP;
      readonly expectedStatus?: StatusPengajuanEvaluasi | StatusSOP;
      readonly detailSopId?: string;
      readonly nomorSOP?: string;
      readonly judulSOP?: string;
      readonly expectedCount?: number;
      readonly updatedCount?: number;
    };

export type FinalizeSopPengesahanArtifactInput = {
  readonly detailSopId: string;
  readonly dokumenTteId: string;
  readonly pdfPath: string;
  readonly pdfSha256: string;
  readonly pdfSizeBytes: number;
  readonly signatureMetadata: PdfSignatureMetadataInput;
};

@Injectable()
export class TteRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Invariant domain: tepat satu FK parent (selaras CHECK `chk_dokumentte_satu_orang_tua`). */
  private isDokumenTteSingleParent(d: {
    detailSopId: string | null;
    pengajuanEvaluasiId: string | null;
  }): boolean {
    const hasDetail = d.detailSopId !== null && d.detailSopId !== undefined;
    const hasPengajuan = d.pengajuanEvaluasiId !== null && d.pengajuanEvaluasiId !== undefined;
    return hasDetail !== hasPengajuan;
  }

  async findPenggunaAktif(userId: string): Promise<TtePenggunaRingkas | null> {
    const row = await this.prisma.pengguna.findFirst({
      where: { penggunaId: userId, deletedAt: null },
      select: {
        penggunaId: true,
        email: true,
        nama: true,
        nip: true,
        jabatan: true,
        pangkat: true,
        peran: true,
        opdId: true,
        opd: { select: { nama: true } },
      },
    });
    if (row === null) return null;
    return {
      penggunaId: row.penggunaId,
      email: row.email,
      nama: row.nama,
      nip: row.nip,
      jabatan: row.jabatan,
      pangkat: row.pangkat,
      peran: row.peran,
      opdId: row.opdId,
      opdNama: row.opd?.nama ?? 'Biro Organisasi',
    };
  }

  async findKredensial(userId: string): Promise<TteKredensialRow | null> {
    const row = await this.prisma.pengguna.findFirst({
      where: { penggunaId: userId, deletedAt: null },
      select: {
        ttePinHash: true,
        tteP12Base64: true,
        tteP12PassphraseEncrypted: true,
        updatedAt: true,
      },
    });
    if (row === null || row.ttePinHash === null) {
      return null;
    }
    return {
      hashPin: row.ttePinHash,
      p12Base64: row.tteP12Base64,
      p12PassphraseEncrypted: row.tteP12PassphraseEncrypted,
      updatedAt: row.updatedAt,
    };
  }

  async createKredensialPin(params: {
    userId: string;
    hashPin: string;
  }): Promise<TteKredensialRow> {
    const row = await this.prisma.pengguna.update({
      where: { penggunaId: params.userId },
      data: {
        ttePinHash: params.hashPin,
      },
      select: {
        ttePinHash: true,
        tteP12Base64: true,
        tteP12PassphraseEncrypted: true,
        updatedAt: true,
      },
    });
    return {
      hashPin: row.ttePinHash!,
      p12Base64: row.tteP12Base64,
      p12PassphraseEncrypted: row.tteP12PassphraseEncrypted,
      updatedAt: row.updatedAt,
    };
  }

  /** Setup awal: simpan PIN hash + P12 sekaligus dalam satu operasi. */
  async createKredensialPinDanP12(params: {
    userId: string;
    hashPin: string;
    p12Base64: string;
    p12PassphraseEncrypted: string;
  }): Promise<TteKredensialRow> {
    const row = await this.prisma.pengguna.update({
      where: { penggunaId: params.userId },
      data: {
        ttePinHash: params.hashPin,
        tteP12Base64: params.p12Base64,
        tteP12PassphraseEncrypted: params.p12PassphraseEncrypted,
      },
      select: {
        ttePinHash: true,
        tteP12Base64: true,
        tteP12PassphraseEncrypted: true,
        updatedAt: true,
      },
    });
    return {
      hashPin: row.ttePinHash!,
      p12Base64: row.tteP12Base64,
      p12PassphraseEncrypted: row.tteP12PassphraseEncrypted,
      updatedAt: row.updatedAt,
    };
  }

  async updateKredensialPinHash(params: {
    userId: string;
    hashPin: string;
  }): Promise<TteKredensialRow> {
    const row = await this.prisma.pengguna.update({
      where: { penggunaId: params.userId },
      data: { ttePinHash: params.hashPin },
      select: {
        ttePinHash: true,
        tteP12Base64: true,
        tteP12PassphraseEncrypted: true,
        updatedAt: true,
      },
    });
    if (row.ttePinHash === null) {
      throw new Error('Kredensial TTE tidak ditemukan setelah pembaruan');
    }
    return {
      hashPin: row.ttePinHash,
      p12Base64: row.tteP12Base64,
      p12PassphraseEncrypted: row.tteP12PassphraseEncrypted,
      updatedAt: row.updatedAt,
    };
  }

  async updateKredensialP12(params: {
    userId: string;
    p12Base64: string;
    p12PassphraseEncrypted: string;
  }): Promise<TteKredensialRow> {
    const row = await this.prisma.pengguna.update({
      where: { penggunaId: params.userId },
      data: {
        tteP12Base64: params.p12Base64,
        tteP12PassphraseEncrypted: params.p12PassphraseEncrypted,
      },
      select: {
        ttePinHash: true,
        tteP12Base64: true,
        tteP12PassphraseEncrypted: true,
        updatedAt: true,
      },
    });
    if (row.ttePinHash === null) {
      throw new Error('Kredensial TTE tidak ditemukan (belum ada PIN)');
    }
    return {
      hashPin: row.ttePinHash,
      p12Base64: row.tteP12Base64,
      p12PassphraseEncrypted: row.tteP12PassphraseEncrypted,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Data ringkas untuk halaman verifikasi publik (scan QR). Tanpa `signatureValue` atau field sensitif lain.
   */
  async findRiwayatPengesahanByUserAndDokumen(userId: string, dokumenTteId: string) {
    return this.prisma.riwayatTandaTangan.findUnique({
      where: { userId_dokumenTteId: { userId, dokumenTteId } },
      select: {
        userId: true,
        dokumenTteId: true,
        peran: true,
        ditandatanganiPada: true,
        dokumenTte: {
          select: {
            dokumenTteId: true,
            nomorDokumen: true,
            judulDokumen: true,
            hashDokumen: true,
            jenisDokumen: true,
            detailSopId: true,
            pengajuanEvaluasiId: true,
          },
        },
        user: {
          select: { penggunaId: true, nama: true, nip: true, jabatan: true },
        },
      },
    });
  }

  async findBeritaAcaraArsipForPdfSigning(pengajuanEvaluasiId: string) {
    const row = await this.prisma.pengajuanEvaluasi.findUnique({
      where: { pengajuanEvaluasiId },
      select: {
        pengajuanEvaluasiId: true,
        status: true,
        opdId: true,
        opd: { select: { nama: true } },
        dokumenTte: {
          where: { jenisDokumen: JenisDokumenTte.BERITA_ACARA_EVALUASI },
          take: 1,
          select: {
            dokumenTteId: true,
            jenisDokumen: true,
            pengajuanEvaluasiId: true,
            riwayatTandaTangan: {
              select: { userId: true, peran: true, ditandatanganiPada: true },
              orderBy: { ditandatanganiPada: 'asc' },
            },
          },
        },
      },
    });
    if (row === null) {
      return null;
    }
    return {
      pengajuanEvaluasiId: row.pengajuanEvaluasiId,
      status: row.status,
      opdId: row.opdId,
      opd: row.opd,
      dokumenTte: row.dokumenTte[0] ?? null,
    };
  }

  async findRiwayatForPdfSigning(userId: string, dokumenTteId: string) {
    return this.prisma.riwayatTandaTangan.findUnique({
      where: { userId_dokumenTteId: { userId, dokumenTteId } },
      select: {
        userId: true,
        dokumenTteId: true,
        peran: true,
        ditandatanganiPada: true,
        dokumenTte: {
          select: {
            dokumenTteId: true,
            nomorDokumen: true,
            judulDokumen: true,
            jenisDokumen: true,
          },
        },
        user: {
          select: {
            penggunaId: true,
            nama: true,
            nip: true,
            jabatan: true,
          },
        },
      },
    });
  }

  async updateRiwayatPdfSignatureMetadata(params: {
    userId: string;
    dokumenTteId: string;
    metadata: PdfSignatureMetadataInput;
  }): Promise<void> {
    await this.prisma.riwayatTandaTangan.update({
      where: {
        userId_dokumenTteId: {
          userId: params.userId,
          dokumenTteId: params.dokumenTteId,
        },
      },
      data: {
        signatureValue: params.metadata.signatureValue,
        signatureAlgorithm: params.metadata.signatureAlgorithm,
        signatureFormat: params.metadata.signatureFormat,
        certSerialNumber: params.metadata.certSerialNumber,
        certIssuer: params.metadata.certIssuer,
        certSubject: params.metadata.certSubject,
        certFingerprint: params.metadata.certFingerprint,
        certValidFrom: params.metadata.certValidFrom,
        certValidTo: params.metadata.certValidTo,
      },
    });
  }

  async findRiwayatByPdfSignatureBinding(params: {
    userId: string;
    dokumenTteId: string;
  }): Promise<PdfSignatureBindingRow | null> {
    return this.prisma.riwayatTandaTangan.findUnique({
      where: {
        userId_dokumenTteId: {
          userId: params.userId,
          dokumenTteId: params.dokumenTteId,
        },
      },
      select: {
        userId: true,
        dokumenTteId: true,
        peran: true,
        ditandatanganiPada: true,
        signatureValue: true,
        certSerialNumber: true,
        certFingerprint: true,
        dokumenTte: {
          select: {
            dokumenTteId: true,
            nomorDokumen: true,
            judulDokumen: true,
            jenisDokumen: true,
            hashDokumen: true,
          },
        },
      },
    });
  }

  async assertRiwayatBelumAda(
    tx: Prisma.TransactionClient,
    dokumenTteId: string,
    peran: PeranPengguna,
  ) {
    return tx.riwayatTandaTangan.findUnique({
      where: {
        dokumenTteId_peran: { dokumenTteId, peran },
      },
    });
  }

  private async gantikanVersiBerlakuLain(
    tx: Prisma.TransactionClient,
    params: { sopId: string; detailSopId: string },
  ): Promise<void> {
    await tx.detailSOP.updateMany({
      where: {
        sopId: params.sopId,
        detailSopId: { not: params.detailSopId },
        status: StatusSOP.BERLAKU,
      },
      data: { status: StatusSOP.DIGANTIKAN },
    });
  }

  /**
   * PJ Evaluator menandatangani BA: pengajuan SELESAI_DIEVALUASI → DITANDATANGANI_PJ_EVALUATOR.
   */
  async transaksiTandaTanganiBaEvaluator(params: {
    pengajuanEvaluasiId: string;
    userId: string;
    peran: PeranPengguna;
    hashDokumen: string;
    nomorDokumen: string;
    judulDokumen: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const pengajuan = await tx.pengajuanEvaluasi.findUnique({
        where: { pengajuanEvaluasiId: params.pengajuanEvaluasiId },
        include: { nilaiEvaluasi: { select: { detailSopId: true } } },
      });
      if (pengajuan === null) {
        return { error: 'NOT_FOUND' as const };
      }
      if (pengajuan.status !== StatusPengajuanEvaluasi.SELESAI_DIEVALUASI) {
        return { error: 'BAD_STATUS' as const, status: pengajuan.status };
      }
      let dokumen = await tx.dokumenTte.findUnique({
        where: { pengajuanEvaluasiId: params.pengajuanEvaluasiId },
      });
      if (dokumen === null) {
        dokumen = await tx.dokumenTte.create({
          data: {
            nomorDokumen: params.nomorDokumen,
            judulDokumen: params.judulDokumen,
            hashDokumen: params.hashDokumen,
            jenisDokumen: JenisDokumenTte.BERITA_ACARA_EVALUASI,
            pengajuanEvaluasiId: params.pengajuanEvaluasiId,
          },
        });
      } else {
        if (!this.isDokumenTteSingleParent(dokumen)) {
          return { error: 'INVALID_DOC_PARENT' as const };
        }
        await tx.dokumenTte.update({
          where: { dokumenTteId: dokumen.dokumenTteId },
          data: {
            nomorDokumen: params.nomorDokumen,
            judulDokumen: params.judulDokumen,
            hashDokumen: params.hashDokumen,
          },
        });
      }
      const dup = await this.assertRiwayatBelumAda(tx, dokumen.dokumenTteId, params.peran);
      if (dup !== null) {
        return { error: 'ALREADY_SIGNED' as const };
      }
      await tx.riwayatTandaTangan.create({
        data: {
          userId: params.userId,
          dokumenTteId: dokumen.dokumenTteId,
          peran: params.peran,
        },
      });
      await tx.pengajuanEvaluasi.update({
        where: { pengajuanEvaluasiId: params.pengajuanEvaluasiId },
        data: {
          status: StatusPengajuanEvaluasi.DITANDATANGANI_PJ_EVALUATOR,
          diverifikasiOlehUserId: params.userId,
          version: { increment: 1 },
        },
      });
      const riwayat = await tx.riwayatTandaTangan.findUnique({
        where: {
          userId_dokumenTteId: { userId: params.userId, dokumenTteId: dokumen.dokumenTteId },
        },
        include: {
          dokumenTte: true,
          user: { select: { penggunaId: true, nama: true, nip: true } },
        },
      });
      return { ok: true as const, riwayat };
    });
  }

  /**
   * PJ Penyusun menandatangani BA: DITANDATANGANI_PJ_EVALUATOR → DITANDATANGANI_PJ_PENYUSUN; DetailSOP MENUNGGU_TTD_PJ_EVALUATOR → DIVERIFIKASI_PJ_EVALUATOR_ORGANISASI.
   */
  async transaksiTandaTanganiBaPjPenyusun(params: {
    pengajuanEvaluasiId: string;
    userId: string;
    userOpdId: string;
    peran: PeranPengguna;
    hashDokumen: string;
    nomorDokumen: string;
    judulDokumen: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const pengajuan = await tx.pengajuanEvaluasi.findUnique({
        where: { pengajuanEvaluasiId: params.pengajuanEvaluasiId },
        include: { nilaiEvaluasi: { select: { detailSopId: true } } },
      });
      if (pengajuan === null) {
        return { error: 'NOT_FOUND' as const };
      }
      if (pengajuan.opdId !== params.userOpdId) {
        return { error: 'FORBIDDEN_OPD' as const };
      }
      if (pengajuan.status !== StatusPengajuanEvaluasi.DITANDATANGANI_PJ_EVALUATOR) {
        return { error: 'BAD_STATUS' as const, status: pengajuan.status };
      }
      const dokumen =
        (await tx.dokumenTte.findUnique({
          where: { pengajuanEvaluasiId: params.pengajuanEvaluasiId },
        })) ??
        (await tx.dokumenTte.create({
          data: {
            nomorDokumen: params.nomorDokumen,
            judulDokumen: params.judulDokumen,
            hashDokumen: params.hashDokumen,
            jenisDokumen: JenisDokumenTte.BERITA_ACARA_EVALUASI,
            pengajuanEvaluasiId: params.pengajuanEvaluasiId,
          },
        }));
      if (!this.isDokumenTteSingleParent(dokumen)) {
        return { error: 'INVALID_DOC_PARENT' as const };
      }
      if (dokumen.pengajuanEvaluasiId !== params.pengajuanEvaluasiId) {
        return { error: 'DOC_MISMATCH' as const };
      }
      await tx.dokumenTte.update({
        where: { dokumenTteId: dokumen.dokumenTteId },
        data: {
          nomorDokumen: params.nomorDokumen,
          judulDokumen: params.judulDokumen,
          hashDokumen: params.hashDokumen,
        },
      });
      const dup = await this.assertRiwayatBelumAda(tx, dokumen.dokumenTteId, params.peran);
      if (dup !== null) {
        return { error: 'ALREADY_SIGNED' as const };
      }
      const detailIds = pengajuan.nilaiEvaluasi.map((n) => n.detailSopId);
      const promoted = await tx.detailSOP.updateMany({
        where: {
          detailSopId: { in: detailIds },
          status: StatusSOP.MENUNGGU_TTD_PJ_EVALUATOR,
        },
        data: { status: StatusSOP.DIVERIFIKASI_PJ_EVALUATOR_ORGANISASI },
      });
      if (promoted.count !== detailIds.length) {
        return {
          error: 'SOP_STATUS_DRIFT' as const,
          expectedCount: detailIds.length,
          updatedCount: promoted.count,
        };
      }
      await tx.riwayatTandaTangan.create({
        data: {
          userId: params.userId,
          dokumenTteId: dokumen.dokumenTteId,
          peran: params.peran,
        },
      });
      const sekarang = new Date();
      await tx.pengajuanEvaluasi.update({
        where: { pengajuanEvaluasiId: params.pengajuanEvaluasiId },
        data: {
          status: StatusPengajuanEvaluasi.DITANDATANGANI_PJ_PENYUSUN,
          ditandatanganiOlehPjPenyusunUserId: params.userId,
          tanggalTTDBaPjPenyusun: sekarang,
          version: { increment: 1 },
        },
      });
      const riwayat = await tx.riwayatTandaTangan.findUnique({
        where: {
          userId_dokumenTteId: { userId: params.userId, dokumenTteId: dokumen.dokumenTteId },
        },
        include: {
          dokumenTte: true,
          user: { select: { penggunaId: true, nama: true, nip: true } },
        },
      });
      return { ok: true as const, riwayat };
    });
  }

  async prepareSopPengesahanDocuments(params: {
    pengajuanEvaluasiId: string;
    userId: string;
    userOpdId: string;
    peran: PeranPengguna;
    hashDokumen: string;
    nomorDokumen: string;
    judulDokumen: string;
    expectedDetailSopIds: readonly string[];
  }): Promise<PreparedSopPengesahanResult> {
    return this.prisma.$transaction(async (tx) => {
      const pengajuan = await tx.pengajuanEvaluasi.findUnique({
        where: { pengajuanEvaluasiId: params.pengajuanEvaluasiId },
        include: {
          nilaiEvaluasi: {
            include: {
              detailSop: {
                include: {
                  sop: { select: { opdId: true, judul: true } },
                },
              },
            },
          },
        },
      });
      if (pengajuan === null) {
        return { error: 'NOT_FOUND' as const };
      }
      const invalid = this.validateSopPengesahanPengajuan(pengajuan, params.userOpdId);
      if (invalid !== null) {
        return invalid;
      }
      const expectedDetailSopIds = new Set(params.expectedDetailSopIds);
      if (
        expectedDetailSopIds.size !== pengajuan.nilaiEvaluasi.length ||
        pengajuan.nilaiEvaluasi.some(
          (nilai) => !expectedDetailSopIds.has(nilai.detailSop.detailSopId),
        )
      ) {
        return {
          error: 'SOP_STATUS_DRIFT' as const,
          expectedCount: pengajuan.nilaiEvaluasi.length,
          updatedCount: expectedDetailSopIds.size,
        };
      }
      const items: PreparedSopPengesahanItem[] = [];
      for (const nilai of pengajuan.nilaiEvaluasi) {
        const detail = nilai.detailSop;
        let dokumen = await tx.dokumenTte.findUnique({
          where: { detailSopId: detail.detailSopId },
        });
        const judulDokumenPerSop = `${params.judulDokumen} - ${detail.sop.judul}`;
        const nomorDokumenPerSop = `${params.nomorDokumen}-${detail.nomorSOP}`;
        if (dokumen === null) {
          dokumen = await tx.dokumenTte.create({
            data: {
              nomorDokumen: nomorDokumenPerSop,
              judulDokumen: judulDokumenPerSop,
              hashDokumen: params.hashDokumen,
              jenisDokumen: JenisDokumenTte.SOP_BERLAKU,
              detailSopId: detail.detailSopId,
            },
          });
        } else {
          if (!this.isDokumenTteSingleParent(dokumen)) {
            return { error: 'INVALID_DOC_PARENT' as const, detailSopId: detail.detailSopId };
          }
          await tx.dokumenTte.update({
            where: { dokumenTteId: dokumen.dokumenTteId },
            data: {
              nomorDokumen: nomorDokumenPerSop,
              judulDokumen: judulDokumenPerSop,
              hashDokumen: params.hashDokumen,
            },
          });
        }
        const dup = await this.assertRiwayatBelumAda(tx, dokumen.dokumenTteId, params.peran);
        if (dup !== null) {
          return { error: 'ALREADY_SIGNED' as const, detailSopId: detail.detailSopId };
        }
        items.push({
          detailSopId: detail.detailSopId,
          sopId: detail.sopId,
          opdId: detail.sop.opdId,
          judulSop: detail.sop.judul,
          nomorSOP: detail.nomorSOP,
          versi: detail.versi,
          dokumenTteId: dokumen.dokumenTteId,
          nomorDokumen: nomorDokumenPerSop,
          judulDokumen: judulDokumenPerSop,
        });
      }
      return { ok: true as const, items };
    });
  }

  async finalizeSopPengesahanWithArtifacts(params: {
    pengajuanEvaluasiId: string;
    userId: string;
    userOpdId: string;
    peran: PeranPengguna;
    signedAt: Date;
    /** Objek yang sama dengan tanggal yang sudah dicetak pada PDF resmi. */
    tanggalEfektif: Date;
    artifacts: FinalizeSopPengesahanArtifactInput[];
  }) {
    return this.prisma.$transaction(async (tx) => {
      const pengajuan = await tx.pengajuanEvaluasi.findUnique({
        where: { pengajuanEvaluasiId: params.pengajuanEvaluasiId },
        include: {
          nilaiEvaluasi: {
            include: {
              detailSop: {
                include: {
                  sop: { select: { opdId: true, judul: true } },
                },
              },
            },
          },
        },
      });
      if (pengajuan === null) {
        return { error: 'NOT_FOUND' as const };
      }
      const invalid = this.validateSopPengesahanPengajuan(pengajuan, params.userOpdId);
      if (invalid !== null) {
        return invalid;
      }
      const artifactByDetail = new Map(params.artifacts.map((item) => [item.detailSopId, item]));
      if (artifactByDetail.size !== pengajuan.nilaiEvaluasi.length) {
        return {
          error: 'SOP_STATUS_DRIFT' as const,
          expectedCount: pengajuan.nilaiEvaluasi.length,
          updatedCount: artifactByDetail.size,
        };
      }

      for (const nilai of pengajuan.nilaiEvaluasi) {
        const detail = nilai.detailSop;
        const artifact = artifactByDetail.get(detail.detailSopId);
        if (artifact === undefined) {
          return {
            error: 'SOP_STATUS_DRIFT' as const,
            expectedCount: pengajuan.nilaiEvaluasi.length,
            updatedCount: artifactByDetail.size,
          };
        }
        const dokumen = await tx.dokumenTte.findUnique({
          where: { detailSopId: detail.detailSopId },
        });
        if (dokumen === null || dokumen.dokumenTteId !== artifact.dokumenTteId) {
          return { error: 'INVALID_DOC_PARENT' as const, detailSopId: detail.detailSopId };
        }
        const dup = await this.assertRiwayatBelumAda(tx, dokumen.dokumenTteId, params.peran);
        if (dup !== null) {
          return { error: 'ALREADY_SIGNED' as const, detailSopId: detail.detailSopId };
        }
        const replaced = await tx.detailSOP.findMany({
          where: {
            sopId: detail.sopId,
            detailSopId: { not: detail.detailSopId },
            status: StatusSOP.BERLAKU,
          },
          select: { detailSopId: true },
        });
        await this.gantikanVersiBerlakuLain(tx, {
          sopId: detail.sopId,
          detailSopId: detail.detailSopId,
        });
        await this.updatePdfStatusForDetailIds(
          tx,
          replaced.map((row) => row.detailSopId),
          'SUPERSEDED',
          params.signedAt,
        );
        await tx.riwayatTandaTangan.create({
          data: {
            userId: params.userId,
            dokumenTteId: dokumen.dokumenTteId,
            peran: params.peran,
            ditandatanganiPada: params.signedAt,
            signatureValue: artifact.signatureMetadata.signatureValue,
            signatureAlgorithm: artifact.signatureMetadata.signatureAlgorithm,
            signatureFormat: artifact.signatureMetadata.signatureFormat,
            certSerialNumber: artifact.signatureMetadata.certSerialNumber,
            certIssuer: artifact.signatureMetadata.certIssuer,
            certSubject: artifact.signatureMetadata.certSubject,
            certFingerprint: artifact.signatureMetadata.certFingerprint,
            certValidFrom: artifact.signatureMetadata.certValidFrom,
            certValidTo: artifact.signatureMetadata.certValidTo,
          },
        });
        await tx.detailSOP.update({
          where: { detailSopId: detail.detailSopId },
          data: {
            status: StatusSOP.BERLAKU,
            terakhirDieditOlehId: params.userId,
            tanggalEfektif: params.tanggalEfektif,
          },
        });
        await tx.$executeRaw`
          UPDATE DokumenTte
          SET pdfPath = ${artifact.pdfPath},
              pdfSha256 = ${artifact.pdfSha256},
              pdfSizeBytes = ${artifact.pdfSizeBytes},
              pdfGeneratedAt = ${params.signedAt},
              pdfPublishedAt = ${params.signedAt},
              pdfRevokedAt = NULL,
              pdfStatus = ${'PUBLISHED'}
          WHERE dokumenTteId = ${dokumen.dokumenTteId}
        `;
      }
      await tx.pengajuanEvaluasi.update({
        where: { pengajuanEvaluasiId: params.pengajuanEvaluasiId },
        data: {
          status: StatusPengajuanEvaluasi.SELESAI,
          version: { increment: 1 },
        },
      });
      return {
        ok: true as const,
        totalSopDitandatangani: pengajuan.nilaiEvaluasi.length,
      };
    });
  }

  private validateSopPengesahanPengajuan(
    pengajuan: {
      opdId: string;
      status: StatusPengajuanEvaluasi;
      nilaiEvaluasi: Array<{
        detailSop: {
          detailSopId: string;
          nomorSOP: string;
          status: StatusSOP;
          sop: { opdId: string; judul: string };
        };
      }>;
    },
    userOpdId: string,
  ): PreparedSopPengesahanResult | null {
    if (pengajuan.opdId !== userOpdId) {
      return { error: 'FORBIDDEN_OPD' as const };
    }
    if (pengajuan.status !== StatusPengajuanEvaluasi.DITANDATANGANI_PJ_PENYUSUN) {
      return {
        error: 'BAD_PENGAJUAN_STATUS' as const,
        status: pengajuan.status,
        expectedStatus: StatusPengajuanEvaluasi.DITANDATANGANI_PJ_PENYUSUN,
      };
    }
    if (pengajuan.nilaiEvaluasi.length === 0) {
      return { error: 'EMPTY_SOP' as const };
    }
    for (const nilai of pengajuan.nilaiEvaluasi) {
      const detail = nilai.detailSop;
      if (detail.sop.opdId !== userOpdId) {
        return { error: 'FORBIDDEN_OPD' as const };
      }
      if (detail.status !== StatusSOP.DIVERIFIKASI_PJ_EVALUATOR_ORGANISASI) {
        return {
          error: 'BAD_SOP_STATUS' as const,
          detailSopId: detail.detailSopId,
          nomorSOP: detail.nomorSOP,
          judulSOP: detail.sop.judul,
          status: detail.status,
          expectedStatus: StatusSOP.DIVERIFIKASI_PJ_EVALUATOR_ORGANISASI,
        };
      }
    }
    return null;
  }

  private async updatePdfStatusForDetailIds(
    tx: Prisma.TransactionClient,
    detailSopIds: string[],
    status: 'SUPERSEDED' | 'REVOKED',
    timestamp: Date,
  ): Promise<void> {
    if (detailSopIds.length === 0) {
      return;
    }
    await tx.$executeRaw`
      UPDATE DokumenTte
      SET pdfStatus = ${status},
          pdfRevokedAt = ${timestamp}
      WHERE detailSopId IN (${Prisma.join(detailSopIds)})
        AND jenisDokumen = ${JenisDokumenTte.SOP_BERLAKU}
    `;
  }

  async transaksiTandaTanganiSemuaSopPengajuan(params: {
    pengajuanEvaluasiId: string;
    userId: string;
    userOpdId: string;
    peran: PeranPengguna;
    signedAt: Date;
    hashDokumen: string;
    nomorDokumen: string;
    judulDokumen: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const tanggalEfektif = toWibDateOnly(params.signedAt);
      const pengajuan = await tx.pengajuanEvaluasi.findUnique({
        where: { pengajuanEvaluasiId: params.pengajuanEvaluasiId },
        include: {
          nilaiEvaluasi: {
            include: {
              detailSop: {
                include: {
                  sop: { select: { opdId: true, judul: true } },
                },
              },
            },
          },
        },
      });
      if (pengajuan === null) {
        return { error: 'NOT_FOUND' as const };
      }
      if (pengajuan.opdId !== params.userOpdId) {
        return { error: 'FORBIDDEN_OPD' as const };
      }
      if (pengajuan.status !== StatusPengajuanEvaluasi.DITANDATANGANI_PJ_PENYUSUN) {
        return {
          error: 'BAD_PENGAJUAN_STATUS' as const,
          status: pengajuan.status,
          expectedStatus: StatusPengajuanEvaluasi.DITANDATANGANI_PJ_PENYUSUN,
        };
      }
      if (pengajuan.nilaiEvaluasi.length === 0) {
        return { error: 'EMPTY_SOP' as const };
      }
      const allowedStatus = new Set<StatusSOP>([StatusSOP.DIVERIFIKASI_PJ_EVALUATOR_ORGANISASI]);
      for (const nilai of pengajuan.nilaiEvaluasi) {
        const detail = nilai.detailSop;
        if (detail.sop.opdId !== params.userOpdId) {
          return { error: 'FORBIDDEN_OPD' as const };
        }
        if (!allowedStatus.has(detail.status)) {
          return {
            error: 'BAD_SOP_STATUS' as const,
            detailSopId: detail.detailSopId,
            nomorSOP: detail.nomorSOP,
            judulSOP: detail.sop.judul,
            status: detail.status,
            expectedStatus: StatusSOP.DIVERIFIKASI_PJ_EVALUATOR_ORGANISASI,
          };
        }
        let dokumen = await tx.dokumenTte.findUnique({
          where: { detailSopId: detail.detailSopId },
        });
        const judulDokumenPerSop = `${params.judulDokumen} - ${detail.sop.judul}`;
        const nomorDokumenPerSop = `${params.nomorDokumen}-${detail.nomorSOP}`;
        if (dokumen === null) {
          dokumen = await tx.dokumenTte.create({
            data: {
              nomorDokumen: nomorDokumenPerSop,
              judulDokumen: judulDokumenPerSop,
              hashDokumen: params.hashDokumen,
              jenisDokumen: JenisDokumenTte.SOP_BERLAKU,
              detailSopId: detail.detailSopId,
            },
          });
        } else {
          if (!this.isDokumenTteSingleParent(dokumen)) {
            return {
              error: 'INVALID_DOC_PARENT' as const,
              detailSopId: detail.detailSopId,
            };
          }
          await tx.dokumenTte.update({
            where: { dokumenTteId: dokumen.dokumenTteId },
            data: {
              nomorDokumen: nomorDokumenPerSop,
              judulDokumen: judulDokumenPerSop,
              hashDokumen: params.hashDokumen,
            },
          });
        }
        const dup = await this.assertRiwayatBelumAda(tx, dokumen.dokumenTteId, params.peran);
        if (dup !== null) {
          return {
            error: 'ALREADY_SIGNED' as const,
            detailSopId: detail.detailSopId,
          };
        }
        await tx.riwayatTandaTangan.create({
          data: {
            userId: params.userId,
            dokumenTteId: dokumen.dokumenTteId,
            peran: params.peran,
            ditandatanganiPada: params.signedAt,
          },
        });
        await this.gantikanVersiBerlakuLain(tx, {
          sopId: detail.sopId,
          detailSopId: detail.detailSopId,
        });
        await tx.detailSOP.update({
          where: { detailSopId: detail.detailSopId },
          data: {
            status: StatusSOP.BERLAKU,
            terakhirDieditOlehId: params.userId,
            tanggalEfektif,
          },
        });
      }
      await tx.pengajuanEvaluasi.update({
        where: { pengajuanEvaluasiId: params.pengajuanEvaluasiId },
        data: {
          status: StatusPengajuanEvaluasi.SELESAI,
          version: { increment: 1 },
        },
      });
      return {
        ok: true as const,
        totalSopDitandatangani: pengajuan.nilaiEvaluasi.length,
      };
    });
  }
}
