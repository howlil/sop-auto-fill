import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EvaluasiGrafikTahunanPerOpdDto } from './evaluasi-grafik-tahunan-per-opd.dto';

/** Ringkasan agregat satu tahun + baris per OPD (seluruh OPD aktif). */
export class EvaluasiGrafikTahunanRingkasanTahunDto {
  @ApiProperty()
  readonly tahun!: number;

  @ApiProperty({ description: 'Total pengajuan evaluasi (penilaian) dalam tahun ini' })
  readonly totalPenilaian!: number;

  @ApiProperty({ description: 'Banyak OPD yang memiliki minimal satu penilaian pada tahun ini' })
  readonly jumlahOpdDenganPenilaian!: number;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Rata-rata skor antar-OPD: mean dari rataRataSkor tiap OPD yang memiliki nilai tidak null',
  })
  readonly rataRataSkorOpd!: number | null;

  @ApiProperty({ type: () => [EvaluasiGrafikTahunanPerOpdDto] })
  readonly perOpd!: EvaluasiGrafikTahunanPerOpdDto[];
}
