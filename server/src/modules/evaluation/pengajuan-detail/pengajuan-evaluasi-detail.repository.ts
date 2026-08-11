import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { JenisDokumenTte, PeranPengguna } from '../../../generated/prisma';

export type SopBerlakuDokumenRow = {
  dokumenTteId: string;
  riwayatTandaTangan: ReadonlyArray<{
    peran: PeranPengguna;
    userId: string;
    dokumenTteId: string;
    ditandatanganiPada: Date;
    user: {
      nama: string;
      nip: string;
      jabatan: string;
    };
  }>;
};

export type BeritaAcaraDokumenRow = {
  dokumenTteId: string;
  hashDokumen: string;
  versiDokumen: number;
  riwayatTandaTangan: ReadonlyArray<{
    peran: PeranPengguna;
    userId: string;
    dokumenTteId: string;
    ditandatanganiPada: Date;
    user: {
      nama: string;
      nip: string;
      jabatan: string;
    };
  }>;
};

/** Akses data terbatas untuk sub-resource detail pengajuan (keanggotaan pengajuan evaluasi, TTE BA). */
@Injectable()
export class PengajuanEvaluasiDetailRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** True bila baris NilaiEvaluasi menghubungkan pengajuan dengan detail SOP. */
  async existsNilaiUntukDetail(pengajuanEvaluasiId: string, detailSopId: string): Promise<boolean> {
    const row = await this.prisma.nilaiEvaluasi.findFirst({
      where: { pengajuanEvaluasiId, detailSopId },
      select: { pengajuanEvaluasiId: true },
    });
    return row !== null;
  }

  /** Dokumen TTE BA beserta peran yang sudah menandatangani. */
  async findDokumenBeritaAcara(pengajuanEvaluasiId: string): Promise<BeritaAcaraDokumenRow | null> {
    const row = await this.prisma.dokumenTte.findFirst({
      where: {
        pengajuanEvaluasiId,
        jenisDokumen: JenisDokumenTte.BERITA_ACARA_EVALUASI,
      },
      select: {
        dokumenTteId: true,
        hashDokumen: true,
        versiDokumen: true,
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
    });
    return row;
  }

  /** Dokumen TTE SOP berlaku beserta riwayat penandatangan per peran. */
  async findDokumenSopBerlaku(detailSopId: string): Promise<SopBerlakuDokumenRow | null> {
    const row = await this.prisma.dokumenTte.findFirst({
      where: {
        detailSopId,
        jenisDokumen: JenisDokumenTte.SOP_BERLAKU,
      },
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
    });
    return row;
  }
}
