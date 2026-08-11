import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** GET `/evaluasi/umpan-balik/detail/:detailSopId` — umpan balik evaluasi aktif per dokumen. */
export class UmpanBalikEvaluasiDetailDto {
  @ApiProperty({ format: 'uuid' })
  readonly pengajuanEvaluasiId!: string;

  @ApiProperty({ format: 'uuid' })
  readonly detailSopId!: string;

  @ApiProperty()
  readonly pengajuanStatus!: string;

  @ApiProperty()
  readonly hasil!: string;

  @ApiProperty()
  readonly hasilLabel!: string;

  @ApiPropertyOptional({ nullable: true })
  readonly catatan!: string | null;

  @ApiPropertyOptional({ enum: ['TERBUKA', 'SELESAI'], nullable: true })
  readonly statusTindakLanjut!: string | null;

  @ApiPropertyOptional({ nullable: true })
  readonly statusTindakLanjutLabel!: string | null;

  @ApiPropertyOptional({ nullable: true })
  readonly ditindaklanjutiPada!: string | null;

  @ApiProperty()
  readonly version!: number;

  @ApiPropertyOptional({ type: () => Object })
  readonly dinilaiOleh?: { id: string; nama: string };

  @ApiPropertyOptional({ type: () => Object })
  readonly ditindaklanjutiOleh?: { id: string; nama: string };
}
