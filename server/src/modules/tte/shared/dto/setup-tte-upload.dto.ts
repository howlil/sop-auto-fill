import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/** Body setup awal TTE: unggah sertifikat P12 dari BSrE + atur PIN dalam satu request. */
export class SetupTteUploadDto {
  @ApiProperty({ example: '1234', description: 'PIN TTE yang akan digunakan' })
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
