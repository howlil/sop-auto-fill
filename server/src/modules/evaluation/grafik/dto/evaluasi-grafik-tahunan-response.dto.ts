import { ApiProperty } from '@nestjs/swagger';
import { EvaluasiGrafikTahunanDaftarOpdDto } from './evaluasi-grafik-tahunan-daftar-opd.dto';
import { EvaluasiGrafikTahunanRingkasanTahunDto } from './evaluasi-grafik-tahunan-ringkasan-tahun.dto';

/** Respons GET `/evaluasi/laporan/grafik-tahunan`. */
export class EvaluasiGrafikTahunanResponseDto {
  @ApiProperty({ description: 'Jumlah OPD aktif (tidak terhapus lunak)' })
  readonly totalOpdAktif!: number;

  @ApiProperty({ type: () => [EvaluasiGrafikTahunanDaftarOpdDto] })
  readonly daftarOpd!: EvaluasiGrafikTahunanDaftarOpdDto[];

  @ApiProperty({
    type: () => [EvaluasiGrafikTahunanRingkasanTahunDto],
    description: 'Satu entri per tahun dalam rentang; tahun tanpa data berisi perOpd dengan nol',
  })
  readonly ringkasanPerTahun!: EvaluasiGrafikTahunanRingkasanTahunDto[];
}
