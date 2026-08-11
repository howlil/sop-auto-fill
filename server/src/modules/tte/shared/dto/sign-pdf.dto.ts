import { ApiProperty } from '@nestjs/swagger';
import { IsBase64, IsEnum, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { PDF_BASE64_MAX_LENGTH } from '../../../../common/http/request-body-limits';
import { JenisDokumenTte } from '../../../../generated/prisma';

export class SignPdfDto {
  @ApiProperty({ example: '1234', description: 'PIN TTE milik pengguna untuk mendekripsi P12' })
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  readonly pin!: string;

  @ApiProperty()
  @IsUUID()
  readonly dokumenTteId!: string;

  @ApiProperty()
  @IsUUID()
  readonly userId!: string;

  @ApiProperty({ enum: JenisDokumenTte })
  @IsEnum(JenisDokumenTte)
  readonly jenisDokumen!: JenisDokumenTte;

  @ApiProperty({ description: 'PDF source as base64 without data URL prefix.' })
  @IsString()
  @IsBase64()
  @MaxLength(PDF_BASE64_MAX_LENGTH)
  readonly pdfBase64!: string;
}
