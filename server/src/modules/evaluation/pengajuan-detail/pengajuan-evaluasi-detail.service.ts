import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { JwtAccessPayload } from '../../../common';
import {
  displayHasilEvaluasi,
  displayStatusPengajuan,
  displayStatusSop,
  displayStatusTindakLanjut,
} from '../../../common/status/status-display';
import { PeranPengguna, StatusPengajuanEvaluasi } from '../../../generated/prisma';
import { encodeLogNilaiEvaluasiClientId } from '../nilai/log-nilai-evaluasi-client-id';
import { buildNilaiEvaluasiClientId } from '../nilai/nilai-evaluasi-client-id';
import { SopCatalogService } from '../../sop/catalog/sop-catalog.service';
import type {
  BeritaAcaraEvaluasiViewDto,
  BeritaAcaraTteSignaturePayloadDto,
} from './dto/berita-acara-evaluasi-view.dto';
import type { PengajuanEvaluasiShellDto } from './dto/pengajuan-evaluasi-shell.dto';
import type { PengajuanSopWorkbenchResponseDto } from './dto/pengajuan-sop-workbench-response.dto';
import { PengajuanEvaluasiDetailRepository } from './pengajuan-evaluasi-detail.repository';
import type { PengajuanEvaluasiDetailRow } from '../pengajuan/pengajuan-evaluasi.repository';
import { PengajuanEvaluasiRepository } from '../pengajuan/pengajuan-evaluasi.repository';
import { PengajuanEvaluasiService } from '../pengajuan/pengajuan-evaluasi.service';
import { shouldOmitOpdFieldsForViewer } from '../pengajuan/pengajuan-evaluasi.mapper';

const DEFAULT_LOGS_LIMIT = 100;
const STATUS_PENGAJUAN_SUDAH_DIVERIFIKASI = new Set<StatusPengajuanEvaluasi>([
  StatusPengajuanEvaluasi.DITANDATANGANI_PJ_EVALUATOR,
  StatusPengajuanEvaluasi.DITANDATANGANI_PJ_PENYUSUN,
  StatusPengajuanEvaluasi.SELESAI,
]);

@Injectable()
export class PengajuanEvaluasiDetailService {
  constructor(
    private readonly pengajuanEvaluasiRepository: PengajuanEvaluasiRepository,
    private readonly pengajuanEvaluasiDetailRepository: PengajuanEvaluasiDetailRepository,
    private readonly pengajuanEvaluasiService: PengajuanEvaluasiService,
    private readonly sopCatalogService: SopCatalogService,
  ) {}

  async getShell(
    user: JwtAccessPayload,
    pengajuanEvaluasiId: string,
  ): Promise<PengajuanEvaluasiShellDto> {
    const row = await this.pengajuanEvaluasiRepository.findByIdFull(pengajuanEvaluasiId);
    if (row === null) {
      throw new NotFoundException('Pengajuan evaluasi tidak ditemukan');
    }
    await this.pengajuanEvaluasiService.assertUserCanAccessPengajuan(user, row.opdId);
    return PengajuanEvaluasiDetailService.mapRowToShell(row, user.peran);
  }

  async getSopDokumen(
    user: JwtAccessPayload,
    pengajuanEvaluasiId: string,
    detailSopId: string,
    logsLimit?: number,
    arsip?: boolean,
  ): Promise<PengajuanSopWorkbenchResponseDto> {
    const row = await this.pengajuanEvaluasiRepository.findByIdFull(pengajuanEvaluasiId);
    if (row === null) {
      throw new NotFoundException('Pengajuan evaluasi tidak ditemukan');
    }
    await this.pengajuanEvaluasiService.assertUserCanAccessPengajuan(user, row.opdId);
    PengajuanEvaluasiDetailService.assertArsipCetakJikaDiminta(row, arsip);
    const anggota = await this.pengajuanEvaluasiDetailRepository.existsNilaiUntukDetail(
      pengajuanEvaluasiId,
      detailSopId,
    );
    if (!anggota) {
      throw new ForbiddenException('Detail SOP ini tidak termasuk pengajuan evaluasi');
    }
    const limit = logsLimit ?? DEFAULT_LOGS_LIMIT;
    const workbench = await this.sopCatalogService.getPenyusunWorkbenchForEvaluasiContext(
      detailSopId,
      limit,
    );
    const dokSop = await this.pengajuanEvaluasiDetailRepository.findDokumenSopBerlaku(detailSopId);
    let tteSignaturePayloadKepalaOpd: BeritaAcaraTteSignaturePayloadDto | undefined;
    if (dokSop !== null) {
      for (const rt of dokSop.riwayatTandaTangan) {
        if (rt.peran !== PeranPengguna.KEPALA_OPD) {
          continue;
        }
        if (rt.user === undefined || rt.user === null) {
          continue;
        }
        tteSignaturePayloadKepalaOpd =
          PengajuanEvaluasiDetailService.mapRiwayatToSignaturePayload(rt);
        break;
      }
    }
    return { detailSopId, workbench, tteSignaturePayloadKepalaOpd };
  }

  private static mapRiwayatToSignaturePayload(rt: {
    userId: string;
    dokumenTteId: string;
    ditandatanganiPada: Date;
    user: { nama: string; nip: string; jabatan: string };
  }): BeritaAcaraTteSignaturePayloadDto {
    return {
      id: `${rt.dokumenTteId}:${rt.userId}`,
      dokumenTteId: rt.dokumenTteId,
      userId: rt.userId,
      nip: rt.user.nip,
      namaLengkap: rt.user.nama,
      jabatan: rt.user.jabatan,
      signedAt: rt.ditandatanganiPada.toISOString(),
    };
  }

  async getBeritaAcaraView(
    user: JwtAccessPayload,
    pengajuanEvaluasiId: string,
    arsip?: boolean,
  ): Promise<BeritaAcaraEvaluasiViewDto> {
    const row = await this.pengajuanEvaluasiRepository.findByIdFull(pengajuanEvaluasiId);
    if (row === null) {
      throw new NotFoundException('Pengajuan evaluasi tidak ditemukan');
    }
    await this.pengajuanEvaluasiService.assertUserCanAccessPengajuan(user, row.opdId);
    PengajuanEvaluasiDetailService.assertArsipCetakJikaDiminta(row, arsip);
    const dokTte =
      await this.pengajuanEvaluasiDetailRepository.findDokumenBeritaAcara(pengajuanEvaluasiId);
    const dokBa = row.dokumenTte[0];
    const nomorBA =
      row.nomorBA ?? (dokBa !== undefined && dokBa !== null ? dokBa.nomorDokumen : undefined);
    const hasilPerSop = [...row.nilaiEvaluasi]
      .map((n) => {
        const hasilDisplay = displayHasilEvaluasi(n.hasil);
        return {
          nomorSOP: n.detailSop.nomorSOP,
          judul: n.detailSop.sop.judul,
          hasilEvaluasi: hasilDisplay.value,
          hasilEvaluasiLabel: hasilDisplay.label,
          ringkasanCatatanEvaluator: n.catatan ?? undefined,
        };
      })
      .sort((a, b) => a.nomorSOP.localeCompare(b.nomorSOP, 'id', { numeric: true }));
    const namaEvaluatorSet = new Set<string>();
    for (const n of row.nilaiEvaluasi) {
      if (
        n.dinilaiOleh !== undefined &&
        n.dinilaiOleh !== null &&
        n.dinilaiOleh.nama.trim() !== ''
      ) {
        namaEvaluatorSet.add(n.dinilaiOleh.nama.trim());
      }
    }
    const tanggalVerifikasiPjEvaluator = STATUS_PENGAJUAN_SUDAH_DIVERIFIKASI.has(row.status)
      ? row.updatedAt.toISOString()
      : undefined;
    let tteBeritaAcara: BeritaAcaraEvaluasiViewDto['tteBeritaAcara'];
    if (dokTte !== null) {
      const adaRiwayatTandaTanganPerPeran: Record<string, boolean> = Object.fromEntries(
        Object.values(PeranPengguna).map((p) => [p, false]),
      );
      let payloadPjEvaluator:
        | {
            id: string;
            dokumenTteId: string;
            userId: string;
            nip: string;
            namaLengkap: string;
            jabatan?: string;
            signedAt?: string;
          }
        | undefined;
      let payloadPjPenyusun:
        | {
            id: string;
            dokumenTteId: string;
            userId: string;
            nip: string;
            namaLengkap: string;
            jabatan?: string;
            signedAt?: string;
          }
        | undefined;
      for (const rt of dokTte.riwayatTandaTangan) {
        adaRiwayatTandaTanganPerPeran[rt.peran] = true;
        if (rt.user === undefined || rt.user === null) {
          continue;
        }
        if (rt.peran === PeranPengguna.PJ_EVALUATOR && payloadPjEvaluator === undefined) {
          payloadPjEvaluator = PengajuanEvaluasiDetailService.mapRiwayatToSignaturePayload(rt);
        }
        if (rt.peran === PeranPengguna.PJ_PENYUSUN && payloadPjPenyusun === undefined) {
          payloadPjPenyusun = PengajuanEvaluasiDetailService.mapRiwayatToSignaturePayload(rt);
        }
      }
      tteBeritaAcara = {
        dokumenTteId: dokTte.dokumenTteId,
        hashDokumen: dokTte.hashDokumen,
        versiDokumen: dokTte.versiDokumen,
        adaRiwayatTandaTanganPerPeran,
        payloadPjEvaluator,
        payloadPjPenyusun,
      };
    }
    return {
      namaOpd: row.opd.nama,
      nomorBA,
      tanggalEvaluasi: row.tanggalEvaluasi?.toISOString(),
      tanggalVerifikasiPjEvaluator,
      nilaiKeseluruhanOpd: row.nilaiOPD ?? undefined,
      hasilPerSop,
      timEvaluasi: {
        penanggungJawabSelesai:
          row.diselesaikanOleh !== null && row.diselesaikanOleh !== undefined
            ? {
                id: row.diselesaikanOleh.penggunaId,
                nama: row.diselesaikanOleh.nama,
              }
            : undefined,
        evaluatorNamaUnik: [...namaEvaluatorSet.values()].sort((a, b) => a.localeCompare(b, 'id')),
      },
      tteBeritaAcara,
    };
  }

  private static mapRowToShell(
    row: PengajuanEvaluasiDetailRow,
    viewerPeran?: string,
  ): PengajuanEvaluasiShellDto {
    const dokBa = row.dokumenTte[0];
    const nomorBA =
      row.nomorBA ?? (dokBa !== undefined && dokBa !== null ? dokBa.nomorDokumen : undefined);
    const sopItems = row.nilaiEvaluasi.map((n) => {
      const statusDisplay = displayStatusSop(n.detailSop.status);
      const hasilDisplay = displayHasilEvaluasi(n.hasil);
      return {
        detailSopId: n.detailSopId,
        sopId: n.detailSop.sop.sopId,
        judul: n.detailSop.sop.judul,
        nomorSOP: n.detailSop.nomorSOP,
        statusDetailSop: statusDisplay.value,
        statusDetailSopLabel: statusDisplay.label,
        hasilEvaluasi: hasilDisplay.value,
        hasilEvaluasiLabel: hasilDisplay.label,
        catatanRingkas: n.catatan ?? undefined,
        evaluatorTerakhir:
          n.dinilaiOleh !== null && n.dinilaiOleh !== undefined
            ? { id: n.dinilaiOleh.penggunaId, nama: n.dinilaiOleh.nama }
            : undefined,
      };
    });
    const nilaiEvaluasi = row.nilaiEvaluasi.map((n) => {
      const tindakDisplay = displayStatusTindakLanjut(n.statusTindakLanjut);
      return {
        id: buildNilaiEvaluasiClientId(row.pengajuanEvaluasiId, n.detailSopId),
        pengajuanEvaluasiId: row.pengajuanEvaluasiId,
        sopDetailId: n.detailSopId,
        hasil: displayHasilEvaluasi(n.hasil).value,
        catatan: n.catatan ?? undefined,
        statusTindakLanjut: tindakDisplay?.value,
        statusTindakLanjutLabel: tindakDisplay?.label,
        ditindaklanjutiPada: n.ditindaklanjutiPada?.toISOString(),
        version: n.version,
        dinilaiOlehId: n.dinilaiOlehId ?? undefined,
        dinilaiOleh:
          n.dinilaiOleh !== null && n.dinilaiOleh !== undefined
            ? { id: n.dinilaiOleh.penggunaId, nama: n.dinilaiOleh.nama }
            : undefined,
        sopDetail: { id: n.detailSopId },
        createdAt: n.createdAt.toISOString(),
        updatedAt: n.updatedAt.toISOString(),
      };
    });
    const timelineNilai = row.logNilaiEvaluasi.map((log) => ({
      id: encodeLogNilaiEvaluasiClientId(
        log.pengajuanEvaluasiId,
        log.detailSopId,
        log.penggunaId,
        log.createdAt,
      ),
      sopDetailId: log.detailSopId,
      evaluatorId: log.penggunaId,
      evaluatorNama: log.pengguna.nama,
      hasilSebelum:
        log.hasilSebelum === null || log.hasilSebelum === undefined
          ? undefined
          : displayHasilEvaluasi(log.hasilSebelum).value,
      hasilSesudah:
        log.hasilSesudah === null || log.hasilSesudah === undefined
          ? undefined
          : displayHasilEvaluasi(log.hasilSesudah).value,
      catatanSebelum: log.catatanSebelum ?? undefined,
      catatanSesudah: log.catatanSesudah ?? undefined,
      createdAt: log.createdAt.toISOString(),
    }));
    const tanggalVerifikasi = STATUS_PENGAJUAN_SUDAH_DIVERIFIKASI.has(row.status)
      ? row.updatedAt.toISOString()
      : undefined;
    const statusDisplay = displayStatusPengajuan(row.status);
    const omitOpdFields = shouldOmitOpdFieldsForViewer(viewerPeran);
    return {
      id: row.pengajuanEvaluasiId,
      jenis: String(row.jenis),
      status: statusDisplay.value,
      statusLabel: statusDisplay.label,
      version: row.version,
      nomorBA,
      tanggalPermintaan: row.tanggalPermintaan?.toISOString(),
      tanggalEvaluasi: row.tanggalEvaluasi?.toISOString(),
      tanggalVerifikasi,
      diverifikasiOlehUserId: row.diverifikasiOlehUserId ?? undefined,
      namaPjEvaluator: row.diverifikasiOlehUser?.nama ?? row.diselesaikanOleh?.nama ?? undefined,
      ditandatanganiOlehPjPenyusunUserId: row.ditandatanganiOlehPjPenyusunUserId ?? undefined,
      namaPjPenyusun: row.ditandatanganiOlehPjPenyusunUser?.nama ?? undefined,
      tanggalTTDBaPjPenyusun: row.tanggalTTDBaPjPenyusun?.toISOString(),
      diselesaikanOlehId: row.diselesaikanOlehId ?? undefined,
      diselesaikanOleh:
        row.diselesaikanOleh !== null && row.diselesaikanOleh !== undefined
          ? { id: row.diselesaikanOleh.penggunaId, nama: row.diselesaikanOleh.nama }
          : undefined,
      timEvaluasi: row.diselesaikanOleh?.nama ?? '',
      tanggalDiselesaikan: row.tanggalDiselesaikan?.toISOString(),
      alasanPenolakan: row.alasanPenolakan ?? undefined,
      tanggalDitolak: row.tanggalDitolak?.toISOString(),
      ditolakOlehId: row.ditolakOlehId ?? undefined,
      ditolakOleh:
        row.ditolakOleh !== null && row.ditolakOleh !== undefined
          ? { id: row.ditolakOleh.penggunaId, nama: row.ditolakOleh.nama }
          : undefined,
      sopItems,
      nilaiEvaluasi,
      timelineNilai,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      ...(omitOpdFields
        ? {}
        : {
            opdId: row.opdId,
            opdNama: row.opd.nama,
            nilaiOPD: row.nilaiOPD ?? undefined,
            opd: { id: row.opd.opdId, nama: row.opd.nama },
          }),
    };
  }

  private static assertArsipCetakJikaDiminta(
    row: PengajuanEvaluasiDetailRow,
    arsip?: boolean,
  ): void {
    if (arsip !== true) {
      return;
    }
    if (row.status !== StatusPengajuanEvaluasi.SELESAI) {
      throw new ForbiddenException(
        'Cetak arsip hanya tersedia setelah seluruh SOP ditandatangani Kepala OPD (status pengajuan selesai).',
      );
    }
  }
}
