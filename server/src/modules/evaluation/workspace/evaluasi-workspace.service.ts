import { Injectable, NotFoundException } from '@nestjs/common';
import type { JwtAccessPayload } from '../../core/auth/helpers/auth.shared';
import {
  displayHasilEvaluasi,
  displayStatusPengajuan,
  displayStatusSop,
  displayStatusTindakLanjut,
  displayTampilanAlur,
} from '../../../common/status/status-display';
import { HasilEvaluasi, PeranPengguna, StatusSOP } from '../../../generated/prisma';
import { SopCatalogService } from '../../sop/catalog/sop-catalog.service';
import { EvaluasiWorkspaceQueryDto } from './dto/evaluasi-workspace-query.dto';
import type { EvaluasiWorkspaceOpdResponseDto } from './dto/evaluasi-workspace-response.dto';
import type { EvaluasiWorkspaceLogNilaiEntryDto } from './dto/evaluasi-workspace-log-nilai-entry.dto';
import { EvaluasiWorkspaceRepository } from './evaluasi-workspace.repository';
import type { EvaluasiWorkspaceLogNilaiRepoRow } from './evaluasi-workspace.repository';
import { encodeLogNilaiEvaluasiClientId } from '../nilai/log-nilai-evaluasi-client-id';
import { PengajuanEvaluasiService } from '../pengajuan/pengajuan-evaluasi.service';

const DEFAULT_RIWAYAT_LIMIT = 30;
const PREVIEW_LOGS_LIMIT = 50;

function parseExpandFlags(expandRaw: string | undefined): Set<string> {
  const set = new Set<string>();
  if (expandRaw === undefined || expandRaw.trim() === '') {
    return set;
  }
  for (const part of expandRaw.split(',')) {
    const t = part.trim();
    if (t !== '') {
      set.add(t);
    }
  }
  return set;
}

function mapLogNilaiRepoRows(
  rows: EvaluasiWorkspaceLogNilaiRepoRow[],
): EvaluasiWorkspaceLogNilaiEntryDto[] {
  return rows.map((log) => ({
    id: encodeLogNilaiEvaluasiClientId(
      log.pengajuanEvaluasiId,
      log.detailSopId,
      log.penggunaId,
      log.createdAt,
    ),
    sopDetailId: log.detailSopId,
    evaluatorId: log.penggunaId,
    evaluatorNama: log.evaluatorNama,
    hasilSebelum:
      log.hasilSebelum === null || log.hasilSebelum === undefined
        ? undefined
        : displayHasilEvaluasi(log.hasilSebelum as HasilEvaluasi).value,
    hasilSesudah:
      log.hasilSesudah === null || log.hasilSesudah === undefined
        ? undefined
        : displayHasilEvaluasi(log.hasilSesudah as HasilEvaluasi).value,
    catatanSebelum: log.catatanSebelum ?? undefined,
    catatanSesudah: log.catatanSesudah ?? undefined,
    createdAt: log.createdAt.toISOString(),
  }));
}

function computeTampilanAlur(
  nilaiUntukDetail: { hasil: string | null } | undefined,
): 'perlu_evaluasi' | 'sedang_dievaluasi' | 'selesai_pengajuan_ini' {
  if (nilaiUntukDetail === undefined) {
    return 'perlu_evaluasi';
  }
  if (nilaiUntukDetail.hasil !== null && nilaiUntukDetail.hasil !== '') {
    return 'selesai_pengajuan_ini';
  }
  return 'sedang_dievaluasi';
}

function mapWorkspaceDaftarSopRow(
  row: {
    detailSopId: string;
    sopId: string;
    judul: string;
    nomorSOP: string;
    statusDetail: StatusSOP;
    versi: number;
    detailUpdatedAt: Date;
  },
  nilaiByDetail: Map<
    string,
    {
      hasil: string | null;
      statusTindakLanjut: string | null;
      ditindaklanjutiPada: Date | null;
    }
  >,
  evaluatorTerakhir: { nama: string; pada: string } | null,
) {
  const nilaiRow = nilaiByDetail.get(row.detailSopId);
  const statusDisplay = displayStatusSop(row.statusDetail);
  const hasilDisplay = displayHasilEvaluasi(
    nilaiRow?.hasil === null || nilaiRow?.hasil === undefined || nilaiRow.hasil === ''
      ? null
      : (nilaiRow.hasil as HasilEvaluasi),
  );
  const tampilanAlur = computeTampilanAlur(nilaiRow);
  const alurDisplay = displayTampilanAlur(tampilanAlur);
  const tindakDisplay = displayStatusTindakLanjut(nilaiRow?.statusTindakLanjut ?? null);
  return {
    detailSopId: row.detailSopId,
    sopId: row.sopId,
    judul: row.judul,
    nomorSOP: row.nomorSOP,
    statusDetail: statusDisplay.value,
    statusDetailLabel: statusDisplay.label,
    hasilEvaluasi: hasilDisplay.value,
    hasilEvaluasiLabel: hasilDisplay.label,
    tampilanAlur,
    tampilanAlurLabel: alurDisplay.label,
    statusTindakLanjut: tindakDisplay?.value ?? null,
    statusTindakLanjutLabel: tindakDisplay?.label ?? null,
    versi: row.versi,
    detailUpdatedAt: row.detailUpdatedAt.toISOString(),
    ditindaklanjutiPada: nilaiRow?.ditindaklanjutiPada?.toISOString() ?? null,
    evaluatorTerakhir,
  };
}

function mapWorkspaceNilaiPerDetail(n: {
  detailSopId: string;
  hasil: string | null;
  catatan: string | null;
  statusTindakLanjut: string | null;
  version: number;
  ditindaklanjutiPada: Date | null;
  versi: number;
  detailUpdatedAt: Date;
}) {
  const hasilDisplay = displayHasilEvaluasi(
    n.hasil === null || n.hasil === '' ? null : (n.hasil as HasilEvaluasi),
  );
  const tindakDisplay = displayStatusTindakLanjut(n.statusTindakLanjut);
  return {
    detailSopId: n.detailSopId,
    hasil: hasilDisplay.value,
    hasilLabel: hasilDisplay.label,
    catatan: n.catatan,
    statusTindakLanjut: tindakDisplay?.value ?? null,
    statusTindakLanjutLabel: tindakDisplay?.label ?? null,
    version: n.version,
    ditindaklanjutiPada: n.ditindaklanjutiPada?.toISOString() ?? null,
    versi: n.versi,
    detailUpdatedAt: n.detailUpdatedAt.toISOString(),
  };
}

function mapWorkspacePengajuanAktif(repo: {
  pengajuanEvaluasiId: string;
  status: import('../../../generated/prisma').StatusPengajuanEvaluasi;
  jenis: import('../../../generated/prisma').JenisPengajuanEvaluasi;
  version: number;
  alasanPenolakan: string | null;
  tanggalDitolak: Date | null;
  nilaiEvaluasi: ReadonlyArray<{
    detailSopId: string;
    hasil: string | null;
    catatan: string | null;
    statusTindakLanjut: string | null;
    version: number;
    ditindaklanjutiPada: Date | null;
    versi: number;
    detailUpdatedAt: Date;
  }>;
}) {
  const statusDisplay = displayStatusPengajuan(repo.status);
  return {
    id: repo.pengajuanEvaluasiId,
    status: statusDisplay.value,
    statusLabel: statusDisplay.label,
    jenis: String(repo.jenis),
    version: repo.version,
    alasanPenolakan: repo.alasanPenolakan,
    tanggalDitolak: repo.tanggalDitolak?.toISOString() ?? null,
    nilaiPerDetail: repo.nilaiEvaluasi.map((n) => mapWorkspaceNilaiPerDetail(n)),
  };
}

@Injectable()
export class EvaluasiWorkspaceService {
  constructor(
    private readonly evaluasiWorkspaceRepository: EvaluasiWorkspaceRepository,
    private readonly sopCatalogService: SopCatalogService,
    private readonly pengajuanEvaluasiService: PengajuanEvaluasiService,
  ) {}

  /** Workspace OPD milik pengguna (PJ Penyusun / Kepala OPD) — tanpa kirim opdId di URL. */
  async getWorkspaceOpdSaya(
    user: JwtAccessPayload,
    query: EvaluasiWorkspaceQueryDto,
  ): Promise<EvaluasiWorkspaceOpdResponseDto> {
    const opdId = await this.pengajuanEvaluasiService.resolveOpdIdTerikat(user);
    return this.getWorkspaceOpd(user, opdId, query);
  }

  async getWorkspaceOpd(
    user: JwtAccessPayload,
    opdId: string,
    query: EvaluasiWorkspaceQueryDto,
  ): Promise<EvaluasiWorkspaceOpdResponseDto> {
    const opdRow = await this.evaluasiWorkspaceRepository.findOpdRingkas(opdId);
    if (opdRow === null) {
      throw new NotFoundException('OPD tidak ditemukan');
    }
    await this.pengajuanEvaluasiService.assertUserCanAccessPengajuan(user, opdId);
    const riwayatLimit = query.riwayatLimit ?? DEFAULT_RIWAYAT_LIMIT;
    const includeSiapDievaluasi = user.peran === PeranPengguna.PJ_PENYUSUN;
    let [daftarRows, pengajuanAktifRepo, riwayatOpdRepo] = await Promise.all([
      this.evaluasiWorkspaceRepository.findDaftarDetailPipeline(opdId, { includeSiapDievaluasi }),
      this.evaluasiWorkspaceRepository.findPengajuanAktif(opdId),
      this.evaluasiWorkspaceRepository.findRiwayatOpdSelesai(opdId, riwayatLimit),
    ]);
    if (
      user.peran === PeranPengguna.EVALUATOR &&
      pengajuanAktifRepo === null &&
      daftarRows.length > 0
    ) {
      await this.pengajuanEvaluasiService.pastikanPengajuanRequestOpdUntukEvaluator(
        user,
        opdId,
        daftarRows,
      );
      pengajuanAktifRepo = await this.evaluasiWorkspaceRepository.findPengajuanAktif(opdId);
    }
    const detailIds = daftarRows.map((r) => r.detailSopId);
    const evaluatorMap =
      await this.evaluasiWorkspaceRepository.evaluatorTerakhirUntukDetailSop(detailIds);
    const nilaiByDetail = new Map(
      (pengajuanAktifRepo?.nilaiEvaluasi ?? []).map((n) => [n.detailSopId, n]),
    );
    const daftarSop = daftarRows.map((row) =>
      mapWorkspaceDaftarSopRow(row, nilaiByDetail, evaluatorMap.get(row.detailSopId) ?? null),
    );
    const pengajuanAktif =
      pengajuanAktifRepo === null ? null : mapWorkspacePengajuanAktif(pengajuanAktifRepo);
    const riwayatOpd = riwayatOpdRepo.map((r) => ({
      tanggal: (r.tanggalDiselesaikan ?? new Date(0)).toISOString(),
      evaluatorNama: r.evaluatorNama,
      nilaiOPD: r.nilaiOPD,
      pengajuanEvaluasiId: r.pengajuanEvaluasiId,
    }));
    const detailSopIdQuery = query.detailSopId;
    const pengajuanIdUntukLog = pengajuanAktifRepo?.pengajuanEvaluasiId;
    const logNilaiSopTerpilih =
      detailSopIdQuery === undefined ||
      pengajuanIdUntukLog === undefined ||
      !detailIds.includes(detailSopIdQuery)
        ? []
        : mapLogNilaiRepoRows(
            await this.evaluasiWorkspaceRepository.findLogNilaiUntukDetailWorkspace(
              pengajuanIdUntukLog,
              detailSopIdQuery,
              riwayatLimit,
            ),
          );
    const expand = parseExpandFlags(query.expand);
    const wantsPreview = expand.has('preview');
    let preview: EvaluasiWorkspaceOpdResponseDto['preview'] = null;
    if (wantsPreview && detailSopIdQuery !== undefined) {
      const boleh =
        (await this.evaluasiWorkspaceRepository.detailMilikiOpd(detailSopIdQuery, opdId)) &&
        detailIds.includes(detailSopIdQuery);
      if (boleh) {
        const workbench = await this.sopCatalogService.getPenyusunWorkbench(
          user,
          detailSopIdQuery,
          PREVIEW_LOGS_LIMIT,
        );
        preview = { detailSopId: detailSopIdQuery, workbench };
      }
    }
    return {
      opd: { id: opdRow.opdId, nama: opdRow.nama },
      pengajuanAktif,
      daftarSop,
      riwayatOpd,
      preview,
      logNilaiSopTerpilih,
    };
  }

  /**
   * Workspace untuk satu pengajuan evaluasi (URL stabil).
   * Daftar SOP = anggota `NilaiEvaluasi` pengajuan ini, bukan seluruh pipeline OPD.
   */
  async getWorkspacePengajuan(
    user: JwtAccessPayload,
    pengajuanEvaluasiId: string,
    query: EvaluasiWorkspaceQueryDto,
  ): Promise<EvaluasiWorkspaceOpdResponseDto> {
    const bundle =
      await this.evaluasiWorkspaceRepository.findPengajuanBundleForWorkspace(pengajuanEvaluasiId);
    if (bundle === null) {
      throw new NotFoundException('Pengajuan evaluasi tidak ditemukan');
    }
    await this.pengajuanEvaluasiService.assertUserCanAccessPengajuan(user, bundle.opdId);
    const opdRow = await this.evaluasiWorkspaceRepository.findOpdRingkas(bundle.opdId);
    if (opdRow === null) {
      throw new NotFoundException('OPD tidak ditemukan');
    }
    const riwayatLimit = query.riwayatLimit ?? DEFAULT_RIWAYAT_LIMIT;
    const detailIds = bundle.daftarRows.map((r) => r.detailSopId);
    const allowedDetail = new Set(detailIds);
    const nilaiByDetail = new Map(bundle.nilaiEvaluasi.map((n) => [n.detailSopId, n]));
    const [evaluatorMap, riwayatOpdRepo] = await Promise.all([
      this.evaluasiWorkspaceRepository.evaluatorTerakhirUntukDetailSop(detailIds),
      this.evaluasiWorkspaceRepository.findRiwayatOpdSelesai(bundle.opdId, riwayatLimit),
    ]);
    const daftarSop = bundle.daftarRows.map((row) =>
      mapWorkspaceDaftarSopRow(row, nilaiByDetail, evaluatorMap.get(row.detailSopId) ?? null),
    );
    const pengajuanAktif = mapWorkspacePengajuanAktif(bundle);
    const riwayatOpd = riwayatOpdRepo.map((r) => ({
      tanggal: (r.tanggalDiselesaikan ?? new Date(0)).toISOString(),
      evaluatorNama: r.evaluatorNama,
      nilaiOPD: r.nilaiOPD,
      pengajuanEvaluasiId: r.pengajuanEvaluasiId,
    }));
    const detailSopIdQuery = query.detailSopId;
    const logNilaiSopTerpilih =
      detailSopIdQuery === undefined || !allowedDetail.has(detailSopIdQuery)
        ? []
        : mapLogNilaiRepoRows(
            await this.evaluasiWorkspaceRepository.findLogNilaiUntukDetailWorkspace(
              bundle.pengajuanEvaluasiId,
              detailSopIdQuery,
              riwayatLimit,
            ),
          );
    const expand = parseExpandFlags(query.expand);
    const wantsPreview = expand.has('preview');
    let preview: EvaluasiWorkspaceOpdResponseDto['preview'] = null;
    if (wantsPreview && detailSopIdQuery !== undefined) {
      const boleh =
        allowedDetail.has(detailSopIdQuery) &&
        (await this.evaluasiWorkspaceRepository.detailMilikiOpd(detailSopIdQuery, bundle.opdId));
      if (boleh) {
        const workbench = await this.sopCatalogService.getPenyusunWorkbench(
          user,
          detailSopIdQuery,
          PREVIEW_LOGS_LIMIT,
        );
        preview = { detailSopId: detailSopIdQuery, workbench };
      }
    }
    return {
      opd: { id: opdRow.opdId, nama: opdRow.nama },
      pengajuanAktif,
      daftarSop,
      riwayatOpd,
      preview,
      logNilaiSopTerpilih,
    };
  }
}
