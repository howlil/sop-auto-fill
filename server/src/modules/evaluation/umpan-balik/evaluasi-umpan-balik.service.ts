import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { JwtAccessPayload } from '../../../common';
import {
  displayHasilEvaluasi,
  displayStatusTindakLanjut,
} from '../../../common/status/status-display';
import { HasilEvaluasi, PeranPengguna } from '../../../generated/prisma';
import type { UmpanBalikEvaluasiDetailDto } from './dto/umpan-balik-evaluasi-detail.dto';
import { EvaluasiNilaiService } from '../nilai/evaluasi-nilai.service';
import { PengajuanEvaluasiRepository } from '../pengajuan/pengajuan-evaluasi.repository';

@Injectable()
export class EvaluasiUmpanBalikService {
  constructor(
    private readonly evaluasiNilaiService: EvaluasiNilaiService,
    private readonly pengajuanEvaluasiRepository: PengajuanEvaluasiRepository,
  ) {}

  async getUmpanBalikForDetail(
    user: JwtAccessPayload,
    detailSopId: string,
  ): Promise<UmpanBalikEvaluasiDetailDto | null> {
    const allowed = new Set<PeranPengguna>([
      PeranPengguna.PENYUSUN,
      PeranPengguna.PJ_PENYUSUN,
      PeranPengguna.KEPALA_OPD,
    ]);
    if (!allowed.has(user.peran)) {
      throw new ForbiddenException('Peran tidak berhak melihat umpan balik evaluasi');
    }
    const opdId = await this.pengajuanEvaluasiRepository.findOpdIdPengguna(user.sub);
    if (opdId === null) {
      throw new ForbiddenException('OPD pengguna tidak ditemukan');
    }
    const detailOpdId = await this.evaluasiNilaiService.findOpdIdByDetailSopId(detailSopId);
    if (detailOpdId === null) {
      throw new NotFoundException('Detail SOP tidak ditemukan');
    }
    if (detailOpdId !== opdId) {
      throw new ForbiddenException('Akses ditolak untuk SOP ini');
    }
    const row = await this.evaluasiNilaiService.findUmpanBalikForDetail(detailSopId, opdId);
    if (row === null) {
      return null;
    }
    const hasilDisplay = displayHasilEvaluasi(row.hasil ?? HasilEvaluasi.PERLU_PERBAIKAN);
    const tindakDisplay = displayStatusTindakLanjut(row.statusTindakLanjut);
    return {
      pengajuanEvaluasiId: row.pengajuanEvaluasiId,
      detailSopId: row.detailSopId,
      pengajuanStatus: String(row.pengajuanEvaluasi.status),
      hasil: hasilDisplay.value,
      hasilLabel: hasilDisplay.label,
      catatan: row.catatan,
      statusTindakLanjut: tindakDisplay?.value ?? null,
      statusTindakLanjutLabel: tindakDisplay?.label ?? null,
      ditindaklanjutiPada: row.ditindaklanjutiPada?.toISOString() ?? null,
      version: row.version,
      dinilaiOleh:
        row.dinilaiOleh !== null
          ? { id: row.dinilaiOleh.penggunaId, nama: row.dinilaiOleh.nama }
          : undefined,
      ditindaklanjutiOleh:
        row.ditindaklanjutiOleh !== null
          ? { id: row.ditindaklanjutiOleh.penggunaId, nama: row.ditindaklanjutiOleh.nama }
          : undefined,
    };
  }
}
