import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/** Body penandatanganan dokumen (hash dokumen dihitung server dari field kanonik). */
export class TandaTanganiDto {
  @ApiProperty()
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  readonly pin!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  readonly nomorDokumen!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  readonly judulDokumen!: string;
}
