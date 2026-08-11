import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/** Body ubah kata sandi pengguna yang sedang login. */
export class ChangePasswordDto {
  @ApiProperty({ example: 'KataSandiLama123', description: 'Kata sandi saat ini' })
  @IsString({ message: 'Kata sandi lama wajib diisi' })
  @MinLength(1, { message: 'Kata sandi lama wajib diisi' })
  readonly kataSandiLama!: string;

  @ApiProperty({ example: 'KataSandiBaru456', description: 'Kata sandi baru (minimal 8 karakter)' })
  @IsString({ message: 'Kata sandi baru wajib diisi' })
  @MinLength(8, { message: 'Kata sandi baru minimal 8 karakter' })
  readonly kataSandiBaru!: string;
}
