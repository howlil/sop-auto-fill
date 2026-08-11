import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

function trimSearch(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Query bersama daftar arsip publik (OPD / SOP). */
export class PublicArsipQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Pencarian substring (nama OPD atau judul/nomor SOP)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => trimSearch(value))
  search?: string;
}
