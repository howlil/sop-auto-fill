import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import {
  INDONESIAN_MOBILE_CANONICAL_PATTERN,
  normalizeIndonesianMobileNumber,
} from '../../../../common/pengguna/indonesian-mobile-number.util';

/** Field profil bersama pembuatan akun pengguna (penyusun, kepala OPD, evaluator). */
export class CreatePenggunaProfilDto {
  @ApiProperty({ example: 'Budi Penyusun' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  readonly nama!: string;

  @ApiProperty({ example: '198001012010011001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  readonly nip!: string;

  @ApiProperty({ example: 'budi@pemda.go.id' })
  @IsEmail()
  @MaxLength(255)
  readonly email!: string;

  @ApiProperty({ example: 'Analis Kebijakan' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  readonly jabatan!: string;

  @ApiProperty({ example: 'IV/a' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  readonly pangkat!: string;

  @ApiProperty({
    example: '081234567890',
    description: 'Format 08... atau 628...; disimpan sebagai 628...',
  })
  @Transform(({ value }: { value: unknown }) => normalizeIndonesianMobileNumber(value) ?? value)
  @IsString()
  @IsNotEmpty()
  @Matches(INDONESIAN_MOBILE_CANONICAL_PATTERN, {
    message: 'nohp harus memakai format 08... atau 628... dan hanya berisi digit',
  })
  readonly nohp!: string;
}
