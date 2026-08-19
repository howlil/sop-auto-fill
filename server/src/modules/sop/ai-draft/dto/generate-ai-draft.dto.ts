import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const trimOptionalString = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

export class GenerateAiDraftDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  readonly workspaceId!: string;

  @ApiProperty({ minLength: 20, maxLength: 8000 })
  @Transform(trimString)
  @IsString()
  @MinLength(20)
  @MaxLength(8000)
  readonly deskripsiProses!: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  readonly tujuanProses?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  readonly catatanTambahan?: string;
}
