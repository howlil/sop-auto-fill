import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

function parseArsipFlag(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (value === true || value === 'true' || value === '1') {
    return true;
  }
  if (value === false || value === 'false' || value === '0') {
    return false;
  }
  return undefined;
}

/** Query opsional `arsip` untuk GET dokumen pengajuan (cetak arsip). */
export class PengajuanArsipQueryDto {
  @ApiPropertyOptional({
    description:
      'Jika true, hanya diizinkan bila PengajuanEvaluasi.status = SELESAI (semua TTE lengkap).',
  })
  @IsOptional()
  @Transform(({ value }) => parseArsipFlag(value))
  @IsBoolean()
  readonly arsip?: boolean;
}
