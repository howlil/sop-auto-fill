import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/** Input pembuatan OPD baru (hanya nama). */
export class CreateOpdDto {
  @ApiProperty({ example: 'Dinas Pendidikan', description: 'Nama organisasi perangkat daerah' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  readonly nama!: string;
}
