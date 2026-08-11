import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreatePelaksanaDto {
  @ApiPropertyOptional({ description: 'OPD target; jika diisi harus sama dengan OPD pengguna' })
  @IsOptional()
  @IsUUID()
  readonly opdId?: string;

  @ApiProperty({ description: 'Nama pelaksana / aktor SOP' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(255)
  readonly namaPelaksana!: string;
}
