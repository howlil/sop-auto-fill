import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches } from 'class-validator';
import {
  INDONESIAN_MOBILE_CANONICAL_PATTERN,
  normalizeIndonesianMobileNumber,
} from '../../../../common/pengguna/indonesian-mobile-number.util';

/** Body pembaruan nomor HP untuk pengguna yang sedang login. */
export class UpdateMyPhoneDto {
  @ApiProperty({
    example: '081234567890',
    description: 'Format 08... atau 628...; disimpan sebagai 628...',
  })
  @Transform(({ value }: { value: unknown }) => normalizeIndonesianMobileNumber(value) ?? value)
  @IsString({ message: 'Nomor HP wajib berupa teks' })
  @IsNotEmpty({ message: 'Nomor HP wajib diisi' })
  @Matches(INDONESIAN_MOBILE_CANONICAL_PATTERN, {
    message: 'Nomor HP harus memakai format 08... atau 628... dan hanya berisi 9-15 digit',
  })
  readonly nohp!: string;
}
