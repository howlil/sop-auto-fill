import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Satu baris nilai evaluasi per DetailSOP dalam pengajuan aktif. */
export class EvaluasiWorkspaceNilaiPerDetailDto {
  @ApiProperty({ format: 'uuid' })
  readonly detailSopId!: string;

  @ApiProperty({ description: 'SESUAI | PERLU_PERBAIKAN | BELUM_DINILAI (turunan API)' })
  readonly hasil!: string;

  @ApiProperty()
  readonly hasilLabel!: string;

  @ApiPropertyOptional({ nullable: true })
  readonly catatan!: string | null;

  @ApiPropertyOptional({ enum: ['TERBUKA', 'SELESAI'], nullable: true })
  readonly statusTindakLanjut!: string | null;

  @ApiPropertyOptional({ nullable: true })
  readonly statusTindakLanjutLabel!: string | null;

  @ApiProperty()
  readonly version!: number;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  readonly ditindaklanjutiPada!: string | null;

  @ApiProperty()
  readonly versi!: number;

  @ApiProperty({ format: 'date-time' })
  readonly detailUpdatedAt!: string;
}
