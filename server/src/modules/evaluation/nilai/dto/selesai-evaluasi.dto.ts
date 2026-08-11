import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

/** Body PATCH `/evaluasi/:pengajuanEvaluasiId/selesai` — ajukan ke PJ setelah semua SOP SESUAI. */
export class SelesaiEvaluasiDto {
  @ApiProperty({
    description: 'Nomor Berita Acara yang diinputkan oleh Evaluator (wajib untuk semua evaluasi).',
  })
  @IsString()
  @IsNotEmpty()
  readonly nomorBA: string;

  @ApiPropertyOptional({
    description:
      'Skor evaluasi tingkat OPD (1–5). Wajib untuk pengajuan EVALUASI_REQUEST_EVALUATOR; untuk EVALUASI_REQUEST_OPD jangan kirim — server menyimpan tanpa skor OPD.',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  readonly nilaiOPD?: number;
}
