import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  INDONESIAN_MOBILE_CANONICAL_PATTERN,
  normalizeIndonesianMobileNumber,
} from '../../../../common/pengguna/indonesian-mobile-number.util';

/** Field profil bersama pembaruan akun pengguna. */
export class UpdatePenggunaProfilDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  readonly nama?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  readonly email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  readonly nip?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  readonly jabatan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  readonly pangkat?: string;

  @ApiPropertyOptional({
    example: '081234567890',
    description: 'Format 08... atau 628...; disimpan sebagai 628...',
  })
  @Transform(({ value }: { value: unknown }) => normalizeIndonesianMobileNumber(value) ?? value)
  @IsOptional()
  @IsString()
  @Matches(INDONESIAN_MOBILE_CANONICAL_PATTERN, {
    message: 'nohp harus memakai format 08... atau 628... dan hanya berisi digit',
  })
  readonly nohp?: string;

  @ApiPropertyOptional({ enum: ['AKTIF', 'NONAKTIF'] })
  @IsOptional()
  @IsIn(['AKTIF', 'NONAKTIF'])
  readonly status?: 'AKTIF' | 'NONAKTIF';
}
