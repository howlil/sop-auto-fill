import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UploadP12Dto {
  @ApiProperty({
    example: '1234',
    description: 'PIN TTE saat ini untuk memverifikasi dan mengenkripsi P12',
  })
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  readonly pin!: string;

  @ApiProperty({
    example: 'passphrase123',
    description: 'Passphrase asli dari file P12 yang diunggah',
  })
  @IsString()
  readonly p12Passphrase!: string;
}
