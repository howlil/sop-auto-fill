import { BadRequestException, Injectable } from '@nestjs/common';
import type { EvaluasiGrafikAggRow, EvaluasiGrafikOpdAktifRow } from './evaluasi-grafik.repository';
import { EvaluasiGrafikRepository } from './evaluasi-grafik.repository';
import { EvaluasiGrafikTahunanQueryDto } from './dto/evaluasi-grafik-tahunan-query.dto';
import type { EvaluasiGrafikTahunanResponseDto } from './dto/evaluasi-grafik-tahunan-response.dto';
import { isNilaiOpdSkorValid } from '../nilai/nilai-opd-skor.constants';

/** Membulatkan skor ke dua angka di belakang koma (konsisten dengan tampilan KPI). */
function roundSkor(n: number): number {
  return Math.round(n * 100) / 100;
}

function toSkorDariDb(v: unknown): number | null {
  if (v == null) {
    return null;
  }
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || !isNilaiOpdSkorValid(Math.round(n))) {
    return null;
  }
  return roundSkor(n);
}

function toJumlahEvaluasi(v: bigint | number): number {
  if (typeof v === 'bigint') {
    return Number(v);
  }
  return v;
}

/**
 * Laporan grafik evaluasi tahunan untuk PJ Evaluator.
 *
 * - Hanya pengajuan berstatus selesai dari sisi evaluator ke depan (biro / tte / selesai).
 * - Tahun dihitung dari COALESCE(tanggalDiselesaikan, tanggalEvaluasi, createdAt).
 * - `rataRataSkorOpd` pada satu tahun = rata-rata aritmetika dari rata-rata skor per OPD
 *   yang memiliki nilai tidak null (selaras dengan agregasi lama di klien).
 */
@Injectable()
export class EvaluasiGrafikService {
  constructor(private readonly evaluasiGrafikRepository: EvaluasiGrafikRepository) {}

  async getGrafikTahunan(
    query: EvaluasiGrafikTahunanQueryDto,
  ): Promise<EvaluasiGrafikTahunanResponseDto> {
    const { tahunDari, tahunSampai } = this.resolveRentangTahun(query);
    if (tahunDari > tahunSampai) {
      throw new BadRequestException('tahunDari tidak boleh lebih besar dari tahunSampai');
    }
    const [daftarOpd, aggRows] = await Promise.all([
      this.evaluasiGrafikRepository.findDaftarOpdAktif(),
      this.evaluasiGrafikRepository.findAgregasiPerTahunOpd(tahunDari, tahunSampai),
    ]);
    return this.buildResponse(daftarOpd, aggRows, tahunDari, tahunSampai);
  }

  private resolveRentangTahun(queryEval: EvaluasiGrafikTahunanQueryDto): {
    tahunDari: number;
    tahunSampai: number;
  } {
    const tahunBerjalan = new Date().getFullYear();
    const dariOpsional = queryEval.tahunDari;
    const sampaiOpsional = queryEval.tahunSampai;
    const adaParameterRentangEksplisit = dariOpsional !== undefined || sampaiOpsional !== undefined;
    if (!adaParameterRentangEksplisit && queryEval.tahun !== undefined) {
      return { tahunDari: queryEval.tahun, tahunSampai: queryEval.tahun };
    }
    if (dariOpsional === undefined && sampaiOpsional === undefined) {
      return { tahunDari: tahunBerjalan - 4, tahunSampai: tahunBerjalan };
    }
    if (dariOpsional !== undefined && sampaiOpsional === undefined) {
      return { tahunDari: dariOpsional, tahunSampai: tahunBerjalan };
    }
    if (dariOpsional === undefined && sampaiOpsional !== undefined) {
      return { tahunDari: sampaiOpsional - 4, tahunSampai: sampaiOpsional };
    }
    return { tahunDari: dariOpsional as number, tahunSampai: sampaiOpsional as number };
  }

  private buildResponse(
    daftarOpd: EvaluasiGrafikOpdAktifRow[],
    aggRows: EvaluasiGrafikAggRow[],
    tahunDari: number,
    tahunSampai: number,
  ): EvaluasiGrafikTahunanResponseDto {
    const aggByTahunOpd = new Map<string, EvaluasiGrafikAggRow>();
    for (const row of aggRows) {
      aggByTahunOpd.set(`${row.tahun}:${row.opdId}`, row);
    }
    const ringkasanPerTahun: EvaluasiGrafikTahunanResponseDto['ringkasanPerTahun'] = [];
    for (let tahun = tahunDari; tahun <= tahunSampai; tahun += 1) {
      const perOpd = daftarOpd.map((opd) => {
        const key = `${tahun}:${opd.opdId}`;
        const r = aggByTahunOpd.get(key);
        const jumlahEvaluasi = r ? toJumlahEvaluasi(r.jumlahEvaluasi) : 0;
        const rataRataSkor = r ? toSkorDariDb(r.rataRataSkor) : null;
        return {
          opdId: opd.opdId,
          opdNama: opd.nama,
          jumlahEvaluasi,
          rataRataSkor,
        };
      });
      const totalPenilaian = perOpd.reduce((s, p) => s + p.jumlahEvaluasi, 0);
      const jumlahOpdDenganPenilaian = perOpd.filter((p) => p.jumlahEvaluasi > 0).length;
      const skorUntukMean = perOpd
        .map((p) => p.rataRataSkor)
        .filter((v): v is number => v !== null);
      let rataRataSkorOpd: number | null = null;
      if (skorUntukMean.length > 0) {
        const sum = skorUntukMean.reduce((a, b) => a + b, 0);
        rataRataSkorOpd = roundSkor(sum / skorUntukMean.length);
      }
      ringkasanPerTahun.push({
        tahun,
        totalPenilaian,
        jumlahOpdDenganPenilaian,
        rataRataSkorOpd,
        perOpd,
      });
    }
    return {
      totalOpdAktif: daftarOpd.length,
      daftarOpd: daftarOpd.map((o) => ({ opdId: o.opdId, opdNama: o.nama })),
      ringkasanPerTahun,
    };
  }
}
