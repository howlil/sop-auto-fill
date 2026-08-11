import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  JenisPengajuanEvaluasi,
  StatusPengajuanEvaluasi,
  StatusSOP,
} from '../../../generated/prisma';
import { STATUS_PENGAJUAN_AKTIF_LINTAS_JOBDESK } from '../pengajuan/pengajuan-evaluasi-status.constants';

const STATUS_PIPELINE_EVALUASI: readonly StatusSOP[] = [
  StatusSOP.DIAJUKAN_EVALUASI,
  StatusSOP.SEDANG_DIEVALUASI,
  StatusSOP.REVISI_DARI_EVALUATOR,
  StatusSOP.MENUNGGU_TTD_PJ_EVALUATOR,
] as const;

const STATUS_PIPELINE_SET = new Set<string>(STATUS_PIPELINE_EVALUASI);
const STATUS_PIPELINE_DENGAN_SIAP_SET = new Set<string>([
  ...STATUS_PIPELINE_EVALUASI.map(String),
  String(StatusSOP.MENUNGGU_PENGAJUAN_EVALUASI),
]);

export type EvaluasiWorkspaceDaftarRowRepo = {
  readonly detailSopId: string;
  readonly sopId: string;
  readonly judul: string;
  readonly nomorSOP: string;
  readonly statusDetail: StatusSOP;
  readonly versi: number;
  readonly detailUpdatedAt: Date;
};

export type EvaluasiWorkspaceNilaiRepo = {
  readonly detailSopId: string;
  readonly hasil: string | null;
  readonly catatan: string | null;
  readonly statusTindakLanjut: string | null;
  readonly version: number;
  readonly ditindaklanjutiPada: Date | null;
  readonly versi: number;
  readonly detailUpdatedAt: Date;
};

export type EvaluasiWorkspacePengajuanAktifRepo = {
  readonly pengajuanEvaluasiId: string;
  readonly status: StatusPengajuanEvaluasi;
  readonly jenis: JenisPengajuanEvaluasi;
  readonly version: number;
  readonly alasanPenolakan: string | null;
  readonly tanggalDitolak: Date | null;
  readonly nilaiEvaluasi: EvaluasiWorkspaceNilaiRepo[];
};

export type EvaluasiWorkspaceRiwayatOpdRepoRow = {
  readonly pengajuanEvaluasiId: string;
  readonly tanggalDiselesaikan: Date | null;
  readonly nilaiOPD: number | null;
  readonly evaluatorNama: string;
};

export type EvaluasiWorkspaceLogNilaiRepoRow = {
  readonly pengajuanEvaluasiId: string;
  readonly detailSopId: string;
  readonly penggunaId: string;
  readonly evaluatorNama: string;
  readonly hasilSebelum: string | null;
  readonly hasilSesudah: string | null;
  readonly catatanSebelum: string | null;
  readonly catatanSesudah: string | null;
  readonly createdAt: Date;
};

/** Bundle pengajuan + nilai beserta detail SOP untuk workspace per pengajuan. */
export type EvaluasiWorkspacePengajuanBundleRepo = {
  readonly pengajuanEvaluasiId: string;
  readonly opdId: string;
  readonly status: StatusPengajuanEvaluasi;
  readonly jenis: JenisPengajuanEvaluasi;
  readonly version: number;
  readonly alasanPenolakan: string | null;
  readonly tanggalDitolak: Date | null;
  readonly nilaiEvaluasi: readonly EvaluasiWorkspaceNilaiRepo[];
  readonly daftarRows: readonly EvaluasiWorkspaceDaftarRowRepo[];
};

@Injectable()
export class EvaluasiWorkspaceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOpdRingkas(opdId: string): Promise<{ opdId: string; nama: string } | null> {
    return this.prisma.oPD.findFirst({
      where: { opdId, deletedAt: null },
      select: { opdId: true, nama: true },
    });
  }

  async findDaftarDetailPipeline(
    opdId: string,
    options?: { readonly includeSiapDievaluasi?: boolean },
  ): Promise<EvaluasiWorkspaceDaftarRowRepo[]> {
    const allowedStatus =
      options?.includeSiapDievaluasi === true
        ? STATUS_PIPELINE_DENGAN_SIAP_SET
        : STATUS_PIPELINE_SET;
    const sops = await this.prisma.sOP.findMany({
      where: { opdId },
      select: {
        sopId: true,
        judul: true,
        detailSops: {
          orderBy: { versi: 'desc' },
          take: 1,
          select: {
            detailSopId: true,
            nomorSOP: true,
            status: true,
            versi: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { judul: 'asc' },
    });
    const out: EvaluasiWorkspaceDaftarRowRepo[] = [];
    for (const row of sops) {
      const d = row.detailSops[0];
      if (d === undefined) {
        continue;
      }
      if (!allowedStatus.has(String(d.status))) {
        continue;
      }
      out.push({
        detailSopId: d.detailSopId,
        sopId: row.sopId,
        judul: row.judul,
        nomorSOP: d.nomorSOP,
        statusDetail: d.status,
        versi: d.versi,
        detailUpdatedAt: d.updatedAt,
      });
    }
    return out;
  }

  /**
   * Muat satu pengajuan beserta nilai dan metadata DetailSOP/SOP untuk daftar workspace.
   * Daftar SOP = persis anggota pengajuan evaluasi (`NilaiEvaluasi` pengajuan ini).
   */
  async findPengajuanBundleForWorkspace(
    pengajuanEvaluasiId: string,
  ): Promise<EvaluasiWorkspacePengajuanBundleRepo | null> {
    const row = await this.prisma.pengajuanEvaluasi.findUnique({
      where: { pengajuanEvaluasiId },
      select: {
        pengajuanEvaluasiId: true,
        opdId: true,
        status: true,
        jenis: true,
        version: true,
        alasanPenolakan: true,
        tanggalDitolak: true,
        nilaiEvaluasi: {
          select: {
            detailSopId: true,
            hasil: true,
            catatan: true,
            statusTindakLanjut: true,
            version: true,
            ditindaklanjutiPada: true,
            detailSop: {
              select: {
                status: true,
                nomorSOP: true,
                versi: true,
                updatedAt: true,
                sop: { select: { sopId: true, judul: true } },
              },
            },
          },
        },
      },
    });
    if (row === null) {
      return null;
    }
    const nilaiEvaluasi: EvaluasiWorkspaceNilaiRepo[] = row.nilaiEvaluasi.map((n) => ({
      detailSopId: n.detailSopId,
      hasil: n.hasil === null || n.hasil === undefined ? null : String(n.hasil),
      catatan: n.catatan ?? null,
      statusTindakLanjut:
        n.statusTindakLanjut === null || n.statusTindakLanjut === undefined
          ? null
          : String(n.statusTindakLanjut),
      version: n.version,
      ditindaklanjutiPada: n.ditindaklanjutiPada,
      versi: n.detailSop.versi,
      detailUpdatedAt: n.detailSop.updatedAt,
    }));
    const daftarRows: EvaluasiWorkspaceDaftarRowRepo[] = row.nilaiEvaluasi.map((n) => ({
      detailSopId: n.detailSopId,
      sopId: n.detailSop.sop.sopId,
      judul: n.detailSop.sop.judul,
      nomorSOP: n.detailSop.nomorSOP,
      statusDetail: n.detailSop.status,
      versi: n.detailSop.versi,
      detailUpdatedAt: n.detailSop.updatedAt,
    }));
    daftarRows.sort((a, b) => a.judul.localeCompare(b.judul, 'id'));
    return {
      pengajuanEvaluasiId: row.pengajuanEvaluasiId,
      opdId: row.opdId,
      status: row.status,
      jenis: row.jenis,
      version: row.version,
      alasanPenolakan: row.alasanPenolakan,
      tanggalDitolak: row.tanggalDitolak,
      nilaiEvaluasi,
      daftarRows,
    };
  }

  async findPengajuanAktif(opdId: string): Promise<EvaluasiWorkspacePengajuanAktifRepo | null> {
    const row = await this.prisma.pengajuanEvaluasi.findFirst({
      where: {
        opdId,
        status: {
          in: [...STATUS_PENGAJUAN_AKTIF_LINTAS_JOBDESK],
        },
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        pengajuanEvaluasiId: true,
        status: true,
        jenis: true,
        version: true,
        alasanPenolakan: true,
        tanggalDitolak: true,
        nilaiEvaluasi: {
          select: {
            detailSopId: true,
            hasil: true,
            catatan: true,
            statusTindakLanjut: true,
            version: true,
            ditindaklanjutiPada: true,
            detailSop: {
              select: { versi: true, updatedAt: true },
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
      jenis: row.jenis,
      version: row.version,
      alasanPenolakan: row.alasanPenolakan,
      tanggalDitolak: row.tanggalDitolak,
      nilaiEvaluasi: row.nilaiEvaluasi.map((n) => ({
        detailSopId: n.detailSopId,
        hasil: n.hasil === null || n.hasil === undefined ? null : String(n.hasil),
        catatan: n.catatan ?? null,
        statusTindakLanjut:
          n.statusTindakLanjut === null || n.statusTindakLanjut === undefined
            ? null
            : String(n.statusTindakLanjut),
        version: n.version,
        ditindaklanjutiPada: n.ditindaklanjutiPada,
        versi: n.detailSop.versi,
        detailUpdatedAt: n.detailSop.updatedAt,
      })),
    };
  }

  async findRiwayatOpdSelesai(
    opdId: string,
    limit: number,
  ): Promise<EvaluasiWorkspaceRiwayatOpdRepoRow[]> {
    const rows = await this.prisma.pengajuanEvaluasi.findMany({
      where: {
        opdId,
        status: StatusPengajuanEvaluasi.SELESAI,
      },
      orderBy: [{ tanggalDiselesaikan: 'desc' }, { updatedAt: 'desc' }],
      take: limit,
      select: {
        pengajuanEvaluasiId: true,
        tanggalDiselesaikan: true,
        nilaiOPD: true,
        diselesaikanOleh: { select: { nama: true } },
      },
    });
    return rows.map((r) => ({
      pengajuanEvaluasiId: r.pengajuanEvaluasiId,
      tanggalDiselesaikan: r.tanggalDiselesaikan,
      nilaiOPD: r.nilaiOPD ?? null,
      evaluatorNama: r.diselesaikanOleh?.nama ?? '—',
    }));
  }

  /** Log penilaian per DetailSOP dalam satu pengajuan (untuk workspace aktif). */
  async findLogNilaiUntukDetailWorkspace(
    pengajuanEvaluasiId: string,
    detailSopId: string,
    limit: number,
  ): Promise<EvaluasiWorkspaceLogNilaiRepoRow[]> {
    const rows = await this.prisma.logNilaiEvaluasi.findMany({
      where: { pengajuanEvaluasiId, detailSopId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        pengajuanEvaluasiId: true,
        detailSopId: true,
        penggunaId: true,
        createdAt: true,
        hasilSebelum: true,
        hasilSesudah: true,
        catatanSebelum: true,
        catatanSesudah: true,
        pengguna: { select: { nama: true } },
      },
    });
    return rows.map((log) => ({
      pengajuanEvaluasiId: log.pengajuanEvaluasiId,
      detailSopId: log.detailSopId,
      penggunaId: log.penggunaId,
      evaluatorNama: log.pengguna.nama,
      hasilSebelum: log.hasilSebelum === null ? null : String(log.hasilSebelum),
      hasilSesudah: log.hasilSesudah === null ? null : String(log.hasilSesudah),
      catatanSebelum: log.catatanSebelum,
      catatanSesudah: log.catatanSesudah,
      createdAt: log.createdAt,
    }));
  }

  async detailMilikiOpd(detailSopId: string, opdId: string): Promise<boolean> {
    const row = await this.prisma.detailSOP.findFirst({
      where: { detailSopId, sop: { opdId } },
      select: { detailSopId: true },
    });
    return row !== null;
  }

  async evaluatorTerakhirUntukDetailSop(
    detailSopIds: string[],
  ): Promise<Map<string, { nama: string; pada: string }>> {
    const map = new Map<string, { nama: string; pada: string }>();
    if (detailSopIds.length === 0) {
      return map;
    }
    const logs = await this.prisma.logNilaiEvaluasi.findMany({
      where: { detailSopId: { in: detailSopIds } },
      orderBy: { createdAt: 'desc' },
      select: {
        detailSopId: true,
        createdAt: true,
        pengguna: { select: { nama: true } },
      },
    });
    for (const log of logs) {
      if (map.has(log.detailSopId)) {
        continue;
      }
      map.set(log.detailSopId, {
        nama: log.pengguna.nama,
        pada: log.createdAt.toISOString(),
      });
    }
    return map;
  }
}
