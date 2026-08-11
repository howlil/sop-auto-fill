import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Ringkas respons setelah PATCH selesai — cukup untuk invalidasi cache klien. */
export class PengajuanEvaluasiSelesaiResponseDto {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ format: 'uuid' })
  readonly opdId!: string;

  @ApiProperty()
  readonly status!: string;

  @ApiPropertyOptional()
  readonly nilaiOPD?: number;

  @ApiPropertyOptional()
  readonly tanggalEvaluasi?: string;

  @ApiPropertyOptional()
  readonly tanggalDiselesaikan?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  readonly diselesaikanOlehId?: string;

  @ApiPropertyOptional()
  readonly alasanPenolakan?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  readonly ditolakOlehId?: string;

  @ApiPropertyOptional()
  readonly tanggalDitolak?: string;

  @ApiProperty()
  readonly version!: number;

  @ApiProperty()
  readonly createdAt!: string;

  @ApiProperty()
  readonly updatedAt!: string;
}
