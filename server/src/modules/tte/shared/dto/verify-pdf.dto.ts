import { ApiProperty } from '@nestjs/swagger';
import { IsBase64, IsString, MaxLength } from 'class-validator';
import { PDF_BASE64_MAX_LENGTH } from '../../../../common/http/request-body-limits';

export class VerifyPdfDto {
  @ApiProperty({ description: 'Berkas PDF sebagai base64 tanpa prefix data URL.' })
  @IsString()
  @IsBase64()
  @MaxLength(PDF_BASE64_MAX_LENGTH)
  readonly pdfBase64!: string;
}
