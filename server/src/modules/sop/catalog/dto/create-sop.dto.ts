import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateSopDto {
  @ApiProperty({ format: 'uuid', description: 'Workspace tempat SOP disimpan' })
  @IsUUID()
  readonly workspaceId!: string;

  @ApiProperty({ description: 'Judul SOP' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(500)
  readonly judul!: string;

  @ApiProperty({ description: 'Nomor SOP pada versi pertama' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(255)
  readonly nomorSop!: string;

  @ApiPropertyOptional({ description: 'Nama lembaga pada dokumen SOP' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  readonly namaLembaga?: string;
}
