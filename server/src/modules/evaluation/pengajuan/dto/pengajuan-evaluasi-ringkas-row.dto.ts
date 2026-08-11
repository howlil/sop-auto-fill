import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Satu baris GET `/evaluasi/ringkas`. */
export class PengajuanEvaluasiRingkasRowDto {
  @ApiProperty({ format: 'uuid' })
  readonly pengajuanEvaluasiId!: string;

  @ApiProperty({ format: 'uuid' })
  readonly opdId!: string;

  @ApiProperty()
  readonly opdNama!: string;

  @ApiProperty({ enum: ['EVALUASI_REQUEST_EVALUATOR', 'EVALUASI_REQUEST_OPD'] })
  readonly jenis!: string;

  @ApiProperty()
  readonly status!: string;

  @ApiProperty()
  readonly statusLabel!: string;

  @ApiPropertyOptional({ description: 'ISO date-time' })
  readonly tanggalEvaluasi?: string;

  @ApiProperty({ description: 'ISO date-time pembuatan pengajuan' })
  readonly createdAt!: string;

  @ApiProperty({ description: 'Jumlah baris NilaiEvaluasi (SOP dalam pengajuan)' })
  readonly jumlahSop!: number;

  @ApiProperty({ description: 'Jumlah SOP yang sudah berisi hasil evaluasi' })
  readonly jumlahSudahDinilai!: number;

  @ApiPropertyOptional()
  readonly nilaiOPD?: number;
}
