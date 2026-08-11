import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBase64,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PDF_BASE64_MAX_LENGTH } from '../../../../common/http/request-body-limits';
import { TandaTanganiDto } from './tanda-tangani.dto';

const MAX_SOP_PER_PENGAJUAN = 100;

export class SopOfficialPdfDto {
  @ApiProperty()
  @IsUUID()
  readonly detailSopId!: string;

  @ApiProperty({
    description: 'PDF hasil renderer kanvas SOP sebagai base64 tanpa prefix data URL.',
  })
  @IsString()
  @IsBase64()
  @MaxLength(PDF_BASE64_MAX_LENGTH)
  readonly pdfBase64!: string;
}

export class TandaTanganiSemuaSopDto extends TandaTanganiDto {
  @ApiProperty({ type: [SopOfficialPdfDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SOP_PER_PENGAJUAN)
  @ValidateNested({ each: true })
  @Type(() => SopOfficialPdfDto)
  readonly sopPdfs!: SopOfficialPdfDto[];
}
