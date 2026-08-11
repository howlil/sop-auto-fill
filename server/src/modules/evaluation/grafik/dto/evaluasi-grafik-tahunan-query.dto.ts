import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Query GET `/evaluasi/laporan/grafik-tahunan`.
 * - `tahun`: satu tahun saja (`tahunDari` = `tahunSampai`), hanya dipakai jika `tahunDari` dan `tahunSampai` tidak dikirim.
 * - Jika semua query diabaikan, server memakai rentang 5 tahun terakhir (inklusif tahun berjalan).
 */
export class EvaluasiGrafikTahunanQueryDto {
  @ApiPropertyOptional({
    description:
      'Satu tahun kalender (data hanya tahun ini). Abaikan jika `tahunDari` atau `tahunSampai` diset.',
    example: 2025,
    minimum: 2000,
    maximum: 2100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  readonly tahun?: number;

  @ApiPropertyOptional({
    description: 'Batas bawah tahun (inklusif)',
    example: 2022,
    minimum: 2000,
    maximum: 2100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  readonly tahunDari?: number;

  @ApiPropertyOptional({
    description: 'Batas atas tahun (inklusif)',
    example: 2026,
    minimum: 2000,
    maximum: 2100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  readonly tahunSampai?: number;
}
