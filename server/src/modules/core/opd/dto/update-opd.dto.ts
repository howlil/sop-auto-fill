import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/** Input pembaruan nama OPD. */
export class UpdateOpdDto {
  @ApiProperty({
    example: 'Dinas Pendidikan dan Kebudayaan',
    description: 'Nama OPD yang diperbarui',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  readonly nama!: string;
}
