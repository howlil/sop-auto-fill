import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/** Body pendaftaran PIN TTE — identitas pengambil dari JWT + baris Pengguna. */
export class RegisterTteDto {
  @ApiProperty({ example: '1234', description: 'PIN verifikasi penandatanganan TTE internal' })
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  readonly pin!: string;
}
