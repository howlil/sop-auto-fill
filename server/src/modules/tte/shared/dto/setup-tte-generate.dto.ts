import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/** Body setup awal TTE: buat sertifikat P12 otomatis + atur PIN dalam satu request. */
export class SetupTteGenerateDto {
  @ApiProperty({ example: '1234', description: 'PIN TTE yang akan digunakan' })
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  readonly pin!: string;
}
