import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, Matches } from 'class-validator';
import { StatusSOP } from '../../../../generated/prisma';

/** Nilai status DetailSOP + `all` (tanpa filter status). */
const STATUS_FILTER_VALUES = [...Object.values(StatusSOP), 'all'] as const;

/**
 * Query opsional untuk `GET /sop`: filter berdasarkan status versi terbaru
 * dan/atau tanggal `updatedAt` (hanya bagian tanggal, format YYYY-MM-DD).
 */
export class ListSopQueryDto {
  @ApiPropertyOptional({
    description:
      'Status DetailSOP terbaru per SOP. `all` atau tidak dikirim = tanpa filter status.',
    enum: STATUS_FILTER_VALUES,
  })
  @IsOptional()
  @IsIn(STATUS_FILTER_VALUES as unknown as string[])
  readonly status?: string;

  @ApiPropertyOptional({
    description: 'Batas bawah tanggal terakhir diperbarui (inklusif), format YYYY-MM-DD',
    example: '2026-01-01',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  readonly tanggalDari?: string;

  @ApiPropertyOptional({
    description: 'Batas atas tanggal terakhir diperbarui (inklusif), format YYYY-MM-DD',
    example: '2026-01-31',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  readonly tanggalSampai?: string;
}
